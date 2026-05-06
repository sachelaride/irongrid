/**
 * IPAMDiscoveryService - Descoberta Multi-Protocolo de IPs
 * 
 * Combina quatro técnicas de descoberta:
 *  1. ICMP Ping (padrão, bloqueado por muitos firewalls)
 *  2. TCP Port Scan (fallback para quando ICMP é bloqueado)
 *  3. ARP Scan (via arp-scan ou tabela ARP local — só na mesma LAN)
 *  4. SNMP ARP Table (consulta tabelas ARP de roteadores cadastrados — passa pelo firewall)
 */
import { exec } from 'child_process';
import { promisify } from 'util';
// net-snmp types are incomplete — use require to avoid TS errors
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snmp = require('net-snmp') as any;
import * as net from 'net';
import { prisma } from '../utils/prisma';
import { sanitizeSnmpString } from '../utils/string';
import { IPAddressStatus } from '@prisma/client';

const execAsync = promisify(exec);

export interface DiscoveryResult {
    ip: string;
    alive: boolean;
    method: 'icmp' | 'tcp' | 'arp' | 'snmp' | 'unknown';
    hostname?: string;
    mac?: string;
    latency?: number;
}

// ─── Portas TCP para detectar dispositivos ativos ────────────────────
const COMMON_PORTS = [
    // Serviços básicos de rede
    21, 22, 23, 25, 53, 67, 69, 80, 110, 111, 119, 123, 137, 138, 139,
    143, 161, 179, 389, 427, 443, 445, 465, 500, 514, 515, 520, 587, 636,
    989, 990,
    // Windows / Active Directory
    88, 135, 389, 464, 593, 636, 3268, 3269,
    // Remote access
    3389, 5900, 8080, 8443,
    // Virtualização / Infraestrutura
    902, 903, 8006, 9443, 6443,
    // Bancos de dados
    1433, 1521, 2049, 2181, 2379, 2483, 2484, 3306, 5432, 6379, 7001, 27017, 28017,
    // Aplicações web / dev
    3000, 4000, 5000, 5601, 7002, 8000, 8008, 8081, 8888, 9000, 9090,
    // Storage / backup
    3260, 111,
    // Syslog
    514,
];

// ─── OID da tabela ARP (ipNetToMediaPhysAddress) ─────────────────────
const ARP_TABLE_OID = '1.3.6.1.2.1.4.22.1.2';

/* ────────────────────────────────────────────────────────────────────
   1. ICMP Ping
   ──────────────────────────────────────────────────────────────────── */
async function pingICMP(ip: string): Promise<DiscoveryResult> {
    try {
        const { stdout } = await execAsync(`ping -c 1 -W 1 ${ip}`, { timeout: 2000 });
        const match = stdout.match(/time=(\d+\.?\d*)/);
        return { ip, alive: true, method: 'icmp', latency: match ? parseFloat(match[1]) : undefined };
    } catch {
        return { ip, alive: false, method: 'icmp' };
    }
}

/* ────────────────────────────────────────────────────────────────────
   2. TCP Port Scan
   ──────────────────────────────────────────────────────────────────── */
function tcpConnect(ip: string, port: number, timeout = 1000): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        socket
            .on('connect', () => { socket.destroy(); resolve(true); })
            .on('error', () => { socket.destroy(); resolve(false); })
            .on('timeout', () => { socket.destroy(); resolve(false); })
            .connect(port, ip);
    });
}

async function scanTCP(ip: string): Promise<DiscoveryResult> {
    const checks = COMMON_PORTS.map(p => tcpConnect(ip, p, 800));
    const results = await Promise.race([
        Promise.all(checks).then(r => r.some(Boolean)),
        new Promise<boolean>(res => setTimeout(() => res(false), 2000))
    ]);
    return { ip, alive: results as boolean, method: 'tcp' };
}

/* ────────────────────────────────────────────────────────────────────
   3. ARP Scan (tabela ARP local do kernel)
   ──────────────────────────────────────────────────────────────────── */
async function getLocalARPTable(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
        // Prefer 'ip neigh show' for detailed liveness state
        const { stdout } = await execAsync('ip neigh show 2>/dev/null || arp -n 2>/dev/null');
        const lines = stdout.split('\n');
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
                const ip = parts[0];
                const mac = parts.find(p => /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(p));
                
                if (ip && mac && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
                    // Validate state if using 'ip neigh'
                    if (line.includes('lladdr')) {
                        const state = parts[parts.length - 1].toUpperCase();
                        const activeStates = ['REACHABLE', 'DELAY', 'PROBE', 'PERMANENT', 'STALE'];
                        if (!activeStates.includes(state)) continue;
                    }
                    map.set(ip, mac);
                }
            }
        }
    } catch { /* silently ignore */ }
    return map;
}

