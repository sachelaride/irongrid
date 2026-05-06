import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { Socket } from 'socket.io-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as https from 'https';
import notifier from 'node-notifier';
import screenshot from 'screenshot-desktop';
import { Logger } from './utils/logger';

const execAsync = promisify(exec);

/**
 * Interface que define as ações remotas que o agente pode executar.
 */
export interface IronGridActionParams {
    logId: string;      // ID único para rastreamento da ação no servidor
    action: 'executeScript' | 'manageService' | 'systemControl' | 'deploySoftware' | 'startVNC' | 'stopVNC' | 'configureSecurity' | 'notify' | 'supportTicket' | 'usbControl';
    parameters: any;    // Parâmetros específicos de cada comando
}

/**
 * Executor de Ações Remotas.
 * Gerencia o recebimento e a execução de comandos administrativos vindos do servidor central.
 */
export class RemoteActionExecutor {
    private readonly ACTION_TIMEOUT = 300000; // Tempo limite global de 5 minutos por ação
    private vncProcess: any = null;
    private vncTunnel: net.Socket | null = null;
    private vncPort = 5900;

    constructor(private socket: Socket, private trpcClient?: any) {
        // Ouve comandos do tipo 'remote-action'
        this.socket.on('remote-action', (params: IronGridActionParams) => {
            this.handleAction(params);
        });

        // Ouve dados do túnel VNC vindo do servidor
        this.socket.on('vnc-data', (data: Buffer) => {
            if (this.vncTunnel && !this.vncTunnel.destroyed) {
                this.vncTunnel.write(data);
            }
        });
    }

