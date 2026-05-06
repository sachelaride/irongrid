/**
 * Serviço de Monitoramento Syslog em Tempo Real
 * 
 * Atua como um servidor Syslog UDP, escutando mensagens enviadas por ativos de rede
 * (Switches, Firewalls, Roteadores). O serviço realiza o parse das mensagens seguindo
 * os padrões RFC 3164 e RFC 5424, permitindo filtragem por severidade e 
 * dispositivo monitorado.
 * 
 * Funcionalidades:
 * - Escuta UDP (porta padrão 1514).
 * - Parser de mensagens (Timestamp, Hostname, Tag, Severity).
 * - Buffer circular em memória para exibição em tempo real via Socket.io.
 * - Persistência automática no banco de dados para mensagens críticas (Severity <= 4).
 * 
 * @module services/syslogService
 */

import dgram from 'dgram';
import { EventEmitter } from 'events';
import { prisma } from '../utils/prisma';
import { syslogPool, initSyslogDb } from '../utils/syslogDb';

/** Mensagem estruturada após o processamento do Syslog */
export interface SyslogMessage {
    /** Data e hora da recepção/geração */
    timestamp: Date;
    /** Nome de host ou IP de origem */
    hostname: string;
    /** Código da facilidade (origem do log) */
    facility: number;
    /** Nível de severidade (0=Emergency até 7=Debug) */
    severity: number;
    /** Identificador do processo ou componente (Tag) */
    tag: string;
    /** Conteúdo útil da mensagem */
    message: string;
    /** Mensagem bruta recebida via socket */
    rawMessage: string;
    /** ID do dispositivo correlacionado (opcional) */
    deviceId?: string;
}

export class SyslogService extends EventEmitter {
    private server: dgram.Socket | null = null;
    private port: number;
    private isRunning: boolean = false;
    /** Buffer circular em memória */
    private messageBuffer: SyslogMessage[] = [];
    /** Tamanho máximo do buffer de memória */
    private readonly bufferSize: number = 1000;
    /** Lista de IPs/Hostnames permitidos para monitoramento ativo */
    private monitoredDevices: Set<string> = new Set();
    /** Flag global de gravação */
    private recordingEnabled: boolean = true;

    constructor(port: number = 514) {
        super();
        this.port = port;
    }

