/**
 * Router de Monitoramento de Métricas
 * 
 * Responsável por consultar e retornar métricas de monitoramento de dispositivos
 * armazenadas no InfluxDB. Fornece dados de tráfego de rede e outras métricas
 * em séries temporais para visualização em gráficos.
 * 
 * Funcionalidades:
 * - Consulta de métricas de dispositivos por IP
 * - Suporte a múltiplos intervalos de tempo (1h, 24h, 7d)
 * - Agregação de dados de tráfego (entrada/saída)
 * - Formatação de dados para visualização
 * 
 * @module routers/monitoringRouter
 * @requires services/influxdb - Cliente InfluxDB para consultas de métricas
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { influxDB } from '../services/influxdb';
import { prisma } from '../utils/prisma';

export const monitoringRouter = router({
    /**
     * Get Device Metrics - Obter Métricas de Dispositivo
     * 
     * Retorna séries temporais de métricas de tráfego de rede para um dispositivo específico.
     * Consulta o InfluxDB para obter dados de bytes de entrada (ifInOctets) e saída (ifOutOctets)
     * agregados por minuto.
     * 
     * Intervalos suportados:
     * - '1h': Última hora
     * - '24h': Últimas 24 horas
     * - '7d': Últimos 7 dias
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.deviceIp - Endereço IP do dispositivo
     * @param {'1h'|'24h'|'7d'} [input.timeRange='1h'] - Intervalo de tempo
     * @returns {Promise<Array<{timestamp: string, bytesIn: number, bytesOut: number}>>} Série temporal de métricas
     * 
     * @example
     * const metrics = await trpc.monitoring.getDeviceMetrics.query({
     *   deviceIp: '192.168.1.1',
     *   timeRange: '24h'
     * });
     */
    getDeviceMetrics: protectedProcedure
        .input(
            z.object({
                deviceIp: z.string(),
                timeRange: z.enum(['1h', '24h', '7d']).default('1h'),
            })
        )
        .query(async ({ input }) => {
            const { deviceIp, timeRange } = input;
            // Mapeamento do intervalo de tempo para a sintaxe do Flux (InfluxDB)
            const durationMap = {
                '1h': '-1h',
                '24h': '-24h',
                '7d': '-7d',
            } as const;
            const duration = durationMap[timeRange];

            /**
             * Query Flux para o InfluxDB:
             * 1. Define o bucket e o intervalo de tempo (range).
             * 2. Filtra pela medição 'interface_traffic'.
             * 3. Filtra pelo IP do dispositivo específico.
             * 4. Filtra pelos campos de tráfego de entrada e saída.
             * 5. Agrega os dados em janelas de 1 minuto calculando a média.
             */
            const query = `
        from(bucket: "${influxDB.bucket}")
          |> range(start: ${duration})
          |> filter(fn: (r) => r["_measurement"] == "interface_traffic")
          |> filter(fn: (r) => r["device"] == "${deviceIp}")
          |> filter(fn: (r) => r["_field"] == "ifInOctets" or r["_field"] == "ifOutOctets")
          |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
          |> yield(name: "mean")
      `;

            try {
                // Executa a consulta e processa as linhas retornadas
                const result = await influxDB.queryRows(query) as any[];
                // Agrupa os resultados por timestamp para combinar entrada e saída no mesmo objeto
                const grouped = new Map<string, { bytesIn?: number; bytesOut?: number }>();

                for (const row of result) {
                    const timestamp = row._time as string;
                    const field = row._field as string;
                    const value = row._value as number;

                    if (!grouped.has(timestamp)) grouped.set(timestamp, {});
                    const entry = grouped.get(timestamp)!;

                    // Atribui o valor ao campo correspondente (In ou Out)
                    if (field === 'ifInOctets') entry.bytesIn = value;
                    else if (field === 'ifOutOctets') entry.bytesOut = value;
                }

                // Converte o Map em um array formatado para o frontend (charts)
                const data = [] as Array<{ timestamp: string; bytesIn: number; bytesOut: number }>;
                for (const [timestamp, vals] of grouped.entries()) {
                    data.push({
                        timestamp,
                        bytesIn: vals.bytesIn || 0,
                        bytesOut: vals.bytesOut || 0
                    });
                }

                // Ordena os dados cronologicamente
                data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                return data;
            } catch (error) {
                console.error('[Monitoring] Erro na consulta ao InfluxDB:', error);
                return [];
            }
        }),

    /**
     * Get Monitoring Configs - Obter Configurações de Monitoramento
     * 
     * Retorna as configurações dos 3 níveis de monitoramento.
     */
    getMonitoringConfigs: protectedProcedure
        .query(async () => {
            const configs = await prisma.monitoringConfig.findMany({
                orderBy: { level: 'asc' }
            });

            // Se não existirem, cria os 3 níveis padrão
            if (configs.length === 0) {
                const defaults = [
                    { level: 1, downtimeThreshold: 5, uptimeThreshold: 2, latencyThreshold: 200, email: '' },
                    { level: 2, downtimeThreshold: 15, uptimeThreshold: 5, latencyThreshold: 500, email: '' },
                    { level: 3, downtimeThreshold: 60, uptimeThreshold: 10, latencyThreshold: 1000, email: '' }
                ];

                for (const d of defaults) {
                    await prisma.monitoringConfig.create({ data: d });
                }

                return prisma.monitoringConfig.findMany({ orderBy: { level: 'asc' } });
            }

            return configs;
        }),

    /**
     * Update Monitoring Config - Atualizar Configuração de Monitoramento
     */
    updateMonitoringConfig: protectedProcedure
        .input(z.object({
            level: z.number(),
            downtimeThreshold: z.number(),
            uptimeThreshold: z.number(),
            latencyThreshold: z.number(),
            email: z.string().optional(),
            enabled: z.boolean().optional()
        }))
        .mutation(async ({ input }) => {
            return prisma.monitoringConfig.update({
                where: { level: input.level },
                data: input
            });
        }),

    /**
     * Set Device Monitoring Level - Definir Nível de Monitoramento do Dispositivo
     */
    setDeviceMonitoringLevel: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            level: z.number() // 0 for none, 1, 2, 3
        }))
        .mutation(async ({ input }) => {
            return prisma.device.update({
                where: { id: input.deviceId },
                data: { monitoringLevel: input.level }
            });
        }),

    /**
     * Get Devices With Levels - Obter Dispositivos e Seus Níveis Atuais
     */
    getDevicesWithLevels: protectedProcedure
        .query(async () => {
            return prisma.device.findMany({
                select: {
                    id: true,
                    name: true,
                    ipAddress: true,
                    monitoringLevel: true,
                    status: true
                },
                orderBy: { name: 'asc' }
            });
        }),
});
