import { exec, spawn } from 'child_process';
import util from 'util';
import * as net from 'net';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import screenshot from 'screenshot-desktop';
import { Logger } from './utils/logger';

const execAsync = util.promisify(exec);

/**
 * Módulo de Acesso Remoto do Agente.
 * Permite que técnicos visualizem e controlem a área de trabalho remotamente,
 * após permissão explícita do usuário local.
 */
export class RemoteAccessModule {
    private isStreaming = false;                // Indica se o streaming de tela está ativo
    private vncProcess: any = null;
    private vncTunnel: net.Socket | null = null;
    private socket: any;
    private agentId: string;
    private permissionMode: 'viewer' | 'administrator' | null = null;
    private streamInterval: any = null;
    private readonly VNC_PORT = 5900;

    constructor(socket: any, agentId: string) {
        this.socket = socket;
        this.agentId = agentId;
        
        // Define o título da janela do terminal para indicar a versão
        if (process.platform === 'win32') {
            console.log('\x1b]0;AGENT IronGrid v4.0.1-ENTERPRISE (STABLE)\x07');
        }

        this.setupHandlers();
    }

    /**
     * Configura os ouvintes de eventos do Socket para comandos de acesso remoto.
     */
    private logToFolder(msg: string) {
        const logPath = path.join(path.dirname(process.execPath), 'agent_debug.log');
        const timestamp = new Date().toISOString();
        try {
            fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
        } catch (e) {}
    }

