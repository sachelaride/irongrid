/**
 * Router SNMP e Monitoramento Ativo
 * 
 * Gerencia a configuração de monitoramento SNMP, comunidades, faixas de rede
 * e o estado em memória dos dispositivos monitorados pelo poller.
 * 
 * Funcionalidades:
 * - Sincronização de dispositivos monitorados com o banco de dados
 * - Coleta de métricas históricas (InfluxDB) para dashboard
 * - Auto-descoberta de interfaces de rede via SNMP
 * - Gestão de CRUD para Comunidades SNMP (v1, v2c, v3)
 * - Gestão de CRUD para Faixas de Rede (Scanning Ranges)
 * - Testes de conectividade SNMP em tempo real
 * 
 * @module routers/snmpRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { SnmpService } from '../services/snmp';
import { sanitizeSnmpString } from '../utils/string';
import { serializeBigInt } from '../utils/serialization';
import { influxDB } from '../services/influxdb';
import { TRPCError } from '@trpc/server';
import { resolveInterface } from '../utils/network';

const snmpService = new SnmpService();

// Cache em memória para dispositivos ativos (o serviço principal depende destes)
export let monitoredDevices: any[] = [];

/**
 * Sync Monitored Devices - Sincronização Global do Poller
 * 
 * Sincroniza o array em memória de dispositivos que devem ser consultados pelo 
 * poller SNMP principal. Também realiza a auto-descoberta de interfaces caso 
 * o dispositivo esteja sendo monitorado mas não tenha interfaces salvas.
 */
export async function syncMonitoredDevices() {
    try {
        const devices = await prisma.monitoredDevice.findMany();

        // Auto-monitoramento de interfaces se o dispositivo as tiver mas monitoredDevice não
        const processed = await Promise.all(devices.map(async d => {
            if (!d.interfaces || d.interfaces.length === 0) {
                const device = d.deviceId 
                    ? await prisma.device.findUnique({ where: { id: d.deviceId }, include: { networkInterfaces: true } })
                    : await prisma.device.findFirst({
                        where: { ipAddress: d.ip },
                        include: { networkInterfaces: true }
                    });

                let ids: number[] = [];

                // 1. Tentar ler do inventário/DB
                if (device && device.networkInterfaces.length > 0) {
                    ids = device.networkInterfaces.map(ni => ni.index).filter(id => id !== null) as number[];
                }

                // 2. Se DB vazio, tentar probe ativo via SNMP
                if (ids.length === 0) {
                    console.log(`[SNMP Router] Nenhuma interface no DB para ${d.ip}. Iniciando probe...`);
                    try {
                        const probe = await snmpService.probeDevice(d.ip, [d.community]);
                        if (probe && probe.interfaces.length > 0) {
                            console.log(`[SNMP Router] Encontradas ${probe.interfaces.length} interfaces para ${d.ip}. Salvando no DB...`);

                            const dbDevice = await prisma.device.findFirst({ where: { ipAddress: d.ip } });

                            if (dbDevice) {
                                for (const iface of probe.interfaces) {
                                    const rawName = iface.alias && iface.alias.length > 0 ? iface.alias :
                                        (iface.description && iface.description.length > 0 ? iface.description : `Interface #${iface.index}`);
                                    const bestName = sanitizeSnmpString(rawName);

                                    await prisma.networkInterface.upsert({
                                        where: {
                                            id: (await prisma.networkInterface.findFirst({
                                                where: { deviceId: dbDevice.id, index: iface.index },
                                                select: { id: true }
                                            }))?.id || "new_id_" + iface.index
                                        },
                                        create: {
                                            deviceId: dbDevice.id,
                                            index: iface.index,
                                            name: bestName,
                                            description: sanitizeSnmpString(iface.description || ''),
                                            macAddress: iface.mac,
                                            status: iface.operStatus === 1 ? 'up' : 'down',
                                            type: 'ethernet',
                                            speed: BigInt(iface.speed || 0),
                                            enabled: true
                                        },
                                        update: {
                                            name: bestName,
                                            description: sanitizeSnmpString(iface.description || ''),
                                            macAddress: iface.mac,
                                            status: iface.operStatus === 1 ? 'up' : 'down',
                                            updatedAt: new Date()
                                        }
                                    });
                                }
                                ids = probe.interfaces.map(i => i.index);
                            }
                        }
                    } catch (e) {
                        console.error(`[SNMP Router] Falha no probe/save para ${d.ip}`, e);
                    }
                }

                if (ids.length > 0) {
                    const deviceLookup = d.deviceId 
                        ? await prisma.device.findUnique({ where: { id: d.deviceId } })
                        : await prisma.device.findFirst({ where: { ipAddress: d.ip } });
                    
                    const allIfaces = await prisma.networkInterface.findMany({
                        where: { deviceId: deviceLookup?.id }
                    });

                    const enabledIds = allIfaces.filter(ni => (ni as any).enabled === true || (ni as any).autoEnabled === true).map(ni => ni.index);

                    await prisma.monitoredDevice.update({
                        where: { id: d.id },
                        data: { interfaces: enabledIds }
                    });
                    return { ...d, interfaces: enabledIds };
                }
            } else {
                const dbDevice = d.deviceId
                    ? await prisma.device.findUnique({ where: { id: d.deviceId }, include: { networkInterfaces: true } })
                    : await prisma.device.findFirst({ where: { ipAddress: d.ip }, include: { networkInterfaces: true } });
                
                if (dbDevice && dbDevice.networkInterfaces.length > 0) {
                    const enabledIds = dbDevice.networkInterfaces
                        .filter(ni => (ni as any).enabled === true || (ni as any).autoEnabled === true)
                        .map(ni => ni.index);

                    if (JSON.stringify(d.interfaces.sort()) !== JSON.stringify(enabledIds.sort())) {
                        await prisma.monitoredDevice.update({
                            where: { id: d.id },
                            data: { interfaces: enabledIds }
                        });
                        return { ...d, interfaces: enabledIds };
                    }
                }
            }
            return d;
        }));

        monitoredDevices.splice(0, monitoredDevices.length, ...processed.map(d => ({
            ip: d.ip,
            community: d.community,
            interfaces: d.interfaces
        })));
        console.log(`[SNMP Router] Sincronizados ${monitoredDevices.length} dispositivos monitorados.`);
        return monitoredDevices;
    } catch (error) {
        console.error('[SNMP Router] Falha ao sincronizar dispositivos monitorados:', error);
        return [];
    }
}

