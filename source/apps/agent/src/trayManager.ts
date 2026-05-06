import SysTray from 'systray2';
import path from 'path';
import fs from 'fs';
import { Socket } from 'socket.io-client';

/**
 * TrayManager
 * 
 * Gerencia o ícone da bandeja do sistema (System Tray) no Windows.
 * Fornece um menu para o usuário e permite disparar ações como abertura de chamados.
 */
export class TrayManager {
    private systray: any = null;
    private agentId: string;

    constructor(private socket: Socket, agentId: string, private onForceInventory?: () => Promise<void>) {
        this.agentId = agentId;
        if (process.platform === 'win32') {
            // Run initialization in background catch-all to prevent global crashes
            this.initTray().catch(err => {
                console.error('[Tray] Fatal error in TrayManager init loop:', err);
            });
        }
    }

    private async ensureTrayBinary(): Promise<string | null> {
        const isPackaged = (process as any).pkg !== undefined;
        const targetDir = 'C:\\IronGridAgent';
        const binDir = path.join(targetDir, 'bin', 'traybin');
        const binaryName = 'tray_windows_release.exe';
        const targetPath = path.join(binDir, binaryName);

        try {
            if (!fs.existsSync(binDir)) {
                fs.mkdirSync(binDir, { recursive: true });
            }

            // Path inside the pkg snapshot
            const snapshotPath = path.join(__dirname, '..', 'node_modules', 'systray2', 'traybin', binaryName);
            const localNodeUnitsPath = path.join(__dirname, 'traybin', binaryName);
            
            let sourcePath = '';
            if (fs.existsSync(snapshotPath)) sourcePath = snapshotPath;
            else if (fs.existsSync(localNodeUnitsPath)) sourcePath = localNodeUnitsPath;
            else {
                // Try relative to bundle
                sourcePath = path.join(process.cwd(), 'node_modules', 'systray2', 'traybin', binaryName);
            }

            if (fs.existsSync(sourcePath)) {
                // Only copy if not already there or size mismatch
                const sourceStats = fs.statSync(sourcePath);
                if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size !== sourceStats.size) {
                    fs.copyFileSync(sourcePath, targetPath);
                    console.log(`[Tray] Extracted binary to physical disk: ${targetPath}`);
                }
                return binDir;
            } else {
                console.warn('[Tray] Source binary not found in snapshot:', sourcePath);
            }
        } catch (err: any) {
            console.error(`[Tray] Failed to extract binary: ${err.message}`);
        }
        return null;
    }

    private async initTray() {
        try {
            // Pre-flight: Extract binary to disk so spawn() works
            const extractedPath = await this.ensureTrayBinary();
            
            // Hack: systray2 expects the binary in a specific place relative to its own index.js
            // When using pkg, we can't easily change the library's internal path logic,
            // but we can try to stay in the same directory where it expects it if we run from disk.
            
            // Configuração do menu da bandeja
            const conf = {
                menu: {
                    icon: this.getIconBase64(),
                    title: '⚡ IRONGRID AGENT',
                    tooltip: `IronGrid Core Agent (${this.agentId})`,
                    items: [
                        {
                            title: `PROTOCOL: ${this.agentId}`,
                            tooltip: 'Dispositivo em modo de monitoramento ativo',
                            enabled: false,
                            checked: false
                        },
                        {
                            title: 'STATUS: GRID CONNECTED',
                            tooltip: 'Sincronizado com o servidor central',
                            enabled: false,
                            checked: true
                        },
                        {
                            title: '⚡ Forçar Sincronização (Grid)',
                            tooltip: 'Envia inventário completo imediatamente',
                            checked: false,
                            enabled: true
                        },
                        {
                            title: '⚡ Abrir Chamado de Segurança',
                            tooltip: 'Envia print da tela e logs para o administrador',
                            checked: false,
                            enabled: true
                        },
                        {
                            title: 'Encerrar Protocolo',
                            tooltip: 'Encerrar o agente',
                            checked: false,
                            enabled: true
                        }
                    ]
                }
            };

            const trayOptions: any = {
                ...conf,
                debug: false,
                copyDir: true // Tells some versions of systray to try copying
            };

            try {
                // Informa o caminho do binário extraído para o SysTray
                const trayConf = {
                    ...conf,
                    binPath: path.join(extractedPath || '', 'tray_windows_release.exe')
                };
                
                this.systray = new SysTray(trayConf);

                // Evitar que erros de spawn do systray derrubem o processo principal
                this.systray.on('error', (err: any) => {
                    console.error('[Tray] Erro assíncrono detectado no binário do Tray:', err.message);
                });
            } catch (spawnErr: any) {
                console.error('[Tray] Erro imediato ao tentar instanciar o Tray:', spawnErr.message);
                return;
            }

            this.systray.onClick(async (action: any) => {
                try {
                    if (action.item.title === '⚡ Forçar Sincronização (Grid)') {
                        console.log('[Tray] Solicitou forçar sync de inventario');
                        if (this.onForceInventory) {
                            await this.onForceInventory();
                        }
                        this.socket.emit('trigger-inventory', { agentId: this.agentId, force: true });
                    } else if (action.item.title === '⚡ Abrir Chamado de Segurança') {
                        this.handleSupportTicket();
                    } else if (action.item.title === 'Encerrar Protocolo') {
                        process.exit(0);
                    }
                } catch (clickErr: any) {
                    console.error('[Tray] Erro ao processar clique no menu:', clickErr.message);
                }
            });

            this.systray.ready();
            console.log('[Tray] Ícone da bandeja inicializado com sucesso');

        } catch (error: any) {
            console.error('[Tray] Falha catastrófica ao inicializar ícone da bandeja:', error.message);
        }
    }

    /**
     * Dispara a criação de um ticket de suporte.
     * Envia um sinal para o executor de ações remotas capturar tudo.
     */
    private handleSupportTicket() {
        console.log('[Tray] Usuário solicitou chamado de suporte');
        this.socket.emit('support-ticket-request', {
            agentId: this.agentId,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Retorna o ícone do IronGrid em formato Base64.
     * Em produção, isso leria de um arquivo .ico em assets.
     */
    private getIconBase64(): string {
        // Implementação oficial: usa o IronGrid.ico gerado na compilação
        const candidates = [
            path.join(process.cwd(), 'assets', 'IronGrid.ico'),
            path.join(path.dirname(process.execPath), 'assets', 'IronGrid.ico'),
            path.join(__dirname, '..', 'assets', 'IronGrid.ico')
        ];

        for (const iconPath of candidates) {
            if (fs.existsSync(iconPath)) {
                return fs.readFileSync(iconPath).toString('base64');
            }
        }

        console.warn('[Tray] Ícone do tray não encontrado em nenhuma das rotas conhecidas:', candidates);
        return '';
    }
}
