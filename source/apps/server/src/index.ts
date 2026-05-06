import 'dotenv/config';
import express from 'express';
import { prisma } from './utils/prisma';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers/appRouter';
export type { AppRouter } from './routers/appRouter';
import { createContext } from './context';
import { monitoredDevices, syncMonitoredDevices } from './routers/snmpRouter';
import { SnmpService } from './services/snmp';
import { influxDB } from './services/influxdb';
import { AlertService } from './services/alertService';
import { Point } from '@influxdata/influxdb-client';
import fs from 'fs';
import path from 'path';
import { Server as SocketServer } from 'socket.io';
import http from 'http';
import { syslogService } from './services/syslogService';
import { MailCollectorService } from './services/mailCollectorService';
import { IPAMSchedulerService } from './services/ipamSchedulerService';
import { DiscoverySchedulerService } from './services/discoverySchedulerService';
import { CronService } from './services/cronService';
import { VncProxyService } from './services/vncProxyService';

const LOG_FILE = path.join(process.cwd(), 'poller_debug.log');

async function logDebug(msg: string, forceConsole = false) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    try {
        await fs.promises.appendFile(LOG_FILE, line);
    } catch (e) {
        if (process.env.DEBUG === 'true') console.error('Failed to write to log file:', e);
    }

    if (forceConsole || process.env.DEBUG === 'true') {
        console.log(msg);
    }
}

// Fatal Error Handlers
process.on('uncaughtException', (err) => {
    logDebug(`[FATAL] Uncaught Exception: ${err.stack || err}`, true);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logDebug(`[FATAL] Unhandled Rejection at: ${promise} reason: ${reason}`, true);
});

// Inicializa o app Express
const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
    cors: {
        origin: '*', // Adjust for production
        methods: ['GET', 'POST', 'OPTIONS']
    },
    allowEIO3: true,            // Compatibility with older socket.io clients
    pingTimeout: 60000,         // Prevent slow Windows agents from dropping
    pingInterval: 25000,
    transports: ['polling', 'websocket']
});

const snmpService = new SnmpService();
const alertService = new AlertService();

// Habilita CORS para permitir requisições do frontend
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Verbose logger for debugging enterprise connectivity
app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    if (ip?.includes('192.168.3.250')) {
        logDebug(`[DEBUG] ${req.method} ${req.url} from ${ip}`);
    }
    next();
});

const port = process.env.DEV_PORT ? parseInt(process.env.DEV_PORT) : 3001;
import { connectedAgents } from './agentState';

// Endpoint principal do tRPC
// Endpoint principal do tRPC
app.use(
    '/trpc',
    createExpressMiddleware({
        router: appRouter,
        createContext: (opts) => createContext(opts, io),
    })
);

// Serve static agents/downloads
const agentsPath = path.join(process.cwd(), 'public/agents');
if (!fs.existsSync(agentsPath)) {
    fs.mkdirSync(agentsPath, { recursive: true });
}
app.use('/downloads', express.static(agentsPath));

// Serve frontend in production
const frontendPath = path.join(process.cwd(), '../web/dist');
if (fs.existsSync(frontendPath)) {
    console.log(`[System] Serving frontend from: ${frontendPath}`);
    app.use(express.static(frontendPath));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/trpc') || req.path.startsWith('/downloads')) return next();
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

// Inicialização de Parâmetros do Sistema (Ocorre uma vez no startup)
async function initializeSystemParameters() {
    try {
        await prisma.systemParameter.upsert({ where: { key: 'alert_bandwidth_threshold' }, update: {}, create: { key: 'alert_bandwidth_threshold', value: '85', category: 'ALERTS', type: 'NUMBER', description: 'Limite de utilização de banda em %' } });
        await prisma.systemParameter.upsert({ where: { key: 'alert_latency_threshold' }, update: {}, create: { key: 'alert_latency_threshold', value: '200', category: 'ALERTS', type: 'NUMBER', description: 'Limite de latência em ms' } });
        await prisma.systemParameter.upsert({ where: { key: 'alert_monitored_types' }, update: {}, create: { key: 'alert_monitored_types', value: 'SWITCH,GATEWAY,FIREWALL', category: 'ALERTS', type: 'STRING', description: 'Tipos de dispositivos monitorados pela central de alertas' } });
        logDebug('[System] Parameters initialized.');
    } catch (e) {
        logDebug(`[System] Error initializing parameters: ${e}`);
    }
}
initializeSystemParameters();

// Serve static files from the web app in production
if (process.env.NODE_ENV === 'production') {
    const webDistPath = path.join(__dirname, '../../web/dist');
    if (fs.existsSync(webDistPath)) {
        app.use(express.static(webDistPath));
        // Handle SPA routing - send all non-API requests to index.html
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/trpc')) return next();
            res.sendFile(path.join(webDistPath, 'index.html'));
        });
        logDebug(`[Server] Serving static frontend from: ${webDistPath}`, true);
    } else {
        logDebug(`[Server] WARNING: web/dist not found at ${webDistPath}. Static serving disabled.`, true);
    }
}

