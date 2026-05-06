/**
 * Router de Tipos de Serviço e Grupos (Torres)
 * 
 * Gerencia a categorização de serviços para o sistema de ticketing (ITSM).
 * Permite organizar serviços em "Torres" (Service Groups) e definir
 * SLAs padrão e prioridades por tipo de serviço.
 * 
 * @module routers/serviceTypeRouter
 */

import { router, protectedProcedure, adminProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { TicketPriority } from '@prisma/client';

export const serviceTypeRouter = router({
    /**
     * List Groups - Listar Grupos e Serviços
     * 
     * Retorna todas as Torres (Service Groups) com seus respectivos
     * tipos de serviço vinculados.
     * 
     * @procedure query
     * @protected Requer autenticação
     */
    listGroups: protectedProcedure.query(async () => {
        return prisma.serviceGroup.findMany({
            include: {
                services: {
                    orderBy: { name: 'asc' }
                }
            },
            orderBy: { name: 'asc' }
        });
    }),

    /**
     * Upsert Group - Criar ou Atualizar Grupo
     * 
     * Cria uma nova Torre ou atualiza uma existente.
     * 
     * @procedure mutation
     * @admin Requer privilégios de administrador
     */
    upsertGroup: adminProcedure
        .input(z.object({
            id: z.string().optional(),
            name: z.string(),
            description: z.string().nullable().optional(),
        }))
        .mutation(async ({ input }) => {
            if (input.id) {
                return prisma.serviceGroup.update({
                    where: { id: input.id },
                    data: {
                        name: input.name,
                        description: input.description,
                    }
                });
            }
            return prisma.serviceGroup.create({
                data: {
                    name: input.name,
                    description: input.description,
                }
            });
        }),

    /**
     * Upsert Service - Criar ou Atualizar Tipo de Serviço
     * 
     * Cria ou atualiza um tipo de serviço, permitindo definir:
     * - Prioridade padrão
     * - Tempo de resposta (SLA Response)
     * - Tempo de resolução (SLA Resolution)
     * 
     * @procedure mutation
     * @admin Requer privilégios de administrador
     */
    upsertService: adminProcedure
        .input(z.object({
            id: z.string().optional(),
            name: z.string(),
            description: z.string().nullable().optional(),
            groupId: z.string(),
            priority: z.nativeEnum(TicketPriority),
            responseTimeMinutes: z.number().nullable(),
            resolutionTimeMinutes: z.number().nullable(),
        }))
        .mutation(async ({ input }) => {
            const data = {
                name: input.name,
                description: input.description,
                groupId: input.groupId,
                priority: input.priority,
                responseTimeMinutes: input.responseTimeMinutes,
                resolutionTimeMinutes: input.resolutionTimeMinutes,
            };

            if (input.id) {
                return prisma.serviceType.update({
                    where: { id: input.id },
                    data
                });
            }
            return prisma.serviceType.create({
                data
            });
        }),

    /**
     * Delete Group - Deletar Torre
     * 
     * Remove uma torre se não houver serviços vinculados.
     * 
     * @procedure mutation
     * @admin Requer privilégios de administrador
     */
    deleteGroup: adminProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            const group = await prisma.serviceGroup.findUnique({
                where: { id: input.id },
                include: { _count: { select: { services: true } } }
            });

            if (group && group._count.services > 0) {
                throw new Error("Não é possível excluir uma torre que possui serviços vinculados.");
            }

            return prisma.serviceGroup.delete({
                where: { id: input.id }
            });
        }),

    /**
     * Delete Service - Deletar Tipo de Serviço
     * 
     * @procedure mutation
     * @admin Requer privilégios de administrador
     */
    deleteService: adminProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            return prisma.serviceType.delete({
                where: { id: input.id }
            });
        }),
});
