/**
 * Router de Descoberta de Rede (Network Discovery)
 * 
 * Centraliza as operações de escaneamento de rede para identificação automática
 * de novos dispositivos, serviços e topologia.
 * 
 * Funcionalidades:
 * - Escaneamento por faixa de IP (Range)
 * - Escaneamento rápido por sub-rede (CIDR)
 * - Acompanhamento de progresso de scan em tempo real
 * - Identificação de serviços via NMAP e SNMP
 * 
 * @module routers/discoveryRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { DiscoveryService } from '../services/discoveryService';
import { serializeBigInt } from '../utils/serialization';

const discoveryService = new DiscoveryService();

// Controle em memória do status dos escaneamentos ativos
const activeScan: Map<string, { status: string, progress: number, found: number }> = new Map();

export const discoveryRouter = router({
    /**
     * Scan Range - Iniciar Scan por Faixa Cadastrada
     * 
     * Dispara um processo de descoberta baseado em uma `NetworkRange`
     * previamente configurada no sistema.
     * 
     * @procedure mutation
     * @param {Object} input
     * @param {string} input.rangeId - ID da faixa de rede
     * @returns {Object} scanId para consulta de status
     */
    scanRange: protectedProcedure
        .input(z.object({ rangeId: z.string() }))
        .mutation(async ({ input }) => {
            const scanId = `scan-${Date.now()}`;

            // Define status inicial
            activeScan.set(scanId, {
                status: 'running',
                progress: 0,
                found: 0
            });

            // Executa o scan em background (assíncrono)
            discoveryService.scanNetworkRange(
                input.rangeId,
                (progress, foundCount) => {
                    const current = activeScan.get(scanId);
                    if (current && current.status !== 'completed' && current.status !== 'failed') {
                        activeScan.set(scanId, {
                            status: 'running',
                            progress: progress,
                            found: foundCount
                        });
                    }
                }
            )
                .then(results => {
                    activeScan.set(scanId, {
                        status: 'completed',
                        progress: 100,
                        found: results.length
                    });
                })
                .catch(err => {
                    console.error('[Discovery] Scan failed:', err);
                    activeScan.set(scanId, {
                        status: 'failed',
                        progress: 0,
                        found: 0
                    });
                });

            return { scanId, message: 'Scan started' };
        }),

    /**
     * Get Scan Status - Consultar Progresso do Scan
     * 
     * @procedure query
     * @param {Object} input
     * @param {string} input.scanId - ID retornado pelo trigger
     */
    getScanStatus: protectedProcedure
        .input(z.object({ scanId: z.string() }))
        .query(async ({ input }) => {
            const status = activeScan.get(input.scanId);
            if (!status) {
                return { status: 'not_found', progress: 0, found: 0 };
            }
            return status;
        }),

    /**
     * Quick Scan - Escaneamento Rápido de Sub-rede
     * 
     * Realiza uma descoberta ad-hoc em uma sub-rede informada em formato CIDR.
     * Permite ajustar a intensidade do scan (quick, deep, stealth).
     * 
     * @procedure mutation
     * @param {Object} input
     * @param {string} input.subnet - Sub-rede (ex: 192.168.1.0/24)
     * @param {string} [input.intensity='quick'] - Nível de detalhamento do scan
     * @param {string} [input.snmpCommunity] - Comunidade SNMP para identificação de ativos
     */
    quickScan: protectedProcedure
        .input(z.object({
            subnet: z.string(),
            intensity: z.enum(['quick', 'deep']).default('quick'),
            snmpCommunity: z.string().optional()
        }))
        .mutation(async ({ input }) => {
            const scanId = `qscan-${Date.now()}`;

            activeScan.set(scanId, {
                status: 'running',
                progress: 0,
                found: 0
            });

            discoveryService.scanRawNetwork(
                input.subnet, 
                input.intensity, 
                input.snmpCommunity,
                (progress, foundCount) => {
                    // Atualização em tempo real das métricas do scanner
                    const current = activeScan.get(scanId);
                    if (current && current.status !== 'completed' && current.status !== 'failed') {
                        activeScan.set(scanId, {
                            status: 'running',
                            progress: progress,
                            found: foundCount
                        });
                    }
                }
            )
                .then(results => {
                    activeScan.set(scanId, {
                        status: 'completed',
                        progress: 100,
                        found: results.length
                    });
                    (activeScan.get(scanId) as any).results = results;
                })
                .catch(err => {
                    console.error('[Discovery] Quick Scan failed:', err);
                    activeScan.set(scanId, {
                        status: 'failed',
                        progress: 0,
                        found: 0
                    });
                });

            return { scanId, message: 'Quick Scan started' };
        }),

    /**
     * Get Scan Results - Obter Resultados Detalhados
     * 
     * Retorna a lista de dispositivos encontrados e seus detalhes técnicos
     * após a conclusão do escaneamento.
     * 
     * @procedure query
     */
    getScanResults: protectedProcedure
        .input(z.object({ scanId: z.string() }))
        .query(async ({ input }) => {
            const status = activeScan.get(input.scanId);
            return serializeBigInt(status || { status: 'not_found', progress: 0, found: 0 });
        }),
});
