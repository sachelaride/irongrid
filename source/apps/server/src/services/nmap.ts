/**
 * Utilitário de Descoberta de Rede (Nmap)
 * 
 * Abstração sobre o binário `nmap` para realização de varreduras de rede.
 * Responsável por identificar hosts ativos, portas abertas e tentar inferir
 * o tipo de dispositivo (Heurística de Device Fingerprinting).
 * 
 * Requisito: O binário `nmap` deve estar instalado e disponível no PATH do sistema.
 * 
 * @module services/nmap
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Tipos de dispositivos suportados pelo sistema de inventário */
export type DeviceType = 'SERVER' | 'ROUTER' | 'SWITCH' | 'PRINTER' | 'WORKSTATION' | 'OTHER';

/** Resultado estruturado de um host encontrado no scan */
export interface ScanResult {
    /** Endereço IP do host */
    ip: string;
    /** Nome de rede (se resolvido via DNS ou NetBIOS) */
    hostname: string;
    /** Endereço físico (apenas em scans na mesma sub-rede L2) */
    mac?: string;
    /** Fabricante da placa de rede (vendor) */
    vendor?: string;
    /** Lista de portas TCP identificadas como 'open' */
    openPorts: number[];
    /** Tipo inferido do dispositivo */
    type: DeviceType;
}

/**
 * Scan Network - Executar varredura de rede
 * 
 * Realiza o mapeamento de uma sub-rede utilizando diferentes níveis de intensidade.
 * Em caso de erro no scan completo, tenta um fallback para scan de ping simples.
 * 
 * @param {string} subnet - Faixa de rede em formato CIDR (ex: 192.168.1.0/24)
 * @param {'quick' | 'deep'} [intensity='quick'] - Nível de profundidade do scan
 * @returns {Promise<ScanResult[]>} Lista de hosts descobertos
 */
export async function scanNetwork(subnet: string, intensity: 'quick' | 'deep' = 'quick'): Promise<ScanResult[]> {
    try {
        console.log(`[Scanning] Iniciando scan ${intensity} na rede ${subnet}...`);

        let flags = '-F -T4'; // Quick: Scaneia as 100 portas mais comuns
        if (intensity === 'deep') {
            // Deep: Detecção de SO, versões, scripts e ignora PING para maior cobertura (Stealth)
            flags = '-A -Pn -T4'; 
        }

        // Executa o binário nmap
        const { stdout } = await execAsync(`nmap ${flags} ${subnet}`);
        return parseNmapOutput(stdout);
    } catch (error) {
        console.error('Falha na execução do Nmap:', error);
        // Fallback: Tentativa de descoberta mínima apenas via ping (ARP/ICMP)
        try {
            const { stdout } = await execAsync(`nmap -sn ${subnet}`);
            return parseNmapOutput(stdout);
        } catch (innerError) {
            console.error('Fallback do Nmap falhou:', innerError);
            throw new Error('Falha ao executar o scan de rede');
        }
    }
}

/**
 * Detect Device Type - Heurística de Classificação de Ativos
 * 
 * Tenta classificar o dispositivo baseando-se em:
 * 1. Fabricante (Vendor) via MAC Address
 * 2. Nome de host (tags como 'srv', 'sw', etc)
 * 3. Assinatura de portas TCP abertas
 * 
 * @private
 */
function detectDeviceType(vendor: string, hostname: string, openPorts: number[]): DeviceType {
    const v = vendor.toLowerCase();
    const h = hostname.toLowerCase();

    // Regras para Impressoras
    if (v.includes('hp') || v.includes('canon') || v.includes('epson') || v.includes('lexmark') || openPorts.includes(9100) || openPorts.includes(515)) {
        return 'PRINTER';
    }

    // Regras para Equipamentos de Infraestrutura (Switches e Roteadores)
    if (v.includes('cisco') || v.includes('tp-link') || v.includes('d-link') || v.includes('ubiquiti') || v.includes('mikrotik') || v.includes('dell networking') || openPorts.includes(161)) {
        if (h.includes('sw') || v.includes('networking')) return 'SWITCH';
        return 'ROUTER';
    }

    // Regras para Servidores
    if (h.includes('srv') || h.includes('server') || openPorts.includes(80) || openPorts.includes(443) || openPorts.includes(3306) || openPorts.includes(5432)) {
        return 'SERVER';
    }

    // Regras para Estações de Trabalho / Laptops
    if (v.includes('apple') || v.includes('intel') || v.includes('dell') || v.includes('microsoft') || openPorts.includes(3389)) {
        return 'WORKSTATION';
    }

    return 'OTHER';
}

/**
 * Parse Nmap Output - Processador de saída textual do Nmap
 * 
 * Transforma o relatório textual em uma lista de objetos estruturados.
 * Identifica blocos de hosts, endereços MAC, fabricates e portas.
 * 
 * @private
 */
function parseNmapOutput(output: string): ScanResult[] {
    const results: ScanResult[] = [];
    const lines = output.split('\n');

    let currentHost: Partial<ScanResult> | null = null;

    for (const line of lines) {
        // Detecção de início de novo host
        if (line.startsWith('Nmap scan report for')) {
            if (currentHost?.ip) {
                currentHost.type = detectDeviceType(currentHost.vendor || '', currentHost.hostname || '', currentHost.openPorts || []);
                results.push(currentHost as ScanResult);
            }

            const parts = line.split(' ');
            const ipOrHost = parts[parts.length - 1].replace(/[()]/g, '');
            currentHost = {
                ip: ipOrHost,
                hostname: parts.length > 5 ? parts[4] : '',
                openPorts: [],
                type: 'OTHER'
            };
        }
        // Captura de MAC e Vendor
        else if (line.includes('MAC Address:')) {
            if (currentHost) {
                const parts = line.split(' ');
                currentHost.mac = parts[2];
                const vendorMatch = line.match(/\((.*)\)/);
                currentHost.vendor = vendorMatch ? vendorMatch[1] : 'Unknown';
            }
        }
        // Captura de portas TCP abertas
        else if (line.includes('/tcp') && line.includes('open')) {
            if (currentHost) {
                const port = parseInt(line.split('/')[0]);
                if (!isNaN(port)) {
                    currentHost.openPorts?.push(port);
                }
            }
        }
    }

    // Processa o último host do loop
    if (currentHost?.ip) {
        currentHost.type = detectDeviceType(currentHost.vendor || '', currentHost.hostname || '', currentHost.openPorts || []);
        results.push(currentHost as ScanResult);
    }

    return results;
}