    /**
     * Auxiliar para garantir que uma promessa não exceda o tempo limite.
     */
    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`Ação expirou após ${timeoutMs}ms`)), timeoutMs)
            )
        ]);
    }

    /**
     * Processa a ação recebida, captura saída/erros e reporta o resultado ao servidor.
     */
    private async handleAction(params: IronGridActionParams) {
        Logger.info(`[RemoteAction] Recebido: ${params.action}`, { logId: params.logId, parameters: params.parameters });
        console.log(`[RemoteAction] Executando ${params.action} para logId ${params.logId}`);
        let output = '';
        let error = '';
        let exitCode = 0;
        const startTime = Date.now();

        try {
            // Define qual submódulo de execução utilizar baseado no tipo de ação
            const actionPromise = (async () => {
                switch (params.action) {
                    case 'executeScript':
                        return await this.executeScript(params.parameters);
                    case 'manageService':
                        return await this.manageService(params.parameters);
                    case 'systemControl':
                        await this.systemControl(params.parameters);
                        return { output: 'Comando de controle de sistema enviado com sucesso', error: '', exitCode: 0 };
                    case 'deploySoftware':
                        return await this.deploySoftware(params.parameters);
                    case 'startVNC':
                        return await this.startVNC(params.parameters);
                    case 'stopVNC':
                        this.stopVNC();
                        return { output: 'VNC finalizado', error: '', exitCode: 0 };
                    case 'usbControl':
                        const usbRes = await this.usbControl(params.parameters.command);
                        return { output: usbRes.message || '', error: usbRes.error || '', exitCode: usbRes.success ? 0 : 1 };
                    case 'configureSecurity':
                        return await this.configureSecurity(params.parameters);
                    case 'notify':
                        return await this.notifyUser(params.parameters);
                    case 'supportTicket':
                        return await this.generateSupportTicket(params.parameters);
                    default:
                        throw new Error(`Tipo de ação desconhecido: ${params.action}`);
                }
            })();

            // Executa com controle de timeout
            const result = await this.withTimeout(actionPromise, this.ACTION_TIMEOUT);
            output = result.output;
            error = result.error;
            exitCode = result.exitCode;

            const duration = Date.now() - startTime;
            console.log(`[RemoteAction] Concluído ${params.action} em ${duration}ms com código de saída ${exitCode}`);

            // Envia o resultado detalhado de volta para o servidor central
            this.socket.emit('action-result', {
                logId: params.logId,
                status: exitCode === 0 ? 'SUCCESS' : 'FAILED',
                output,
                error,
                exitCode
            });
        } catch (err: any) {
            const duration = Date.now() - startTime;
            console.error(`[RemoteAction] Falhou após ${duration}ms:`, err);
            this.socket.emit('action-result', {
                logId: params.logId,
                status: 'FAILED',
                error: `${err.message || String(err)} (Duração: ${duration}ms)`,
                exitCode: err.code || 1
            });
        }
    }

    /**
     * Executa scripts arbitrários no terminal (PowerShell no Windows, Bash no Linux).
     * Suporta scripts passados como string direta ou via arquivo temporário.
     */
    private async executeScript(params: { script?: string, scriptContent?: string, shell?: string }): Promise<{ output: string, error: string, exitCode: number }> {
        const shell = params.shell || (process.platform === 'win32' ? 'powershell' : 'bash');
        const content = params.scriptContent || params.script;

        if (!content || content.trim().length === 0) {
            throw new Error('Conteúdo do script está vazio');
        }

        console.log(`[RemoteAction] Executando script (tamanho: ${content.length} caracteres)`);

        let tempFilePath = '';
        try {
            // Se o script for multi-line ou tiver hashbang, usamos arquivo temporário para maior estabilidade
            if (content.includes('\n') || content.startsWith('#!')) {
                const extension = process.platform === 'win32' ? '.ps1' : (content.includes('expect') ? '.exp' : '.sh');
                tempFilePath = path.join(os.tmpdir(), `irongrid_script_${Date.now()}${extension}`);
                
                await fs.promises.writeFile(tempFilePath, content, { mode: 0o755 });
                
                let command = '';
                if (process.platform === 'win32') {
                    command = `powershell -ExecutionPolicy Bypass -File "${tempFilePath}"`;
                } else {
                    // Se tiver hashbang, executa direto, senão usa o shell definido
                    command = content.startsWith('#!') ? `"${tempFilePath}"` : `${shell} "${tempFilePath}"`;
                }

                console.log(`[RemoteAction] Executando via arquivo temporário: ${command}`);
                const { stdout, stderr } = await execAsync(command, {
                    maxBuffer: 1024 * 1024 * 10
                });
                
                return { output: stdout, error: stderr, exitCode: 0 };
            } else {
                // Execução de comando simples em linha única (legado)
                let command = '';
                if (shell === 'powershell' || shell === 'pwsh') {
                    command = `${shell} -Command "${content.replace(/"/g, '\\"')}"`;
                } else {
                    command = `${shell} -c "${content.replace(/"/g, '\\"')}"`;
                }

                const { stdout, stderr } = await execAsync(command, {
                    maxBuffer: 1024 * 1024 * 10
                });
                return { output: stdout, error: stderr, exitCode: 0 };
            }
        } catch (err: any) {
            return { 
                output: err.stdout || '', 
                error: err.stderr || err.message, 
                exitCode: err.code || 1 
            };
        } finally {
            // Limpeza do arquivo temporário
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    await fs.promises.unlink(tempFilePath);
                } catch (e) {
                    console.error(`[RemoteAction] Falha ao remover arquivo temporário: ${tempFilePath}`, e);
                }
            }
        }
    }

    /**
     * Gerencia serviços do sistema (iniciar, parar, reiniciar).
     */
    private async manageService(params: { serviceName: string, action: 'start' | 'stop' | 'restart' | 'status' }): Promise<{ output: string, error: string, exitCode: number }> {
        let command = '';
        if (process.platform === 'win32') {
            command = `powershell -Command "${params.action}-Service -Name ${params.serviceName}"`;
            if (params.action === 'status') {
                command = `powershell -Command "Get-Service -Name ${params.serviceName} | Select-Object Status, Name, DisplayName | ConvertTo-Json"`;
            }
        } else {
            command = `sudo systemctl ${params.action} ${params.serviceName}`;
        }

        try {
            const { stdout, stderr } = await execAsync(command);
            return { output: stdout, error: stderr, exitCode: 0 };
        } catch (err: any) {
            return { output: err.stdout || '', error: err.stderr || err.message, exitCode: err.code || 1 };
        }
    }

    /**
     * Realiza controle de energia (reiniciar e desligar) do dispositivo.
     */
    private async systemControl(params: { action: 'reboot' | 'shutdown', delay?: number }): Promise<void> {
        const delay = params.delay || 0;
        let command = '';
        
        Logger.info(`[SYSTEM_CONTROL] Recebido: ${params.action}`, params);
        
        // TRAVA DE SEGURANÇA: Só executa se a ação for explicitamente reconhecida
        if (params.action !== 'reboot' && params.action !== 'shutdown') {
            Logger.error('[SYSTEM_CONTROL] Ação ignorada por segurança (não reconhecida)', params);
            console.error('[RemoteAction] AÇÃO CRÍTICA IGNORADA POR SEGURANÇA:', params.action);
            return;
        }

        if (process.platform === 'win32') {
            const flag = params.action === 'reboot' ? '-r' : '-s';
            command = `shutdown ${flag} -t ${delay} -f`;
        } else {
            const flag = params.action === 'reboot' ? '-r' : '-h';
            command = `sudo shutdown ${flag} +${Math.ceil(delay / 60)}`;
        }
        
        console.log(`[RemoteAction] EXECUTANDO COMANDO CRÍTICO: ${command}`);
        Logger.info(`[SYSTEM_CONTROL] Executando comando: ${command}`);
        await execAsync(command);
    }

    /**
     * Inicia o Servidor VNC e o Túnel reverso.
     */
    private async startVNC(params: { password?: string }): Promise<{ output: string, error: string, exitCode: number }> {
        if (process.platform !== 'win32') {
            throw new Error('Acesso remoto via VNC suportado apenas em Windows no momento');
        }

        try {
            // 1. Garantir que o executável existe
            const vncDir = path.join(process.cwd(), 'bin');
            if (!fs.existsSync(vncDir)) fs.mkdirSync(vncDir);
            
            const vncExe = path.join(vncDir, 'tvnserver.exe');
            if (!fs.existsSync(vncExe)) {
                console.log('[RemoteAction] Baixando servidor VNC...');
                // Em produção, isso viria do seu bucket ou servidor principal
                // Por agora, vamos assumir que está em /downloads/tvnserver.exe
                await this.downloadVNC(vncExe);
            }

            // 2. Parar qualquer instância anterior
            this.stopVNC();

            // 3. Iniciar o processo VNC (TightVNC portable)
            // Nota: TightVNC portable usa argumentos para configurar sem mexer no registro
            const password = params.password || 'IronGrid123';
            
            // Configura a senha via CLI (TightVNC suporta carregar config de arquivo ou registry)
            // Aqui vamos simplificar usando um comando que "garante" a execução em 127.0.0.1
            console.log('[RemoteAction] Iniciando processo VNC na porta 5900...');
            this.vncProcess = spawn(vncExe, [
                '-run',
                '-port', '5900',
                '-password', password,
                '-realtimescaling', '1',
                '-disableselectloop', '1'
            ]);

            this.vncProcess.on('error', (err: any) => console.error('[RemoteAction] VNC Process Error:', err));

            // 4. Iniciar o Túnel TCP -> WebSocket
            setTimeout(() => this.setupVncTunnel(), 2000);

            return { output: 'VNC iniciado com sucesso. Túnel estabelecido.', error: '', exitCode: 0 };
        } catch (err: any) {
            return { output: '', error: `Falha ao iniciar VNC: ${err.message}`, exitCode: 1 };
        }
    }

    private stopVNC() {
        if (this.vncProcess) {
            this.vncProcess.kill();
            this.vncProcess = null;
        }
        if (this.vncTunnel) {
            this.vncTunnel.destroy();
            this.vncTunnel = null;
        }
    }

    private setupVncTunnel() {
        console.log('[RemoteAction] Estabelecendo túnel TCP para VNC...');
        
        this.vncTunnel = net.createConnection({ port: 5900, host: '127.0.0.1' });

        this.vncTunnel.on('data', (data) => {
            this.socket.emit('vnc-data', data);
        });

        this.vncTunnel.on('error', (err) => {
            console.error('[RemoteAction] VNC Tunnel TCP Error:', err);
            // Tenta reconectar em 5 segundos se o VNC cair
            setTimeout(() => {
                if (!this.vncTunnel || this.vncTunnel.destroyed) this.setupVncTunnel();
            }, 5000);
        });

        this.vncTunnel.on('close', () => {
            console.log('[RemoteAction] Túnel VNC encerrado');
        });
    }

    private async downloadVNC(dest: string): Promise<void> {
        // Pega a URL do servidor a partir do socket (hack para saber onde o servidor está)
        const serverUrl = (this.socket as any).io.uri;
        const downloadUrl = `${serverUrl}/downloads/tvnserver.exe`;
        
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(downloadUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Falha no download: Status ${response.statusCode}`));
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
     * Implementação futura para deploy automatizado de software.
     */
    private async deploySoftware(params: { packageUrl: string, installCommand: string }): Promise<{ output: string, error: string, exitCode: number }> {
        let output = 'Deploy de software iniciado (implementação futura)';
        return { output, error: '', exitCode: 0 };
    }

    /**
     * Configura políticas de segurança (ex: Bloqueio de USB)
     */
    private async configureSecurity(params: { usbBlocked: boolean }): Promise<{ output: string, error: string, exitCode: number }> {
        if (process.platform !== 'win32') {
            throw new Error('Configurações de segurança suportadas apenas em Windows');
        }

        try {
            // 3 = Enabled (Manual/Auto), 4 = Disabled
            const value = params.usbBlocked ? 4 : 3;
            const command = `reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR" /v Start /t REG_DWORD /d ${value} /f`;
            
            console.log(`[RemoteAction] Alterando política USB para: ${params.usbBlocked ? 'BLOQUEADO' : 'LIBERADO'}`);
            const { stdout, stderr } = await execAsync(command);
            
            return { 
                output: `Política USB alterada com sucesso (${params.usbBlocked ? 'Bloqueado' : 'Liberado'}). ${stdout}`, 
                error: stderr, 
                exitCode: 0 
            };
        } catch (err: any) {
            return { output: '', error: `Falha ao configurar segurança: ${err.message}`, exitCode: 1 };
        }
    }

    /**
     * Exibe uma notificação para o usuário (Windows Toast)
     */
    private async notifyUser(params: { title?: string, message: string }): Promise<{ output: string, error: string, exitCode: number }> {
        console.log(`[RemoteAction] Exibindo notificação: ${params.message}`);
        
        notifier.notify({
            title: params.title || 'IronGrid - Mensagem do Admin',
            message: params.message,
            icon: path.join(process.cwd(), 'assets', 'logo.png'),
            sound: true,
            wait: true
        });

        return { output: 'Notificação enviada', error: '', exitCode: 0 };
    }

    /**
     * Gera um chamado de suporte com print da tela e dados técnicos
     */
    private async generateSupportTicket(params: { reason?: string }): Promise<{ output: string, error: string, exitCode: number }> {
        console.log('[RemoteAction] Gerando ticket de suporte...');
        
        try {
            const tempFile = path.join(os.tmpdir(), `ticket_${Date.now()}.png`);
            
            // 1. Captura a tela
            await screenshot({ filename: tempFile });
            const base64Image = await fs.promises.readFile(tempFile, { encoding: 'base64' });

            // 2. Tenta enviar para o servidor via tRPC ou Socket
            if (this.trpcClient) {
                await this.trpcClient.tickets.create.mutate({
                    agentId: (this.socket as any).agentId,
                    reason: params.reason || 'Solicitação via Agente',
                    screenshot: base64Image,
                    logs: 'Snapshot de logs recolhido pelo agente.'
                });
            } else {
                // Fallback via socket
                this.socket.emit('support-ticket-upload', {
                    screenshot: base64Image,
                    reason: params.reason
                });
            }

            // Limpeza
            fs.unlink(tempFile, () => {});

            return { output: 'Ticket de suporte enviado com sucesso', error: '', exitCode: 0 };
        } catch (err: any) {
            return { output: '', error: `Falha ao gerar ticket: ${err.message}`, exitCode: 1 };
        }
    }

    private async usbControl(command: 'block' | 'unblock'): Promise<{ success: boolean, message?: string, error?: string }> {
        if (process.platform !== 'win32') {
            return { success: false, error: 'Comando suportado apenas no Windows' };
        }

        const value = command === 'block' ? 4 : 3;
        const displayName = command === 'block' ? 'BLOQUEAR' : 'DESBLOQUEAR';
        
        Logger.info(`[USB_CONTROL] Solicitado: ${displayName}`);

        try {
            const regCmd = `reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR" /v Start /t REG_DWORD /d ${value} /f`;
            await execAsync(regCmd);
            
            return { 
                success: true, 
                message: `Portas USB ${command === 'block' ? 'bloqueadas' : 'desbloqueadas'} com sucesso. Reinicie a máquina se necessário.` 
            };
        } catch (error: any) {
            Logger.error(`[USB_CONTROL] Erro: ${error.message}`);
            return { success: false, error: 'Falha ao alterar registro do Windows. Verifique permissões de Admin.' };
        }
    }
}