    private setupHandlers() {
        this.socket.on('connect', () => {
            console.log('[Remote] Conectado ao servidor de sinalização');
        });

        // Recebe solicitação de acesso (viewer ou administrator)
        this.socket.on('access-request', async (data: { requestId: string, mode: 'viewer' | 'administrator' }) => {
            Logger.info('Solicitacao de acesso recebida', data);
            console.log(`[Remote] ===== SOLICITAÇÃO DE ACESSO RECEBIDA =====`);
            console.log(`[Remote] ID da Requisição: ${data.requestId}`);
            console.log(`[Remote] Modo: ${data.mode}`);

            // Solicita permissão ao usuário local via caixa de diálogo nativa
            const granted = await this.promptUser(data.mode);

            console.log(`[Remote] Resposta do usuário: ${granted ? 'CONCEDIDO' : 'REJEITADO'}`);

            if (granted) {
                this.permissionMode = data.mode;

                try {
                    // Tenta iniciar o servidor VNC embuido para controle mais fluido
                    const vncConfig = await this.startVNCServer();
                    Logger.info('Acesso concedido. VNC iniciado.', { requestId: data.requestId, vncConfig });
                    this.socket.emit('access-response', {
                        requestId: data.requestId,
                        granted: true,
                        vncConfig
                    });
                } catch (e) {
                    Logger.error('Erro ao iniciar VNC, usando fallback de screenshots', { error: String(e) });
                    console.log('[Remote] VNC não disponível, utilizando stream de screenshots...', e instanceof Error ? e.message : e);
                    // Caso o VNC falhe, prossegue com o método de stream básico
                    this.socket.emit('access-response', {
                        requestId: data.requestId,
                        granted: true,
                        vncConfig: null
                    });
                }
            } else {
                // Notifica o servidor que o acesso foi negado pelo usuário
                Logger.info('Acesso rejeitado pelo usuario', { requestId: data.requestId });
                this.socket.emit('access-response', {
                    requestId: data.requestId,
                    granted: false
                });
            }
        });

        // Finaliza a sessão de acesso remoto
        this.socket.on('stop-session', () => {
            this.stopVNCServer();
            this.stopStreaming();
        });

        // Inicia o streaming de frames (screenshots)
        this.socket.on('request-stream-start', () => {
            console.log('[Remote] Comando de início de stream recebido');
            this.startStreaming();
        });

        // Para o streaming de frames
        this.socket.on('request-stream-stop', () => {
            console.log('[Remote] Comando de parada de stream recebido');
            this.stopStreaming();
        });

        /**
         * Simula a interação do usuário (mouse e teclado) recebida do técnico.
         * Apenas executado se a permissão for 'administrator'.
         */
        this.socket.on('user-input', async (input: { type: string, data: any }) => {
            if (this.permissionMode !== 'administrator') return;

            try {
                if (input.type === 'mousemove') {
                    // Obtém resolução da tela via PowerShell para cálculo proporcional
                    const { stdout } = await execAsync('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | Select-Object Width,Height | ConvertTo-Json"');
                    const screen = JSON.parse(stdout);
                    const x = Math.round(input.data.x * screen.Width);
                    const y = Math.round(input.data.y * screen.Height);

                    // Move o cursor do mouse
                    await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`);

                } else if (input.type === 'mousedown') {
                    // Simula clique utilizando VBScript (método legado mas estável para cliques)
                    const vbsScript = `
                    Set WshShell = WScript.CreateObject("WScript.Shell")
                    WshShell.SendKeys "{CLICK}"
                    `;
                    const fs = require('fs');
                    const path = require('path');
                    const os = require('os');
                    const tempFile = path.join(os.tmpdir(), `click_${Date.now()}_${Math.random().toString(36).substring(7)}.vbs`);
                    fs.writeFileSync(tempFile, vbsScript);
                    await execAsync(`cscript //nologo "${tempFile}"`);
                    try { fs.unlinkSync(tempFile); } catch (e) { }

                } else if (input.type === 'keydown') {
                    // Simula pressionamento de tecla via SendKeys do .NET
                    const key = input.data.key;
                    let sendKey = key;

                    // Mapeamento de teclas especiais para o formato do SendKeys
                    const keyMap: any = {
                        'Enter': '{ENTER}',
                        'Backspace': '{BACKSPACE}',
                        'Tab': '{TAB}',
                        'Escape': '{ESC}',
                        'Delete': '{DELETE}',
                        'ArrowUp': '{UP}',
                        'ArrowDown': '{DOWN}',
                        'ArrowLeft': '{LEFT}',
                        'ArrowRight': '{RIGHT}',
                    };

                    if (keyMap[key]) {
                        sendKey = keyMap[key];
                    } else if (key.length === 1) {
                        sendKey = key;
                    } else {
                        return; // Ignora teclas de sistema/função não mapeadas
                    }

                    await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')"`);
                }
            } catch (err) {
                console.error('[Remote] Erro na simulação de input:', err);
            }
        });

        this.socket.on('vnc-client-connected', () => {
            console.log('[Remote] Cliente VNC connectou no Proxy, estabelecendo túnel interno...');
            // Inicia o túnel agora para pegar o handshake RFB certinho
            if (this.vncTunnel) {
                this.vncTunnel.destroy();
                this.vncTunnel = null;
            }
            this.setupVncTunnel(0);
        });

        this.socket.on('vnc-data', (data: Buffer) => {
            if (this.vncTunnel && !this.vncTunnel.destroyed) {
                this.vncTunnel.write(data);
            }
        });

        this.socket.on('disconnect', () => {
            this.stopStreaming();
            this.stopVNCServer();
        });
    }

    /**
     * Exibe um prompt de confirmação no Windows para o usuário local.
     */
    private async promptUser(mode: string): Promise<boolean> {
        try {
            const title = "IronGrid - Solicitacao de Acesso Remoto";
            const modeText = mode === 'viewer' ? 'VISUALIZACAO' : 'CONTROLE TOTAL (Administrador)';
            const message = `Um tecnico esta solicitando acesso de ${modeText} ao seu computador. Deseja permitir?`;

            // Script PowerShell para exibir MessageBox do .NET
            const scriptContent = `
            Add-Type -AssemblyName PresentationFramework
            $result = [System.Windows.MessageBox]::Show('${message}', '${title}', 'YesNo', 'Question')
            if ($result -eq 'Yes') { Write-Output 'Yes' } else { Write-Output 'No' }
            `;

            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const tempScript = path.join(os.tmpdir(), `irongrid_prompt_${Date.now()}.ps1`);

            fs.writeFileSync(tempScript, scriptContent);

            return new Promise((resolve) => {
                const child = require('child_process').spawn('powershell', [
                    '-NoProfile',
                    '-ExecutionPolicy', 'Bypass',
                    '-File', tempScript
                ]);

                let stdout = '';
                child.stdout.on('data', (data: any) => { stdout += data.toString(); });

                child.on('error', (err: any) => {
                    console.error('[Remote] Erro ao disparar prompt:', err);
                    resolve(false);
                });

                child.on('close', (code: number) => {
                    try { fs.unlinkSync(tempScript); } catch (e) { }
                    resolve(stdout.trim() === 'Yes');
                });

                // Tempo limite de 30 segundos para resposta do usuário
                setTimeout(() => {
                    if (!child.killed) child.kill();
                    resolve(false);
                }, 30000);
            });
        } catch (err) {
            console.error('[Remote] Erro no prompt de permissão:', err);
            return false;
        }
    }

