/**
 * Router de Métricas e Telemetria
 * 
 * Gerencia a ingestão e consulta de dados de performance em tempo real.
 * Utiliza o InfluxDB para armazenamento de séries temporais de alta performance.
 * 
 * Funcionalidades:
 * - Ingestão de métricas enviadas pelos agentes (CPU, RAM, Disco, Rede)
 * - Consulta de métricas históricas para gráficos
 * - Cálculo de taxas de transmissão de rede (derivadas)
 * - Agregação de janelas de tempo (average/max)
 * - Vinculação dinâmica de agentes a dispositivos no cadastro
 * 
 * @module routers/metrics
 */

import { router, protectedProcedure, publicProcedure } from '../trpc';
import { z } from 'zod';
import { influxDB } from '../services/influxdb';
import { Point } from '@influxdata/influxdb-client';
import { prisma } from '../utils/prisma';
import { Logger } from '../utils/logger';
import { serializeBigInt } from '../utils/serialization';

export const metricsRouter = router({
    /**
     * Ingest - Receber Métricas do Agente
     * 
     * Rota de alta frequência utilizada pelos agentes IronGrid para reportar 
     * o estado de saúde do sistema. Realiza a escrita no InfluxDB e
     * atualiza o status de "Última Vez Visto" no PostgreSQL.
     * 
     * @procedure mutation
     * @public Utilizado por agentes (pode usar token de autenticação via contexto)
     */
    ingest: publicProcedure
        .input(z.object({
            agentId: z.string().optional(),
            cpu: z.object({
                load: z.number(),
                cores: z.array(z.number()),
            }),
            memory: z.object({
                total: z.number(),
                used: z.number(),
                free: z.number(),
                percent: z.number(),
            }),
            disk: z.array(z.object({
                fs: z.string(),
                size: z.number(),
                used: z.number(),
                usePercent: z.number(),
                mount: z.string(),
            })).optional(),
            network: z.array(z.object({
                iface: z.string(),
                rx_bytes: z.number(),
                tx_bytes: z.number(),
                operstate: z.string(),
            })).optional(),
            uptime: z.number(),
            timestamp: z.string().or(z.date()),
            security: z.object({
                av: z.string().optional(),
                avStatus: z.string().optional(),
                usbBlocked: z.boolean().optional()
            }).optional(),
            activity: z.object({
                currentWindow: z.string().optional(),
                stats: z.record(z.string(), z.number()).optional()
            }).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const agentId = input.agentId || ctx.user?.id || 'unknown';
            const time = new Date();

            if (agentId === 'enterprise' || agentId.includes('sachelaride')) {
                Logger.info(`[METRICS] Received from ${agentId}: CPU=${input.cpu.load}%, DISK=${input.disk?.length || 0}, NET=${input.network?.length || 0}`);
                if (input.disk) {
                    input.disk.forEach(d => Logger.info(`  - Disk ${d.mount} (${d.fs}): ${d.used}/${d.size} bytes (${d.usePercent}%)`));
                }
            }

            Logger.info(`Metrics received from agent: ${agentId}`, {
                cpu: input.cpu.load,
                mem: input.memory.percent
            });

            try {
                // Sincronização automática de cadastro
                if (agentId !== 'unknown') {
                    // 1. Tentar atualizar por agentId (já vinculado)
                    const updated = await prisma.device.updateMany({
                        where: { agentId: agentId },
                        data: {
                            status: 'ONLINE',
                            lastSeen: new Date(),
                            lastCpuUsage: input.cpu.load,
                            lastRamUsage: input.memory.percent,
                            ...(input.security ? {
                                lastAvName: input.security.av,
                                lastAvStatus: input.security.avStatus,
                                usbBlocked: input.security.usbBlocked ?? false
                            } : {})
                        }
                    });

                    // 2. Se não encontrou Device com esse agentId, tentamos busca por hostname ou criamos novo
                    if (updated.count === 0) {
                        Logger.info(`[METRICS] New agent detected: ${agentId}. Attempting to link or create device.`);

                        const existingByHostname = await prisma.device.findFirst({
                            where: {
                                OR: [
                                    { hostname: agentId },
                                    { name: agentId }
                                ],
                                agentId: null
                            }
                        });

                        if (existingByHostname) {
                            await prisma.device.update({
                                where: { id: existingByHostname.id },
                                data: {
                                    agentId: agentId,
                                    status: 'ONLINE',
                                    lastSeen: new Date(),
                                    lastCpuUsage: input.cpu.load,
                                    lastRamUsage: input.memory.percent,
                                    ...(input.security ? {
                                        lastAvName: input.security.av,
                                        lastAvStatus: input.security.avStatus,
                                        usbBlocked: input.security.usbBlocked ?? false
                                    } : {})
                                }
                            });
                            Logger.info(`[METRICS] Linked agent ${agentId} to existing device ${existingByHostname.name}`);
                        } else {
                            // Cadastro automático de novo ativo descoberto via Agente
                            try {
                                const newDevice = await prisma.device.create({
                                    data: {
                                        name: agentId,
                                        hostname: agentId,
                                        agentId: agentId,
                                        ipAddress: `agent:${agentId}`,
                                        type: 'SERVER',
                                        status: 'ONLINE',
                                        lastSeen: new Date(),
                                        lastCpuUsage: input.cpu.load,
                                        lastRamUsage: input.memory.percent
                                    }
                                });
                                Logger.info(`[METRICS] Created new device for agent ${agentId}: ${newDevice.id}`);
                            } catch (createError) {
                                Logger.error(`[METRICS] Failed to create device for agent ${agentId}`, createError);
                            }
                        }
                    }
                }

                // Escrita de séries temporais no InfluxDB
                const timeStr = input.timestamp instanceof Date
                    ? input.timestamp
                    : new Date(input.timestamp);

                const point = new Point('system_metrics')
                    .tag('device_id', agentId)
                    .floatField('cpu_load', input.cpu.load)
                    .floatField('mem_percent', input.memory.percent)
                    .floatField('mem_used', input.memory.used)
                    .floatField('uptime', input.uptime)
                    .timestamp(timeStr);

                if (input.disk && input.disk.length > 0) {
                    input.disk.forEach(d => {
                        const diskPoint = new Point('disk_usage')
                            .tag('device_id', agentId)
                            .tag('fs', d.fs)
                            .tag('mount', d.mount)
                            .floatField('used_bytes', d.used)
                            .floatField('total_bytes', d.size)
                            .floatField('used_percent', d.usePercent)
                            .timestamp(timeStr);
                        influxDB.writeApi.writePoint(diskPoint);
                    });
                }

                if (input.network && input.network.length > 0) {
                    input.network.forEach(n => {
                        const netPoint = new Point('interface_traffic')
                            .tag('device', agentId)
                            .tag('device_id', agentId)
                            .tag('interface', n.iface)
                            .tag('interface_index', n.iface)
                            .floatField('ifInOctets', n.rx_bytes)
                            .floatField('ifOutOctets', n.tx_bytes)
                            .timestamp(timeStr);
                        influxDB.writeApi.writePoint(netPoint);
                    });
                }

                influxDB.writeApi.writePoint(point);
                await influxDB.writeApi.flush();

            } catch (error) {
                Logger.error('Error writing to InfluxDB or updating Device', error);
            }

            return { success: true };
        }),

    /**
     * Get System Metrics - Obter Histórico de CPU/RAM
     * 
     * @procedure query
     * @param {Object} input
     * @param {string} input.deviceId - ID do dispositivo
     * @param {string} [input.timeRange='1h'] - Período de consulta
     */
    getSystemMetrics: protectedProcedure
        .input(z.object({
            deviceId: z.string().optional(),
            timeRange: z.enum(['1h', '24h', '7d']).default('1h')
        }))
        .query(async ({ input, ctx }) => {
            const durationMap = {
                '1h': '-1h',
                '24h': '-24h',
                '7d': '-7d'
            } as const;
            const duration = durationMap[input.timeRange];
            const deviceId = input.deviceId || ctx.user?.id;

            if (!deviceId) {
                Logger.info(`[MetricsQuery] No deviceId provided or found in context`);
                return [];
            }

            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                select: { agentId: true, name: true }
            });

            const filterId = device?.agentId || deviceId;

            // Query em Flux (InfluxDB) para buscar e agregar médias por minuto
            const query = `
                from(bucket: "${influxDB.bucket}")
                    |> range(start: ${duration})
                    |> filter(fn: (r) => r["_measurement"] == "system_metrics")
                    |> filter(fn: (r) => r["device_id"] == "${filterId}" or r["device"] == "${filterId}")
                    |> filter(fn: (r) => r["_field"] == "cpu_load" or r["_field"] == "mem_percent" or r["_field"] == "memory_percent")
                    |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
                    |> yield(name: "mean")
            `;

            try {
                const result = await influxDB.queryApi.collectRows(query);
                const grouped = new Map<string, { cpu?: number; memory?: number }>();

                for (const row of result as any[]) {
                    const timestamp = row._time;
                    const field = row._field;
                    const value = row._value;

                    if (!grouped.has(timestamp)) {
                        grouped.set(timestamp, {});
                    }

                    const entry = grouped.get(timestamp)!;
                    if (field === 'cpu_load') {
                        entry.cpu = value;
                    } else if (field === 'mem_percent') {
                        entry.memory = value;
                    }
                }

                const data = Array.from(grouped.entries()).map(([timestamp, values]) => ({
                    timestamp,
                    cpu: values.cpu || 0,
                    memory: values.memory || 0
                }));

                data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                return serializeBigInt(data);

            } catch (error) {
                console.error('[Metrics] Error querying InfluxDB:', error);
                return [];
            }
        }),

    /**
     * Get Interface Metrics - Tráfego de Rede por Interface
     * 
     * Retorna o tráfego em tempo real calculando a derivada (bytes/s)
     * entre os contadores acumulados das amostras.
     * 
     * @procedure query
     */
    getInterfaceMetrics: protectedProcedure
        .input(z.object({
            deviceIp: z.string(),
            interfaceIndex: z.union([z.number(), z.string()]),
            timeRange: z.enum(['1m', '1h', '24h', '7d']).default('1h')
        }))
        .query(async ({ input }) => {
            const { deviceIp, interfaceIndex, timeRange } = input;

            const device = await prisma.device.findFirst({
                where: { ipAddress: deviceIp },
                include: { networkInterfaces: true }
            });

            const filterId = device?.agentId || (deviceIp.startsWith('agent:') ? deviceIp.replace('agent:', '') : deviceIp);

            const durationMap = { '1m': '-5m', '1h': '-1h', '24h': '-24h', '7d': '-7d' } as const;
            const windowMap = { '1m': '5s', '1h': '1m', '24h': '5m', '7d': '30m' } as const;

            let interfaceFilter = 'r["interface_index"] =~ /.*/';
            if (interfaceIndex !== 'all') {
                const candidates = [String(interfaceIndex)];

                if (device?.networkInterfaces) {
                    const ni = device.networkInterfaces.find(n => n.index === Number(interfaceIndex));
                    if (ni) {
                        if (ni.name) candidates.push(ni.name);
                        if (ni.description) candidates.push(ni.description);
                    }
                }

                const orClause = candidates.map(c => `r["interface_index"] == "${c}" or r["interface"] == "${c}"`).join(" or ");
                interfaceFilter = `(${orClause})`;
            }

            const query = `
                from(bucket: "${influxDB.bucket}")
                    |> range(start: ${durationMap[timeRange]})
                    |> filter(fn: (r) => r["_measurement"] == "interface_traffic")
                    |> filter(fn: (r) => r["device"] == "${filterId}" or r["device_id"] == "${filterId}")
                    |> filter(fn: (r) => ${interfaceFilter}) 
                    |> filter(fn: (r) => r["_field"] == "ifInOctets" or r["_field"] == "ifOutOctets")
                    |> derivative(unit: 1s, nonNegative: true)
                    |> aggregateWindow(every: ${windowMap[timeRange]}, fn: mean, createEmpty: false)
                    |> yield(name: "mean")
            `;

            try {
                const result = await influxDB.queryApi.collectRows(query);
                const grouped = new Map<string, { bytesIn?: number; bytesOut?: number }>();

                for (const row of result as any[]) {
                    const timestamp = row._time;
                    if (!grouped.has(timestamp)) grouped.set(timestamp, {});
                    const entry = grouped.get(timestamp)!;
                    if (row._field === 'ifInOctets') entry.bytesIn = row._value;
                    else if (row._field === 'ifOutOctets') entry.bytesOut = row._value;
                }

                return serializeBigInt(Array.from(grouped.entries()).map(([timestamp, values]) => ({
                    timestamp,
                    bytesIn: values.bytesIn || 0,
                    bytesOut: values.bytesOut || 0
                })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
            } catch (error) {
                console.error('[Metrics] Error querying interface metrics:', error);
                return [];
            }
        }),

    /**
     * Get Disk Metrics - Histórico de Uso de Disco
     * 
     * @procedure query
     */
    getDiskMetrics: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            timeRange: z.enum(['1h', '24h', '7d']).default('1h')
        }))
        .query(async ({ input }) => {
            const device = await prisma.device.findUnique({
                where: { id: input.deviceId },
                select: { agentId: true, ipAddress: true }
            });

            if (!device) return [];
            const filterId = device.agentId || device.ipAddress;
            const durationMap = { '1h': '-1h', '24h': '-24h', '7d': '-7d' } as const;

            const query = `
                from(bucket: "${influxDB.bucket}")
                    |> range(start: ${durationMap[input.timeRange]})
                    |> filter(fn: (r) => r["_measurement"] == "disk_usage")
                    |> filter(fn: (r) => r["device_id"] == "${filterId}" or r["device"] == "${filterId}")
                    |> filter(fn: (r) => r["_field"] == "used_bytes" or r["_field"] == "total_bytes")
                    |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
                    |> yield(name: "mean")
            `;

            try {
                const result = await influxDB.queryApi.collectRows(query);
                const grouped = new Map<string, any>();

                for (const row of result as any[]) {
                    const timestamp = row._time;
                    const mount = row.mount;
                    if (!grouped.has(timestamp)) grouped.set(timestamp, { timestamp, disks: {} });

                    const entry = grouped.get(timestamp);
                    if (!entry.disks[mount]) entry.disks[mount] = {};
                    entry.disks[mount][row._field === 'used_bytes' ? 'used' : 'total'] = row._value;
                }

                return serializeBigInt(Array.from(grouped.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
            } catch (e) {
                console.error('[Metrics] Disk query error:', e);
                return [];
            }
        })
});