// Diagnostic endpoint
app.get('/diag/agents', (req, res) => {
    res.json({
        total: connectedAgents.size,
        agents: Array.from(connectedAgents.entries())
    });
});

// Rota de teste básica (Health Check simples fora do tRPC)
app.get('/', (req, res) => {
    res.json({ message: 'IronGrid API' });
});

logDebug(`Server starting [PID: ${process.pid}] [ENV: ${process.env.NODE_ENV || 'development'}]`, true);

// Initialize Syslog Service
syslogService.start().then(() => {
    const status = syslogService.getStatus();
    logDebug(`[Syslog] Service started on port ${status.port}`);
}).catch(err => {
    logDebug(`[Syslog] Failed to start service: ${err.message}`);
});

// Initialize Mail Collector Polling
MailCollectorService.startPolling();

// Initialize monitoring from DB
syncMonitoredDevices().then(devices => {
    logDebug(`Restored ${devices.length} monitored devices from DB`);
}).catch(err => {
    logDebug(`Error restoring monitored devices: ${err.message}`);
});

// Polling Loop for SNMP Monitoring
let lastPollerStatusEmpty = false;
setInterval(async () => {
    if (monitoredDevices.length === 0) {
        if (!lastPollerStatusEmpty) {
            logDebug(`[SNMP Poller] Entry state: No devices to poll (Agents connected: ${connectedAgents.size})`);
            lastPollerStatusEmpty = true;
        }
        return;
    }
    lastPollerStatusEmpty = false;

    logDebug(`[SNMP Poller] Monitoring ${monitoredDevices.length} devices: ${monitoredDevices.map(d => d.ip).join(', ')}`);

    const { monitoringService } = await import('./services/monitoringService');

    for (const device of monitoredDevices) {
        try {
            if (device.interfaces.length === 0) {
                logDebug(`[SNMP Poller] Skipping ${device.ip} (Zero interfaces monitored)`);
                continue;
            }
            logDebug(`[SNMP Poller] Fetching metrics for ${device.ip} (Interfaces: ${device.interfaces.join(',')})`);
            const metrics = await snmpService.getTrafficMetrics(device.ip, device.community, device.interfaces, logDebug);

            logDebug(`[SNMP Poller] ${device.ip} returned ${metrics.length} interface metrics`);

            if (metrics.length > 0) {
                const dbDevice = await prisma.device.findFirst({
                    where: { ipAddress: device.ip },
                    include: { networkInterfaces: true },
                    orderBy: { createdAt: 'asc' }
                });

                if (dbDevice) {
                    // Update status to ONLINE if SNMP is responding
                    if (dbDevice.status !== 'ONLINE') {
                        await prisma.device.update({
                            where: { id: dbDevice.id },
                            data: { 
                                status: 'ONLINE', 
                                lastSeen: new Date(),
                                offlineSince: null 
                            }
                        });
                        await monitoringService.checkStatus(dbDevice, 'ONLINE');
                    } else {
                        await prisma.device.update({
                            where: { id: dbDevice.id },
                            data: { lastSeen: new Date() }
                        });
                    }

                    metrics.forEach(m => {
                        const point = new Point('interface_traffic')
                            .tag('device', device.ip)
                            .tag('interface_index', m.index.toString())
                            .floatField('ifInOctets', Number(m.in))
                            .floatField('ifOutOctets', Number(m.out))
                            .stringField('status', m.status);

                        const iface = dbDevice.networkInterfaces.find(i => i.index === m.index);
                        if (iface) {
                            point.tag('interface', iface.name);
                        }

                        influxDB.writeApi.writePoint(point);

                        // Update status in database for the interface
                        prisma.networkInterface.updateMany({
                            where: { deviceId: dbDevice.id, index: m.index },
                            data: { status: m.status, updatedAt: new Date() }
                        }).catch(e => logDebug(`[SNMP Poller] Failed to update interface status for ${device.ip}:${m.index}: ${e}`));

                        // Verificação de Banda (Threshold)
                        if (iface && iface.speed) {
                            monitoringService.checkBandwidth(
                                dbDevice,
                                m.index,
                                iface.name,
                                m.in,
                                m.out,
                                Number(iface.speed) / 1000000 // Convert to Mbps
                            ).catch(e => logDebug(`[Monitoring] Bandwidth check failed: ${e}`));
                        }
                    });

                    await influxDB.writeApi.flush();
                    logDebug(`[SNMP Poller] Data flushed to InfluxDB for ${device.ip}`);
                }
            }
        } catch (error: any) {
            logDebug(`[SNMP Poller] ERROR polling ${device.ip}: ${error?.message || error}`);

            // Trigger Critical Alert on poll failure — com deduplicação:
            // Só cria/envia se NÃO houver um alerta SNMP ativo para este dispositivo.
            try {
                const { AlertSeverity, AlertStatus } = await import('@prisma/client');
                const dbDevice = await prisma.device.findFirst({ where: { ipAddress: device.ip }, orderBy: { createdAt: 'asc' } });

                const existingSnmpAlert = await prisma.alert.findFirst({
                    where: {
                        deviceId: dbDevice?.id ?? undefined,
                        status: AlertStatus.ACTIVE,
                        title: { startsWith: `Falha de Comunicação SNMP: ${device.ip}` }
                    }
                });

                if (existingSnmpAlert) {
                    logDebug(`[SNMP Poller] ${device.ip} still unreachable — SNMP alert already active (${existingSnmpAlert.id}), skipping duplicate.`);
                } else {
                    await alertService.createAlert({
                        title: `Falha de Comunicação SNMP: ${device.ip}`,
                        message: `O poller não conseguiu obter métricas do dispositivo ${device.ip}. Erro: ${error?.message || 'Unknown'}`,
                        severity: AlertSeverity.CRITICAL,
                        deviceId: dbDevice?.id
                    });
                }
            } catch (alertError) {
                logDebug(`[SNMP Poller] Failed to create alert: ${alertError}`);
            }
        }
    }
}, 60000); // 60s para monitoramento padrão empresarial