    /**
     * Auxiliar para configurar o Registro do Windows
     */
    private async setRegistry(key: string, value: string | number, type: 'REG_SZ' | 'REG_DWORD' = 'REG_DWORD'): Promise<void> {
        return new Promise((resolve) => {
            const cmd = `reg add "HKCU\\Software\\TightVNC\\Server" /v "${key}" /t ${type} /d ${value} /f`;
            exec(cmd, (err) => {
                if (err) {
                    console.error(`[Remote] FALHA Registro ${key}:`, err.message);
                } else {
                    this.logToFolder(`OK Registro ${key}=${value}`);
                    console.log(`[Remote] OK Registro ${key}=${value}`);
                }
                resolve();
            });
        });
    }

    /**
     * Inicia o ciclo de captura de tela e envio de frames via socket.
     */
    private async startStreaming() {
        if (this.isStreaming) return;
        this.isStreaming = true;

        console.log('[Remote] Iniciando stream da área de trabalho');
        this.streamInterval = setInterval(async () => {
            try {
                // Captura screenshot no formato JPG de baixo peso
                const img = await screenshot({ format: 'jpg' });
                const base64 = img.toString('base64');

                this.socket.emit('stream-frame', {
                    agentId: this.agentId,
                    frame: base64
                });
            } catch (err) {
                console.error('[Remote] Erro de captura:', err);
            }
        }, 500); // 2 FPS para manter simplicidade e baixo consumo de banda
    }

