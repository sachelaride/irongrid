import { io, Socket } from 'socket.io-client';
import { AgentSocket } from './sharedSocket';
import { InventoryPayload } from '../collectors/inventoryCollector';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

export class InventoryTransport {
    private socket: Socket;

    constructor(serverUrl: string, agentId: string) {
        this.socket = AgentSocket.getInstance(serverUrl, agentId);
    }

    async sendInventory(payload: InventoryPayload): Promise<void> {
        try {
            const compressed = await this.compressPayload(payload);
            console.log(`[InventoryTransport] Sending inventory size: ${JSON.stringify(payload).length} bytes (Compressed: ${compressed.length} bytes)`);

            this.socket.emit('inventory_update', compressed, (response: any) => {
                if (response?.status === 'ok') {
                    console.log('[InventoryTransport] Inventory acknowledged by server.');
                } else {
                    console.warn('[InventoryTransport] Server returned error:', response);
                }
            });
        } catch (error) {
            console.error('[InventoryTransport] Failed to send inventory:', error);
            throw error;
        }
    }

    private async compressPayload(data: InventoryPayload): Promise<Buffer> {
        const json = JSON.stringify(data);
        return await gzip(json);
    }
}
