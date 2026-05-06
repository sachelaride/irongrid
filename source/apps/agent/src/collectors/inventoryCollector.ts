import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getInstalledSoftware, getHardwareFallback } from '../collector';

// Usar fs.promises ao invés de 'fs/promises' para compatibilidade com pkg
const fsPromises = fs.promises;
const execAsync = promisify(exec);

export interface HardwareInfo {
    cpu: {
        model: string;
        cores: number;
        threads: number;
        speed: number;
    };
    memory: {
        total: number;
        slots: number;
    };
    motherboard: {
        manufacturer: string;
        model: string;
        serial: string;
    };
    disk: {
        total: number;
    };
    gpu: {
        model: string;
        memory: number;
    };
}

export interface SoftwareInfo {
    name: string;
    version: string;
    publisher?: string;
    installDate?: string;
}

export interface PeripheralInfo {
    type: string;
    model: string;
    manufacturer: string;
    serial: string;
}

export interface NetworkInterfaceInfo {
    index: number;
    name: string;
    description: string;
    type: string;
    mac: string;
    speed: number;
    status: string;
    operState: string;
}

export interface InventoryPayload {
    machineId: string;
    hardware: HardwareInfo;
    software: SoftwareInfo[];
    peripherals: PeripheralInfo[];
    interfaces: NetworkInterfaceInfo[];
}

export class InventoryCollector {
    private hashFile = path.resolve(process.cwd(), 'inventory_hash.json');

    async collectFullInventory(): Promise<InventoryPayload> {
        const uuidInfo = await si.uuid();
        const hardware = await this.collectHardware();
        const software = await this.collectSoftware();
        const peripherals = await this.collectPeripherals();
        const interfaces = await this.collectNetworkInterfaces();

        return {
            machineId: uuidInfo.os || uuidInfo.hardware || 'unknown-mac-' + interfaces[0]?.mac,
            hardware,
            software,
            peripherals,
            interfaces,
        };
    }

    async collectDeltaInventory(): Promise<InventoryPayload | null> {
        const currentInventory = await this.collectFullInventory();
        const currentHash = this.calculateInventoryHash(currentInventory);
        const storedHash = await this.getStoredHash();

        if (currentHash === storedHash) {
            console.log('[Inventory] No changes detected in inventory.');
            return null;
        }

        await this.storeInventoryHash(currentHash);
        return currentInventory;
    }

    async collectHardware(): Promise<HardwareInfo> {
        const cpu = await si.cpu();
        const mem = await si.mem();
        const memLayout = await si.memLayout();
        const baseboard = await si.baseboard();
        const disk = await si.diskLayout();
        const graphics = await si.graphics();
        
        const hwFall = await getHardwareFallback();

        const totalDisk = disk.reduce((acc, d) => acc + d.size, 0);
        const gpu = graphics.controllers.length > 0 ? graphics.controllers[0] : { model: 'Unknown', vram: 0 };

        return {
            cpu: {
                model: (cpu.brand && cpu.brand !== 'Unknown') ? `${cpu.manufacturer} ${cpu.brand}` : hwFall.cpuName,
                cores: cpu.physicalCores || 0,
                threads: cpu.cores || 0,
                speed: cpu.speed || hwFall.cpuSpeed,
            },
            memory: {
                total: mem.total || hwFall.totalMem,
                slots: memLayout.length || 0,
            },
            motherboard: {
                manufacturer: baseboard.manufacturer || 'N/A',
                model: baseboard.model || 'N/A',
                serial: baseboard.serial || 'N/A',
            },
            disk: {
                total: totalDisk,
            },
            gpu: {
                model: gpu.model,
                memory: gpu.vram || 0,
            }
        };
    }

    async collectSoftware(): Promise<SoftwareInfo[]> {
        // Redireciona para o coletor robusto unificado
        return await getInstalledSoftware();
    }

    async collectPeripherals(): Promise<PeripheralInfo[]> {
        const peripherals: PeripheralInfo[] = [];
        try {
            const usb = await si.usb();
            usb.forEach(dev => {
                peripherals.push({
                    type: dev.type || 'USB',
                    model: dev.name,
                    manufacturer: dev.vendor,
                    serial: dev.serialNumber || '',
                });
            });

            const graphics = await si.graphics();
            graphics.displays.forEach(display => {
                peripherals.push({
                    type: 'Monitor',
                    model: display.model,
                    manufacturer: display.vendor,
                    serial: display.serial || '',
                });
            });

            const printers = await si.printer();
            printers.forEach(printer => {
                peripherals.push({
                    type: 'Printer',
                    model: printer.name,
                    manufacturer: '',
                    serial: '',
                });
            });
        } catch (error) {
            console.error('Error collecting peripherals:', error);
        }
        return peripherals;
    }

    async collectNetworkInterfaces(): Promise<NetworkInterfaceInfo[]> {
        const interfaces: NetworkInterfaceInfo[] = [];
        try {
            const ifaces = await si.networkInterfaces();
            const filtered = Array.isArray(ifaces) ? ifaces : [ifaces];

            filtered.forEach((iface, index) => {
                if (iface.internal || !iface.mac) return;

                interfaces.push({
                    index: index,
                    name: iface.ifaceName || iface.iface,
                    description: iface.iface,
                    type: iface.type || 'unknown',
                    mac: iface.mac,
                    speed: iface.speed || 0,
                    status: iface.operstate === 'up' ? 'online' : 'offline',
                    operState: iface.operstate,
                });
            });
        } catch (error) {
            console.error('Error collecting network interfaces:', error);
        }
        return interfaces;
    }

    calculateInventoryHash(inventory: InventoryPayload): string {
        return crypto.createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
    }

    async getStoredHash(): Promise<string | null> {
        try {
            const data = await fsPromises.readFile(this.hashFile, 'utf-8');
            return JSON.parse(data).hash;
        } catch {
            return null;
        }
    }

    async storeInventoryHash(hash: string): Promise<void> {
        await fsPromises.writeFile(this.hashFile, JSON.stringify({ hash, lastUpdate: new Date() }));
    }
}
