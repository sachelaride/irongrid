/**
 * Serviço de Gestão de Inventário (IT Asset Management)
 * 
 * Responsável por processar e persistir dados detalhados de hardware e software
 * coletados pelos Agentes IronGrid. Realiza a detecção de mudanças (deltas) para
 * alertar sobre instalações ou remoções de programas.
 * 
 * Funcionalidades:
 * - Persistência de Hardware (CPU, RAM, Placa-mãe, Discos, GPU)
 * - Listagem de Software Instalado
 * - Mapeamento de Periféricos e Interfaces de Rede
 * - Detecção automática de mudanças no inventário com geração de alertas
 * 
 * @module services/inventoryService
 */

import { prisma } from '../utils/prisma';
import { AlertService } from './alertService';
import { AlertSeverity, IPAddressStatus } from '@prisma/client';
import { IPAMService } from './ipamService';

const alertService = new AlertService();

/** Estrutura de dados recebida do Agente */
export interface InventoryPayload {
    hardware: {
        cpu: { model: string; cores: number; threads: number; speed: number };
        memory: { total: number; slots: number };
        motherboard: { manufacturer: string; model: string; serial: string };
        disk: { total: number };
        gpu: { model: string; memory: number };
    };
    software: Array<{
        name: string;
        version: string;
        publisher?: string;
        installDate?: string;
    }>;
    peripherals: Array<{
        type: string;
        model: string;
        manufacturer: string;
        serial: string;
    }>;
    interfaces: Array<{
        index: number;
        name: string;
        description: string;
        type: string;
        mac: string;
        speed: number;
        status: string;
        operState: string;
    }>;
}