// Global Ping Poller for Topology and Status
setInterval(async () => {
    const devices = await prisma.device.findMany();
    if (devices.length === 0) return;

    logDebug(`[Ping Poller] Pinging ${devices.length} devices...`);

    const { PingService } = await import('./services/pingService');
    const { monitoringService } = await import('./services/monitoringService');
    const pingService = new PingService();
    const results = await pingService.bulkPing(devices.map(d => d.ipAddress));

    for (const res of results) {
        const status = res.success ? 'ONLINE' : 'OFFLINE';
        const device = devices.find(d => d.ipAddress === res.ip);

        if (device) {
            // Sective exceptions for ping statuses:
            // 1) Se o ping falhou, mas o dispositivo foi visto há menos de 2 minutos por outro serviço (IPAM/SNMP),
            // ignoramos a mudança para OFFLINE para evitar flickering.
            // 2) Dispositivos do tipo INTERNET sempre são forçados como ONLINE.
            const recentlySeen = device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime()) < 120000;
            const finalStatus = (device.type === 'INTERNET' || (status === 'OFFLINE' && recentlySeen)) ? 'ONLINE' : status;

            // Verificação de Status e Latência
            await monitoringService.checkStatus(device, finalStatus);
            if (res.success && res.latency) {
                await monitoringService.checkLatency(device, res.latency);
                
                // Grava latência histórica no InfluxDB para o Grafana
                const point = new Point('device_latency')
                    .tag('device', device.ipAddress)
                    .tag('name', device.name)
                    .floatField('value', res.latency);
                influxDB.writeApi.writePoint(point);
            }

            try {
                await prisma.device.updateMany({
                    where: { id: device.id },
                    data: {
                        status: finalStatus as any,
                        lastLatency: res.latency || (finalStatus === 'ONLINE' ? device.lastLatency : null),
                        lastSeen: res.success ? new Date() : device.lastSeen,
                        offlineSince: finalStatus === 'OFFLINE'
                            ? (device?.offlineSince || new Date())
                            : null
                    }
                });
            } catch (updateErr) {
                logDebug(`[Ping Poller] Error updating device ${device.ipAddress} (maybe deleted?): ${updateErr}`);
            }
        }
    }
    await influxDB.writeApi.flush();
    logDebug(`[Ping Poller] Updated ${results.length} devices`);
}, 30000); // Aumentado para 30s

