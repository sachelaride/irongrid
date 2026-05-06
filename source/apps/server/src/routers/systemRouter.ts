/**
 * Router de Administração do Sistema
 * 
 * Centraliza operações de manutenção, backup, restore e configurações globais
 * da aplicação IronGrid.
 * 
 * Funcionalidades:
 * - Monitoramento de saúde do banco de dados (PG/Influx)
 * - Gestão de política de retenção de dados
 * - Rotinas de limpeza (cleanup) de logs e métricas
 * - Sistema de Backup e Restore (Snapshot do banco)
 * - Parâmetros globais de configuração do sistema
 * 
 * @module routers/systemRouter
 */

import { router, protectedProcedure, publicProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { MaintenanceService } from '../services/maintenanceService';
import { syslogService } from '../services/syslogService';

const maintenanceService = new MaintenanceService();

export const systemRouter = router({
    /**
     * Get Maintenance Status - Status de Saúde do Sistema
     * 
     * Retorna as configurações de retenção atuais e o status de saúde
     * das bases de dados (PostgreSQL e InfluxDB).
     * 
     * @procedure query
     */
    getMaintenanceStatus: protectedProcedure.query(async () => {
        const settings = await maintenanceService.getSettings();
        const health = await maintenanceService.getDatabaseHealth();
        return { settings, health };
    }),

    /**
     * Get System Customization - Parâmetros de Customização
     */
    getSystemCustomization: protectedProcedure.query(async () => {
        return await maintenanceService.getSystemCustomization();
    }),

    /**
     * Update System Customization - Atualizar Parâmetros de Customização
     */
    updateSystemCustomization: protectedProcedure
        .input(z.object({
            ticketAutoCloseDays: z.number().min(1),
            ticketDefaultRating: z.number().min(1).max(5),
            companyName: z.string(),
            workingHours: z.string(),
            dashSlaGoal: z.number().min(0).max(100),
            dashStorageCritical: z.number().min(0).max(100),
            dashStorageWarning: z.number().min(0).max(100),
            syslogRecordingEnabled: z.boolean()
        }))
        .mutation(async ({ input }) => {
            await maintenanceService.saveSystemCustomization(input);
            // Refresh Syslog config in real-time
            await syslogService.refreshConfig().catch(err => 
                console.error('[SystemRouter] Failed to refresh Syslog config:', err)
            );
            return { success: true };
        }),

    /**
     * Update Retention Settings - Atualizar Política de Retenção
     * 
     * Define por quanto tempo logs e métricas devem ser mantidos antes
     * de serem descartados automaticamente.
     * 
     * @procedure mutation
     * @param {Object} input
     * @param {number} input.logsDays - Dias de retenção para logs
     * @param {number} input.metricsDays - Dias de retenção para métricas no Influx
     */
    updateRetentionSettings: protectedProcedure
        .input(z.object({
            logsDays: z.number().min(1),
            metricsDays: z.number().min(1),
            syslogDays: z.number().min(1).optional()
        }))
        .mutation(async ({ input }) => {
            await maintenanceService.saveSettings(input.logsDays, input.metricsDays, input.syslogDays);
            return { success: true };
        }),

    /**
     * Trigger Cleanup - Iniciar Limpeza Manual
     * 
     * Executa imediatamente a rotina de descarte de dados antigos baseada
     * nas configurações de retenção.
     * 
     * @procedure mutation
     * @param {Object} [input]
     * @param {string[]} [input.targets] - Alvos da limpeza (audit, notification, remote, metrics)
     */
    triggerCleanup: protectedProcedure
        .input(z.object({
            targets: z.array(z.string()).optional() // ['audit', 'notification', 'remote', 'metrics']
        }).optional())
        .mutation(async ({ input }) => {
            const targets = input?.targets || ['audit', 'notification', 'remote'];
            const result = await maintenanceService.runCleanup(targets);
            return { success: true, result };
        }),

    /**
     * Cleanup Syslog DB - Limpar banco de dados de Syslog
     *
     * Remove entradas da tabela syslog_entries mais antigas que N dias.
     */
    cleanupSyslogDb: protectedProcedure
        .input(z.object({
            daysOld: z.number().min(1).default(30)
        }))
        .mutation(async ({ input }) => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');

            // Inicia o processo em background
            syslogMaintenanceService.cleanupSyslogInBatches(input.daysOld);

            return {
                success: true,
                message: `Processo de limpeza iniciado em background (retenção: ${input.daysOld} dias). Verifique o log para progresso.`
            };
        }),

    /**
     * Get Syslog Cleanup Status - Verifica se há limpeza em andamento
     */
    getSyslogCleanupStatus: protectedProcedure
        .query(async () => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
            return syslogMaintenanceService.getCleanupStatus();
        }),

    /**
     * Clear All Syslog - Apagar todos os logs e recuperar espaço total
     */
    clearAllSyslog: protectedProcedure
        .mutation(async () => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
            await syslogMaintenanceService.clearAll();
            return { success: true };
        }),

    /**
     * Reclaim Syslog Space - Recuperar espaço em disco (VACUUM FULL)
     */
    reclaimSyslogSpace: protectedProcedure
        .mutation(async () => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
            await syslogMaintenanceService.reclaimSpace();
            return { success: true };
        }),


    // --- Backup & Restore ---

    /**
     * Create Backup - Gerar Snapshot do Sistema
     * 
     * Cria um arquivo compactado contendo o dump do banco de dados relacional.
     * 
     * @procedure mutation
     */
    createBackup: protectedProcedure
        .mutation(async () => {
            return await maintenanceService.createBackup();
        }),

    /**
     * List Backups - Listar Arquivos de Backup
     * 
     * Retorna a lista de backups disponíveis no servidor.
     * 
     * @procedure query
     */
    listBackups: protectedProcedure
        .query(async () => {
            return await maintenanceService.listBackups();
        }),

    /**
     * Delete Backup - Remover Arquivo de Backup
     * 
     * @procedure mutation
     */
    deleteBackup: protectedProcedure
        .input(z.object({ filename: z.string() }))
        .mutation(async ({ input }) => {
            return await maintenanceService.deleteBackup(input.filename);
        }),

    /**
     * Restore Backup - Restaurar Snapshot
     * 
     * ATENÇÃO: Esta operação sobrescreve os dados atuais com o conteúdo do backup.
     * 
     * @procedure mutation
     */
    restoreBackup: protectedProcedure
        .input(z.object({ filename: z.string() }))
        .mutation(async ({ input }) => {
            return await maintenanceService.restoreBackup(input.filename);
        }),

    // --- System Parameters (General Configs) ---

    /**
     * Get Params - Obter Parâmetros Globais
     * 
     * Retorna chaves e valores de configuração geral do sistema (ex: SMTP, Temas).
     * 
     * @procedure query
     */
    getParams: protectedProcedure.query(async () => {
        return prisma.systemParameter.findMany();
    }),

    /**
     * Update Param - Atualizar Parâmetro Global
     * 
     * @procedure mutation
     */
    updateParam: protectedProcedure
        .input(z.object({
            key: z.string(),
            value: z.string()
        }))
        .mutation(async ({ input }) => {
            return prisma.systemParameter.update({
                where: { key: input.key },
                data: { value: input.value }
            });
        }),

    /**
     * Clear All Influx Data - Limpeza Total de Métricas
     * 
     * Remove permanentemente TODOS os dados do InfluxDB.
     * Use com cautela.
     * 
     * @procedure mutation
     */
    clearAllInfluxData: protectedProcedure
        .mutation(async () => {
            return await maintenanceService.clearAllInfluxData();
        }),

    /**
     * Trigger Syslog Backup - Iniciar Backup Manual do Syslog
     * 
     * @procedure mutation
     */
    triggerSyslogBackup: protectedProcedure
        .mutation(async () => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
            return await syslogMaintenanceService.backupSyslog();
        }),

    /**
     * Get Syslog Backup Status - Status do backup em background
     */
    getSyslogBackupStatus: protectedProcedure
        .query(async () => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
            return syslogMaintenanceService.getBackupStatus();
        }),

    /**
     * Run Syslog Cleanup - Executar Limpeza de Logs do Syslog
     * 
     * @procedure mutation
     */
    triggerSyslogCleanup: protectedProcedure
        .mutation(async () => {
            const { syslogMaintenanceService } = await import('../services/syslogMaintenanceService');
            return await syslogMaintenanceService.cleanupAfterBackup();
        }),

    /**
     * Export System Data - Exportar Snapshot em JSON
     */
    exportSystemData: protectedProcedure
        .mutation(async () => {
            return await maintenanceService.exportSystemData();
        }),

    /**
     * Import System Data - Restaurar Snapshot via JSON
     */
    importSystemData: protectedProcedure
        .input(z.any())
        .mutation(async ({ input }) => {
            return await maintenanceService.importSystemData(input);
        }),
});
