import { Server as SocketServer } from 'socket.io';
import { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { connectedAgents } from '../agentState';
import net from 'net';

/**
 * VncProxyService
 * 
 * Atua como uma ponte entre o visualizador noVNC (Browser) e o Agente IronGrid.
 * Utiliza WebSockets para o front-end e Socket.io para o túnel com o agente.
 */
export class VncProxyService {
    private wss: WebSocketServer;
    private activeTCPProxies = new Map<string, { server: net.Server, port: number }>();
    private proxyPortBase = 5900;

    constructor(private io: SocketServer) {
        // Criamos um servidor WebSocket interno que não escuta em porta, 
        // mas processa upgrades manuais do servidor HTTP principal.
        this.wss = new WebSocketServer({ noServer: true });

        this.wss.on('connection', (ws: WebSocket, request: IncomingMessage, agentId: string) => {
            this.handleProxyConnection(ws, agentId);
        });
    }

    /**
     * Tenta realizar o upgrade de uma requisição HTTP para WebSocket para uma sessão VNC.
     */
    public handleUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
        const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
        
        // Caminho esperado: /vnc-tunnel/:agentId
        if (pathname.startsWith('/vnc-tunnel/')) {
            const agentId = pathname.split('/').pop();
            
            if (!agentId || !connectedAgents.has(agentId)) {
                socket.destroy();
                return;
            }

            this.wss.handleUpgrade(request, socket, head, (ws) => {
                this.wss.emit('connection', ws, request, agentId);
            });
        }
    }

    /**
     * Inicia uma ponte TCP (Proxy VNC Nativo) para um agente específico.
     * Retorna a porta alocada para conexão nativa.
     */
    public async startTCPProxy(agentId: string): Promise<number> {
        if (this.activeTCPProxies.has(agentId)) {
            return this.activeTCPProxies.get(agentId)!.port;
        }

        return new Promise((resolve, reject) => {
            let port = this.proxyPortBase;
            const portsInUse = Array.from(this.activeTCPProxies.values()).map(p => p.port);
            while (portsInUse.includes(port)) port++;

            const server = net.createServer((tcpSocket) => {
                const agent = connectedAgents.get(agentId);
                if (!agent) {
                    tcpSocket.destroy();
                    return;
                }

                const agentSocket = this.io.sockets.sockets.get(agent.socketId);
                if (!agentSocket) {
                    tcpSocket.destroy();
                    return;
                }

                console.log(`[VncProxy-TCP] Cliente nativo conectado na porta ${port} para agente ${agentId}`);
                
                // Avisa o agente que o visualizador TCP se conectou. 
                // Isso faz o agente conectar no tvnserver e nos mandar o RFB handshake na hora certa!
                agentSocket.emit('vnc-client-connected');

                // Ponte TCP -> Agent
                tcpSocket.on('data', (data) => {
                    agentSocket.emit('vnc-data', data);
                });

                // Ponte Agent -> TCP
                const vncDataHandler = (data: Buffer) => {
                    if (tcpSocket.writable) tcpSocket.write(data);
                };
                agentSocket.on('vnc-data', vncDataHandler);

                tcpSocket.on('close', () => {
                    console.log(`[VncProxy-TCP] Cliente nativo desconectado do agente ${agentId}`);
                    agentSocket.off('vnc-data', vncDataHandler);
                });

                tcpSocket.on('error', (err) => {
                    console.error(`[VncProxy-TCP] Erro no socket TCP:`, err);
                    tcpSocket.destroy();
                });
            });

            server.listen(port, () => {
                console.log(`[VncProxy-TCP] Proxy iniciado na porta ${port} para agente ${agentId}`);
                this.activeTCPProxies.set(agentId, { server, port });
                resolve(port);
            });

            server.on('error', (err) => {
                console.error(`[VncProxy-TCP] Falha ao iniciar servidor na porta ${port}:`, err);
                reject(err);
            });
        });
    }

    /**
     * Encerra a ponte TCP de um agente.
     */
    public stopTCPProxy(agentId: string) {
        const proxy = this.activeTCPProxies.get(agentId);
        if (proxy) {
            proxy.server.close();
            this.activeTCPProxies.delete(agentId);
            console.log(`[VncProxy-TCP] Proxy encerrado para agente ${agentId}`);
        }
    }

    /**
     * Gerencia a ponte de dados entre o WebSocket do Browser e o Socket.io do Agente.
     */
    private handleProxyConnection(browserWs: WebSocket, agentId: string) {
        const agent = connectedAgents.get(agentId);
        if (!agent) {
            browserWs.close(1001, 'Agent disconnected');
            return;
        }

        const agentSocket = this.io.sockets.sockets.get(agent.socketId);
        if (!agentSocket) {
            browserWs.close(1001, 'Agent socket not found');
            return;
        }

        console.log(`[VncProxy] Iniciando túnel para agente ${agentId}`);
        agentSocket.emit('vnc-client-connected');

        // 1. Dados vindos do Browser (noVNC) -> Enviar para o Agente
        browserWs.on('message', (data: Buffer) => {
            agentSocket.emit('vnc-data', data);
        });

        // 2. Dados vindos do Agente -> Enviar para o Browser (noVNC)
        const vncDataHandler = (data: Buffer) => {
            if (browserWs.readyState === WebSocket.OPEN) {
                browserWs.send(data);
            }
        };

        agentSocket.on('vnc-data', vncDataHandler);

        // Limpeza em caso de desconexão
        browserWs.on('close', () => {
            console.log(`[VncProxy] Browser fechou conexão para agente ${agentId}`);
            agentSocket.off('vnc-data', vncDataHandler);
            agentSocket.emit('remote-action', {
                logId: 'vnc-stop-' + Date.now(),
                action: 'stopVNC',
                parameters: { command: 'stopVNC' }
            });
        });

        agentSocket.on('disconnect', () => {
            browserWs.close(1001, 'Agent disconnected');
        });
    }
}