    /**
     * Start - Iniciar o servidor de escuta UDP
     * 
     * Configura o socket dgram e inicia o processamento de pacotes recebidos.
     * Dispara eventos 'message' para notificações em tempo real.
     */
    async start(forcedPort?: number): Promise<void> {
        console.log(`[SyslogService] Start requested (Forced port: ${forcedPort || 'none'})`);
        if (this.isRunning) {
            console.log('[SyslogService] Already running');
            return;
        }

        await initSyslogDb();
        await this.loadMonitoredDevices();
        await this.loadRecordingConfig();

        // Preserve lastError if it was set by a preceding bind failure (like EACCES fallback)
        if (!forcedPort) {
            this.lastError = null;
        }

        // Only load from DB if no forced port is provided
        if (forcedPort) {
            this.port = forcedPort;
        } else {
            await this.loadPortConfig();
        }

        return new Promise((resolve, reject) => {
            const socket = dgram.createSocket('udp4');
            this.server = socket;

            const onListening = () => {
                const address = socket.address();
                console.log(`[SyslogService] Listening on ${address.address}:${address.port}`);
                this.isRunning = true;
                this.emit('started');
                cleanup();
                resolve();
            };

            const onError = async (err: any) => {
                console.error('[SyslogService] Server error during startup:', err);
                this.lastError = err.message || String(err);

                cleanup();
                try {
                    socket.close();
                } catch (e) { }
                this.server = null;
                this.isRunning = false;

                if (err.code === 'EACCES') {
                    const fallbackPort = 1514;
                    const message = `Porta ${this.port} requer privilégios de root. Usando fallback ${fallbackPort}.`;
                    console.warn(`[SyslogService] ${message}`);
                    this.lastError = message;
                    console.warn(`[SyslogService] TIP: Run 'sudo setcap cap_net_bind_service=+ep $(which node)' to allow Node to bind to ports < 1024.`);

                    if (this.port !== fallbackPort) {
                        this.port = fallbackPort;
                        try {
                            await prisma.systemParameter.upsert({
                                where: { key: 'syslog_port' },
                                update: { value: String(fallbackPort) },
                                create: { key: 'syslog_port', value: String(fallbackPort), category: 'SYSLOG', type: 'NUMBER', description: 'Porta UDP para escuta do servidor Syslog' }
                            });
                        } catch (dbErr) {
                            console.error('[SyslogService] Failed to save fallback port to DB:', dbErr);
                        }
                        // Retry on fallback port
                        this.start().then(resolve).catch(reject);
                        return;
                    }
                }
                reject(err);
            };

            const cleanup = () => {
                socket.removeListener('listening', onListening);
                socket.removeListener('error', onError); // Remove the startup error listener
            };

            socket.on('listening', onListening);
            socket.on('error', onError); // This listener is for startup errors

            // Regular message handler (persists after startup)
            socket.on('message', async (msg, rinfo) => {
                try {
                    const parsed = this.parseSyslog(msg.toString(), rinfo.address);

                    // Correlaciona o dispositivo para permitir filtragem em tempo real
                    const device = await this.findCachedDevice(parsed.hostname);
                    if (device) {
                        parsed.deviceId = device.id;
                    }

                    // Emite para TODOS os ouvintes em tempo real (Auditoria)
                    this.addToBuffer(parsed);
                    this.emit('message', parsed);

                    // Persistência: Grava no banco apenas se for um dispositivo selecionado para gravação
                    // Se a lista estiver vazia (modo aberto), grava tudo.
                    if (this.recordingEnabled) {
                        const isMonitored = this.monitoredDevices.size === 0 || this.monitoredDevices.has(parsed.hostname);
                        
                        if (isMonitored) {
                            this.persistMessage(parsed, device?.id).catch(err =>
                                console.error('[SyslogService] Failed to persist message:', err)
                            );
                        }
                    }
                } catch (error) {
                    console.error('[SyslogService] Failed to parse syslog message:', error);
                }
            });

            // Handle runtime errors separately, after the server has successfully started
            socket.on('error', (err) => {
                if (!this.isRunning) return; // This error was handled by the startup promise
                console.error('[SyslogService] Runtime server error:', err);
                this.lastError = err.message || String(err);
                // Optionally, you might want to stop the service or attempt a restart here
                // this.stop().then(() => this.start());
            });

            try {
                socket.bind(this.port);
            } catch (bindErr: any) {
                onError(bindErr); // Catch synchronous bind errors and pass to onError
            }
        });
    }

    /**
     * Stop - Encerrar o servidor
     */
    async stop(): Promise<void> {
        console.log('[SyslogService] Stop requested');
        if (!this.isRunning || !this.server) {
            console.log('[SyslogService] Not running or server is null');
            return;
        }

        return new Promise((resolve) => {
            this.server!.close(() => {
                console.log('[SyslogService] Server stopped');
                this.isRunning = false;
                this.server = null;
                this.emit('stopped');
                resolve();
            });
        });
    }

    /**
     * Restart - Reiniciar o servidor em uma nova porta
     */
    async restart(newPort?: number): Promise<void> {
        console.log(`[SyslogService] Restarting... New port: ${newPort || 'same'}`);
        await this.stop();
        await this.start(newPort);
        console.log('[SyslogService] Restart complete');
    }

    /**
     * Refresh Config - Recarrega configurações do banco sem reiniciar o servidor
     */
    async refreshConfig(): Promise<void> {
        console.log('[SyslogService] Refreshing config...');
        await this.loadMonitoredDevices();
        await this.loadRecordingConfig();
    }

