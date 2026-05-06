
import { Pool } from 'pg';

const SYSLOG_DB_URL = process.env.SYSLOG_DATABASE_URL || 'postgresql://admin:irongrid@localhost:5432/syslog_net_monitor';

export const syslogPool = new Pool({
    connectionString: SYSLOG_DB_URL,
});

/**
 * Inicializa a tabela de syslog no banco de dados dedicado
 */
export async function initSyslogDb() {
    // 1. Ensure Database Exists
    console.log('[SyslogDB] Ensuring database exists...');
    try {
        // Parse connection details to connect to default 'postgres' db
        const dbUrl = new URL(SYSLOG_DB_URL);
        const dbName = dbUrl.pathname.slice(1); // remove leading '/'
        dbUrl.pathname = '/postgres'; // Connect to maintenance DB

        const rootPool = new Pool({ connectionString: dbUrl.toString() });
        console.log(`[SyslogDB] Connecting to maintenance DB to check '${dbName}'...`);
        const rootClient = await rootPool.connect();

        try {
            const checkRes = await rootClient.query(
                "SELECT 1 FROM pg_database WHERE datname = $1",
                [dbName]
            );

            if (checkRes.rowCount === 0) {
                console.log(`[SyslogDB] Database '${dbName}' not found. Creating...`);
                await rootClient.query(`CREATE DATABASE "${dbName}"`);
                console.log(`[SyslogDB] Database '${dbName}' created successfully.`);
            }
        } finally {
            rootClient.release();
            await rootPool.end();
        }
    } catch (e) {
        console.warn('[SyslogDB] Warning: Could not check/create database. Assuming it exists or permissions are restricted.', e);
    }

    // 2. Initialize Schema
    console.log('[SyslogDB] Connecting to syslog pool to initialize schema...');
    const client = await syslogPool.connect();
    try {
        console.log('[SyslogDB] Initializing schema (CREATE TABLE IF NOT EXISTS)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS syslog_entries (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP NOT NULL,
                hostname TEXT NOT NULL,
                facility INTEGER,
                severity INTEGER,
                tag TEXT,
                message TEXT,
                raw_message TEXT,
                device_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_syslog_timestamp ON syslog_entries(timestamp);
            CREATE INDEX IF NOT EXISTS idx_syslog_hostname ON syslog_entries(hostname);
            CREATE INDEX IF NOT EXISTS idx_syslog_device_id ON syslog_entries(device_id);
            CREATE INDEX IF NOT EXISTS idx_syslog_severity ON syslog_entries(severity);
        `);
        console.log('[SyslogDB] Database initialized successfully');
    } catch (error) {
        console.error('[SyslogDB] Failed to initialize database:', error);
    } finally {
        client.release();
    }
}
