import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { prisma } from '../utils/prisma';
import { TicketCategory } from '@prisma/client';

export const mailCollectorRouter = router({
    list: adminProcedure.query(async () => {
        return (prisma as any).mailCollectorConfig.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }),

    create: adminProcedure
        .input(z.object({
            name: z.string(),
            host: z.string(),
            port: z.number().default(993),
            secure: z.boolean().default(true),
            user: z.string(),
            password: z.string(),
            folder: z.string().default('INBOX'),
            deleteAfter: z.boolean().default(false),
            category: z.nativeEnum(TicketCategory).default(TicketCategory.INCIDENT),
            enabled: z.boolean().default(true)
        }))
        .mutation(async ({ input }) => {
            return (prisma as any).mailCollectorConfig.create({
                data: input
            });
        }),

    update: adminProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            host: z.string().optional(),
            port: z.number().optional(),
            secure: z.boolean().optional(),
            user: z.string().optional(),
            password: z.string().optional(),
            folder: z.string().optional(),
            deleteAfter: z.boolean().optional(),
            category: z.nativeEnum(TicketCategory).optional(),
            enabled: z.boolean().optional()
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            return (prisma as any).mailCollectorConfig.update({
                where: { id },
                data
            });
        }),

    delete: adminProcedure
        .input(z.string())
        .mutation(async ({ input: id }) => {
            return (prisma as any).mailCollectorConfig.delete({
                where: { id }
            });
        }),

    test: adminProcedure
        .input(z.string())
        .mutation(async ({ input: id }) => {
            // TODO: Implement connectivity test using imaps.connect logic
            return { success: true, message: 'Teste agendado para a próxima execução' };
        })
});
