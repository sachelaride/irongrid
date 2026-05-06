/**
 * Router de Gestão de Manutenção de Ativos
 * 
 * Responsável pelo registro histórico e agendamento de intervenções técnicas
 * nos dispositivos da rede.
 * 
 * Funcionalidades:
 * - Agendamento de manutenções preventivas e corretivas
 * - Controle de custos de manutenção por ativo
 * - Histórico de intervenções e upgrades de hardware
 * - Gestão de status de ordens de serviço (Scheduled, In Progress, Completed, Cancelled)
 * 
 * @module routers/maintenanceRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { TRPCError } from '@trpc/server';

export const maintenanceRouter = router({
    /**
     * List Records - Listar Registros de Manutenção
     * 
     * Retorna o histórico de manutenções com base em filtros de dispositivo ou status.
     * 
     * @procedure query
     * @param {Object} [input]
     * @param {string} [input.deviceId] - Filtrar por um ativo específico
     * @param {string} [input.status] - Filtrar por estado da manutenção
     */
    listRecords: protectedProcedure
        .input(z.object({
            deviceId: z.string().optional(),
            status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
        }).optional())
        .query(async ({ input }) => {
            return prisma.maintenanceRecord.findMany({
                where: {
                    deviceId: input?.deviceId,
                    status: input?.status
                },
                include: {
                    device: { select: { name: true, ipAddress: true } }
                },
                orderBy: { scheduledDate: 'desc' }
            });
        }),

    /**
     * Get Record - Detalhes do Registro de Manutenção
     * 
     * @procedure query
     */
    getRecord: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            return prisma.maintenanceRecord.findUnique({
                where: { id: input.id },
                include: {
                    device: true
                }
            });
        }),

    /**
     * Create Record - Criar Nova Ordem de Manutenção
     * 
     * @procedure mutation
     */
    createRecord: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            title: z.string(),
            description: z.string().optional(),
            type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'UPGRADE', 'REPLACEMENT']),
            status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
            cost: z.number().optional(),
            performer: z.string().optional(),
            scheduledDate: z.date().or(z.string()).default(new Date().toISOString()),
        }))
        .mutation(async ({ input, ctx }) => {
            const allowedRoles = ['ADMIN', 'OPERATOR', 'TECNICO'];
            if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores, operadores ou técnicos podem criar registros de manutenção' });
            }
            const date = new Date(input.scheduledDate);
            return prisma.maintenanceRecord.create({
                data: {
                    ...input,
                    scheduledDate: date
                }
            });
        }),

    /**
     * Update Record - Atualizar Registro de Manutenção
     * 
     * Permite alterar o status, registrar custos ou data de conclusão.
     * 
     * @procedure mutation
     */
    updateRecord: protectedProcedure
        .input(z.object({
            id: z.string(),
            title: z.string().optional(),
            description: z.string().optional(),
            status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
            cost: z.number().optional(),
            performer: z.string().optional(),
            completedAt: z.date().or(z.string()).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const allowedRoles = ['ADMIN', 'OPERATOR', 'TECNICO'];
            if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores, operadores ou técnicos podem atualizar registros de manutenção' });
            }
            const { id, ...data } = input;
            const updateData: any = { ...data };
            if (data.completedAt) updateData.completedAt = new Date(data.completedAt);

            return prisma.maintenanceRecord.update({
                where: { id },
                data: updateData
            });
        }),

    /**
     * Delete Record - Remover Registro de Manutenção
     * 
     * @procedure mutation
     */
    deleteRecord: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem deletar registros de manutenção' });
            }
            return prisma.maintenanceRecord.delete({ where: { id: input.id } });
        })
});