/* ────────────────────────────────────────────────────────────────────
   4. SNMP ARP Table (consulta roteadores/switches cadastrados)
      Tenta TODOS os SNMP communities cadastrados + "IronGrid"
   ──────────────────────────────────────────────────────────────────── */
function snmpGetSubtree(host: string, community: string, oid: string, timeout = 3000): Promise<Map<string, string>> {
    return new Promise((resolve) => {
        const result = new Map<string, string>();
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; session.close(); resolve(result); } };

        const session = snmp.createSession(host, community, {
            timeout,
            retries: 1,
            version: snmp.Version2c
        });

        session.subtree(
            oid,
            20,
            (varbinds: any[]) => {
                for (const vb of varbinds) {
                    if (snmp.isVarbindError(vb)) continue;
                    try {
                        // OID suffix encodes: .ifIndex.a.b.c.d → extract last 4 octets = IP
                        const parts = vb.oid.split('.');
                        const ip = parts.slice(-4).join('.');
                        // Value is MAC as buffer
                        const mac = Buffer.isBuffer(vb.value)
                            ? Array.from(vb.value).map((b: any) => b.toString(16).padStart(2, '0')).join(':')
                            : String(vb.value);
                        if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
                            result.set(ip, mac);
                        }
                    } catch { /* skip bad varbind */ }
                }
            },
            done
        );

        setTimeout(done, timeout + 500);
    });
}

async function getSnmpARPTable(host: string, communities: string[]): Promise<Map<string, string>> {
    for (const community of communities) {
        try {
            const result = await snmpGetSubtree(host, community, ARP_TABLE_OID);
            if (result.size > 0) {
                console.log(`[IPAM SNMP] ${host} respondeu com community "${community}" — ${result.size} entradas ARP`);
                return result;
            }
        } catch { /* try next community */ }
    }
    return new Map();
}

/* ────────────────────────────────────────────────────────────────────
   MAIN: Full Discovery Engine
   ──────────────────────────────────────────────────────────────────── */
export class IPAMDiscoveryService {