// Daily System Maintenance (Cleanup Logs & Metrics)
import { MaintenanceService } from './services/maintenanceService';
const maintenanceService = new MaintenanceService();
setInterval(async () => {
    logDebug('[System] Running daily maintenance job...');
    try {
        const result = await maintenanceService.runCleanup();
        logDebug(`[System] Maintenance complete. Deleted ${result.logsDeleted} logs.`);

        // Auto-avaliação de tickets (15 dias)
        logDebug('[System] Running auto-evaluation for tickets...');
        const evalResult = await maintenanceService.autoEvaluateTickets();
        logDebug(`[System] Auto-evaluation complete. Processed ${evalResult.processed} tickets.`);

        // Weekly Syslog Backup & Cleanup (Executa no Domingo - Day 0)
        const now = new Date();
        if (now.getDay() === 0) {
            logDebug('[System] Running weekly Syslog maintenance...');
            const { syslogMaintenanceService } = await import('./services/syslogMaintenanceService');
            await syslogMaintenanceService.backupSyslog();
            await syslogMaintenanceService.cleanupAfterBackup();
        }
    } catch (e) {
        logDebug(`[System] Maintenance job failed: ${e}`);
    }
}, 24 * 60 * 60 * 1000); // 24 hours

// Socket.io Handlers for Remote Access
import { setupInventoryHandlers } from './websocket/inventoryHandler';
import { RemoteActionService } from './services/remoteActionService';
const remoteActionService = new RemoteActionService();
const vncProxyService = new VncProxyService(io);

// Handle VNC / Remote Access Proxy upgrades
server.on('upgrade', (request, socket, head) => {
    vncProxyService.handleUpgrade(request, socket, head);
});

// Debug connection attempts
io.engine.on("connection", (socket) => {
    logDebug(`[Socket ENGINE] New connection attempt: ${socket.id} from ${socket.remoteAddress}`);
});

io.engine.on("connection_error", (err) => {
    logDebug(`[Socket ENGINE] Connection error: ${err.req.url} - ${err.code} - ${err.message}`);
});

