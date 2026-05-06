import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { CronService } from '../services/cronService';
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'cron_logs');

export const cronRouter = router({
    /**
     * List Cron Jobs - Listar Tarefas Agendadas
     */
    listJobs: protectedProcedure.query(async () => {
        return (prisma as any).cronJob.findMany({
            orderBy: { createdAt: 'desc' },
            include: { logs: { take: 1, orderBy: { startedAt: 'desc' } } }
        });
    }),

    /**
     * Create Cron Job - Criar Nova Tarefa
     */
    createJob: protectedProcedure
        .input(z.object({
            name: z.string(),
            schedule: z.string(),
            action: z.string(),
            parameters: z.any().optional(),
            targetId: z.string().optional()
        }))
        .mutation(async ({ input }) => {
            const job = await (prisma as any).cronJob.create({
                data: input
            });
            
            if (job.enabled) {
                CronService.scheduleJob(job);
            }
            
            return job;
        }),

    /**
     * Update Cron Job - Atualizar Tarefa
     */
    updateJob: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            schedule: z.string().optional(),
            action: z.string().optional(),
            parameters: z.any().optional(),
            targetId: z.string().optional(),
            enabled: z.boolean().optional()
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            const job = await (prisma as any).cronJob.update({
                where: { id },
                data
            });
            
            if (job.enabled) {
                CronService.scheduleJob(job);
            } else {
                CronService.unscheduleJob(id);
            }
            
            return job;
        }),

    /**
     * Remove Cron Job - Deletar Tarefa
     */
    removeJob: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            CronService.unscheduleJob(input.id);
            return (prisma as any).cronJob.delete({ where: { id: input.id } });
        }),

    /**
     * Execute Now - Disparo Manual
     */
    executeNow: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            // Executa em background para não travar a requisição UI
            CronService.executeJob(input.id).catch(console.error);
            return { success: true };
        }),

    /**
     * Get Latest Log - Ler o arquivo de log atual
     */
    getLatestLog: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const logFilePath = path.join(LOG_DIR, `job_${input.id}.log`);
            if (fs.existsSync(logFilePath)) {
                return fs.readFileSync(logFilePath, 'utf-8');
            }
            return 'Nenhuma execução registrada.';
        }),

    /**
     * List Executions - Histórico de execuções do DB
     */
    listExecutions: protectedProcedure
        .input(z.object({ jobId: z.string(), limit: z.number().default(20) }))
        .query(async ({ input }) => {
            return (prisma as any).cronJobLog.findMany({
                where: { cronJobId: input.jobId },
                orderBy: { startedAt: 'desc' },
                take: input.limit
            });
        }),
});