    /**
     * Parse Syslog - Processador de Mensagens (RFC 3164/5424)
     * 
     * Tenta identificar o PRI (<numerologia>), Hostname e Tag.
     * Possui heurística para identificar logs de auditoria de equipamentos de rede.
     * 
     * @private
     */
    private parseSyslog(message: string, sourceIp: string): SyslogMessage {
        const timestamp = new Date();
        let hostname = sourceIp;
        let facility = 0;
        let severity = 6;
        let tag = '';
        let content = message;

        // Extração de Prioridade (PRI)
        const priMatch = message.match(/^<(\d+)>/);
        if (priMatch) {
            const pri = parseInt(priMatch[1]);
            facility = Math.floor(pri / 8);
            severity = pri % 8;
            content = message.substring(priMatch[0].length);
        }

        // Heurística de Auditoria/Login
        let isAudit = false;
        if (content.toLowerCase().includes('audit') || content.toLowerCase().includes('auth') || content.toLowerCase().includes('login')) {
            isAudit = true;
        }

        // Extração de Hostname e Tag
        const parts = content.trim().split(/\s+/);
        if (parts.length >= 2) {
            if (parts[0].match(/^[A-Z][a-z]{2}$/) || parts[0].match(/^\d{4}-\d{2}/)) {
                hostname = parts[1];
                tag = parts[2] || '';
                content = parts.slice(3).join(' ');
            } else if (parts[0].match(/^[a-zA-Z0-9.-]+$/)) {
                hostname = parts[0];
                tag = parts[1] || '';
                content = parts.slice(2).join(' ');
            }
        }

        tag = tag.replace(/:$/, '');

        if (content.length < 5) {
            content = message.replace(/^<\d+>/, '').trim();
        }

        if (!hostname || hostname === '-') {
            hostname = sourceIp;
        }

        if (isAudit && !tag) {
            tag = 'AUDIT';
        }

        return {
            timestamp,
            hostname,
            facility,
            severity,
            tag: tag || 'SYSTEM',
            message: content,
            rawMessage: message
        };
    }

    /**
     * Sanitize String - Remove caracteres que quebram o PostgreSQL (ex: null bytes)
     * @private
     */
    private sanitizeString(str: string): string {
        if (!str) return str;
        // Remove null bytes (\u0000) que causam erro 22021 no Postgres
        return str.replace(/\0/g, '').trim();
    }

    /**
     * Add to Buffer - Adicionar ao buffer circular
     * @private
     */
    private addToBuffer(message: SyslogMessage): void {
        this.messageBuffer.push(message);
        if (this.messageBuffer.length > this.bufferSize) {
            this.messageBuffer.shift();
        }
    }

