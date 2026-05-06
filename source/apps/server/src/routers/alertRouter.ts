/**
 * Router de Gerenciamento de Alertas
 * 
 * Responsável por todas as operações relacionadas a alertas do sistema.
 * Alertas são notificações automáticas ou manuais sobre eventos importantes
 * que requerem atenção, como dispositivos offline, uso excessivo de recursos, etc.
 * 
 * Funcionalidades:
 * - Listagem de alertas com filtros (status, severidade, dispositivo)
 * - Reconhecimento de alertas (acknowledge)
 * - Resolução de alertas
 * - Criação manual de alertas
 * - Integração com sistema de tickets
 * 
 * @module routers/alertRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AlertSeverity, AlertStatus } from '@prisma/client';
import { AlertService } from '../services/alertService';
import { TRPCError } from '@trpc/server';

const alertService = new AlertService();

export const alertRouter = router({
    /**
     * List - Listar Alertas com Filtros
     * 
     * Retorna lista de alertas do sistema com suporte a filtros por:
     * - Status (ACTIVE, ACKNOWLEDGED, RESOLVED)
     * - Severidade (INFO, WARNING, CRITICAL)
     * - Dispositivo específico
     * 
     * Inclui relacionamentos com dispositivo e tickets associados.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} [input] - Filtros opcionais
     * @param {AlertStatus} [input.status] - Filtrar por status
     * @param {AlertSeverity} [input.severity] - Filtrar por severidade
     * @param {string} [input.deviceId] - Filtrar por dispositivo
     * @returns {Promise<Alert[]>} Lista de alertas ordenados por data (mais recentes primeiro)
     */
    list: protectedProcedure
        .input(z.object({
            status: z.nativeEnum(AlertStatus).optional(),
            severity: z.nativeEnum(AlertSeverity).optional(),
            deviceId: z.string().optional(),
        }).optional())
        .query(async ({ input }) => {
            return prisma.alert.findMany({
                where: {
                    ...(input?.status ? { status: input.status } : {}),
                    ...(input?.severity ? { severity: input.severity } : {}),
                    ...(input?.deviceId ? { deviceId: input.deviceId } : {}),
                },
                include: {
                    device: { select: { name: true, ipAddress: true } },
                    tickets: { select: { id: true, ticketNumber: true, status: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }),

    /**
     * Acknowledge - Reconhecer Alerta
     * 
     * Marca um alerta como reconhecido (ACKNOWLEDGED), indicando que
     * alguém está ciente do problema mas ainda não foi resolvido.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.id - ID do alerta
     * @returns {Promise<Alert>} Alerta atualizado
     */
    acknowledge: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            return prisma.alert.update({
                where: { id: input.id },
                data: { status: AlertStatus.ACKNOWLEDGED }
            });
        }),

    /**
     * Resolve - Resolver Alerta
     * 
     * Marca um alerta como resolvido (RESOLVED), indicando que o
     * problema foi solucionado. Utiliza o AlertService para lógica adicional.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.id - ID do alerta
     * @returns {Promise<Alert>} Alerta resolvido
     */
    resolve: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            return alertService.resolveAlert(input.id);
        }),

    /**
     * Create Manual - Criar Alerta Manual
     * 
     * Permite criar alertas manualmente, útil para documentar
     * problemas identificados manualmente ou eventos planejados.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.title - Título do alerta
     * @param {string} input.message - Descrição detalhada
     * @param {AlertSeverity} input.severity - Nível de severidade
     * @param {string} [input.deviceId] - ID do dispositivo relacionado (opcional)
     * @returns {Promise<Alert>} Alerta criado
     */
    createManual: protectedProcedure
        .input(z.object({
            title: z.string(),
            message: z.string(),
            severity: z.nativeEnum(AlertSeverity),
            deviceId: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem criar alertas manualmente' });
            }
            return alertService.createAlert(input);
        }),

    getAlert: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            return prisma.alert.findUnique({
                where: { id: input.id },
                include: {
                    device: true,
                    tickets: true
                }
            });
        }),

    deleteAlert: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem deletar alertas' });
            }
            return prisma.alert.delete({ where: { id: input.id } });
        }),

    bulkDeleteAlerts: protectedProcedure
        .input(z.object({ ids: z.array(z.string()) }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem deletar alertas em massa' });
            }
            return prisma.alert.deleteMany({
                where: { id: { in: input.ids } }
            });
        })
});
