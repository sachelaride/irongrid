import fs from 'fs';
import path from 'path';

export class Logger {
    private static getLogDir() {
        const isPackaged = (process as any).pkg !== undefined;
        const baseDir = isPackaged ? path.dirname(process.execPath) : process.cwd();
        return path.join(baseDir, 'logs');
    }

    private static logDir = Logger.getLogDir();

    private static ensureDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    private static cleanup() {
        try {
            const files = fs.readdirSync(this.logDir);
            const now = Date.now();
            const maxAge = 30 * 24 * 60 * 60 * 1000;

            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > maxAge) {
                    fs.unlinkSync(filePath);
                }
            });
        } catch (e) { }
    }

    static info(message: string, context?: any) {
        this.log('INFO', message, context);
    }

    static error(message: string, context?: any) {
        this.log('ERROR', message, context);
    }

    private static log(level: string, message: string, context?: any) {
        this.ensureDir();

        const date = new Date().toISOString().split('T')[0];
        const timestamp = new Date().toISOString();
        const logFile = path.join(this.logDir, `${date}.log`);

        const logLine = `[${timestamp}] [${level}] ${message} ${context ? JSON.stringify(context) : ''}\n`;

        fs.appendFileSync(logFile, logLine);

        if (Math.random() < 0.01) {
            this.cleanup();
        }
    }
}
