import { prisma } from '../utils/prisma';
import { IPAddressStatus } from '@prisma/client';
import { PingService } from './pingService';

export class IPAMService {
    /**
     * Sync Subnet - Garante que todos os IPs de uma sub-rede estão presentes na tabela IPAMAddress
     * 
     * @param {string} subnetId - ID da sub-rede
     */
    static async syncSubnet(subnetId: string) {
        const subnet = await (prisma as any).iPAMSubnet.findUnique({
            where: { id: subnetId },
            include: { addresses: true }
        });

        if (!subnet) return;

        // Lógica simplificada para IPv4 /24 por enquanto
        const [base, mask] = subnet.subnet.split('/');
        if (mask !== '24') return; // TODO: Implementar suporte a outras máscaras

        const parts = base.split('.');
        const prefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;

        const existingIps = new Set(subnet.addresses.map((a: any) => a.ip));
        const newAddresses = [];

        for (let i = 1; i <= 254; i++) {
            const ip = `${prefix}${i}`;
            if (!existingIps.has(ip)) {
                newAddresses.push({
                    subnetId,
                    ip,
                    status: IPAddressStatus.AVAILABLE
                });
            }
        }

        if (newAddresses.length > 0) {
            await (prisma as any).iPAMAddress.createMany({
                data: newAddresses
            });
        }
    }

    /**
     * Update IP Status - Atualiza o status de um IP baseado em descoberta ou inventário
     */
    static async updateIPStatus(ip: string, status: IPAddressStatus, details: { mac?: string, hostname?: string, deviceId?: string } = {}) {
        const address = await (prisma as any).iPAMAddress.findFirst({
            where: { ip }
        });

        if (address) {
            let deviceId = details.deviceId;

            // Tenta encontrar dispositivo pelo IP se não fornecido
            if (!deviceId) {
                const device = await (prisma as any).device.findUnique({
                    where: { ipAddress: ip }
                });
                if (device) deviceId = device.id;
            }

            await (prisma as any).iPAMAddress.update({
                where: { id: address.id },
                data: {
                    status,
                    mac: details.mac || address.mac,
                    hostname: details.hostname || address.hostname,
                    deviceId: deviceId || address.deviceId,
                    lastSeen: status === IPAddressStatus.USED ? new Date() : address.lastSeen
                }
            });
        }
    }

    /**
     * Get Network Summary - Resumo de utilização para dashboards
     */
    static async getSummary() {
        const subnets = await (prisma as any).iPAMSubnet.findMany({
            include: {
                location: true,
                _count: {
                    select: { addresses: true }
                }
            }
        });

        const stats = await Promise.all(subnets.map(async (s: any) => {
            const used = await (prisma as any).iPAMAddress.count({
                where: { subnetId: s.id, status: { in: [IPAddressStatus.USED, IPAddressStatus.STATIC, IPAddressStatus.RESERVED] } }
            });
            return {
                id: s.id,
                name: s.name || s.subnet,
                subnet: s.subnet,
                total: 254, // Simplificado para /24
                used,
                percent: Math.round((used / 254) * 100),
                location: s.location,
                locationId: s.locationId,
                isScanning: s.isScanning
            };
        }));

        return stats;
    }

    /**
     * Scan Subnet - Realiza uma varredura (Sweep) na sub-rede para detectar dispositivos ativos
     */
    static async scanSubnet(subnetId: string) {
        const subnet = await (prisma as any).iPAMSubnet.findUnique({
            where: { id: subnetId },
            include: { addresses: true }
        });

        if (!subnet) return;

        const pingService = new PingService();
        const ips = subnet.addresses.map((a: any) => a.ip);

        // Dividir em chunks para evitar sobrecarga
        const chunkSize = 50;
        for (let i = 0; i < ips.length; i += chunkSize) {
            const chunk = ips.slice(i, i + chunkSize);
            const results = await pingService.bulkPing(chunk);

            for (const res of results) {
                const addr = subnet.addresses.find((a: any) => a.ip === res.ip);
                if (addr) {
                    let newStatus = addr.status;

                    if (res.success) {
                        if (addr.status === IPAddressStatus.AVAILABLE || addr.status === IPAddressStatus.RESERVED) {
                            newStatus = IPAddressStatus.USED;
                        }
                    } else if (addr.status === IPAddressStatus.USED) {
                        newStatus = IPAddressStatus.AVAILABLE;
                    }

                    await (prisma as any).iPAMAddress.update({
                        where: { id: addr.id },
                        data: {
                            status: newStatus,
                            lastSeen: res.success ? new Date() : addr.lastSeen
                        }
                    });
                }
            }
        }
    }

    /**
     * Update IP Metadata - Permite editar Hostname, MAC e status de reserva manualmente
     */
    static async updateMetadata(addressId: string, data: {
        hostname?: string | null,
        mac?: string | null,
        status?: IPAddressStatus,
        reservedFor?: string | null,
        reservedNote?: string | null
    }) {
        const address = await (prisma as any).iPAMAddress.findUnique({
            where: { id: addressId }
        });

        let deviceId = address?.deviceId;

        // Se o status mudar para AVAILABLE (Liberado), exclui o dispositivo do inventário
        if (data.status === IPAddressStatus.AVAILABLE && deviceId) {
            try {
                await (prisma as any).device.delete({
                    where: { id: deviceId }
                });
            } catch (e) {
                console.error("[IPAMService] Falha ao deletar dispositivo na liberação do IP:", e);
            }
            deviceId = null; // Remove a associação
        } else if (address && data.status !== IPAddressStatus.AVAILABLE) {
            // Tenta vincular caso exista um dispositivo com este IP e não seja uma liberação
            const device = await (prisma as any).device.findFirst({
                where: { ipAddress: address.ip }
            });
            if (device) deviceId = device.id;
        }

        return (prisma as any).iPAMAddress.update({
            where: { id: addressId },
            data: {
                ...data,
                deviceId: data.status === IPAddressStatus.AVAILABLE ? null : (deviceId || undefined)
            }
        });
    }
}
