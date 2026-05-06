import { io, Socket } from 'socket.io-client';

export class AgentSocket {
    private static instance: Socket | null = null;

    static getInstance(serverUrl: string, agentId: string): Socket {
        if (!this.instance) {
            console.log(`[Socket] Initializing shared connection to ${serverUrl} for agent ${agentId}...`);
            this.instance = io(serverUrl, {
                query: { agentId },
                transports: ['polling', 'websocket'], // Robust fallback
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
            });

            this.instance.on('connect', () => {
                console.log(`[Socket] Connected to server! ID: ${this.instance?.id}`);
            });

            this.instance.on('connect_error', (error) => {
                console.error(`[Socket] Connection error: ${error.message}`);
                console.log('[Socket] Tips: Check firewall (allow WebSockets/Poling) or server URL.');
            });

            this.instance.on('disconnect', (reason) => {
                console.warn(`[Socket] Disconnected: ${reason}`);
            });
        }
        return this.instance;
    }
}
