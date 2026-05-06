/**
 * Router de Ações Remotas (Agent Control)
 * 
 * Gerencia a execução de comandos e scripts nos dispositivos que possuem
 * o agente IronGrid instalado.
 * 
 * Funcionalidades:
 * - Execução de scripts remotos (PowerShell/Bash)
 * - Gestão de serviços do sistema (Start/Stop/Restart)
 * - Controle de energia (Reboot/Shutdown)
 * - Deploy silencioso de software
 * - Auditoria de execuções remotas
 * 
 * @module routers/actionRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { connectedAgents } from '../agentState';
import { AuditService } from '../services/auditService';
import { RemoteActionService } from '../services/remoteActionService';

const remoteActionService = new RemoteActionService();

export const actionRouter = router({
    /**
     * List Logs - Listar Histórico de Ações
     * 
     * Retorna os registros de ações executadas remotamente, permitindo
     * auditar quem executou o que e em qual dispositivo.
     * 
     * @procedure query
     * @param {Object} input
     * @param {string} [input.deviceId] - Filtrar por dispositivo
     * @param {number} [input.limit=50] - Limite de registros
     */
    listLogs: protectedProcedure
        .input(z.object({
            deviceId: z.string().optional(),
            limit: z.number().min(1).max(100).default(50),
        }))
        .query(async ({ input, ctx }) => {
            return prisma.remoteActionLog.findMany({
                where: {
                    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
                    ...(ctx.user?.role === 'USER' ? { device: { departmentId: ctx.user.departmentId } } : {})
                },
                orderBy: { startedAt: 'desc' },
                take: input.limit,
                include: { device: { select: { name: true, hostname: true, ipAddress: true } } }
            });
        }),

    /**
     * Trigger Action - Disparar Ação Remota via Agente
     * 
     * Envia um comando para o agente conectado para execução imediata.
     * Possui travas de segurança baseadas em role e departamento.
     * 
     * @procedure mutation
     * @param {Object} input
     * @param {string} input.deviceId - ID do dispositivo alvo
     * @param {string} input.action - Tipo de ação (executeScript, manageService, etc)
     * @param {any} input.parameters - Parâmetros específicos da ação
     */
    triggerAction: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            action: z.enum(['executeScript', 'manageService', 'systemControl', 'deploySoftware', 'usbControl', 'notify']),
            parameters: z.any(),
        }))
        .mutation(async ({ input, ctx }) => {
            const device = await prisma.device.findUnique({
                where: { id: input.deviceId },
                select: { id: true, agentId: true, departmentId: true }
            });

            if (!device || !device.agentId) {
                throw new Error('Dispositivo não encontrado ou não gerenciado por agente.');
            }

            // Segurança: Usuários comuns só operam em seu departamento
            if (ctx.user?.role === 'USER' && device.departmentId !== ctx.user.departmentId) {
                throw new Error('Você não tem permissão para executar ações neste dispositivo.');
            }

            // Segurança: Reboot/Shutdown restrito a técnicos/admins
            if (ctx.user?.role === 'USER' && input.action === 'systemControl') {
                throw new Error('Ações de controle de sistema (reboot/shutdown) são restritas a técnicos.');
            }

            if (!ctx.io) throw new Error('Erro Interno: Socket não disponível no contexto.');

            return remoteActionService.triggerAction(ctx.io, {
                agentId: device.agentId,
                action: input.action,
                parameters: input.parameters,
                userId: ctx.user.id
            });
        }),

    /**
     * USB Control - Bloquear/Desbloquear USB em um dispositivo
     */
    usbControl: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            command: z.enum(['block', 'unblock'])
        }))
        .mutation(async ({ input, ctx }) => {
            const device = await prisma.device.findUnique({
                where: { id: input.deviceId },
                select: { id: true, agentId: true }
            });

            if (!device?.agentId) {
                throw new Error('Dispositivo não encontrado ou sem agente instalado.');
            }

            if (!ctx.io) throw new Error('Erro Interno: Socket não disponível.');

            return remoteActionService.triggerAction(ctx.io, {
                agentId: device.agentId,
                action: 'usbControl',
                parameters: { command: input.command },
                userId: ctx.user.id
            });
        }),
});
