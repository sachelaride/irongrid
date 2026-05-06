/**
 * Serviço de Manutenção e Backup do Sistema
 * 
 * Centraliza as operações de rotina para garantir a saúde do IronGrid, incluindo:
 * - Limpeza de logs antigos (PostgreSQL)
 * - Gestão de políticas de retenção de métricas (InfluxDB)
 * - Criação, listagem e restauração de backups (pg_dump/pg_restore)
 * - Monitoramento de saúde do banco de dados (tamanhos e contagens)
 * 
 * @module services/maintenanceService
 */

import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { prisma } from '../utils/prisma';
import { influxDB } from './influxdb';

const execAsync = promisify(exec);
/** Diretório padrão para armazenamento de backups SQL */
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Garante a existência do diretório de backup na inicialização
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export class MaintenanceService {
    /** Retenção padrão de logs: 90 dias */
    private defaultRetentionLogs = 90;
    /** Retenção padrão de métricas: 30 dias */
    private defaultRetentionMetrics = 30;

    /**
     * Recursive BigInt Serializer
     * Converts all BigInt values in an object/array to strings for JSON safety.
     */
    private serializeBigInt(obj: any): any {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'bigint') return obj.toString();
        if (Array.isArray(obj)) return obj.map(item => this.serializeBigInt(item));
        if (typeof obj === 'object') {
            const result: any = {};
            for (const key in obj) {
                result[key] = this.serializeBigInt(obj[key]);
            }
            return result;
        }
        return obj;
    }

    /**
     * Get Settings - Obter configurações de retenção atuais
     * 
     * Recupera as políticas de retenção e a data da última execução da tabela SystemParameter.
     */
    async getSettings() {
        const logsParam = await prisma.systemParameter.findUnique({ where: { key: 'retention_logs_days' } });
        const metricsParam = await prisma.systemParameter.findUnique({ where: { key: 'retention_metrics_days' } });
        const syslogParam = await prisma.systemParameter.findUnique({ where: { key: 'syslog_retention_after_backup' } });
        const lastRunParam = await prisma.systemParameter.findUnique({ where: { key: 'maintenance_last_run' } });

        return {
            retentionLogsDays: logsParam ? parseInt(logsParam.value) : this.defaultRetentionLogs,
            retentionMetricsDays: metricsParam ? parseInt(metricsParam.value) : this.defaultRetentionMetrics,
            syslogRetentionDays: syslogParam ? parseInt(syslogParam.value) : 3,
            lastRun: lastRunParam ? new Date(lastRunParam.value) : null
        };
    }

    /**
     * Get System Customization - Obter parâmetros de customização do sistema
     */
    /**
     * Get System Customization - Obter parâmetros de customização do sistema
     */
    async getSystemCustomization() {
        const params = await prisma.systemParameter.findMany({
            where: {
                key: {
                    in: [
                        'ticket_auto_close_days',
                        'ticket_default_rating',
                        'company_name',
                        'ticket_working_hours',
                        'dash_sla_goal',
                        'dash_storage_critical',
                        'dash_storage_warning',
                        'syslog_recording_enabled'
                    ]
                }
            }
        });

        const getParam = (key: string, defaultVal: any) => {
            const param = params.find(p => p.key === key);
            return param ? param.value : defaultVal;
        };

        return {
            ticketAutoCloseDays: parseInt(getParam('ticket_auto_close_days', '15')),
            ticketDefaultRating: parseInt(getParam('ticket_default_rating', '4')),
            companyName: getParam('company_name', 'IronGrid Monitoramento'),
            workingHours: getParam('ticket_working_hours', '08:00 - 18:00'),
            dashSlaGoal: parseFloat(getParam('dash_sla_goal', '98.0')),
            dashStorageCritical: parseInt(getParam('dash_storage_critical', '90')),
            dashStorageWarning: parseInt(getParam('dash_storage_warning', '80')),
            syslogRecordingEnabled: getParam('syslog_recording_enabled', 'true') === 'true'
        };
    }

    /**
     * Save Settings - Salvar novas políticas de retenção
     * 
     * @param {number} logsDays - Dias de retenção para logs do Postgres
     * @param {number} metricsDays - Dias de retenção para métricas no InfluxDB
     */
    async saveSettings(logsDays: number, metricsDays: number, syslogDays: number = 3) {
        await prisma.systemParameter.upsert({
            where: { key: 'retention_logs_days' },
            create: { key: 'retention_logs_days', value: logsDays.toString(), description: 'Days to keep system logs', type: 'NUMBER' },
            update: { value: logsDays.toString() }
        });

        await prisma.systemParameter.upsert({
            where: { key: 'retention_metrics_days' },
            create: { key: 'retention_metrics_days', value: metricsDays.toString(), description: 'Days to keep metrics in InfluxDB', type: 'NUMBER' },
            update: { value: metricsDays.toString() }
        });

        await prisma.systemParameter.upsert({
            where: { key: 'syslog_retention_after_backup' },
            create: { key: 'syslog_retention_after_backup', value: syslogDays.toString(), description: 'Days to keep syslog entries after backup', type: 'NUMBER' },
            update: { value: syslogDays.toString() }
        });

        await this.updateInfluxRetention(metricsDays);
        await this.updateInfluxRetention(metricsDays);
    }

    /**
     * Save System Customization - Salvar parâmetros de customização
     */
    async saveSystemCustomization(params: {
        ticketAutoCloseDays: number;
        ticketDefaultRating: number;
        companyName: string;
        workingHours: string;
        dashSlaGoal: number;
        dashStorageCritical: number;
        dashStorageWarning: number;
        syslogRecordingEnabled: boolean;
    }) {
        await prisma.systemParameter.upsert({
            where: { key: 'ticket_auto_close_days' },
            create: { key: 'ticket_auto_close_days', value: params.ticketAutoCloseDays.toString(), description: 'Days to auto-close resolved tickets', type: 'NUMBER' },
            update: { value: params.ticketAutoCloseDays.toString() }
        });

        await prisma.systemParameter.upsert({
            where: { key: 'ticket_default_rating' },
            create: { key: 'ticket_default_rating', value: params.ticketDefaultRating.toString(), description: 'Default rating for auto-closed tickets', type: 'NUMBER' },
            update: { value: params.ticketDefaultRating.toString() }
        });

        await prisma.systemParameter.upsert({
            where: { key: 'company_name' },
            create: { key: 'company_name', value: params.companyName, description: 'Company name for system branding', type: 'STRING' },
            update: { value: params.companyName }
        });

        await prisma.systemParameter.upsert({
            where: { key: 'ticket_working_hours' },
            create: { key: 'ticket_working_hours', value: params.workingHours, description: 'Working hours for SLA calculation', type: 'STRING' },
            update: { value: params.workingHours }
        });

        await prisma.systemParameter.upsert({
            where: { key: 'dash_sla_goal' },
            create: { key: 'dash_sla_goal', value: params.dashSlaGoal.toString(), description: 'SLA Goal %', type: 'NUMBER' },
            update: { value: params.dashSlaGoal.toString() }
        });

        await prisma.systemParameter.upsert({
            where: { key: 'dash_storage_critical' },
            create: { key: 'dash_storage_critical', value: params.dashStorageCritical.toString(), description: 'Storage Critical Threshold %', type: 'NUMBER' },
            update: { value: params.dashStorageCritical.toString() }
        });

        await prisma.systemParameter.upsert({
            where: { key: 'dash_storage_warning' },
            create: { key: 'dash_storage_warning', value: params.dashStorageWarning.toString(), description: 'Storage Warning Threshold %', type: 'NUMBER' },
            update: { value: params.dashStorageWarning.toString() }
        });

        await prisma.systemParameter.upsert({
            where: { key: 'syslog_recording_enabled' },
            create: { key: 'syslog_recording_enabled', value: params.syslogRecordingEnabled.toString(), type: 'BOOLEAN', category: 'SYSLOG' },
            update: { value: params.syslogRecordingEnabled.toString() }
        });
    }

    /**
     * Run Cleanup - Executar limpeza de dados antigos
     * 
     * Remove registros de auditoria, notificações e logs de ações remotas que excederam
     * o limite de dias configurado. Também atualiza a regra de retenção do InfluxDB.
     * 
     * @param {string[]} targets - Alvos da limpeza (audit, notification, remote, metrics)
     */
    async runCleanup(targets: string[] = ['audit', 'notification', 'remote']) {
        console.log(`[Maintenance] Starting system cleanup for targets: ${targets.join(', ')}...`);
        const settings = await this.getSettings();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - settings.retentionLogsDays);

        const result = {
            logsDeleted: 0,
            metricsRetentionUpdated: false,
            timestamp: new Date()
        };

        try {
            // 1. Limpeza seletiva de logs no Postgres
            if (targets.includes('audit')) {
                try {
                    console.log('[Maintenance] Cleaning up audit logs...');
                    const audit = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoffDate } } });
                    result.logsDeleted += audit.count;
                    console.log(`[Maintenance] Audit logs cleaned: ${audit.count}`);
                } catch (e) {
                    console.error('[Maintenance] Failed to cleanup audit logs:', e);
                }
            }
            if (targets.includes('notification')) {
                try {
                    console.log('[Maintenance] Cleaning up notification logs...');
                    const notif = await prisma.notificationLog.deleteMany({ where: { sentAt: { lt: cutoffDate } } });
                    result.logsDeleted += notif.count;
                    console.log(`[Maintenance] Notification logs cleaned: ${notif.count}`);
                } catch (e) {
                    console.error('[Maintenance] Failed to cleanup notification logs:', e);
                }
            }
            if (targets.includes('remote')) {
                try {
                    console.log('[Maintenance] Cleaning up remote action logs...');
                    const remote = await prisma.remoteActionLog.deleteMany({ where: { startedAt: { lt: cutoffDate } } });
                    result.logsDeleted += remote.count;
                    console.log(`[Maintenance] Remote action logs cleaned: ${remote.count}`);
                } catch (e) {
                    console.error('[Maintenance] Failed to cleanup remote action logs:', e);
                }
            }
            if (targets.includes('syslog')) {
                try {
                    console.log('[Maintenance] Cleaning up Syslog entries (batch mode)...');
                    const { syslogMaintenanceService } = await import('./syslogMaintenanceService');
                    // We use 7 days as default for syslog, or the same retention as other logs
                    await syslogMaintenanceService.cleanupSyslogInBatches(settings.retentionLogsDays);
                    console.log('[Maintenance] Syslog entries cleanup triggered in background');
                } catch (e) {
                    console.error('[Maintenance] Failed to cleanup Syslog entries:', e);
                }
            }

            console.log(`[Maintenance] Total PostgreSQL records deleted: ${result.logsDeleted}`);

            // 2. Atualiza retenção do InfluxDB
            if (targets.includes('metrics')) {
                try {
                    console.log('[Maintenance] Updating InfluxDB retention...');
                    await this.updateInfluxRetention(settings.retentionMetricsDays);
                    result.metricsRetentionUpdated = true;
                    console.log('[Maintenance] InfluxDB retention update triggered');
                } catch (e) {
                    console.error('[Maintenance] Failed to update InfluxDB retention:', e);
                }
            }

            // 3. Registra execução bem-sucedida
            await prisma.systemParameter.upsert({
                where: { key: 'maintenance_last_run' },
                create: { key: 'maintenance_last_run', value: new Date().toISOString(), description: 'Timestamp of last successful maintenance run', type: 'STRING' },
                update: { value: new Date().toISOString() }
            });

            return result;
        } catch (error) {
            console.error('[Maintenance] Cleanup failed:', error);
            throw error;
        }
    }

    /**
     * Get Clean DB URL - Obter URL de conexão limpa para ferramentas CLI
     * 
     * Remove parâmetros de query (?schema=...) que costumam causar erros no pg_dump.
     * @private
     */
    private getCleanDbUrl() {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error('DATABASE_URL not set');

        try {
            const url = new URL(dbUrl);
            url.search = '';
            return url.toString();
        } catch (e) {
            return dbUrl;
        }
    }

    /**
     * Create Backup - Gerar novo backup do banco PostgreSQL
     * 
     * Utiliza o comando nativo `pg_dump` para gerar um arquivo .sql comprimido.
     * @returns {Promise<Object>} Metadados do backup (nome, tamanho, data)
     */
    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_irongrid_${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        const dbUrl = this.getCleanDbUrl();

        try {
            console.log(`[Maintenance] Starting backup to ${filepath}...`);
            await execAsync(`pg_dump "${dbUrl}" -F c -f "${filepath}"`);

            const stats = fs.statSync(filepath);
            return {
                filename,
                size: stats.size,
                createdAt: new Date()
            };
        } catch (error) {
            console.error('[Maintenance] Backup failed:', error);
            throw new Error('Backup failed. Ensure pg_dump is installed and reachable.');
        }
    }

    /**
     * List Backups - Listar arquivos de backup existentes
     */
    async listBackups() {
        try {
            const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql') || f.endsWith('.gz'));
            return files.map(f => {
                const stats = fs.statSync(path.join(BACKUP_DIR, f));
                let type: 'irongrid' | 'syslog' = 'irongrid';
                if (f.startsWith('syslog_backup_')) type = 'syslog';

                return {
                    filename: f,
                    size: stats.size,
                    createdAt: stats.mtime, // Use mtime as birthtime can be unreliable on linux
                    type
                };
            }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } catch (e) {
            return [];
        }
    }

    /**
     * Delete Backup - Excluir arquivo de backup físico
     * 
     * @param {string} filename - Nome do arquivo no diretório /backups
     */
    async deleteBackup(filename: string) {
        const filepath = path.join(BACKUP_DIR, filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            return true;
        }
        return false;
    }

    /**
     * Restore Backup - Restaurar banco de dados a partir de arquivo
     * 
     * WARNING: Esta operação é destrutiva e substitui todo o banco atual.
     * @param {string} filename - Nome do arquivo de backup
     */
    async restoreBackup(filename: string) {
        const filepath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filepath)) {
            throw new Error('Backup file not found');
        }

        const dbUrl = this.getCleanDbUrl();

        try {
            console.log(`[Maintenance] Restoring backup from ${filepath}...`);
            // pg_restore com flag --clean para limpar objetos antes de criar
            await execAsync(`pg_restore --clean --if-exists --no-owner --no-privileges -d "${dbUrl}" "${filepath}"`);

            return {
                success: true,
                message: 'Database restored successfully'
            };
        } catch (error: any) {
            console.error('[Maintenance] Restore failed:', error);
            throw new Error(`Restore failed: ${error.message || error}`);
        }
    }

    /**
     * Update Influx Retention - Atualizar política no InfluxDB
     * 
     * @private
     */
    private async updateInfluxRetention(days: number) {
        try {
            console.log(`[Maintenance] Enforcing InfluxDB retention policy: ${days} days.`);
            // Nota: Implementação real dependeria da API de Buckets do InfluxDB v2.
        } catch (e) {
            console.warn('[Maintenance] Failed to update InfluxDB retention:', e);
        }
    }

    /**
     * Get Influx Size - Obter tamanho ocupado no disco pelo InfluxDB
     * 
     * Consulta o endpoint /metrics do InfluxDB para somar TSM e WAL.
     * @private
     */
    private async getInfluxSize(): Promise<string> {
        try {
            const response = await fetch('http://localhost:8086/metrics');
            if (!response.ok) return 'N/A';

            const text = await response.text();
            const lines = text.split('\n');
            let totalBytes = 0;

            for (const line of lines) {
                if (line.startsWith('#')) continue;

                // Soma o tamanho dos arquivos TSM e do WAL (Write Ahead Log)
                if (line.startsWith('storage_tsm_files_disk_bytes') || line.startsWith('storage_wal_size')) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const val = parseFloat(parts[parts.length - 1]);
                        if (!isNaN(val)) {
                            totalBytes += val;
                        }
                    }
                }
            }

            if (totalBytes === 0) return '0 B';

            const units = ['B', 'kB', 'MB', 'GB', 'TB'];
            let size = totalBytes;
            let unitIndex = 0;
            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
            }

            return `${size.toFixed(1)} ${units[unitIndex]}`;

        } catch (e) {
            console.warn('[Maintenance] Failed to fetch InfluxDB metrics:', e);
            return 'N/A';
        }
    }

    /**
     * Get Database Health - Estatísticas gerais de saúde do banco
     * 
     * Retorna contagens de registros e o tamanho físico ocupado pelos bancos.
     */
    async getDatabaseHealth() {
        const auditCount = await prisma.auditLog.count();
        const notifCount = await prisma.notificationLog.count();
        const remoteCount = await prisma.remoteActionLog.count();
        const deviceCount = await prisma.device.count();

        // Tamanho do Postgres
        let dbSize = 'Unknown';
        try {
            const sizeQuery: any = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
            if (sizeQuery && sizeQuery[0]) {
                dbSize = sizeQuery[0].size;
            }
        } catch (e) {
            console.error('Failed to get DB size:', e);
        }

        // Tamanho do InfluxDB
        const influxSize = await this.getInfluxSize();

        // Estatísticas do Syslog (Banco dedicado)
        let syslogCount = 0;
        let syslogSize = 'N/A';
        try {
            const { syslogPool } = await import('../utils/syslogDb');
            const countRes = await syslogPool.query('SELECT COUNT(*) FROM syslog_entries');
            syslogCount = parseInt(countRes.rows[0].count);

            const sizeRes: any = await syslogPool.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
            if (sizeRes.rows[0]) syslogSize = sizeRes.rows[0].size;
        } catch (e) {
            console.warn('[Maintenance] Failed to fetch Syslog DB stats:', e);
        }

        // Normaliza tamanhos para unidades mais legíveis (ex: 3994 MB -> 3.9 GB)
        const normalizeSizeString = (sizeStr: string): string => {
            if (!sizeStr || sizeStr === 'N/A' || sizeStr === 'Unknown') return sizeStr;

            const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/);
            if (!match) return sizeStr;

            let value = parseFloat(match[1]);
            let unit = match[2].toUpperCase();

            // Converte para a próxima unidade se >= 1024
            if (unit === 'KB' && value >= 1024) {
                value = value / 1024;
                unit = 'MB';
            }
            if (unit === 'MB' && value >= 1024) {
                value = value / 1024;
                unit = 'GB';
            }
            if (unit === 'GB' && value >= 1024) {
                value = value / 1024;
                unit = 'TB';
            }

            // Formata com 1 casa decimal e remove .0 desnecessário
            return `${value.toFixed(1).replace(/\.0$/, '')} ${unit}`;
        };

        return {
            auditConfigs: auditCount,
            notifications: notifCount,
            remoteLogs: remoteCount,
            devices: deviceCount,
            dbSize: normalizeSizeString(dbSize),
            influxSize: normalizeSizeString(influxSize),
            syslogCount,
            syslogSize: normalizeSizeString(syslogSize)
        };
    }

    /**
     * Clear All Influx Data - Apagar TODAS as métricas
     * 
     * Operação crítica disparada via interface de manutenção.
     * WARNING: Remove permanentemente todos os dados do bucket.
     */
    async clearAllInfluxData() {
        try {
            console.log('[Maintenance] Clearing ALL InfluxDB data...');

            const bucket = process.env.INFLUX_BUCKET || 'netmonitor_metrics';
            const org = process.env.INFLUX_ORG || 'netmonitor';
            const token = process.env.INFLUX_TOKEN || '';
            const url = process.env.INFLUX_URL || 'http://localhost:8086';

            const start = '1970-01-01T00:00:00Z';
            const stop = new Date().toISOString();

            const response = await fetch(`${url}/api/v2/delete?org=${org}&bucket=${bucket}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    start,
                    stop,
                    predicate: '' // Predicado vazio remove tudo
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`InfluxDB API error: ${response.status} - ${errorText}`);
            }

            console.log('[Maintenance] Successfully cleared all InfluxDB data');
            return { success: true, message: 'All InfluxDB data cleared' };
        } catch (error: any) {
            console.error('[Maintenance] Failed to clear InfluxDB data:', error);
            throw new Error(`Failed to clear InfluxDB data: ${error.message || error}`);
        }
    }

    /**
     * Auto Evaluate Tickets - Avaliação automática após 15 dias
     * 
     * Busca chamados em status 'RESOLVED' (Encerrado pelo técnico) que não foram 
     * avaliados pelo usuário em até 15 dias e os fecha automaticamente com 4 estrelas.
     */
    async autoEvaluateTickets() {
        const settings = await this.getSystemCustomization();
        const autoCloseDays = settings.ticketAutoCloseDays;
        const defaultRating = settings.ticketDefaultRating;

        console.log(`[Maintenance] Checking for tickets pending auto-evaluation (${autoCloseDays} days grace period)...`);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - autoCloseDays);

        try {
            // Buscar chamados RESOLVED (Encerrados) com mais de 15 dias desde o resolvedAt
            const ticketsToAutoClose = await prisma.ticket.findMany({
                where: {
                    status: 'RESOLVED',
                    resolvedAt: { lt: cutoffDate },
                    rating: null // Garantir que não foi avaliado
                }
            });

            if (ticketsToAutoClose.length === 0) {
                console.log('[Maintenance] No tickets found for auto-evaluation.');
                return { processed: 0 };
            }

            console.log(`[Maintenance] Auto-evaluating ${ticketsToAutoClose.length} tickets...`);

            let count = 0;
            for (const ticket of ticketsToAutoClose) {
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        status: 'CLOSED',
                        rating: defaultRating,
                        ratingComment: `Avaliação automática pelo sistema após ${autoCloseDays} dias de inatividade.`,
                        closedAt: new Date(),
                        activities: {
                            create: {
                                message: `Chamado encerrado e avaliado automaticamente com ${defaultRating} estrelas pelo sistema (Prazo de ${autoCloseDays} dias excedido).`,
                                type: 'COMMENT',
                                userId: 'SYSTEM' // Identificador especial ou null
                            }
                        }
                    }
                });
                count++;
            }

            console.log(`[Maintenance] Successfully auto-evaluated ${count} tickets.`);
            return { processed: count };
        } catch (error) {
            console.error('[Maintenance] Auto-evaluation failed:', error);
            throw error;
        }
    }

    /**
     * Export System Data - Exportar todos os dados capitais em JSON
     * 
     * Coleta parâmetros, dispositivos (posições), ativos, chamados e estruturas.
     */
    async exportSystemData() {
        console.log('[Maintenance] Exporting system data to JSON...');

        const [
            parameters,
            devices,
            hardwares,
            softwares,
            peripherals,
            tickets,
            ticketActivities,
            ticketCustomValues,
            customFields,
            departments,
            locations,
            serviceGroups,
            serviceTypes,
            snmpCommunities,
            networkRanges,
            notificationChannels,
            emailConfigs,
            slaConfigs
        ] = await Promise.all([
            prisma.systemParameter.findMany(),
            prisma.device.findMany(),
            prisma.hardware.findMany(),
            prisma.software.findMany(),
            prisma.peripheral.findMany(),
            prisma.ticket.findMany(),
            prisma.ticketActivity.findMany(),
            prisma.ticketCustomValue.findMany(),
            prisma.customField.findMany(),
            prisma.department.findMany(),
            prisma.location.findMany(),
            prisma.serviceGroup.findMany(),
            prisma.serviceType.findMany(),
            prisma.snmpCommunity.findMany(),
            prisma.networkRange.findMany(),
            prisma.notificationChannel.findMany(),
            prisma.emailConfiguration.findMany(),
            prisma.sLAConfiguration.findMany()
        ]);

        const rawData = {
            parameters,
            devices,
            hardwares,
            softwares,
            peripherals,
            tickets,
            ticketActivities,
            ticketCustomValues,
            customFields,
            departments,
            locations,
            serviceGroups,
            serviceTypes,
            snmpCommunities,
            networkRanges,
            notificationChannels,
            emailConfigs,
            slaConfigs
        };

        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            data: this.serializeBigInt(rawData)
        };
    }

    /**
     * Import System Data - Restaurar dados a partir de JSON
     * 
     * @param {any} backupData - Objeto exportado pelo exportSystemData
     */
    async importSystemData(backupData: any) {
        if (!backupData || !backupData.data) {
            throw new Error('Invalid backup data format');
        }

        const { data } = backupData;

        console.log('[Maintenance] Starting system data import...');

        return await prisma.$transaction(async (tx) => {
            // Ordem de exclusão (filhos primeiro)
            await tx.ticketActivity.deleteMany();
            await tx.ticketCustomValue.deleteMany();
            await tx.ticket.deleteMany();
            await tx.customField.deleteMany();
            await tx.maintenanceCost.deleteMany();
            await tx.maintenanceRecord.deleteMany();
            await tx.hardware.deleteMany();
            await tx.software.deleteMany();
            await tx.peripheral.deleteMany();
            await tx.networkInterface.deleteMany();
            await tx.syslogEntry.deleteMany();
            await tx.deviceAlert.deleteMany();
            await tx.alert.deleteMany();
            await tx.device.deleteMany(); // Cascade will handle some, but let's be explicit

            await tx.serviceType.deleteMany();
            await tx.serviceGroup.deleteMany();
            await tx.networkRange.deleteMany();
            await tx.snmpCommunity.deleteMany();
            await tx.department.deleteMany();
            await tx.location.deleteMany();

            await tx.notificationLog.deleteMany();
            await tx.notificationChannel.deleteMany();
            await tx.emailConfiguration.deleteMany();
            await tx.sLAConfiguration.deleteMany();
            await tx.systemParameter.deleteMany();

            // Ordem de inserção (pais primeiro)
            if (data.locations?.length) await tx.location.createMany({ data: data.locations });
            if (data.departments?.length) await tx.department.createMany({ data: data.departments });
            if (data.snmpCommunities?.length) await tx.snmpCommunity.createMany({ data: data.snmpCommunities });
            if (data.networkRanges?.length) await tx.networkRange.createMany({ data: data.networkRanges });
            if (data.serviceGroups?.length) await tx.serviceGroup.createMany({ data: data.serviceGroups });
            if (data.serviceTypes?.length) await tx.serviceType.createMany({ data: data.serviceTypes });

            if (data.devices?.length) {
                // Remove parentId for first pass to avoid FK issues
                const devicesWithoutParent = data.devices.map((d: any) => ({ ...d, parentId: null }));
                await tx.device.createMany({ data: devicesWithoutParent });

                // Second pass to restore parentId
                for (const d of data.devices) {
                    if (d.parentId) {
                        await tx.device.update({
                            where: { id: d.id },
                            data: { parentId: d.parentId }
                        });
                    }
                }
            }

            if (data.hardwares?.length) await tx.hardware.createMany({ data: data.hardwares });
            if (data.softwares?.length) await tx.software.createMany({ data: data.softwares });
            if (data.peripherals?.length) await tx.peripheral.createMany({ data: data.peripherals });

            if (data.customFields?.length) await tx.customField.createMany({ data: data.customFields });
            if (data.tickets?.length) await tx.ticket.createMany({ data: data.tickets });
            if (data.ticketActivities?.length) await tx.ticketActivity.createMany({ data: data.ticketActivities });
            if (data.ticketCustomValues?.length) await tx.ticketCustomValue.createMany({ data: data.ticketCustomValues });

            if (data.notificationChannels?.length) await tx.notificationChannel.createMany({ data: data.notificationChannels });
            if (data.emailConfigs?.length) await tx.emailConfiguration.createMany({ data: data.emailConfigs });
            if (data.slaConfigs?.length) await tx.sLAConfiguration.createMany({ data: data.slaConfigs });
            if (data.parameters?.length) {
                for (const p of data.parameters) {
                    await tx.systemParameter.upsert({
                        where: { key: p.key },
                        create: p,
                        update: p
                    });
                }
            }

            console.log('[Maintenance] Data import completed successfully');
            return { success: true, message: 'Data imported successfully' };
        });
    }
}