export class InventoryService {
    /**
     * Process Inventory - Processar e Salvar Inventário
     * 
     * Recebe o payload completo do Agente, identifica o dispositivo vinculado
     * e atualiza as tabelas de Hardware, Software, Periféricos e Interfaces.
     * Caso detecte mudanças no software, um alerta de WARNING é gerado.
     * 
     * @param {string} agentId - Identificador único do Agente
     * @param {string} ipAddress - Endereço IP do dispositivo reportando
     * @param {InventoryPayload} data - Dados técnicos coletados
     * @returns {Promise<{ created: boolean; device: any }>}
     */
    async processInventory(agentId: string, ipAddress: string, data: InventoryPayload): Promise<{ created: boolean; device: any }> {
        console.log(`[InventoryService] Processing inventory for Agent ${agentId} (${ipAddress})`);

        // Identificadores para reconciliação
        const machineId = (data as any).machineId;
        const macAddresses = data.interfaces.map(i => i.mac).filter(m => m && m !== '00:00:00:00:00:00');

        let device: any = null;

        // 1. Tentar encontrar por machineId (Identificador definitivo)
        if (machineId) {
            device = await prisma.device.findUnique({ where: { machineId } });
        }

        // 2. Se não encontrou, tentar por agentId (Compatibilidade)
        if (!device) {
            device = await prisma.device.findUnique({ where: { agentId } });
        }

        // 3. Se ainda não encontrou, buscar por MAC Address de qualquer interface
        if (!device && macAddresses.length > 0) {
            // Busca nas interfaces de rede existentes
            const existingInterface = await prisma.networkInterface.findFirst({
                where: { macAddress: { in: macAddresses } },
                include: { device: true }
            });
            if (existingInterface) {
                device = existingInterface.device;
            } else {
                // Também busca no campo macAddress principal do Device (caso tenha sido cadastrado via SNMP scan)
                device = await prisma.device.findFirst({
                    where: { macAddress: { in: macAddresses } }
                });
            }
        }

        // 4. Se não achou por MAC nem IDs, tenta fundir pelo IP Address (útil se o Ping achou o IP antes)
        if (!device && ipAddress && ipAddress !== '127.0.0.1') {
            device = await prisma.device.findFirst({
                where: { ipAddress }
            });
        }


        // Detect peripherals (Webcam/Headset)
        const hasWebcam = data.peripherals.some(p => 
            p.type.toLowerCase().includes('camera') || 
            p.type.toLowerCase().includes('webcam') ||
            p.model.toLowerCase().includes('webcam') ||
            p.model.toLowerCase().includes('camera')
        );
        const hasHeadset = data.peripherals.some(p => 
            p.type.toLowerCase().includes('headset') || 
            p.type.toLowerCase().includes('audio') ||
            p.model.toLowerCase().includes('headset')
        );

        let created = false;
        // Se encontrou o dispositivo por MAC/UUID, atualizamos o registro existente
        if (device) {
            console.log(`[InventoryService] Updating existing device ${device.id} (Name: ${device.name}) with AgentId: ${agentId}`);
            device = await prisma.device.update({
                where: { id: device.id },
                data: {
                    agentId,   // Crucial: Update the agentId to match the current reporter
                    machineId,
                    ipAddress,
                    lastSeen: new Date(),
                    status: 'ONLINE',
                    hasWebcam,
                    hasHeadset,
                    // Se o dispositivo não tinha macAddress principal, usamos o primeiro válido
                    macAddress: device.macAddress || macAddresses[0]
                }
            });
        } else {
            // Cria um novo dispositivo se realmente for inédito
            created = true;
            device = await prisma.device.create({
                data: {
                    name: agentId,
                    agentId,
                    machineId,
                    ipAddress,
                    macAddress: macAddresses[0],
                    type: 'SERVER',
                    status: 'ONLINE',
                    lastSeen: new Date(),
                    hasWebcam,
                    hasHeadset
                }
            });
        }

        // Sincronizar com IPAM se o IP estiver disponível
        if (ipAddress) {
            await IPAMService.updateIPStatus(ipAddress, IPAddressStatus.USED, {
                deviceId: device.id,
                hostname: device.name || undefined
            });
        }

        // 5. Atualização de Hardware (Com proteção contra regressão)
        const currentHardware = await prisma.hardware.findUnique({ where: { deviceId: device.id } });
        
        const hwData = {
            cpuModel: (data.hardware.cpu.model && data.hardware.cpu.model !== 'Unknown') ? data.hardware.cpu.model : (currentHardware?.cpuModel || 'Unknown'),
            cpuCores: data.hardware.cpu.cores || currentHardware?.cpuCores || 0,
            cpuThreads: data.hardware.cpu.threads || currentHardware?.cpuThreads || 0,
            cpuSpeed: data.hardware.cpu.speed || currentHardware?.cpuSpeed || 0,
            totalMemory: data.hardware.memory.total || currentHardware?.totalMemory || BigInt(0),
            memorySlots: data.hardware.memory.slots || currentHardware?.memorySlots || 0,
            motherboard: (data.hardware.motherboard.model && data.hardware.motherboard.model !== 'Unknown') ? data.hardware.motherboard.model : (currentHardware?.motherboard || 'N/A'),
            serialNumber: (data.hardware.motherboard.serial && data.hardware.motherboard.serial !== 'Unknown') ? data.hardware.motherboard.serial : (currentHardware?.serialNumber || 'N/A'),
            totalDisk: data.hardware.disk.total || currentHardware?.totalDisk || BigInt(0),
            gpuModel: data.hardware.gpu.model || currentHardware?.gpuModel || 'Integrada',
            gpuMemory: data.hardware.gpu.memory || currentHardware?.gpuMemory || BigInt(0)
        };

        await prisma.hardware.upsert({
            where: { deviceId: device.id },
            create: { deviceId: device.id, ...hwData, biosVersion: '' },
            update: hwData
        });

        // Detecção de Delta de Software (Mudanças desde a última coleta)
        const currentSoftware = await prisma.software.findMany({ where: { deviceId: device.id } });
        const currentNames = new Set(currentSoftware.map(sw => `${sw.name} (${sw.version})`));
        const incomingNames = new Set(data.software.map(sw => `${sw.name} (${sw.version})`));

        const added = data.software.filter(sw => !currentNames.has(`${sw.name} (${sw.version})`));
        const removed = currentSoftware.filter(sw => !incomingNames.has(`${sw.name} (${sw.version})`));

        if (added.length > 0 || removed.length > 0) {
            console.log(`[InventoryService] Detected changes for ${agentId}: +${added.length}, -${removed.length}`);

            /* // Alertas de inventário desativados conforme solicitação
            let msg = 'Alterações de software detectadas:\n';
            if (added.length > 0) msg += `\nInstalados: ${added.map(s => s.name).slice(0, 5).join(', ')}${added.length > 5 ? '...' : ''}`;
            if (removed.length > 0) msg += `\nRemovidos: ${removed.map(s => s.name).slice(0, 5).join(', ')}${removed.length > 5 ? '...' : ''}`;

            await alertService.createAlert({
                title: `Mudança no Inventário: ${device.name}`,
                message: msg,
                severity: AlertSeverity.WARNING,
                deviceId: device.id
            });
            */
        }
 
        // Persistence of Activity Logs (Top Apps)
        if ((data as any).activity && (data as any).activity.stats) {
            const stats = (data as any).activity.stats;
            const logEntries = Object.entries(stats).map(([appName, duration]) => ({
                deviceId: device.id,
                appName: appName.substring(0, 255),
                durationSeconds: Number(duration),
                date: new Date()
            }));

            if (logEntries.length > 0) {
                await prisma.activityLog.createMany({
                    data: logEntries
                });
            }
        }


        // Software: Substituição completa da lista atual (Abordagem de sincronia total)
        if (data.software && data.software.length > 0) {
            await prisma.$transaction([
                prisma.software.deleteMany({ where: { deviceId: device.id } }),
                prisma.software.createMany({
                    data: data.software.map(sw => {
                        let installDate: Date | null = null;
                        if (sw.installDate) {
                            const parsedDate = new Date(sw.installDate);
                            if (!isNaN(parsedDate.getTime())) {
                                installDate = parsedDate;
                            }
                        }

                        return {
                            deviceId: device.id,
                            name: sw.name.substring(0, 255),
                            version: sw.version?.substring(0, 255),
                            publisher: sw.publisher?.substring(0, 255),
                            installDate,
                        };
                    }),
                    skipDuplicates: true
                })
            ]);
        }

        // Periféricos: Sincronia total
        if (data.peripherals && data.peripherals.length > 0) {
            await prisma.$transaction([
                prisma.peripheral.deleteMany({ where: { deviceId: device.id } }),
                prisma.peripheral.createMany({
                    data: data.peripherals.map(p => ({
                        deviceId: device.id,
                        type: p.type,
                        model: p.model,
                        manufacturer: p.manufacturer,
                        serialNumber: p.serial
                    })),
                    skipDuplicates: true
                })
            ]);
        }

        // Interfaces de Rede: Sincronia total
        if (data.interfaces && data.interfaces.length > 0) {
            await prisma.$transaction([
                prisma.networkInterface.deleteMany({ where: { deviceId: device.id } }),
                prisma.networkInterface.createMany({
                    data: data.interfaces.map(iface => ({
                        deviceId: device.id,
                        index: iface.index,
                        name: iface.name,
                        description: iface.description,
                        type: iface.type,
                        macAddress: iface.mac,
                        speed: BigInt(iface.speed || 0),
                        status: iface.status,
                    })),
                    skipDuplicates: true
                })
            ]);
        }

        console.log(`[InventoryService] Finished processing for ${agentId}`);
        return { created, device };
    }
}
