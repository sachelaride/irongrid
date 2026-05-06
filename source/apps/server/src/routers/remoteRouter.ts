/**
 * Router de Acesso Remoto
 * 
 * Gerencia solicitações de acesso remoto a dispositivos monitorados.
 * Implementa um sistema de permissões onde o usuário solicita acesso
 * e o agente no dispositivo deve aprovar ou rejeitar.
 * 
 * Funcionalidades:
 * - Solicitar acesso remoto (viewer ou administrator)
 * - Verificar status de solicitações pendentes
 * - Gerenciar permissões via Socket.IO em tempo real
 * - Armazenamento temporário de solicitações ativas em memória
 * 
 * Modos de acesso:
 * - viewer: Apenas visualização (somente leitura)
 * - administrator: Controle total (mouse e teclado)
 * 
 * @module routers/remoteRouter
 * @requires socket.io - Comunicação em tempo real com agentes
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { connectedAgents } from '../agentState';
import { Server as SocketServer } from 'socket.io';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'poller_debug.log');

/**
 * Registra mensagens de debug no arquivo de log
 * @param {string} msg - Mensagem a ser registrada
 */
function logDebug(msg: string) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    try {
        fs.appendFileSync(LOG_FILE, line);
    } catch (e) { }
    console.log(msg);
}

/**
 * Armazenamento em memória de solicitações de acesso ativas
 * Em produção, considere usar Redis ou banco de dados
 */
export const activeRequests = new Map<string, {
    agentId: string,
    mode: 'viewer' | 'administrator',
    status: 'pending' | 'granted' | 'rejected',
    timestamp: number,
    connectionId?: string,
    password?: string,
    proxyPort?: number
}>();

export const remoteRouter = router({
    /**
     * Request Access - Solicitar Acesso Remoto
     * 
     * Cria uma solicitação de acesso remoto a um dispositivo específico.
     * Envia notificação via Socket.IO para o agente aprovar/rejeitar.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.agentId - ID do agente/dispositivo
     * @param {'viewer'|'administrator'} input.mode - Modo de acesso desejado
     * @returns {Promise<{requestId: string}>} ID da solicitação criada
     * @throws {Error} Agente offline ou não encontrado
     * 
     * @example
     * const { requestId } = await trpc.remote.requestAccess.mutate({
     *   agentId: 'agent-123',
     *   mode: 'viewer'
     * });
     */
    requestAccess: protectedProcedure
        .input(z.object({
            agentId: z.string(),
            mode: z.enum(['viewer', 'administrator'])
        }))
        .mutation(async ({ input, ctx }) => {
            logDebug(`[RemoteRouter] requestAccess called for agent ${input.agentId}, mode: ${input.mode}`);
            logDebug(`[RemoteRouter] ctx.io available: ${!!ctx.io}`);
            logDebug(`[RemoteRouter] connectedAgents: ${JSON.stringify(Array.from(connectedAgents.keys()))}`);

            let agent = connectedAgents.get(input.agentId);
            
            // Fallback: If agent no found by ID, try to find by IP address
            if (!agent) {
                logDebug(`[RemoteRouter] Agent ${input.agentId} not found by ID. Searching by IP fallback...`);
                
                // 1. Get the device from DB to find its registered IP
                const { prisma } = await import('../utils/prisma');
                const dbDevice = await prisma.device.findFirst({
                    where: { OR: [{ agentId: input.agentId }, { name: input.agentId }] }
                });

                if (dbDevice && dbDevice.ipAddress) {
                    logDebug(`[RemoteRouter] Found device in DB with IP: ${dbDevice.ipAddress}. Looking for connected agent with this IP...`);
                    
                    // 2. Search connectedAgents for this IP
                    const matchingAgentEntry = Array.from(connectedAgents.entries()).find(
                        ([_, info]) => info.ipAddress === dbDevice.ipAddress
                    );

                    if (matchingAgentEntry) {
                        const [actualAgentId, info] = matchingAgentEntry;
                        logDebug(`[RemoteRouter] Success! Found agent ${actualAgentId} at ${info.ipAddress}. Redirecting request.`);
                        
                        // Use the ACTUAL agentId from the connection
                        agent = info;
                        // Important: Update the agentId for the rest of the flow to use the one the agent is REGISTERED with
                        input.agentId = actualAgentId;
                    }
                }
            }

            if (!agent) {
                logDebug(`[RemoteRouter] Agent ${input.agentId} not found in connectedAgents (even after IP fallback)`);
                throw new Error('Agent offline or not found');
            }

            const requestId = Math.random().toString(36).substring(7);
            activeRequests.set(requestId, {
                agentId: input.agentId,
                mode: input.mode,
                status: 'pending',
                timestamp: Date.now()
            });

            // Emit the access request directly to the agent via Socket.io
            if (ctx.io) {
                const room = `agent:${input.agentId}`;
                console.log(`[RemoteRouter] EMITTING ACCESS-REQUEST: request=${requestId}, agent=${input.agentId}, mode=${input.mode}`);
                logDebug(`[RemoteRouter] Emitting to room: ${room}`);
                ctx.io.to(room).emit('access-request', {
                    requestId,
                    mode: input.mode
                });
                logDebug(`[RemoteRouter] Sent access-request to agent ${input.agentId} for request ${requestId}`);
            } else {
                logDebug('[RemoteRouter] Socket.io instance not available in context');
            }

            return { requestId };
        }),

    /**
     * Check Request Status - Verificar Status de Solicitação
     * 
     * Verifica o status atual de uma solicitação de acesso remoto.
     * Usado para polling até que o agente aprove/rejeite.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.requestId - ID da solicitação
     * @returns {Promise<{status: string, mode?: string, connectionId?: string}>} Status da solicitação
     */
    checkRequestStatus: protectedProcedure
        .input(z.object({ requestId: z.string() }))
        .query(({ input }) => {
            const request = activeRequests.get(input.requestId);
            if (!request) return { status: 'rejected' };
            return {
                status: request.status,
                mode: request.mode,
                connectionId: request.connectionId,
                password: request.password,
                proxyPort: request.proxyPort
            };
        }),
});
