/**
 * Router do Dashboard - Estatísticas e Métricas do Sistema
 * 
 * Responsável por fornecer todas as estatísticas e métricas exibidas no dashboard.
 * Coleta dados de múltiplas fontes (servidor, banco de dados, dispositivos, alertas, tickets)
 * e os organiza para visualização.
 * 
 * Funcionalidades:
 * - Estatísticas do servidor (CPU, RAM, rede, uptime)
 * - Estatísticas de bancos de dados (PostgreSQL, InfluxDB)
 * - Estatísticas globais de dispositivos
 * - Estatísticas técnicas (status de dispositivos, alertas críticos)
 * - Estatísticas administrativas (departamentos, localizações, tickets)
 * - Estatísticas executivas (uptime, SLA, ativos totais)
 * - Logs de auditoria
 * 
 * @module routers/dashboardRouter
 * @requires systeminformation - Coleta de informações do sistema
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import si from 'systeminformation';
import { prisma } from '../utils/prisma';
import { influxDB } from '../services/influxdb';
import { serializeBigInt } from '../utils/serialization';

export const dashboardRouter = router({
    /**
     * Get Server Stats - Estatísticas do Servidor
     * 
     * Retorna métricas em tempo real do servidor onde o IronGrid está executando:
     * - Uso de CPU (percentual de carga)
     * - Uso de memória (total, usado, ativo, percentual)
     * - Tráfego de rede (bytes recebidos/enviados por segundo)
     * - Uptime do sistema
     * 
     * Utiliza a biblioteca systeminformation para coletar dados do sistema operacional.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @returns {Promise<ServerStats>} Estatísticas do servidor
     * @throws {Error} Falha ao coletar estatísticas do servidor
     */
    getServerStats: protectedProcedure.query(async () => {
        try {
            // Coleta métricas básicas do SO de forma asíncrona e paralela
            const [cpu, mem, load, net] = await Promise.all([
                si.currentLoad(),    // Carga atual da CPU
                si.mem(),            // Detalhes da memória RAM
                si.fullLoad(),       // Média de carga total
                si.networkStats()    // Estatísticas de interface de rede
            ]);

            // Obtém dados da primeira interface de rede ativa (throughput)
            const netStats = net[0] || { rx_sec: 0, tx_sec: 0 };

            return serializeBigInt({
                cpu: {
                    load: cpu.currentLoad,
                    temp: 0, // Temperatura depende de permissões/hardware específico
                },
                memory: {
                    total: mem.total,
                    used: mem.used,
                    active: mem.active,
                    percent: (mem.used / mem.total) * 100
                },
                network: {
                    rx_sec: netStats.rx_sec || 0, // Bytes recebidos por segundo
                    tx_sec: netStats.tx_sec || 0, // Bytes enviados por segundo
                },
                uptime: si.time().uptime // Tempo de atividade do sistema em segundos
            });
        } catch (error) {
            console.error('[DashboardRouter] Erro ao buscar estatísticas do servidor:', error);
            throw new Error('Falha ao coletar estatísticas do servidor');
        }
    }),

    /**
     * Get Database Stats - Estatísticas dos Bancos de Dados
     * 
     * Retorna estatísticas de uso dos bancos de dados:
     * - PostgreSQL: tamanho do banco, conexões ativas, status
     * - InfluxDB: bucket configurado, status
     * 
     * @procedure query
     * @protected Requer autenticação
     * @returns {Promise<{postgres: Object, influx: Object}>} Estatísticas dos bancos
     */
    getDatabaseStats: protectedProcedure.query(async () => {
        try {
            // Consulta SQL bruta para obter o tamanho do banco atual e total de conexões no PostgreSQL
            const pgStats: any = await prisma.$queryRaw`
                SELECT 
                    pg_database_size(current_database()) as size_bytes,
                    (SELECT count(*) FROM pg_stat_activity) as active_connections
            `;

            const pgSize = Number(pgStats[0].size_bytes);
            const pgConns = Number(pgStats[0].active_connections);

            // Estatísticas básicas do InfluxDB (Status online se o cliente estiver ativo)
            return {
                postgres: {
                    sizeBytes: pgSize,
                    connections: pgConns,
                    status: 'online'
                },
                influx: {
                    bucket: influxDB.bucket,
                    status: 'online'
                }
            };
        } catch (error) {
            console.error('[DashboardRouter] Erro ao buscar estatísticas do banco de dados:', error);
            return {
                postgres: { sizeBytes: 0, connections: 0, status: 'error' },
                influx: { bucket: '', status: 'error' }
            };
        }
    }),

    /**
     * Get Global Stats - Estatísticas Globais de Dispositivos
     * 
     * Retorna contadores globais de dispositivos:
     * - Total de dispositivos cadastrados
     * - Dispositivos online
     * - Dispositivos offline
     * - Dispositivos monitorados ativamente
     * 
     * @procedure query
     * @protected Requer autenticação
     * @returns {Promise<{total: number, online: number, offline: number, monitored: number}>}
     */
    getGlobalStats: protectedProcedure.query(async () => {
        const p = prisma as any;
        // Executa contagens simultâneas para otimizar o tempo de resposta
        const [totalDevices, onlineDevices, monitoredDevicesCount] = await Promise.all([
            p.device.count(),
            p.device.count({ where: { status: 'ONLINE' } }),
            p.monitoredDevice.count() // Dispositivos que estão com monitoramento ativo (agente ou SNMP)
        ]);

        return {
            total: totalDevices,
            online: onlineDevices,
            offline: totalDevices - onlineDevices,
            monitored: monitoredDevicesCount
        };
    }),

    /**
     * Get Technical Stats - Estatísticas Técnicas
     * 
     * Retorna dados técnicos para perfis técnicos:
     * - Status de todos os dispositivos (com uso de CPU/RAM)
     * - Contagem de alertas críticos ativos
     * - Feed de tickets/incidentes recentes
     * 
     * Respeita controle de acesso: usuários comuns (USER) veem apenas
     * dispositivos e tickets do seu departamento.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @returns {Promise<{deviceStatuses: Device[], criticalAlertsCount: number, incidentFeed: Ticket[]}>}
     */
    getTechnicalStats: protectedProcedure.query(async ({ ctx }) => {
        const p = prisma as any;

        // Se o usuário não for ADMIN, filtra apenas pelo seu departamento
        const deviceWhere = (ctx.user?.role === 'USER' && ctx.user?.departmentId)
            ? { departmentId: ctx.user.departmentId }
            : {};

        const [devices, activeAlerts, recentTickets] = await Promise.all([
            // Lista status simplificado dos dispositivos para o monitor monitorar
            p.device.findMany({
                where: deviceWhere,
                select: { id: true, name: true, status: true, lastCpuUsage: true, lastRamUsage: true }
            }),
            // Conta alertas CRÍTICOS que ainda estão ativos
            p.alert.count({
                where: {
                    status: 'ACTIVE',
                    severity: 'CRITICAL',
                    ...(deviceWhere.departmentId ? { device: { departmentId: deviceWhere.departmentId } } : {})
                }
            }),
            // Busca os 5 chamados mais recentes abertos
            p.ticket.findMany({
                where: {
                    status: 'OPEN',
                    ...(ctx.user?.role === 'USER' ? {
                        OR: [
                            { requesterId: ctx.user.id },
                            { device: { departmentId: ctx.user?.departmentId } }
                        ]
                    } : {})
                },
                take: 5,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return serializeBigInt({
            deviceStatuses: devices,
            criticalAlertsCount: activeAlerts,
            incidentFeed: recentTickets
        });
    }),

    /**
     * Get Administrative Stats - Estatísticas Administrativas
     * 
     * Retorna dados para perfis administrativos:
     * - Contagem de departamentos e localizações
     * - Tamanho do inventário de software
     * - Distribuição de tickets por status
     * 
     * @procedure query
     * @protected Requer autenticação
     * @returns {Promise<{orgCounts: Object, inventorySize: number, ticketDistribution: Array}>}
     */
    getAdministrativeStats: protectedProcedure.query(async () => {
        const p = prisma as any;
        const [depts, locations, swCount, ticketStatus] = await Promise.all([
            p.department.count(),
            p.location.count(),
            p.software.count(), // Total de softwares únicos identificados no inventário
            p.ticket.groupBy({
                by: ['status'],
                _count: { _all: true }
            })
        ]);

        return {
            orgCounts: { depts, locations },
            inventorySize: swCount,
            // Formata o agrupamento de status para um array de objetos simples
            ticketDistribution: (ticketStatus as any[]).map(s => ({ status: s.status, count: s._count._all }))
        };
    }),

    /**
     * Get Executive Stats - Estatísticas Executivas
     * 
     * Retorna KPIs de alto nível para perfis executivos:
     * - Uptime do sistema (percentual de dispositivos online)
     * - Compliance de SLA (taxa de resolução de tickets)
     * - Total de ativos gerenciados
     * 
     * @procedure query
     * @protected Requer autenticação
     * @returns {Promise<{systemUptime: number, slaCompliance: number, totalAssets: number}>}
     */
    getExecutiveStats: protectedProcedure.query(async () => {
        const p = prisma as any;
        const [totalTickets, resolvedTickets, devices] = await Promise.all([
            p.ticket.count(),
            p.ticket.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }),
            p.device.findMany({ select: { status: true } })
        ]);

        // Calcula percentual de ativos online VS total
        const onlineCount = (devices as any[]).filter(d => d.status === 'ONLINE').length;
        const uptimePercent = devices.length > 0 ? (onlineCount / devices.length) * 100 : 100;

        // Calcula taxa de resolução de chamados para medir eficiência do suporte
        const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 100;

        return {
            systemUptime: uptimePercent,
            slaCompliance: resolutionRate,
            totalAssets: devices.length
        };
    }),

    /**
     * Get Stats - Estatísticas Gerais para BI Dashboard
     * 
     * Retorna estatísticas consolidadas para o dashboard de Business Intelligence.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @returns {Promise<{totalAlerts: number}>} Estatísticas gerais
     */
    getStats: protectedProcedure.query(async () => {
        const p = prisma as any;
        const totalAlerts = await p.alert.count({
            where: {
                status: 'ACTIVE',
                severity: 'CRITICAL'
            }
        });

        return {
            totalAlerts
        };
    }),

    /**
     * Get Audit Logs - Obter Logs de Auditoria
     * 
     * Retorna logs de auditoria do sistema, registrando ações importantes
     * realizadas por usuários (quem fez o quê e quando).
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} input
     * @param {number} [input.limit=20] - Número máximo de logs a retornar
     * @returns {Promise<AuditLog[]>} Logs ordenados por data (mais recentes primeiro)
     */
    getAuditLogs: protectedProcedure
        .input(z.object({ limit: z.number().default(20) }))
        .query(async ({ input }) => {
            return (prisma as any).auditLog.findMany({
                take: input.limit,
                orderBy: { createdAt: 'desc' }
            });
        })
});
