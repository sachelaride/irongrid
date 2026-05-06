/**
 * Serviço de Ações Remotas (Remote Execution)
 * 
 * Permite o disparo de comandos e scripts para serem executados nos Agentes IronGrid
 * de forma assíncrona. Utiliza WebSockets (Socket.io) para comunicação em tempo real
 * e mantém um log persistente de todas as execuções para fins de auditoria.
 * 
 * Funcionalidades:
 * - Execução de Scripts (PowerShell/Bash)
 * - Gestão de Serviços (Start/Stop/Restart)
 * - Controle de Sistema (Reboot/Shutdown)
 * - Deploy de Software
 * 
 * @module services/remoteActionService
 */

import { prisma } from '../utils/prisma';
import { connectedAgents } from '../agentState';
import { Server as SocketServer } from 'socket.io';
import { AuditService } from './auditService';
import fs from 'fs';
import path from 'path';

export class RemoteActionService {
    /**
     * Trigger Action - Disparar ação remota para um agente
     * 
     * Valida se o agente está online, cria um registro de log com status PENDING,
     * emite o evento via Socket e registra a ação na auditoria do sistema.
     * 
     * @param {SocketServer} io - Instância do servidor Socket.io
     * @param {Object} params - Parâmetros da ação
     * @param {string} params.agentId - ID único do Agente destino
     * @param {'executeScript' | 'manageService' | 'systemControl' | 'deploySoftware'} params.action - Tipo da ação
     * @param {any} params.parameters - Argumentos específicos da ação (ex: nome do serviço)
     * @param {string} [params.userId] - Usuário que solicitou a ação
     * @returns {Promise<Object>} Registro do log criado
     */
    async triggerAction(io: SocketServer, params: {
        agentId: string;
        action: 'executeScript' | 'manageService' | 'systemControl' | 'deploySoftware' | 'usbControl' | 'notify';
        parameters: any;
        userId?: string;
    }) {
        const agent = connectedAgents.get(params.agentId);
        if (!agent) {
            throw new Error('Agent offline or not found');
        }

        // 1. Identifica o dispositivo vinculado ao Agente
        const device = await prisma.device.findFirst({
            where: {
                OR: [
                    { agentId: params.agentId },
                    { hostname: params.agentId },
                    { ipAddress: agent.ipAddress }
                ]
            }
        });

        if (!device) {
            throw new Error('Device not found for this agent');
        }

        // 2. Cria Log de Progresso
        const log = await prisma.remoteActionLog.create({
            data: {
                deviceId: device.id,
                action: params.action,
                parameters: params.parameters,
                status: 'PENDING',
                userId: params.userId
            }
        });

        // 3. Emite comando via canal privado do Agente (Socket.io room)
        io.to(`agent:${params.agentId}`).emit('remote-action', {
            logId: log.id,
            action: params.action,
            parameters: params.parameters
        });

        // 4. Registro de Auditoria detalhado
        await AuditService.log({
            action: `REMOTE_${params.action.toUpperCase()}`,
            resource: 'Device',
            resourceId: device.id,
            userId: params.userId,
            details: { logId: log.id, parameters: params.parameters }
        });

        return log;
    }

    /**
     * Handle Result - Processar retorno do Agente
     * 
     * Atualiza o log da ação remota com o output, erro ou código de saída
     * retornado pelo script executado no host remoto.
     * 
     * @param {Object} data - Dados de retorno do agente
     */
    async handleResult(data: {
        logId: string;
        status: 'SUCCESS' | 'FAILED';
        output?: string;
        error?: string;
        exitCode?: number;
    }) {
        const actionLog = await prisma.remoteActionLog.findUnique({ where: { id: data.logId } });

        if (!actionLog) {
            console.warn(`[RemoteAction] Received result for non-existent logId: ${data.logId}. Ignoring update.`);
            return null;
        }

        const updatedLog = await prisma.remoteActionLog.update({
            where: { id: data.logId },
            data: {
                status: data.status,
                output: data.output,
                error: data.error,
                exitCode: data.exitCode,
                completedAt: new Date()
            }
        });

        // Sincronizar com CronJobLog se este for um agendamento
        const params = actionLog?.parameters as any;
        if (params?.cronJobLogId) {
            try {
                const cronLog = await (prisma as any).cronJobLog.findUnique({
                    where: { id: params.cronJobLogId }
                });

                if (cronLog) {
                    const logDir = path.join(process.cwd(), 'cron_logs');
                    const logFilePath = path.join(logDir, `job_${cronLog.cronJobId}.log`);
                    
                    const resultText = data.status === 'SUCCESS' ? 'SUCESSO' : 'FALHA';
                    const outputContent = data.output || data.error || 'Sem output do agente';
                    
                    if (fs.existsSync(logFilePath)) {
                        fs.appendFileSync(logFilePath, `\n--- Resultado do Agente (${resultText}) ---\n${outputContent}\n--- Fim da Execução: ${new Date().toLocaleString()} ---\n`);
                    }

                    await (prisma as any).cronJobLog.update({
                        where: { id: params.cronJobLogId },
                        data: {
                            status: data.status,
                            output: outputContent,
                            error: data.error,
                            finishedAt: new Date()
                        }
                    });

                    await (prisma as any).cronJob.update({
                        where: { id: cronLog.cronJobId },
                        data: { lastRun: new Date() }
                    });
                }
            } catch (err) {
                console.error('[RemoteAction] Erro ao sincronizar log de cron:', err);
            }
        }

        return updatedLog;
    }
}
