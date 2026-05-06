import { z } from 'zod';
import { router, adminProcedure, publicProcedure } from '../trpc';
import { prisma } from '../utils/prisma';
import { IPAddressStatus } from '@prisma/client';
import { IPAMService } from '../services/ipamService';
import { IPAMDiscoveryService } from '../services/ipamDiscoveryService';

export const ipamRouter = router({
    listSubnets: publicProcedure.query(async () => {
        return (prisma as any).iPAMSubnet.findMany({
            include: {
                location: true,
                _count: {
                    select: { addresses: true }
                }
            }
        });
    }),

    getSummary: publicProcedure.query(async () => {
        return IPAMService.getSummary();
    }),

    createSubnet: adminProcedure
        .input(z.object({
            name: z.string().nullish(),
            subnet: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/, "Formato inválido (ex: 192.168.1.0/24)"),
            description: z.string().nullish(),
            vlan: z.string().nullish(),
            locationId: z.string().nullish()
        }))
        .mutation(async ({ input }) => {
            const subnet = await (prisma as any).iPAMSubnet.create({
                data: input
            });

            // Sincroniza IPs em background
            IPAMService.syncSubnet(subnet.id).catch(console.error);

            return subnet;
        }),

    deleteSubnet: adminProcedure
        .input(z.string())
        .mutation(async ({ input: id }) => {
            console.log(`[IPAMRouter] Iniciando exclusão da sub-rede: ${id}`);
            try {
                // 1. Identificar dispositivos vinculados a esta sub-rede para exclusão sincronizada
                const addresses = await (prisma as any).iPAMAddress.findMany({
                    where: { subnetId: id },
                    select: { deviceId: true }
                });
                
                const deviceIds = addresses
                    .map((a: any) => a.deviceId)
                    .filter((devId: string | null) => devId !== null);

                if (deviceIds.length > 0) {
                    console.log(`[IPAMRouter] Removendo ${deviceIds.length} dispositivos associados do inventário...`);
                    await (prisma as any).device.deleteMany({
                        where: { id: { in: deviceIds } }
                    });
                }

                // 2. Limpar associações e logs (embora o schema tenha Cascade, limpamos explicitamente por segurança)
                await (prisma as any).iPAMAddress.deleteMany({ where: { subnetId: id } });
                await (prisma as any).iPAMScanLog.deleteMany({ where: { subnetId: id } });
                
                // 3. Deletar a sub-rede
                return await (prisma as any).iPAMSubnet.delete({
                    where: { id }
                });
            } catch (error) {
                console.error(`[IPAMRouter] Erro ao deletar sub-rede ${id}:`, error);
                throw error;
            }
        }),

    updateSubnet: adminProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().nullish(),
            description: z.string().nullish(),
            vlan: z.string().nullish(),
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            return (prisma as any).iPAMSubnet.update({
                where: { id },
                data
            });
        }),

    listAddresses: publicProcedure
        .input(z.object({
            subnetId: z.string(),
            status: z.nativeEnum(IPAddressStatus).optional()
        }))
        .query(async ({ input }) => {
            const addresses = await (prisma as any).iPAMAddress.findMany({
                where: {
                    subnetId: input.subnetId,
                    status: input.status
                },
                include: {
                    device: {
                        select: {
                            id: true,
                            name: true,
                            agentId: true,
                            hasWebcam: true,
                            hasHeadset: true,
                            voipExtension: true,
                            assetNumber: true,
                            status: true,
                            departmentRef: { select: { name: true } },
                            location: { select: { name: true } },
                            hardware: {
                                select: {
                                    cpuModel: true,
                                    totalMemory: true,
                                    totalDisk: true,
                                }
                            }
                        }
                    }
                },
                orderBy: { ip: 'asc' }
            });

            // Auto-link devices that might exist but are not linked to IPAMAddress
            const unlinkedAddresses = addresses.filter((a: any) => !a.deviceId);
            if (unlinkedAddresses.length > 0) {
                const ips = unlinkedAddresses.map((a: any) => a.ip);
                const existingDevices = await (prisma as any).device.findMany({
                    where: { ipAddress: { in: ips } },
                    include: {
                        departmentRef: { select: { name: true } },
                        location: { select: { name: true } },
                        hardware: { select: { cpuModel: true, totalMemory: true, totalDisk: true } }
                    }
                });

                if (existingDevices.length > 0) {
                    const deviceMap = new Map(existingDevices.map((d: any) => [d.ipAddress, d]));
                    for (const addr of addresses) {
                        if (!addr.deviceId && deviceMap.has(addr.ip)) {
                            const dev = deviceMap.get(addr.ip) as any;
                            addr.deviceId = dev.id;
                            addr.device = {
                                id: dev.id,
                                name: dev.name,
                                agentId: dev.agentId,
                                hasWebcam: dev.hasWebcam,
                                hasHeadset: dev.hasHeadset,
                                voipExtension: dev.voipExtension,
                                assetNumber: dev.assetNumber,
                                status: dev.status,
                                departmentRef: dev.departmentRef,
                                location: dev.location,
                                hardware: dev.hardware
                            };
                            // Update DB asynchronously
                            (prisma as any).iPAMAddress.update({
                                where: { id: addr.id },
                                data: { deviceId: dev.id }
                            }).catch(console.error);
                        }
                    }
                }
            }

            // Convert BigInts to Number since JSON cannot serialize BigInt natively in tRPC returns
            return addresses.map((addr: any) => {
                if (addr.device && addr.device.hardware) {
                    addr.device.hardware.totalMemory = addr.device.hardware.totalMemory ? Number(addr.device.hardware.totalMemory) : null;
                    addr.device.hardware.totalDisk = addr.device.hardware.totalDisk ? Number(addr.device.hardware.totalDisk) : null;
                }
                return addr;
            });
        }),

    updateAddress: adminProcedure
        .input(z.object({
            id: z.string(),
            status: z.nativeEnum(IPAddressStatus),
            hostname: z.string().optional(),
            mac: z.string().optional(),
            description: z.string().optional()
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            return (prisma as any).iPAMAddress.update({
                where: { id },
                data
            });
        }),

    scanSubnet: adminProcedure
        .input(z.string())
        .mutation(async ({ input: id }) => {
            // Executa em background com todas as técnicas (ICMP + TCP + ARP + SNMP)
            IPAMDiscoveryService.discoverSubnet(id).catch(console.error);
            return { success: true, message: 'Varredura multi-protocolo iniciada (ICMP + TCP + ARP + SNMP).' };
        }),

    updateMetadata: adminProcedure
        .input(z.object({
            id: z.string(),
            hostname: z.string().nullish(),
            mac: z.string().nullish(),
            status: z.nativeEnum(IPAddressStatus).optional(),
            reservedFor: z.string().nullish(),
            reservedNote: z.string().nullish(),
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            return IPAMService.updateMetadata(id, data);
        })
});