io.on('connection', (socket) => {
    // Setup Inventory Handlers
    setupInventoryHandlers(socket);

    const agentId = socket.handshake.query.agentId as string;
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    const forwardedIp = typeof forwarded === 'string' ? forwarded.split(',')[0] : (Array.isArray(forwarded) ? forwarded[0] : null);
    const clientIp = (forwardedIp || socket.handshake.address).replace('::ffff:', '').replace('::1', '127.0.0.1');
    const transport = socket.conn.transport.name;

    logDebug(`[Socket] established: ${socket.id} from ${clientIp} (agentId: ${agentId}, transport: ${transport})`);

    if (agentId) {
        logDebug(`[Socket] Agent ${agentId} registered from ${clientIp}`);
        connectedAgents.set(agentId, {
            socketId: socket.id,
            ipAddress: clientIp
        });
        socket.join(`agent:${agentId}`);
        io.emit('agent-status-change', { agentId, status: 'online' });
    }

    socket.on('join-session', (data: { agentId: string }) => {
        logDebug(`[Socket] User joining session for agent ${data.agentId}`);
        socket.join(`session:${data.agentId}`);

        // Notify user if agent is offline
        if (!connectedAgents.has(data.agentId)) {
            socket.emit('error', { message: 'Agent is offline' });
            return;
        }

        // Request agent to start streaming
        io.to(`agent:${data.agentId}`).emit('request-stream-start');
    });

    socket.on('leave-session', (data: { agentId: string }) => {
        logDebug(`[Socket] User leaving session for agent ${data.agentId}`);
        socket.leave(`session:${data.agentId}`);
        // If no more users in session, stop agent stream
        const room = io.sockets.adapter.rooms.get(`session:${data.agentId}`);
        if (!room || room.size === 0) {
            io.to(`agent:${data.agentId}`).emit('request-stream-stop');
        }
    });

    socket.on('stream-frame', (data: { agentId: string, frame: string }) => {
        // Broadcast frame to all users in the session room
        // if (Math.random() < 0.1) console.log(`[Socket] Received frame for agent ${data.agentId} (${data.frame.length} chars)`);
        io.to(`session:${data.agentId}`).emit('stream-frame', data.frame);
    });

    socket.on('access-response', async (data: { requestId: string, granted: boolean, vncConfig?: { port: number, password: string } }) => {
        const agentId = socket.handshake.query.agentId;
        console.log(`[Socket] Received access-response from Agent ${agentId} for request ${data.requestId}: ${data.granted ? 'GRANTED' : 'REJECTED'}`);
        logDebug(`[Socket] Received access-response for ${data.requestId}: ${data.granted ? 'GRANTED' : 'REJECTED'}`);
        const { activeRequests } = require('./routers/remoteRouter');

        const request = activeRequests.get(data.requestId);
        if (request) {
            request.status = data.granted ? 'granted' : 'rejected';

            if (data.granted && data.vncConfig) {
                request.password = data.vncConfig.password;
                // Inicia Proxy TCP para VNC Nativo
                vncProxyService.startTCPProxy(request.agentId).then(proxyPort => {
                    request.proxyPort = proxyPort;
                    logDebug(`[Socket] Native VNC Proxy allocated for ${request.agentId}: port ${proxyPort}`);
                }).catch(err => {
                    console.error(`[Socket] Failed to start native VNC proxy for ${request.agentId}:`, err);
                });
                logDebug(`[Socket] Access granted via VNC Tunnel for ${request.agentId} (PWD: ${request.password ? 'YES' : 'NO'})`);
            } else if (data.granted && !data.vncConfig) {
                // Caso não tenha VNC, o frontend usará o streaming via sockets (Native Stream)
                logDebug(`[Socket] Access granted without VNC for ${data.requestId}. Using native streaming.`);
            }
        }
    });

    socket.on('user-input', (data: { agentId: string, type: string, data: any }) => {
        // Forward input to the target agent
        io.to(`agent:${data.agentId}`).emit('user-input', data);
    });

    socket.on('action-result', async (data: { logId: string, status: 'SUCCESS' | 'FAILED', output?: string, error?: string, exitCode?: number }) => {
        logDebug(`[Socket] Received action-result for log ${data.logId}: ${data.status}`);
        await remoteActionService.handleResult(data);
    });

    socket.on('disconnect', () => {
        if (agentId) {
            const currentAgent = connectedAgents.get(agentId);
            if (currentAgent && currentAgent.socketId === socket.id) {
                logDebug(`[Socket] Agent ${agentId} disconnected (Socket: ${socket.id})`);
                connectedAgents.delete(agentId);
                io.emit('agent-status-change', { agentId, status: 'offline' });
            } else {
                logDebug(`[Socket] Obsolete socket disconnected for agent ${agentId} (Socket: ${socket.id})`);
            }
        }
    });
});

// Inicia o servidor na porta definida
server.listen(port, '0.0.0.0', () => {
    logDebug(`Server running on http://0.0.0.0:${port}`, true);
    // Iniciar agendadores (varreduras agendadas)
    IPAMSchedulerService.start();
    DiscoverySchedulerService.start();
    CronService.start(io);
});