    /**
     * Persist Message - Salvar log no banco de dados
     * @private
     */
    private async persistMessage(message: SyslogMessage, providedDeviceId?: string): Promise<void> {
        try {
            let deviceId = providedDeviceId;

            // Se não foi provido, tenta buscar (fallback)
            if (!deviceId) {
                const device = await this.findCachedDevice(message.hostname);
                deviceId = device?.id;
            }

            await syslogPool.query(
                `INSERT INTO syslog_entries 
                (timestamp, hostname, facility, severity, tag, message, raw_message, device_id) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    message.timestamp,
                    this.sanitizeString(message.hostname),
                    message.facility,
                    message.severity,
                    this.sanitizeString(message.tag),
                    this.sanitizeString(message.message),
                    this.sanitizeString(message.rawMessage),
                    deviceId
                ]
            );
        } catch (error) {
            console.error('[SyslogService] Failed to persist message:', error);
        }
    }

    /**
     * Load Monitored Devices - Recupera a lista persistida do banco
     * @private
     */
    private async loadMonitoredDevices(): Promise<void> {
        try {
            const param = await prisma.systemParameter.findUnique({
                where: { key: 'syslog_monitored_identifiers' }
            });

            if (param && param.value) {
                const identifiers = JSON.parse(param.value);
                this.monitoredDevices = new Set(identifiers);
                console.log(`[SyslogService] Loaded ${this.monitoredDevices.size} monitored identifiers from DB`);
            }
        } catch (error) {
            console.error('[SyslogService] Failed to load monitored devices:', error);
        }
    }

    /**
     * Load Port Config - Carrega a porta configurada no banco
     * @private
     */
    private async loadPortConfig(): Promise<void> {
        try {
            const param = await prisma.systemParameter.findUnique({
                where: { key: 'syslog_port' }
            });

            if (param && param.value) {
                const port = parseInt(param.value);
                if (!isNaN(port) && port > 0 && port < 65535) {
                    this.port = port;
                    console.log(`[SyslogService] Loaded custom port from DB: ${this.port}`);
                }
            }
        } catch (error) {
            console.error('[SyslogService] Failed to load port config:', error);
        }
    }

    /**
     * Load Recording Config - Carrega flags de gravação e rotação
     * @private
     */
    private async loadRecordingConfig(): Promise<void> {
        try {
            const params = await prisma.systemParameter.findMany({
                where: {
                    key: {
                        in: ['syslog_recording_enabled']
                    }
                }
            });

            const enabledParam = params.find(p => p.key === 'syslog_recording_enabled');
            if (enabledParam) {
                this.recordingEnabled = enabledParam.value === 'true';
            }
            
            console.log(`[SyslogService] Recording: ${this.recordingEnabled}`);
        } catch (error) {
            console.error('[SyslogService] Failed to load recording config:', error);
        }
    }

    /**
     * Get Recent Messages - Recuperar mensagens do buffer
     * Utilizado para carga inicial de clients Socket.io.
     */
    getRecentMessages(limit?: number): SyslogMessage[] {
        if (limit) {
            return this.messageBuffer.slice(-limit);
        }
        return [...this.messageBuffer];
    }

    /**
     * Set Monitored Devices - Definir alvos de interesse e persistir
     */
    async setMonitoredDevices(identifiers: string[]): Promise<void> {
        this.monitoredDevices = new Set(identifiers);
        console.log(`[SyslogService] Monitoring ${identifiers.length} devices`);

        try {
            await prisma.systemParameter.upsert({
                where: { key: 'syslog_monitored_identifiers' },
                update: { value: JSON.stringify(identifiers) },
                create: {
                    key: 'syslog_monitored_identifiers',
                    value: JSON.stringify(identifiers),
                    category: 'SYSLOG',
                    type: 'JSON',
                    description: 'Lista de IPs/Hostnames monitorados pelo Syslog'
                }
            });
        } catch (error) {
            console.error('[SyslogService] Failed to persist monitored devices:', error);
        }
    }

    private deviceCache: Map<string, any> = new Map();
    private lastCacheClear = Date.now();

    /**
     * findCachedDevice - Busca dispositivo com cache simples para performance do Syslog
     */
    private async findCachedDevice(hostname: string) {
        // Limpa cache a cada 5 minutos
        if (Date.now() - this.lastCacheClear > 300000) {
            this.deviceCache.clear();
            this.lastCacheClear = Date.now();
        }

        if (this.deviceCache.has(hostname)) {
            return this.deviceCache.get(hostname);
        }

        // Try exact matches first
        let device = await prisma.device.findFirst({
            where: {
                OR: [
                    { ipAddress: hostname },
                    { hostname: hostname },
                    { name: hostname }
                ]
            }
        });

        // If not found, try partial hostname match (e.g., hostname.domain.com or hostname-1 matching hostname)
        if (!device) {
            let baseName = hostname;
            if (hostname.includes('.')) {
                baseName = hostname.split('.')[0];
            } else if (hostname.includes('-')) {
                // Handle suffixes like -1, -A, etc.
                const parts = hostname.split('-');
                if (parts.length > 1) {
                    baseName = parts.slice(0, -1).join('-');
                }
            }

            if (baseName !== hostname) {
                device = await prisma.device.findFirst({
                    where: {
                        OR: [
                            { hostname: { startsWith: baseName, mode: 'insensitive' } },
                            { name: { startsWith: baseName, mode: 'insensitive' } }
                        ]
                    }
                });
            }
        }

        if (device) {
            this.deviceCache.set(hostname, device);
        } else {
            if (process.env.DEBUG === 'true') {
                console.log(`[SyslogService] Device correlated NOT found for hostname/IP: ${hostname}`);
            }
        }
        return device;
    }

    /**
     * Add Monitored Device - Adicionar alvo à lista branca
     */
    addMonitoredDevice(deviceId: string): void {
        this.monitoredDevices.add(deviceId);
    }

    /**
     * Remove Monitored Device - Remover alvo da lista branca
     */
    removeMonitoredDevice(deviceId: string): void {
        this.monitoredDevices.delete(deviceId);
    }

    /**
     * Clear Monitored Devices - Monitorar todos os ativos
     */
    clearMonitoredDevices(): void {
        this.monitoredDevices.clear();
    }

    private lastError: string | null = null;

    /**
     * Get Status - Obter informações de estado do servidor
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            bufferSize: this.messageBuffer.length,
            monitoredDevices: Array.from(this.monitoredDevices),
            lastError: this.lastError,
            recordingEnabled: this.recordingEnabled
        };
    }
}

// Instância Singleton exportada com porta customizada
export const syslogService = new SyslogService(1514);
