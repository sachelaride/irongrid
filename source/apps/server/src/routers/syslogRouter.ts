/**
 * Router de Syslog - Monitoramento de Logs de Dispositivos de Rede
 * 
 * Gerencia a recepção e visualização de mensagens Syslog (RFC 5424/3164)
 * enviadas por dispositivos de rede (firewalls, roteadores, switches).
 * 
 * Funcionalidades:
 * - Controle do servidor Syslog (UDP 514)
 * - Visualização de mensagens recentes em buffer (tempo real)
 * - Filtro de monitoramento por dispositivos específicos
 * - Pesquisa histórica de logs no banco de dados
 * - Assinatura em tempo real (Subscriptions) para live monitoring
 * 
 * @module routers/syslogRouter
 * @requires services/syslogService - Motor de recepção e processamento
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { syslogService } from '../services/syslogService';
import { observable } from '@trpc/server/observable';
import { syslogPool } from '../utils/syslogDb';

export const syslogRouter = router({
    /**
     * Get Status - Estado do Servidor Syslog
     * 
     * Retorna se o servidor está ativo, a porta de escuta e
     * estatísticas básicas de mensagens recebidas.
     * 
     * @procedure query
     * @protected Requer autenticação
     */
    getStatus: protectedProcedure.query(async () => {
        return syslogService.getStatus();
    }),

    /**
     * Start - Iniciar Servidor
     * 
     * @procedure mutation
     * @protected Requer autenticação
     */
    start: protectedProcedure.mutation(async () => {
        await syslogService.start();
        return { success: true, message: 'Syslog server started' };
    }),

    /**
     * Stop - Parar Servidor
     * 
     * @procedure mutation
     * @protected Requer autenticação
     */
    stop: protectedProcedure.mutation(async () => {
        await syslogService.stop();
        return { success: true, message: 'Syslog server stopped' };
    }),

    /**
     * Update Config - Atualizar Configurações do Servidor
     * 
     * @procedure mutation
     */
    updateConfig: protectedProcedure
        .input(z.object({
            port: z.number().min(1).max(65535).optional(),
        }))
        .mutation(async ({ input }) => {
            if (input.port) {
                await prisma.systemParameter.upsert({
                    where: { key: 'syslog_port' },
                    update: { value: input.port.toString() },
                    create: {
                        key: 'syslog_port',
                        value: input.port.toString(),
                        category: 'SYSLOG',
                        type: 'NUMBER',
                        description: 'Porta UDP para escuta do servidor Syslog'
                    }
                });

                await syslogService.restart(input.port);
                return { success: true, message: `Syslog server restarted on port ${input.port}` };
            }
            return { success: false, message: 'No configuration provided' };
        }),

    /**
     * Get Recent Messages - Buffer de Tempo Real
     * 
     * Retorna as mensagens mais recentes armazenadas no buffer circular
     * em memória (não persiste no banco imediatamente para performance).
     * 
     * @procedure query
     * @param {Object} [input]
     * @param {number} [input.limit] - Máximo de mensagens
     */
    getRecentMessages: protectedProcedure
        .input(z.object({ limit: z.number().optional() }).optional())
        .query(async ({ input }) => {
            return syslogService.getRecentMessages(input?.limit);
        }),

    /**
     * Set Monitored Devices - Filtrar Dispositivos
     * 
     * Define uma lista de IPs/Hostnames para monitoramento exclusivo.
     * Se vazio, o servidor captura logs de todos os dispositivos.
     * 
     * @procedure mutation
     */
    setMonitoredDevices: protectedProcedure
        .input(z.object({ deviceIds: z.array(z.string()) }))
        .mutation(async ({ input }) => {
            const devices = await prisma.device.findMany({
                where: { id: { in: input.deviceIds } },
                select: { ipAddress: true, hostname: true, name: true }
            });

            const identifiers = devices.flatMap(d =>
                [d.ipAddress, d.hostname, d.name].filter(Boolean) as string[]
            );

            await syslogService.setMonitoredDevices(identifiers);
            return { success: true, count: identifiers.length };
        }),

    /**
     * Remove Monitored Device - Parar de monitorar um dispositivo específico
     * 
     * @procedure mutation
     */
    removeMonitoredDevice: protectedProcedure
        .input(z.object({ deviceId: z.string() }))
        .mutation(async ({ input }) => {
            const device = await prisma.device.findUnique({
                where: { id: input.deviceId },
                select: { ipAddress: true, hostname: true, name: true }
            });

            if (device) {
                const identifiers = [device.ipAddress, device.hostname, device.name].filter(Boolean) as string[];
                const status = syslogService.getStatus();
                const currentMonitored = status.monitoredDevices;
                const newMonitored = currentMonitored.filter(id => !identifiers.includes(id));
                await syslogService.setMonitoredDevices(newMonitored);
            }

            return { success: true };
        }),

    /**
     * Get Monitored Devices - Listar dispositivos sendo monitorados no momento
     * 
     * @procedure query
     */
    getMonitoredDevices: protectedProcedure.query(async () => {
        const { monitoredDevices } = syslogService.getStatus();

        if (monitoredDevices.length === 0) return [];

        // Busca dispositivos no banco que batem com os identificadores monitorados
        const devices = await prisma.device.findMany({
            where: {
                OR: [
                    { ipAddress: { in: monitoredDevices } },
                    { hostname: { in: monitoredDevices } },
                    { name: { in: monitoredDevices } }
                ]
            },
            select: { id: true, name: true, ipAddress: true, hostname: true }
        });

        return devices;
    }),

    /**
     * Clear Monitored Devices - Limpar Filtros
     * 
     * @procedure mutation
     */
    clearMonitoredDevices: protectedProcedure.mutation(async () => {
        syslogService.clearMonitoredDevices();
        return { success: true };
    }),

    /**
     * Get Historical Logs - Pesquisa no Banco de Dados
     * 
     * Busca centralizada de logs persistidos com suporte a filtros
     * por data, severidade e dispositivo.
     * 
     * @procedure query
     */
    getHistoricalLogs: protectedProcedure
        .input(z.object({
            deviceId: z.string().optional(),
            severity: z.number().min(0).max(7).optional(),
            limit: z.number().default(100),
            offset: z.number().default(0),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
        }))
        .query(async ({ input }) => {
            const conditions: string[] = [];
            const params: any[] = [];

            if (input.deviceId) {
                params.push(input.deviceId);
                conditions.push(`device_id = $${params.length}`);
            }

            if (input.severity !== undefined) {
                params.push(input.severity);
                conditions.push(`severity <= $${params.length}`);
            }

            if (input.startDate) {
                params.push(new Date(input.startDate));
                conditions.push(`timestamp >= $${params.length}`);
            }

            if (input.endDate) {
                params.push(new Date(input.endDate));
                conditions.push(`timestamp <= $${params.length}`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Query logs without JOIN
            const logsQuery = `
                SELECT s.* 
                FROM syslog_entries s
                ${whereClause}
                ORDER BY timestamp DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `;

            const countQuery = `SELECT COUNT(*) FROM syslog_entries ${whereClause}`;

            const [logsResult, countResult] = await Promise.all([
                syslogPool.query(logsQuery, [...params, input.limit, input.offset]),
                syslogPool.query(countQuery, params)
            ]);

            // Enrich with device info from main DB
            const deviceIds = [...new Set(logsResult.rows.map(row => row.device_id).filter(Boolean))];
            const devices = deviceIds.length > 0
                ? await prisma.device.findMany({ where: { id: { in: deviceIds as string[] } } })
                : [];

            return {
                logs: logsResult.rows.map(row => {
                    const device = devices.find(d => d.id === row.device_id);
                    return {
                        ...row,
                        device: device ? { id: device.id, name: device.name, ipAddress: device.ipAddress } : null
                    };
                }),
                total: parseInt(countResult.rows[0].count)
            };
        }),

    /**
     * Subscribe to Messages - Assinatura em Tempo Real
     * 
     * Abre um stream via WebSocket para receber notificações instantâneas
     * de cada log que chega ao servidor.
     * 
     * @procedure subscription
     */
    subscribeToMessages: protectedProcedure.subscription(() => {
        return observable((emit) => {
            const onMessage = (message: any) => {
                emit.next(message);
            };

            syslogService.on('message', onMessage);

            return () => {
                syslogService.off('message', onMessage);
            };
        });
    }),

    /**
     * Cleanup Old Logs - Manutenção de Histórico
     * 
     * Remove registros antigos do banco de dados para evitar estouro de disco.
     * 
     * @procedure mutation
     */
    cleanupOldLogs: protectedProcedure
        .input(z.object({
            daysOld: z.number().default(30)
        }))
        .mutation(async ({ input }) => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - input.daysOld);

            try {
                const result = await syslogPool.query('DELETE FROM syslog_entries WHERE created_at < $1', [cutoffDate]);
                return {
                    success: true,
                    deleted: result.rowCount,
                    message: `Deleted ${result.rowCount} logs older than ${input.daysOld} days`
                };
            } catch (error: any) {
                console.error('[SyslogRouter] Cleanup failed:', error);
                throw new Error(`Cleanup failed: ${error.message}`);
            }
        }),

    /**
     * Get Log Sources - Listar dispositivos que estão enviando logs
     * 
     * @procedure query
     */
    getLogSources: protectedProcedure.query(async () => {
        const result = await syslogPool.query(`
            SELECT DISTINCT s.device_id,
                   MAX(s.timestamp) as last_log
            FROM syslog_entries s
            GROUP BY s.device_id
            ORDER BY last_log DESC
        `);

        // Enrich with device info from main DB
        const deviceIds = result.rows.map(row => row.device_id).filter(Boolean);
        const devices = deviceIds.length > 0
            ? await prisma.device.findMany({ where: { id: { in: deviceIds as string[] } } })
            : [];

        return result.rows.map(row => {
            const device = devices.find(d => d.id === row.device_id);
            return {
                id: row.device_id,
                name: device?.name || 'Desconhecido',
                ip: device?.ipAddress || row.hostname || 'N/A', // Fallback to hostname if IP not in device
                lastLog: row.last_log
            };
        });
    }),
    /**
     * Get Cleanup Status - Status da limpeza de fundo
     */
    getCleanupStatus: protectedProcedure.query(async () => {
        const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
        return syslogMaintenanceService.getCleanupStatus();
    }),

    /**
     * Trigger Cleanup - Iniciar limpeza manual
     */
    triggerCleanup: protectedProcedure
        .input(z.object({ daysOld: z.number().min(1).default(7) }))
        .mutation(async ({ input }) => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
            // Inicia em background
            syslogMaintenanceService.cleanupSyslogInBatches(input.daysOld).catch(err =>
                console.error('[SyslogRouter] Manual cleanup failed:', err)
            );
            return { success: true, message: 'Cleanup started in background' };
        }),

    /**
     * Clear All - Limpar todos os logs e recuperar espaço total
     */
    clearAll: protectedProcedure
        .mutation(async () => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
            await syslogMaintenanceService.clearAll();
            return { success: true };
        }),

    /**
     * Reclaim Space - Recuperar espaço em disco (VACUUM FULL)
     */
    reclaimSpace: protectedProcedure
        .mutation(async () => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
            await syslogMaintenanceService.reclaimSpace();
            return { success: true };
        }),

    /**
     * Get DB Info - Tamanho e localização
     */
    getDbInfo: protectedProcedure.query(async () => {
        const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
        return syslogMaintenanceService.getDbInfo();
    }),
});