/**
 * Ensure Monitoring Enabled - Ativação Automática de Monitoramento
 * 
 * Garante que um dispositivo e uma interface específica estejam sendo 
 * monitorados pelo poller SNMP. Se o dispositivo não estiver no monitoredDevice,
 * ele é adicionado com a comunidade vinculada no cadastro do Device.
 */
export async function ensureMonitoringEnabled(deviceId: string, interfaceIndex: number) {
    try {
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            include: { snmpCommunity: true }
        });

        if (!device || !device.ipAddress) {
            console.warn(`[SNMP Router] Device ${deviceId} not found or has no IP for auto-monitoring`);
            return;
        }

        // Tenta encontrar o registro de monitoramento
        const existing = await prisma.monitoredDevice.findFirst({
            where: { ip: device.ipAddress }
        });

        if (existing) {
            // Se já monitorado, garante que a interface está na lista
            if (!existing.interfaces.includes(interfaceIndex)) {
                await prisma.monitoredDevice.update({
                    where: { id: existing.id },
                    data: {
                        interfaces: {
                            set: [...existing.interfaces, interfaceIndex]
                        }
                    }
                });
                console.log(`[SNMP Router] Added interface ${interfaceIndex} to monitored device ${device.ipAddress}`);
                await syncMonitoredDevices();
            }
        } else {
            // Se não monitorado, cria o registro inicial
            const community = device.snmpCommunity?.community || 'IronGrid';
            await prisma.monitoredDevice.create({
                data: {
                    ip: device.ipAddress,
                    community: community,
                    interfaces: [interfaceIndex],
                    status: 'up'
                }
            });
            console.log(`[SNMP Router] Created new monitored device ${device.ipAddress} with interface ${interfaceIndex}`);
            await syncMonitoredDevices();
        }
    } catch (error) {
        console.error(`[SNMP Router] Failed to ensure monitoring for device ${deviceId}:`, error);
    }
}

// Sincronização inicial na carga do módulo
syncMonitoredDevices();

