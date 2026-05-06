/**
 * Router de Inventário e BI
 * 
 * Gerencia o inventário detalhado de hardware, software e periféricos.
 * Fornece dados agrupados para relatórios de Business Intelligence (BI).
 * 
 * Funcionalidades:
 * - Detalhamento de hardware/software por dispositivo
 * - Estatísticas globais de software (ranking de instalações)
 * - Relatórios avançados de hardware (capacidade vs uso)
 * - Inventário de periféricos e distribuição por departamento
 * - Filtros complexos para relatórios de conformidade
 * 
 * @module routers/inventoryRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { serializeBigInt } from '../utils/serialization';

export const inventoryRouter = router({
    /**
     * Get Device Inventory - Inventário Completo do Dispositivo
     * 
     * Retorna todos os detalhes de hardware, software e periféricos de um ativo.
     * 
     * @procedure query
     * @param {Object} input
     * @param {string} input.deviceId - ID do dispositivo
     * @returns {Promise<Object>} Dados do inventário serializados
     */
    getDeviceInventory: protectedProcedure
        .input(z.object({ deviceId: z.string() }))
        .query(async ({ input }) => {
            const device = await prisma.device.findUnique({
                where: { id: input.deviceId },
                include: {
                    hardware: true,
                    software: { orderBy: { name: 'asc' } },
                    peripherals: true,
                    networkInterfaces: true,
                    location: { select: { name: true } },
                    departmentRef: { select: { name: true } },
                    assignedUser: { select: { name: true } },
                    maintenanceRecords: { select: { cost: true }, orderBy: { scheduledDate: 'desc' } }
                }
            });

            if (!device) return null;

            // Extrair status de segurança armazenado nas métricas do dispositivo
            const security = {
                av: (device as any).lastAvName || null,
                avStatus: (device as any).lastAvStatus || null,
                usbBlocked: (device as any).usbBlocked || false
            };

            return serializeBigInt({ ...device, security });
        }),

    /**
     * Get Software By Device - Listar Software por Máquina
     * 
     * Retorna a lista de programas instalados em um dispositivo específico.
     * 
     * @procedure query
     * @param {Object} input
     * @param {string} input.deviceId - ID do dispositivo
     */
    getSoftwareByDevice: protectedProcedure
        .input(z.object({ deviceId: z.string() }))
        .query(async ({ input }) => {
            const software = await prisma.software.findMany({
                where: { deviceId: input.deviceId },
                orderBy: { name: 'asc' }
            });
            return serializeBigInt(software);
        }),

    // --- REPORT QUERIES ---

    /**
     * Get Global Software Stats - Estatísticas Globais de Software
     * 
     * Retorna contagem de instâncias de software (ex: Chrome: 15 máquinas).
     * Utilizado para gestão de licenças e padronização.
     * 
     * @procedure query
     */
    getGlobalSoftwareStats: protectedProcedure
        .query(async () => {
            const stats = await prisma.software.groupBy({
                by: ['name', 'version'],
                _count: { _all: true },
                orderBy: { _count: { name: 'desc' } }
            });
            return stats.map(s => ({
                name: s.name,
                version: s.version,
                count: s._count._all
            }));
        }),

    /**
     * Get Advanced Hardware Report - Relatório Avançado de Hardware
     * 
     * Gera rankings de BI baseados em capacidades e consumo de recursos:
     * - Top 10 máquinas por Memória RAM
     * - Top 10 máquinas por Espaço em Disco
     * - Top 10 máquinas com maior uso de CPU/RAM atual
     * 
     * @procedure query
     */
    getAdvancedHardwareReport: protectedProcedure
        .query(async () => {
            const [topMemory, topDisk, highestCpuUsage, highestRamUsage] = await Promise.all([
                prisma.device.findMany({
                    where: { hardware: { isNot: null } },
                    orderBy: { hardware: { totalMemory: 'desc' } },
                    take: 10,
                    include: { hardware: true }
                }),
                prisma.device.findMany({
                    where: { hardware: { isNot: null } },
                    orderBy: { hardware: { totalDisk: 'desc' } },
                    take: 10,
                    include: { hardware: true }
                }),
                prisma.device.findMany({
                    where: { lastCpuUsage: { not: null } },
                    orderBy: { lastCpuUsage: 'desc' },
                    take: 10
                }),
                prisma.device.findMany({
                    where: { lastRamUsage: { not: null } },
                    orderBy: { lastRamUsage: 'desc' },
                    take: 10
                })
            ]);

            return {
                topMemory: topMemory.filter(d => d.hardware?.totalMemory).map(d => ({ id: d.id, name: d.name || d.hostname, value: Number(d.hardware!.totalMemory) })),
                topDisk: topDisk.filter(d => d.hardware?.totalDisk).map(d => ({ id: d.id, name: d.name || d.hostname, value: Number(d.hardware!.totalDisk) })),
                highestCpuUsage: highestCpuUsage.map(d => ({ id: d.id, name: d.name || d.hostname, value: d.lastCpuUsage })),
                highestRamUsage: highestRamUsage.map(d => ({ id: d.id, name: d.name || d.hostname, value: d.lastRamUsage }))
            };
        }),

    /**
     * Get Software Inventory Full - Inventário Geral de Software
     * 
     * Permite buscar onde determinado software está instalado ou listar
     * por departamento.
     * 
     * @procedure query
     * @param {Object} [input]
     * @param {string} [input.softwareName] - Nome parcial do software
     * @param {string} [input.departmentId] - ID do departamento
     */
    getSoftwareInventoryFull: protectedProcedure
        .input(z.object({
            softwareName: z.string().optional(),
            departmentId: z.string().optional()
        }).optional())
        .query(async ({ input }) => {
            const whereClause: any = {};

            if (input?.softwareName) {
                whereClause.name = { contains: input.softwareName, mode: 'insensitive' };
            }

            if (input?.departmentId) {
                whereClause.device = { departmentId: input.departmentId };
            }

            if (input?.softwareName || input?.departmentId) {
                const results = await prisma.software.findMany({
                    where: whereClause,
                    include: {
                        device: {
                            include: {
                                departmentRef: true
                            }
                        }
                    },
                    orderBy: { device: { name: 'asc' } }
                });
                return serializeBigInt(results);
            }

            // Global stats if no specific search
            const stats = await prisma.software.groupBy({
                by: ['name'],
                _count: { _all: true },
                orderBy: { _count: { name: 'desc' } },
                take: 100
            });

            return stats.map(s => ({
                name: s.name,
                count: s._count._all
            }));
        }),

    /**
     * Get Software Distribution - Distribuição de Software por Área
     * 
     * Retorna contagem de softwares filtrada opcionalmente por departamento.
     * 
     * @procedure query
     */
    getSoftwareDistribution: protectedProcedure
        .input(z.object({
            departmentId: z.string().optional()
        }).optional())
        .query(async ({ input }) => {
            const whereClause: any = {};
            if (input?.departmentId) {
                whereClause.device = { departmentId: input.departmentId };
            }

            const stats = await prisma.software.groupBy({
                where: whereClause,
                by: ['name'],
                _count: { _all: true },
                orderBy: { _count: { name: 'desc' } },
                take: 50
            });

            return stats.map(s => ({
                name: s.name,
                count: s._count._all
            }));
        }),

    /**
     * Get Hardware Specs Summary - Sumário Técnico de Hardware
     * 
     * Agrega dados técnicos de todo o parque computacional:
     * - Distribuição de modelos de CPU
     * - Distribuição de capacidades de RAM
     * - Totais de Disco e RAM em todo o parque
     * 
     * @procedure query
     */
    getHardwareSpecsSummary: protectedProcedure
        .query(async () => {
            const hardwares = await prisma.hardware.findMany();

            // Aggregations
            const cpuStats = new Map<string, number>();
            const ramStats = new Map<string, number>();
            let totalDisk = BigInt(0);
            let totalRam = BigInt(0);

            hardwares.forEach(h => {
                if (h.cpuModel) {
                    cpuStats.set(h.cpuModel, (cpuStats.get(h.cpuModel) || 0) + 1);
                }
                if (h.totalMemory) {
                    const gb = Math.round(Number(h.totalMemory) / (1024 ** 3));
                    const label = `${gb} GB`;
                    ramStats.set(label, (ramStats.get(label) || 0) + 1);
                    totalRam += h.totalMemory;
                }
                if (h.totalDisk) {
                    totalDisk += h.totalDisk;
                }
            });

            return {
                cpuDistribution: Array.from(cpuStats.entries()).map(([name, count]) => ({ name, count })),
                ramDistribution: Array.from(ramStats.entries()).map(([name, count]) => ({ name, count })),
                totals: {
                    disk: totalDisk.toString(),
                    ram: totalRam.toString(),
                    devices: hardwares.length
                }
            };
        }),

    /**
     * Get Peripheral Inventory - Inventário de Periféricos
     * 
     * Lista dispositivos externos (monitores, impressoras, etc) vinculados a máquinas.
     * 
     * @procedure query
     * @param {Object} [input]
     * @param {string} [input.type] - Tipo de periférico
     */
    getPeripheralInventory: protectedProcedure
        .input(z.object({
            type: z.string().optional()
        }).optional())
        .query(async ({ input }) => {
            const results = await prisma.peripheral.findMany({
                where: input?.type ? { type: { contains: input.type, mode: 'insensitive' } } : undefined,
                include: {
                    device: {
                        select: {
                            name: true,
                            hostname: true,
                            ipAddress: true,
                            departmentRef: { select: { name: true } }
                        }
                    }
                },
                orderBy: { type: 'asc' }
            });
            return serializeBigInt(results);
        }),

    /**
     * Get Advanced Inventory Report - Relatório de Inventário Avançado
     * 
     * Filtro complexo para busca cruzada entre hardware, periféricos e organização.
     * Ex: "Buscar notebooks com mais de 8GB de RAM no Financeiro com monitores Dell".
     * 
     * @procedure query
     * @param {Object} input - Filtros técnicos e organizacionais
     */
    getAdvancedInventoryReport: protectedProcedure
        .input(z.object({
            ramMin: z.number().optional(),
            ramMax: z.number().optional(),
            departmentId: z.string().optional(),
            deviceType: z.string().optional(),
            peripheralType: z.string().optional(),
        }).optional())
        .query(async ({ input }) => {
            const whereClause: any = {};

            if (input?.deviceType) {
                const deviceTypeMap: Record<string, any> = {
                    'servidor': 'SERVER',
                    'roteador': 'ROUTER',
                    'switch': 'SWITCH',
                    'impressora': 'PRINTER',
                    'estação': 'WORKSTATION',
                    'estacao': 'WORKSTATION',
                    'workstation': 'WORKSTATION',
                    'firewall': 'FIREWALL',
                    'gateway': 'GATEWAY',
                    'outro': 'OTHER',
                    'other': 'OTHER',
                    'server': 'SERVER',
                    'router': 'ROUTER',
                    'printer': 'PRINTER'
                };
                whereClause.type = deviceTypeMap[input.deviceType.toLowerCase()] || input.deviceType;
            }

            if (input?.departmentId) {
                whereClause.departmentId = input.departmentId;
            }

            const hardwareFilter: any = {};
            if (input?.ramMin !== undefined) {
                hardwareFilter.totalMemory = { ...hardwareFilter.totalMemory, gte: BigInt(input.ramMin * 1024 * 1024 * 1024) };
            }
            if (input?.ramMax !== undefined) {
                hardwareFilter.totalMemory = { ...hardwareFilter.totalMemory, lte: BigInt(input.ramMax * 1024 * 1024 * 1024) };
            }

            if (Object.keys(hardwareFilter).length > 0) {
                whereClause.hardware = hardwareFilter;
            }

            if (input?.peripheralType) {
                whereClause.peripherals = {
                    some: {
                        type: { contains: input.peripheralType, mode: 'insensitive' }
                    }
                };
            }

            const devices = await prisma.device.findMany({
                where: whereClause,
                include: {
                    hardware: true,
                    departmentRef: true,
                    peripherals: true,
                    location: true,
                },
                orderBy: { name: 'asc' }
            });

            return serializeBigInt(devices);
        }),

    /**
     * Get Organizational Inventory - Inventário por Hierarquia
     * 
     * Retorna a distribuição de ativos por Unidade e Departamento.
     * 
     * @procedure query
     */
    getOrganizationalInventory: protectedProcedure
        .query(async () => {
            const locations = await prisma.location.findMany({
                include: {
                    devices: { select: { id: true } },
                    departments: {
                        include: {
                            devices: { select: { id: true } }
                        }
                    }
                }
            });

            return locations;
        }),
});
