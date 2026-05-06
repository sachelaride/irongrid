
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { syslogPool } from '../utils/syslogDb';
import { prisma } from '../utils/prisma';

const execAsync = promisify(exec);
const BACKUP_DIR = path.join(process.cwd(), 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export interface BackupStatus {
    isBackingUp: boolean;
    lastStatus: 'none' | 'running' | 'success' | 'failed';
    lastError: string | null;
    startTime?: string;
}

export class SyslogMaintenanceService {
    private isBackingUp = false;
    private backupStatus: 'none' | 'running' | 'success' | 'failed' = 'none';
    private backupError: string | null = null;
    private backupStartTime: string | null = null;

    /**
     * Executa o backup do banco de syslog e compacta o arquivo
     * Pode ser executado em background
     */
    async backupSyslog() {
        if (this.isBackingUp) {
            console.log('[SyslogMaintenance] Backup already in progress');
            return;
        }

        this.isBackingUp = true;
        this.backupStatus = 'running';
        this.backupError = null;
        this.backupStartTime = new Date().toISOString();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `syslog_backup_${timestamp}.sql.gz`;
        const filepath = path.join(BACKUP_DIR, filename.replace('.gz', ''));
        const compressedFile = path.join(BACKUP_DIR, filename);

        const dbUrl = process.env.SYSLOG_DATABASE_URL || 'postgresql://admin:irongrid@localhost:5432/syslog_net_monitor';

        // Iniciamos o processo real
        (async () => {
            try {
                console.log(`[SyslogMaintenance] Starting backup to ${filepath}...`);
                await execAsync(`pg_dump "${dbUrl}" -F c -f "${filepath}"`);

                console.log(`[SyslogMaintenance] Compressing backup...`);
                await execAsync(`gzip "${filepath}"`);

                const stats = fs.statSync(compressedFile);

                console.log(`[SyslogMaintenance] Backup completed: ${compressedFile} (${stats.size} bytes)`);

                await this.updateLastBackupDate();
                this.backupStatus = 'success';
            } catch (error: any) {
                console.error('[SyslogMaintenance] Backup failed:', error);
                this.backupStatus = 'failed';
                this.backupError = error.message || 'Unknown error during pg_dump/gzip';
                
                // Cleanup partial files
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            } finally {
                this.isBackingUp = false;
            }
        })();

        return { success: true, message: 'Backup started in background' };
    }

    getBackupStatus(): BackupStatus {
        return {
            isBackingUp: this.isBackingUp,
            lastStatus: this.backupStatus,
            lastError: this.backupError,
            startTime: this.backupStartTime || undefined
        };
    }

    /**
     * Limpa logs que foram backupeados 3 dias atrás
     */
    async cleanupAfterBackup() {
        try {
            const retentionParam = await prisma.systemParameter.findUnique({ where: { key: 'syslog_retention_after_backup' } });
            const days = retentionParam ? parseInt(retentionParam.value) : 3;

            const lastBackupParam = await prisma.systemParameter.findUnique({ where: { key: 'syslog_last_backup_date' } });
            if (!lastBackupParam) return;

            const lastBackupDate = new Date(lastBackupParam.value);
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays >= days) {
                console.log(`[SyslogMaintenance] Cleaning up logs older than last backup (${days} days passed)...`);
                await syslogPool.query('DELETE FROM syslog_entries WHERE timestamp <= $1', [lastBackupDate]);
                console.log('[SyslogMaintenance] Cleanup completed');
            }
        } catch (error) {
            console.error('[SyslogMaintenance] Cleanup failed:', error);
        }
    }

    private isCleaning = false;
    private totalDeleted = 0;

    /**
     * Limpa logs do banco de de syslog em lotes para evitar timeouts e travamentos
     * Executa em background.
     */
    async cleanupSyslogInBatches(daysOld: number) {
        if (this.isCleaning) {
            console.log('[SyslogMaintenance] Cleanup already in progress, skipping...');
            return;
        }

        this.isCleaning = true;
        this.totalDeleted = 0;

        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - daysOld);

            console.log(`[SyslogMaintenance] Starting batch cleanup for entries older than ${daysOld} days (Cutoff: ${cutoff.toISOString()})`);

            // Check total rows to be deleted for progress reporting
            const countRes = await syslogPool.query('SELECT COUNT(*) FROM syslog_entries WHERE timestamp < $1', [cutoff]);
            const totalToProcess = parseInt(countRes.rows[0].count);
            console.log(`[SyslogMaintenance] Total rows to delete: ${totalToProcess}`);

            const BATCH_SIZE = 100000; // Increased batch size for efficiency if indexing is good
            let currentBatchDeleted = 0;
            let iterations = 0;
            const MAX_ITERATIONS = 5000;

            do {
                // Optimized deletion for PostgreSQL using subquery with LIMIT
                const result = await syslogPool.query(
                    'DELETE FROM syslog_entries WHERE id IN (SELECT id FROM syslog_entries WHERE timestamp < $1 LIMIT $2)',
                    [cutoff, BATCH_SIZE]
                );

                currentBatchDeleted = result.rowCount || 0;
                this.totalDeleted += currentBatchDeleted;
                iterations++;

                if (currentBatchDeleted > 0) {
                    const progress = totalToProcess > 0 ? ((this.totalDeleted / totalToProcess) * 100).toFixed(1) : '100';
                    console.log(`[SyslogMaintenance] Batch ${iterations}: Deleted ${currentBatchDeleted} rows. Total: ${this.totalDeleted} (${progress}%)`);

                    // Small delay to prevent CPU/IO saturation
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

            } while (currentBatchDeleted === BATCH_SIZE && iterations < MAX_ITERATIONS);

            console.log(`[SyslogMaintenance] Cleanup finished. Total rows removed: ${this.totalDeleted}`);

            // VACUUM is ESSENTIAL for SQLite/Postgres to reclaim space.
            // On a 357GB DB, VACUUM might take a LONG time and lock the table.
            // ANALYZE is faster and helps the query planner.
            if (this.totalDeleted > 100000) {
                console.log('[SyslogMaintenance] Running ANALYZE...');
                await syslogPool.query('ANALYZE syslog_entries');
                console.log('[SyslogMaintenance] ANALYZE completed');

                // Note: VACUUM FULL would reclaim space but locks the table. 
                // Regular VACUUM (without FULL) allows reuse of space within the file.
                console.log('[SyslogMaintenance] Running VACUUM...');
                await syslogPool.query('VACUUM syslog_entries');
                console.log('[SyslogMaintenance] VACUUM completed');
            }

            // Record last cleanup
            await prisma.systemParameter.upsert({
                where: { key: 'syslog_last_cleanup_date' },
                create: { key: 'syslog_last_cleanup_date', value: new Date().toISOString(), description: 'Date of the last successful Syslog cleanup', type: 'STRING' },
                update: { value: new Date().toISOString() }
            });

        } catch (error) {
            console.error('[SyslogMaintenance] Batch cleanup failed:', error);
            throw error;
        } finally {
            this.isCleaning = false;
        }
    }

    /**
     * Retorna o status atual da limpeza
     */
    getCleanupStatus() {
        return {
            isCleaning: this.isCleaning,
            totalDeleted: this.totalDeleted
        };
    }

    private async updateLastBackupDate() {
        await prisma.systemParameter.upsert({
            where: { key: 'syslog_last_backup_date' },
            create: { key: 'syslog_last_backup_date', value: new Date().toISOString(), description: 'Date of the last Syslog backup', type: 'STRING' },
            update: { value: new Date().toISOString() }
        });
    }

    /**
     * Limpa TODAS as entradas do Syslog imediatamente
     */
    async clearAll(): Promise<void> {
        console.log('[SyslogMaintenance] TRUNCATING syslog_entries...');
        await syslogPool.query('TRUNCATE TABLE syslog_entries');
        console.log('[SyslogMaintenance] Table truncated. Running VACUUM FULL to reclaim space...');
        await syslogPool.query('VACUUM FULL syslog_entries');
        console.log('[SyslogMaintenance] All space reclaimed.');
    }

    /**
     * Executa o VACUUM FULL para recuperar espaço em disco sem deletar dados
     * ATENÇÃO: Bloqueia a tabela durante a execução.
     */
    async reclaimSpace(): Promise<void> {
        console.log('[SyslogMaintenance] Starting VACUUM FULL to reclaim space...');
        await syslogPool.query('VACUUM FULL syslog_entries');
        console.log('[SyslogMaintenance] VACUUM FULL completed successfully.');
    }

    /**
     * Retorna o tamanho do banco de dados e o diretório de dados do PostgreSQL
     */
    async getDbInfo() {
        const dbUrl = process.env.SYSLOG_DATABASE_URL || 'postgresql://admin:irongrid@localhost:5432/syslog_net_monitor';
        const dbName = new URL(dbUrl).pathname.slice(1);
        
        let size = 'N/A';
        let dataDirectory = 'Padrão PostgreSQL';

        try {
            const sizeRes = await syslogPool.query('SELECT pg_size_pretty(pg_database_size($1)) as size', [dbName]);
            size = sizeRes.rows[0]?.size || 'N/A';
        } catch (e) {
            console.warn('[SyslogMaintenance] Could not get DB size:', e);
            size = 'Indisponível';
        }

        try {
            // Tentativa de pegar o diretório de dados (exige permissão pg_read_all_settings)
            const pathRes = await syslogPool.query('SHOW data_directory');
            dataDirectory = pathRes.rows[0]?.data_directory || 'Padrão PostgreSQL';
        } catch (e) {
            console.warn('[SyslogMaintenance] Permission denied for SHOW data_directory. Trying fallback...');
            try {
                // Tentativa alternativa via caminho do arquivo da tabela
                const fileRes = await syslogPool.query("SELECT pg_relation_filepath('syslog_entries') as path");
                if (fileRes.rows[0]?.path) {
                    dataDirectory = `Base: pg_data/${fileRes.rows[0].path}`;
                }
            } catch (e2) {
                dataDirectory = 'Gerenciado pelo Sistema';
            }
        }

        return {
            dbName,
            size,
            dataDirectory
        };
    }
}

export const syslogMaintenanceService = new SyslogMaintenanceService();