export const snmpRouter = router({
    /**
     * List Monitored Devices - Listagem de Dispositivos Monitorados com Métricas
     * 
     * Retorna a lista de dispositivos monitorados juntamente com:
     * - Detalhes das interfaces (nome, status, tráfego in/out)
     * - Métricas de CPU/RAM em tempo real e histórico (sparklines)
     * - Estatísticas de disco
     * 
     * @procedure query
     */
    listMonitoredDevices: protectedProcedure.query(async () => {
        const monitored = await prisma.monitoredDevice.findMany();

        // 1. Pré-fetch de todos os devices para resolver o N+1
        const deviceIds = monitored.map((m: any) => m.deviceId).filter(Boolean);
        const ips = monitored.map((m: any) => m.ip).filter(Boolean);
        
        const allDevices = await prisma.device.findMany({
            where: {
                OR: [
                    { id: { in: deviceIds } },
                    { ipAddress: { in: ips } }
                ]
            },
            include: {
                networkInterfaces: true,
                hardware: true
            }
        });

        // 2. Indexação de Cache na RAM O(1)
        const deviceMap = new Map();
        allDevices.forEach((d) => {
            deviceMap.set(d.id, d);
            if (d.ipAddress) deviceMap.set(d.ipAddress, d);
        });

        // 3. Pool Concorrente Limits para evitar Timeout/Derrubar InfluxDB
        const asyncPool = async (array: any[], limit: number, iteratorFn: (item: any) => Promise<any>) => {
            const ret: any[] = [];
            const executing: any[] = [];
            for (const item of array) {
                const p = Promise.resolve().then(() => iteratorFn(item));
                ret.push(p);
                if (limit <= array.length) {
                    const e: any = p.then(() => executing.splice(executing.indexOf(e), 1));
                    executing.push(e);
                    if (executing.length >= limit) await Promise.race(executing);
                }
            }
            return Promise.all(ret);
        };

        const enriched = await asyncPool(monitored, 10, async (m) => {
            let latest: any = { cpu: null, ram: null, disks: {}, interfaces: {} };
            let history: any = { cpu: [], ram: [] };

            const resolvedDevice = deviceMap.get((m as any).deviceId) || deviceMap.get(m.ip);

            if (resolvedDevice && !(m as any).deviceId) {
                // Auto-repair em background
                prisma.monitoredDevice.update({
                    where: { id: m.id },
                    data: { deviceId: resolvedDevice.id } as any
                }).catch(() => {});
            }

            if (!resolvedDevice) return { ...m, latest, history };

            const filterIds = [m.ip];
            if (resolvedDevice.agentId) filterIds.push(resolvedDevice.agentId);
            if (resolvedDevice.name) filterIds.push(resolvedDevice.name);
            if (resolvedDevice.id) filterIds.push(resolvedDevice.id);

            const filterClause = filterIds.map(id => `r["device_id"] == "${id}" or r["device"] == "${id}"`).join(" or ");

            try {
                const query = `
                    from(bucket: "${influxDB.bucket}")
                        |> range(start: -15m)
                        |> filter(fn: (r) => ${filterClause})
                `;
                const rows = await influxDB.queryApi.collectRows(query);
                const sortedRows = (rows as any[]).sort((a, b) => new Date(a._time).getTime() - new Date(b._time).getTime());

                for (const r of sortedRows) {
                    const field = r._field;
                    const val = r._value;
                    const time = new Date(r._time).getTime();

                    if (r._measurement === 'system_metrics') {
                        if (r._field === 'cpu_load') {
                            latest.cpu = r._value;
                            history.cpu.push({ time: r._time, value: r._value });
                        }
                        if (r._field === 'mem_percent' || r._field === 'memory_percent') {
                            latest.ram = r._value;
                            history.ram.push({ time: r._time, value: r._value });
                        }
                    }
                    if (r._measurement === 'disk_usage') {
                        const mount = r.mount || r.fs || 'Root';
                        if (!latest.disks[mount]) latest.disks[mount] = { used: 0, total: 1 };

                        let valFixed = val;
                        if (val > 0 && val < 10000) valFixed = val * 1024 * 1024 * 1024;

                        if (field === 'used_bytes') latest.disks[mount].used = valFixed;
                        else if (field === 'total_bytes') latest.disks[mount].total = valFixed;
                    }
                    if (r._measurement === 'interface_traffic') {
                        const idx = r.interface_index || r.interface;
                        if (!latest.interfaces[idx]) {
                            latest.interfaces[idx] = { in: 0, out: 0, _lastIn: -1, _lastOut: -1, _lastTIn: 0, _lastTOut: 0, historyIn: [], historyOut: [] };
                        }

                        const stats = latest.interfaces[idx];
                        if (r._field === 'ifInOctets') {
                            if (stats._lastIn >= 0) {
                                const dt = (time - stats._lastTIn) / 1000;
                                if (dt > 0) {
                                    const rate = Math.max(0, ((val - stats._lastIn) / dt) * 8);
                                    stats.in = rate;
                                    stats.historyIn.push({ time, value: rate });
                                }
                            }
                            stats._lastIn = val;
                            stats._lastTIn = time;
                        } else if (r._field === 'ifOutOctets') {
                            if (stats._lastOut >= 0) {
                                const dt = (time - stats._lastTOut) / 1000;
                                if (dt > 0) {
                                    const rate = Math.max(0, ((val - stats._lastOut) / dt) * 8);
                                    stats.out = rate;
                                    stats.historyOut.push({ time, value: rate });
                                }
                            }
                            stats._lastOut = val;
                            stats._lastTOut = time;
                        }
                    }
                }
            } catch (e) { console.error('[SNMP Router] Erro ao buscar métricas:', e); }

            const dbInterfaces = resolvedDevice.networkInterfaces.map((ni: any) => ({
                index: ni.index,
                name: ni.description || `Interface #${ni.index}`,
                alias: ni.name,
                status: ni.status,
                latest: (() => {
                    if (!latest.interfaces) return null;
                    const idxStr = ni.index?.toString();
                    if (idxStr && latest.interfaces[idxStr]) return latest.interfaces[idxStr];
                    if (ni.name && latest.interfaces[ni.name]) return latest.interfaces[ni.name];
                    if (ni.description && latest.interfaces[ni.description]) return latest.interfaces[ni.description];
                    const normalizedDesc = ni.description?.toLowerCase().split('#')[0].trim();
                    const normalizedName = ni.name?.toLowerCase().split('#')[0].trim();
                    const fuzzy = Object.entries(latest.interfaces).find(([k]) => {
                        const lk = k.toLowerCase();
                        return (normalizedDesc && lk.includes(normalizedDesc)) ||
                            (normalizedName && lk.includes(normalizedName));
                    });
                    return fuzzy ? fuzzy[1] : null;
                })(),
                enabled: (ni as any).enabled
            }));

            const agentInterfaces = Object.keys(latest.interfaces || {})
                .filter(idx => !dbInterfaces.some((ext: any) => ext.index?.toString() === idx || ext.name === idx))
                .map(idx => ({
                    index: idx,
                    name: idx,
                    alias: idx,
                    status: 'UP',
                    latest: latest.interfaces[idx]
                }));

            return {
                ...m,
                deviceName: resolvedDevice.name,
                deviceType: resolvedDevice.type,
                hasAgent: !!resolvedDevice.agentId,
                interfaceDetails: [...dbInterfaces, ...agentInterfaces],
                hw: resolvedDevice.hardware,
                deviceId: resolvedDevice.id,
                monitoringLevel: resolvedDevice.monitoringLevel,
                latest,
                history
            };
        });

        return serializeBigInt(enriched);
    }),

    /**
     * Add Monitored Device - Adicionar Dispositivo ao Monitoramento
     * 
     * @procedure mutation
     */
    addMonitoredDevice: protectedProcedure
        .input(z.object({
            ip: z.string(),
            community: z.string(),
            interfaces: z.array(z.number())
        }))
        .mutation(async ({ input }) => {
            const existing = await prisma.monitoredDevice.findFirst({ where: { ip: input.ip } });
            let device;
            if (existing) {
                device = await prisma.monitoredDevice.update({
                    where: { id: existing.id },
                    data: {
                        community: input.community,
                        interfaces: input.interfaces
                    }
                });
            } else {
                device = await prisma.monitoredDevice.create({
                    data: {
                        ip: input.ip,
                        community: input.community,
                        interfaces: input.interfaces
                    }
                });
            }
            await syncMonitoredDevices();
            return device;
        }),

    /**
     * Remove Monitored Device - Parar Monitoramento de Dispositivo
     * 
     * @procedure mutation
     */
    removeMonitoredDevice: protectedProcedure
        .input(z.object({ ip: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.monitoredDevice.deleteMany({ where: { ip: input.ip } });
            await syncMonitoredDevices();
            return { success: true };
        }),

    /**
     * Test Connection - Testar Conectividade SNMP em Tempo Real
     * 
     * Tenta realizar um probe no dispositivo para listar interfaces e validar
     * a comunidade SNMP informada.
     * 
     * @procedure mutation
     */
    testConnection: protectedProcedure
        .input(z.object({
            ip: z.string(),
            community: z.string()
        }))
        .mutation(async ({ input }) => {
            console.log(`[SNMP Router] Testando conexão com ${input.ip} usando comunidade ${input.community}`);
            try {
                const data = await snmpService.probeDevice(input.ip, [input.community]);
                if (data) {
                    return {
                        success: true,
                        ping: true,
                        data: {
                            sysName: sanitizeSnmpString(data.sysName || 'Device-' + input.ip.split('.').pop()),
                            interfaces: data.interfaces.map(i => ({
                                index: i.index,
                                description: sanitizeSnmpString(i.description || `Interface ${i.index}`),
                                alias: sanitizeSnmpString(i.alias),
                                operStatus: i.operStatus
                            }))
                        }
                    };
                } else {
                    return {
                        success: false,
                        ping: true,
                        error: 'Probe SNMP falhou. Verifique a comunidade e conectividade.'
                    };
                }
            } catch (error: any) {
                console.error(`[SNMP Router] Erro no teste de conexão:`, error);
                return {
                    success: false,
                    ping: false,
                    error: error.message
                };
            }
        }),

    /**
     * Start Monitoring - Iniciar Monitoramento de Interfaces
     * 
     * @procedure mutation
     */
    startMonitoring: protectedProcedure
        .input(z.object({
            ip: z.string(),
            community: z.string(),
            interfaces: z.array(z.number())
        }))
        .mutation(async ({ input }) => {
            const existing = await prisma.monitoredDevice.findFirst({ where: { ip: input.ip } });
            let device;
            if (existing) {
                device = await prisma.monitoredDevice.update({
                    where: { id: existing.id },
                    data: {
                        community: input.community,
                        interfaces: input.interfaces
                    }
                });
            } else {
                device = await prisma.monitoredDevice.create({
                    data: {
                        ip: input.ip,
                        community: input.community,
                        interfaces: input.interfaces
                    }
                });
            }
            await syncMonitoredDevices();
            return device;
        }),

    /**
     * Toggle Monitoring - Alternar Estado de Monitoramento
     * 
     * Ativa ou desativa o monitoramento para um IP específico,
     * utilizando a primeira comunidade disponível como carregamento padrão.
     * 
     * @procedure mutation
     */
    toggleMonitoring: protectedProcedure
        .input(z.object({
            ip: z.string(),
            enabled: z.boolean()
        }))
        .mutation(async ({ input }) => {
            if (input.enabled) {
                const firstCommunity = await prisma.snmpCommunity.findFirst();
                const community = firstCommunity?.community || 'IronGrid';

                const existing = await prisma.monitoredDevice.findFirst({ where: { ip: input.ip } });
                if (existing) {
                    await prisma.monitoredDevice.update({
                        where: { id: existing.id },
                        data: { community, interfaces: [] }
                    });
                } else {
                    await prisma.monitoredDevice.create({
                        data: { ip: input.ip, community, interfaces: [] }
                    });
                }
            } else {
                await prisma.monitoredDevice.deleteMany({
                    where: { ip: input.ip }
                });
            }
            await syncMonitoredDevices();
            return { success: true };
        }),

    /**
     * Toggle Interface - Habilitar/Desabilitar Interface Individual
     * 
     * Persiste a preferência de monitoramento de uma interface específica
     * no inventário de rede.
     * 
     * @procedure mutation
     */
    toggleInterface: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            index: z.number(),
            enabled: z.boolean()
        }))
        .mutation(async ({ input }) => {
            await prisma.networkInterface.updateMany({
                where: { deviceId: input.deviceId, index: input.index },
                data: { enabled: input.enabled } as any
            });
            await syncMonitoredDevices();
            return { success: true };
        }),

    bulkToggleInterfaces: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            type: z.enum(['all', 'lag']),
            enabled: z.boolean()
        }))
        .mutation(async ({ input }) => {
            console.log(`[SNMP Router] Bulk toggle for device ${input.deviceId}, type ${input.type}, enabled: ${input.enabled}`);
            const where: any = { deviceId: input.deviceId };
            
            if (input.type === 'lag') {
                where.OR = [
                    { name: { contains: 'Link Aggregate', mode: 'insensitive' } },
                    { name: { contains: 'bond', mode: 'insensitive' } },
                    { name: { contains: 'ae', mode: 'insensitive' } },
                    { name: { contains: 'port-channel', mode: 'insensitive' } },
                    { description: { contains: 'Link Aggregate', mode: 'insensitive' } },
                    { description: { contains: 'LAG', mode: 'insensitive' } }
                ];
            }

            await prisma.networkInterface.updateMany({
                where,
                data: { enabled: input.enabled } as any
            });

            await syncMonitoredDevices();
            return { success: true };
        }),

    // --- CRUD Comunidades SNMP ---

    /**
     * List Communities - Listar Comunidades Cadastradas
     * 
     * @procedure query
     */
    listCommunities: protectedProcedure.query(async () => {
        return prisma.snmpCommunity.findMany({
            include: {
                _count: { select: { networkRanges: true, devices: true } }
            }
        });
    }),

    /**
     * Get Community - Detalhes da Comunidade
     * 
     * @procedure query
     */
    getCommunity: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            return prisma.snmpCommunity.findUnique({
                where: { id: input.id },
                include: {
                    _count: { select: { networkRanges: true, devices: true } },
                    networkRanges: true,
                    devices: { select: { id: true, name: true, ipAddress: true } }
                }
            });
        }),

    /**
     * Create Community - Criar Nova Comunidade SNMP
     * 
     * @procedure mutation
     */
    createCommunity: protectedProcedure
        .input(z.object({
            name: z.string(),
            version: z.enum(['v1', 'v2c', 'v3']),
            community: z.string().optional(),
            username: z.string().optional(),
            authProto: z.string().optional(),
            authPass: z.string().optional(),
            privProto: z.string().optional(),
            privPass: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem criar comunidades SNMP' });
            }
            return prisma.snmpCommunity.create({ data: input });
        }),

    /**
     * Update Community - Atualizar Comunidade SNMP
     * 
     * @procedure mutation
     */
    updateCommunity: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            version: z.enum(['v1', 'v2c', 'v3']).optional(),
            community: z.string().optional(),
            username: z.string().optional(),
            authProto: z.string().optional(),
            authPass: z.string().optional(),
            privProto: z.string().optional(),
            privPass: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem atualizar comunidades SNMP' });
            }
            const { id, ...data } = input;
            return prisma.snmpCommunity.update({ where: { id }, data });
        }),

    /**
     * Delete Community - Remover Comunidade SNMP
     * 
     * @procedure mutation
     */
    deleteCommunity: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem deletar comunidades SNMP' });
            }
            return prisma.snmpCommunity.delete({ where: { id: input.id } });
        }),

    // --- CRUD Faixas de Rede (Scanning Ranges) ---

    /**
     * List Ranges - Listar Faixas de Varredura
     * 
     * @procedure query
     */
    listRanges: protectedProcedure.query(async () => {
        return prisma.networkRange.findMany({
            include: {
                location: { select: { name: true } },
                snmpCommunity: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }),

    /**
     * Get Range - Detalhes da Faixa
     * 
     * @procedure query
     */
    getRange: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            return prisma.networkRange.findUnique({
                where: { id: input.id },
                include: {
                    location: true,
                    snmpCommunity: true
                }
            });
        }),

    /**
     * Create Range - Criar Nova Faixa de Varredura
     * 
     * @procedure mutation
     */
    createRange: protectedProcedure
        .input(z.object({
            name: z.string(),
            subnet: z.string(),
            locationId: z.string().optional(),
            enabled: z.boolean().optional(),
            scanSchedule: z.string().optional(),
            scanIntervalDays: z.number().optional(),
            scanHour: z.number().optional(),
            snmpEnabled: z.boolean().optional(),
            snmpCommunityId: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem criar faixas de rede' });
            }
            return prisma.networkRange.create({ data: input });
        }),

    /**
     * Update Range - Atualizar Faixa de Varredura
     * 
     * @procedure mutation
     */
    updateRange: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            subnet: z.string().optional(),
            locationId: z.string().optional(),
            enabled: z.boolean().optional(),
            scanSchedule: z.string().optional(),
            scanIntervalDays: z.number().optional(),
            scanHour: z.number().optional(),
            snmpEnabled: z.boolean().optional(),
            snmpCommunityId: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem atualizar faixas de rede' });
            }
            const { id, ...data } = input;
            return prisma.networkRange.update({ where: { id }, data });
        }),

    /**
     * Delete Range - Remover Faixa de Varredura
     * 
     * @procedure mutation
     */
    deleteRange: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem deletar faixas de rede' });
            }
            return prisma.networkRange.delete({ where: { id: input.id } });
        }),
});