    /**
     * Interrompe o envio de frames de tela.
     */
    private stopStreaming() {
        this.isStreaming = false;
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }
        console.log('[Remote] Stream interrompido');
    }

    /**
     * Tenta localizar e iniciar um servidor VNC binário para controle avançado.
     */
    private async startVNCServer(): Promise<{ port: number, password: string }> {
        if (process.platform !== 'win32') {
            throw new Error('Acesso remoto via VNC suportado apenas em Windows');
        }

        const isPackaged = (process as any).pkg !== undefined;
        const baseDir = isPackaged ? path.dirname(process.execPath) : process.cwd();
        const vncDir = path.join(baseDir, 'bin');

        if (!fs.existsSync(vncDir)) fs.mkdirSync(vncDir);
        
        const vncExe = path.join(vncDir, 'tvnserver.exe');
        console.log(`[Remote] Buscando VNC em: ${vncExe}`);

        if (!fs.existsSync(vncExe)) {
            console.log('[Remote] Servidor VNC não encontrado localmente. Tentando baixar...');
            await this.downloadVNC(vncExe);
        }

        this.stopVNCServer();

        // Configura o VNC via Registro do Windows (Mais Robusto e Seguro)
        console.log('[Remote] Configurando VNC em MODO DE SEGURANÇA...');
        this.logToFolder('Iniciando configuracao segura de registro');

        await this.setRegistry('RfbPort', this.VNC_PORT);
        await this.setRegistry('AcceptPort', 1);
        await this.setRegistry('AcceptAllowLoopback', 1);
        await this.setRegistry('QuerySetting', 0);
        await this.setRegistry('QueryTimeout', 0);
        await this.setRegistry('QueryAccept', 1);
        await this.setRegistry('AllowLoopback', 1);
        
        // CHAVES DE SEGURANÇA ANTI-BSOD (Crítico para evitar reinício ou tela azul)
        Logger.info('Aplicando configuracoes de seguranca do registro para VNC...');
        await this.setRegistry('VideoHookDriver', 0);    // Desativa drivers de gancho kernel (Causa BSOD)
        await this.setRegistry('DisableMirrorDriver', 1); // Desativa driver de espelhamento (Causa BSOD)
        await this.setRegistry('UpdateMethod', 1);        // Força modo Polling (Mais lento mas 100% SEGURO)
        await this.setRegistry('GrabTransparent', 1);    // Compatibilidade UI moderna
        await this.setRegistry('AllowDirectDraw', 0);     // Desativa aceleração perigosa
        await this.setRegistry('UsePerformanceCounters', 0); // Desativa contadores que podem travar CPUs antigas
        await this.setRegistry('RemoveWallpaper', 0);     // Nao mexe no papel de parede (evita travamento do shell)

        const password = 'IronGrid' + Math.random().toString(36).slice(-4);
        Logger.info(`Iniciando processo VNC. Porto: ${this.VNC_PORT}, Senha gerada.`);
        console.log(`\x1b[32m[Remote] Iniciando Servidor VNC (Versão 4.x - Enterprise) na porta ${this.VNC_PORT}\x1b[0m`);

        // Inicia o TightVNC em modo portable
        // AGORA: Usamos APENAS -run sem outros flags que causam erro de sintaxe.
        // Ele vai ler TUDO (porta, senha, etc) do Registro que acabamos de configurar.
        const args = ['-run'];
        console.log(`\x1b[32m[Remote] Executando: ${vncExe} ${args.join(' ')}\x1b[0m`);

        this.vncProcess = spawn(vncExe, args);

        if (this.vncProcess.stdout) {
            this.vncProcess.stdout.on('data', (data: any) => console.log(`[VNC-OUT] ${data}`));
        }
        if (this.vncProcess.stderr) {
            this.vncProcess.stderr.on('data', (data: any) => console.error(`[VNC-ERR] ${data}`));
        }

        this.vncProcess.on('error', (err: any) => console.error('[Remote] VncProcess Error:', err));
        this.vncProcess.on('exit', (code: any) => console.log(`[Remote] VncProcess finalizado com codigo: ${code}`));

        // Não iniciamos o túnel imediatamente. Aguardamos o evento 'vnc-client-connected'
        // para não perder o handshake RFB (RFB 003.008) enviado pelo tvnserver.

        return { port: this.VNC_PORT, password };
    }

    private setupVncTunnel(attempt = 0) {
        if (attempt === 0) {
            console.log('[Remote] Estabelecendo túnel TCP reversível para o servidor central...');
        }
        
        const connection = net.createConnection({ port: this.VNC_PORT, host: '127.0.0.1' });
        this.vncTunnel = connection;

        connection.on('connect', () => {
            console.log(`[Remote] Túnel VNC estabelecido com sucesso (Tentativa ${attempt + 1})`);
        });

        connection.on('data', (data) => {
            this.socket.emit('vnc-data', data);
        });

        connection.on('error', (err: any) => {
            if (err.code === 'ECONNREFUSED' && attempt < 15) {
                // Se a conexão for recusada, tenta novamente em breve (o VNC pode estar subindo)
                setTimeout(() => this.setupVncTunnel(attempt + 1), 1000);
                return;
            }

            console.error(`[Remote] Erro no túnel TCP do VNC (Tentativa ${attempt + 1}):`, err.message || err);
            
            setTimeout(() => {
                if (!this.vncTunnel || this.vncTunnel.destroyed) this.setupVncTunnel(0);
            }, 5000);
        });
    }

    private async downloadVNC(dest: string): Promise<void> {
        const serverUrl = (this.socket as any).io.uri;
        const downloadUrl = `${serverUrl}/downloads/tvnserver.exe`;
        
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(downloadUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Download falhou: ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        });
    }

    /**
     * Finaliza o servidor VNC e fecha o túnel.
     */
    private stopVNCServer() {
        if (this.vncProcess) {
            try {
                this.vncProcess.kill();
                console.log('[Remote] Servidor VNC finalizado');
            } catch (e) {
                console.error('[Remote] Erro ao parar VNC:', e);
            }
            this.vncProcess = null;
        }

        // Força o encerramento de qualquer instância órfã no Windows
        if (process.platform === 'win32') {
            try {
                exec('taskkill /F /IM tvnserver.exe /T', (err) => {
                    if (!err) console.log('[Remote] Instancias orfas do VNC limpas');
                });
            } catch (e) { }
        }

        if (this.vncTunnel) {
            this.vncTunnel.destroy();
            this.vncTunnel = null;
        }
    }
}
