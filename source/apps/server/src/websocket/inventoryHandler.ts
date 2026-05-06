import { Socket } from 'socket.io';
import zlib from 'zlib';
import { promisify } from 'util';
import { InventoryService, InventoryPayload } from '../services/inventoryService';

const gunzip = promisify(zlib.gunzip);
const inventoryService = new InventoryService();

export function setupInventoryHandlers(socket: Socket) {
    socket.on('inventory_update', async (compressedData: Buffer, callback: (resp: any) => void) => {
        try {
            const agentId = socket.handshake.query.agentId as string;
            if (!agentId) {
                if (callback) callback({ status: 'error', message: 'No Agent ID' });
                return;
            }

            // Decompress
            const buffer = await gunzip(compressedData);
            const data = JSON.parse(buffer.toString()) as InventoryPayload;

            // Process
            const forwarded = socket.handshake.headers['x-forwarded-for'];
            const forwardedIp = typeof forwarded === 'string' ? forwarded.split(',')[0] : (Array.isArray(forwarded) ? forwarded[0] : null);
            const rawIp = forwardedIp || socket.handshake.address;
            const ipAddress = rawIp.replace('::ffff:', '').replace('::1', '127.0.0.1');

            const result = await inventoryService.processInventory(agentId, ipAddress, data);

            if (result.created) {
                console.log(`[InventoryHandler] NEW DEVICE DISCOVERED: ${result.device.name} (ID: ${result.device.id})`);
                socket.broadcast.emit('device-discovered', {
                    id: result.device.id,
                    name: result.device.name,
                    ip: result.device.ipAddress,
                    type: result.device.type
                });
            }

            if (callback) callback({ status: 'ok' });
        } catch (error) {
            console.error('[InventoryHandler] Error processing inventory:', error);
            if (callback) callback({ status: 'error', message: 'Internal Server Error' });
        }
    });

    socket.on('action-result', async (data: {
        logId: string,
        status: 'SUCCESS' | 'FAILED',
        output?: string,
        error?: string,
        exitCode?: number
    }) => {
        try {
            const { prisma } = await import('../utils/prisma');
            
            // Check if record exists first to prevent P2025 fatal error
            const exists = await prisma.remoteActionLog.findUnique({
                where: { id: data.logId }
            });

            if (!exists) {
                console.warn(`[ActionHandler] Received result for non-existent logId: ${data.logId}. Ignoring.`);
                return;
            }

            await prisma.remoteActionLog.update({
                where: { id: data.logId },
                data: {
                    status: data.status,
                    output: data.output || '',
                    error: data.error || '',
                    exitCode: data.exitCode ?? 0,
                    completedAt: new Date()
                }
            });
            console.log(`[ActionHandler] Updated log ${data.logId} with status ${data.status}`);
        } catch (error) {
            console.error('[ActionHandler] Error updating action log:', error);
        }
    });
}