    /**
     * discoverSubnet - Varre uma sub-rede usando todas as técnicas disponíveis
     * Atualiza o banco de dados com os resultados.
     */
    static async discoverSubnet(subnetId: string): Promise<{ discovered: number; total: number }> {
        const subnet = await (prisma as any).iPAMSubnet.findUnique({
            where: { id: subnetId },
            include: { addresses: true }
        });
        if (!subnet) return { discovered: 0, total: 0 };

        console.log(`\n[IPAM Discovery] Iniciando descoberta para ${subnet.subnet}...`);

        // Marcar como escaneando
        await (prisma as any).iPAMSubnet.update({
            where: { id: subnetId },
            data: { isScanning: true }
        });

        try {
            // ── Fase 1: Coletar MACs via SNMP de todos os roteadores cadastrados ──
            const snmpMacMap = new Map<string, string>();
            await IPAMDiscoveryService.collectSNMPArp(snmpMacMap);

            // ── Fase 2: Coletar tabela ARP local ─────────────────────────────────
            const localArpMap = await getLocalARPTable();
            console.log(`[IPAM ARP] Tabela ARP local: ${localArpMap.size} entradas`);

            // ── Fase 3: Varrer IPs da sub-rede com ICMP + TCP ────────────────────
            const addresses: any[] = subnet.addresses;
            const ips = addresses.map((a: any) => a.ip);

            // Pre-fetch all devices that could match this subnet's IPs to cross-reference
            const registeredDevices = await (prisma as any).device.findMany({
                where: { ipAddress: { in: ips } },
                select: { id: true, ipAddress: true }
            });
            const deviceIpMap = new Map(registeredDevices.map((d: any) => [d.ipAddress, d.id]));

            // Processar em chunks de 30 para não sobrecarregar
            const CHUNK = 30;
            const allResults = new Map<string, DiscoveryResult>();

            for (let i = 0; i < ips.length; i += CHUNK) {
                const chunk = ips.slice(i, i + CHUNK);
                const icmpResults = await Promise.all(chunk.map(pingICMP));

                for (const r of icmpResults) {
                    if (r.alive) {
                        allResults.set(r.ip, r);
                    }
                }

                // TCP scan apenas para os que não responderam ICMP
                const failedIcmp = icmpResults.filter(r => !r.alive).map(r => r.ip);
                if (failedIcmp.length > 0) {
                    const tcpResults = await Promise.all(failedIcmp.map(scanTCP));
                    for (const r of tcpResults) {
                        if (r.alive) allResults.set(r.ip, r);
                    }
                }
            }

            // ── Incorporar resultados ARP/SNMP ────────────────────────────────────
            for (const [ip, mac] of [...snmpMacMap, ...localArpMap]) {
                if (!allResults.has(ip)) {
                    allResults.set(ip, { ip, alive: true, method: 'snmp', mac });
                } else {
                    const existing = allResults.get(ip)!;
                    if (!existing.mac) existing.mac = mac;
                }
            }

            // ── Fase 4: Atualizar banco de dados ──────────────────────────────────
            let discoveredCount = 0;
            for (const addr of addresses) {
                const result = allResults.get(addr.ip);
                const isAlive = !!result;

                let newStatus = addr.status;
                if (isAlive) {
                    if (addr.status === IPAddressStatus.AVAILABLE) {
                        newStatus = IPAddressStatus.USED;
                    }
                    discoveredCount++;
                } else if (addr.status === IPAddressStatus.USED) {
                    newStatus = IPAddressStatus.AVAILABLE;
                }

                const mac = result?.mac || addr.mac || null;
                let deviceId = deviceIpMap.get(addr.ip) || addr.deviceId;

                // ── Auto-Inventory Upgrade: Create or Update device if alive ──
                if (isAlive) {
                    try {
                        const device = await (prisma as any).device.upsert({
                            where: { ipAddress: addr.ip },
                            update: {
                                status: 'ONLINE',
                                lastSeen: new Date(),
                                macAddress: mac || undefined,
                                hostname: sanitizeSnmpString(result?.hostname || addr.hostname),
                                locationId: subnet.locationId || undefined,
                            },
                            create: {
                                name: sanitizeSnmpString(result?.hostname || addr.hostname || `Device-${addr.ip}`),
                                ipAddress: addr.ip,
                                macAddress: mac || undefined,
                                hostname: sanitizeSnmpString(result?.hostname || addr.hostname),
                                type: 'OTHER',
                                status: 'ONLINE',
                                lastSeen: new Date(),
                                locationId: subnet.locationId || undefined,
                            }
                        });
                        deviceId = device.id;
                    } catch (e) {
                        console.error(`[IPAM Discovery] Failed to upsert device for ${addr.ip}:`, e);
                    }
                }

                await (prisma as any).iPAMAddress.update({
                    where: { id: addr.id },
                    data: {
                        status: newStatus,
                        mac: mac || undefined,
                        deviceId: deviceId || undefined,
                        lastSeen: isAlive ? new Date() : addr.lastSeen,
                    }
                });

            }

            console.log(`[IPAM Discovery] Concluído: ${discoveredCount}/${ips.length} IPs ativos em ${subnet.subnet}`);
            return { discovered: discoveredCount, total: ips.length };
        } finally {
            // Marcar como concluído
            await (prisma as any).iPAMSubnet.update({
                where: { id: subnetId },
                data: { isScanning: false }
            }).catch(console.error);
        }
    }

    /**
     * Coleta tabelas ARP via SNMP de todos os devices cadastrados com SNMP
     * Tenta todas as communities cadastradas + "public"
     */
    private static async collectSNMPArp(targetMap: Map<string, string>) {
        // Buscar devices monitorados com SNMP
        const devices = await (prisma as any).device.findMany({
            where: { status: { in: ['ONLINE', 'WARNING'] } },
            select: { ipAddress: true, snmpCommunityId: true }
        });

        // Buscar todas as communities cadastradas
        const communities = await (prisma as any).snmpCommunity.findMany({
            select: { community: true }
        });

        // Montar lista de communities a tentar: IronGrid Primeiro!
        const communityList = [
            'IronGrid'
        ];
        
        communities.forEach((c: any) => { if (c.community) communityList.push(c.community); });
        communityList.push('public');
        communityList.push('irongrid');

        const uniqueCommunities = Array.from(new Set(communityList));

        console.log(`[IPAM SNMP] Testando ${devices.length} dispositivos com communities: ${communityList.join(', ')}`);

        // Tentar obter tabela ARP de cada dispositivo em paralelo (com limit)
        const SNMP_CHUNK = 5;
        for (let i = 0; i < devices.length; i += SNMP_CHUNK) {
            const chunk = devices.slice(i, i + SNMP_CHUNK);
            await Promise.all(chunk.map(async (d: any) => {
                const arpMap = await getSnmpARPTable(d.ipAddress, communityList);
                for (const [ip, mac] of arpMap) {
                    targetMap.set(ip, mac);
                }
            }));
        }

        console.log(`[IPAM SNMP] Total de entradas ARP via SNMP: ${targetMap.size}`);
    }
}
