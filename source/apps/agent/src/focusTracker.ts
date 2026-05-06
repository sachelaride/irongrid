import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * FocusTracker
 * 
 * Monitora qual aplicativo está em primeiro plano (janela ativa) no Windows.
 * Acumula o tempo de uso para ser enviado no inventário periódico.
 */
export class FocusTracker {
    private stats: Record<string, number> = {};
    private interval: NodeJS.Timeout | null = null;
    private readonly POLL_INTERVAL_MS = 10000; // 10 segundos

    constructor() {
        if (process.platform === 'win32') {
            this.start();
        }
    }

    private start() {
        this.interval = setInterval(() => this.poll(), this.POLL_INTERVAL_MS);
    }

    private async poll() {
        try {
            // Script PowerShell para obter o processo da janela em foco
            const psCmd = `
                $signature = '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();'
                $type = Add-Type -MemberDefinition $signature -Name "Win32" -Namespace "Win32" -PassThru
                $handle = [Win32.Win32]::GetForegroundWindow()
                if ($handle -ne 0) {
                    Get-Process | Where-Object { $_.MainWindowHandle -eq $handle } | Select-Object Name, MainWindowTitle | ConvertTo-Json
                }
            `;

            const { stdout } = await execAsync(`powershell -Command "${psCmd.replace(/\n/g, ' ')}"`);
            if (stdout.trim()) {
                const data = JSON.parse(stdout);
                const appName = data.Name || 'Unknown';
                
                // Incrementa o tempo (convertido para segundos)
                this.stats[appName] = (this.stats[appName] || 0) + (this.POLL_INTERVAL_MS / 1000);
            }
        } catch (e) {
            // Silencioso para não poluir o log
        }
    }

    /**
     * Retorna as estatísticas acumuladas e limpa o contador para o próximo período.
     */
    public getAndResetStats(): Record<string, number> {
        const currentStats = { ...this.stats };
        this.stats = {};
        return currentStats;
    }

    public stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
