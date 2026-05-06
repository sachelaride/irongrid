/**
 * Router de Scan e Gerenciamento de Dispositivos
 * 
 * Este módulo é responsável por todas as operações relacionadas à descoberta,
 * varredura e gerenciamento de dispositivos na rede. Inclui funcionalidades para:
 * 
 * - Scan rápido de rede usando NMAP
 * - Enriquecimento de dados via SNMP
 * - Listagem e filtragem de dispositivos
 * - Operações CRUD em dispositivos
 * - Operações em massa (bulk operations)
 * - Gerenciamento de topologia (parent-child relationships)
 * 
 * @module routers/scanRouter
 * @requires trpc - Framework tRPC para criação de APIs type-safe
 * @requires zod - Biblioteca de validação de schemas
 * @requires services/nmap - Serviço de scan de rede
 * @requires utils/prisma - Cliente Prisma para acesso ao banco de dados
 * @requires services/snmp - Serviço SNMP para coleta de informações de dispositivos
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { scanNetwork } from '../services/nmap';
import { prisma } from '../utils/prisma';
import { SnmpService } from '../services/snmp';
import { serializeBigInt } from '../utils/serialization';
import { connectedAgents } from '../agentState';

const snmpService = new SnmpService();

const DEVICE_INCLUDE = {
    departmentRef: { select: { id: true, name: true } },
    location: { select: { id: true, name: true } },
    assignedUser: { select: { id: true, name: true } },
    parent: { select: { id: true, name: true, ipAddress: true } },
    maintenanceRecords: { select: { cost: true } },
    hardware: {
        select: {
            cpuModel: true,
            totalMemory: true,
            totalDisk: true,
        }
    },
    ipamAddresses: { select: { status: true } }
};

const enrichDevices = (devices: any[], monitoredIps: Set<string>) => {
    return devices.map((d: any) => ({
        id: d.id,
        ip: d.ipAddress,
        ipAddress: d.ipAddress,
        name: d.name,
        model: d.model || '',
        hostname: d.hostname || '',
        mac: d.macAddress || '',
        type: (d.type || 'OTHER').toUpperCase(),
        status: (d.type === 'INTERNET') ? 'online' : (d.status || 'OFFLINE').toLowerCase(),
        department: d.departmentRef?.name || d.department || '',
        departmentId: d.departmentId || '',
        location: d.location,
        locationId: d.locationId || '',
        user: d.assignedUser?.name || d.user || '',
        lastSeen: d.lastSeen?.toISOString(),
        purchaseValue: d.purchaseValue,
        maintenanceRecords: d.maintenanceRecords,
        lastLatency: (d as any).lastLatency,
        offlineSince: d.offlineSince?.toISOString() || null,
        parentId: (d as any).parentId,
        parentName: d.parent?.name || '',
        parentIp: d.parent?.ipAddress || '',
        parentPort: (d as any).parentPort || '',
        portSpeed: (d as any).portSpeed || '',
        connectedPort: (d as any).connectedPort || null,
        snmpCommunityId: (d as any).snmpCommunityId || '',
        topoX: d.topoX,
        topoY: d.topoY,
        vlan: d.vlan,
        topologyRole: (d as any).topologyRole || '',
        additionalParents: d.additionalParents || null,
        isMonitored: monitoredIps.has(d.ipAddress),
        voipExtension: d.voipExtension || '',
        hasWebcam: d.hasWebcam || false,
        hasHeadset: d.hasHeadset || false,
        assetNumber: d.assetNumber || '',
        ipamStatus: d.ipamAddresses?.[0]?.status || null,
        agentId: d.agentId || d.hostname || Array.from(connectedAgents.entries()).find(([_, info]) => info.ipAddress === d.ipAddress)?.[0] || null,
        hardware: d.hardware
    }));
};

export const scanRouter = router({
    /**
     * Quick Scan - Varredura Rápida de Rede
     * 
     * Realiza uma varredura rápida de rede em um subnet especificado usando NMAP.
     * Após a descoberta inicial, enriquece os dados dos dispositivos encontrados
     * com informações SNMP (nome do sistema, descrição, tipo).
     * 
     * Funcionalidades:
     * - Scan de rede usando NMAP
     * - Probe SNMP para cada dispositivo encontrado
     * - Detecção automática de tipo de dispositivo (Switch, Router, etc)
     * - Persistência automática no banco de dados (upsert)
     * - Atualização de status e última visualização
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input - Parâmetros do scan
     * @param {string} [input.subnet='192.168.1.0/24'] - Subnet no formato CIDR
     * @returns {Promise<{target: string, devices: Array}>} Resultado do scan
     * 
     * @example
     * // Scan com subnet padrão
     * const result = await trpc.scan.quickScan.mutate({});
     * 
     * @example
     * // Scan com subnet customizado
     * const result = await trpc.scan.quickScan.mutate({ 
     *   subnet: '10.0.0.0/24' 
     * });
     */
    quickScan: protectedProcedure
        .input(z.object({
            subnet: z.string().optional(),
            snmpCommunity: z.string().optional()
        }))
        .mutation(async ({ input }) => {
            const target = input.subnet || '192.168.1.0/24';
            const results = await scanNetwork(target);

            console.log(`[Scan] Found ${results.length} devices on ${target}. Enriching with SNMP...`);

            // Persist to database with SNMP enrichment
            const enrichmentPromises = results.map(async (device) => {
                // Try SNMP probe to get better name and model
                const snmpData = await snmpService.probeDevice(
                    device.ip,
                    input.snmpCommunity ? [input.snmpCommunity] : undefined
                );

                let finalType = device.type;
                let finalName = device.hostname || device.ip;
                let finalModel = null;

                if (snmpData) {
                    if (snmpData.sysName) {
                        finalName = snmpData.sysName;
                    }
                    if (snmpData.sysDescr) {
                        finalModel = snmpData.sysDescr;
                        const desc = snmpData.sysDescr.toLowerCase();
                        // Heuristic override based on SNMP description
                        if (desc.includes('switch') || desc.includes('networking')) {
                            finalType = 'SWITCH';
                        } else if (desc.includes('router') || desc.includes('gateway')) {
                            finalType = 'ROUTER';
                        }
                    }
                }

                const existing = await prisma.device.findFirst({ where: { ipAddress: device.ip } });
                const updateData = {
                    name: finalName,
                    model: finalModel,
                    hostname: device.hostname,
                    macAddress: device.mac,
                    type: finalType as any,
                    status: 'ONLINE' as any,
                    lastSeen: new Date(),
                };
                
                if (existing) {
                    return prisma.device.update({
                        where: { id: existing.id },
                        data: updateData
                    });
                } else {
                    return prisma.device.create({
                        data: {
                            ...updateData,
                            ipAddress: device.ip
                        }
                    });
                }
            });

            await Promise.all(enrichmentPromises);

            return serializeBigInt({ target, devices: results });
        }),

    /**
     * Get Devices - Listagem de Dispositivos com Filtros
     * 
     * Retorna a lista de dispositivos cadastrados no sistema com suporte a:
     * - Busca por texto (nome, IP, hostname, usuário)
     * - Busca por range de IPs (formato: 192.168.0.1-192.168.0.50)
     * - Filtro por tipo de dispositivo
     * - Filtro por departamento
     * - Ordenação customizável
     * - Controle de acesso por role (usuários comuns veem apenas seu departamento)
     * 
     * Inclui relacionamentos:
     * - Departamento (departmentRef)
     * - Localização (location)
     * - Usuário atribuído (assignedUser)
     * 
     * Também realiza mapeamento dinâmico de agentId baseado em IP quando disponível.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} [input] - Parâmetros de filtro e ordenação
     * @param {string} [input.search] - Texto de busca ou range de IPs
     * @param {string} [input.type] - Tipo de dispositivo (SWITCH, ROUTER, etc)
     * @param {string} [input.department] - Filtro por departamento
     * @param {string} [input.sortBy] - Campo para ordenação
     * @param {'asc'|'desc'} [input.sortOrder='asc'] - Direção da ordenação
     * @returns {Promise<Array>} Lista de dispositivos com relacionamentos
     * 
     * @example
     * // Buscar todos os switches
     * const devices = await trpc.scan.getDevices.query({ type: 'switch' });
     * 
     * @example
     * // Buscar por range de IPs
     * const devices = await trpc.scan.getDevices.query({ 
     *   search: '192.168.1.1-192.168.1.100' 
     * });
     */
    getDevices: protectedProcedure
        .input(z.object({
            search: z.string().optional(),
            type: z.string().optional(),
            department: z.string().optional(),
            sortBy: z.string().optional(),
            sortOrder: z.enum(['asc', 'desc']).optional(),
        }).optional())
        .query(async ({ input, ctx }) => {
            try {
                require('fs').appendFileSync('poller_debug.log', `[${new Date().toISOString()}] getDevices called with input: ${JSON.stringify(input)}\n`);
            } catch (e) { }
            const where: any = {};

            if (input?.search) {
                // Check if it's an IP range (e.g., 192.168.0.1-192.168.0.50)
                if (input.search.includes('-')) {
                    const parts = input.search.split('-').map(p => p.trim());
                    if (parts.length === 2) {
                        where.ipAddress = {
                            gte: parts[0],
                            lte: parts[1]
                        };
                    }
                } else {
                    where.OR = [
                        { name: { contains: input.search, mode: 'insensitive' } },
                        { ipAddress: { contains: input.search, mode: 'insensitive' } },
                        { hostname: { contains: input.search, mode: 'insensitive' } },
                        { user: { contains: input.search, mode: 'insensitive' } },
                    ];
                }
            }

            if (input?.type && input.type !== 'all') {
                where.type = input.type.toUpperCase();
            }

            if (input?.department) {
                where.OR = [
                    { department: { contains: input.department, mode: 'insensitive' } },
                    { departmentRef: { name: { contains: input.department, mode: 'insensitive' } } }
                ];
            }

            // Usuários comuns (USER) só veem dispositivos do seu departamento
            if (ctx.user?.role === 'USER' && ctx.user?.departmentId) {
                where.departmentId = ctx.user.departmentId;
            }

            // Mapeamento de campos do frontend para o Prisma
            const sortMapping: any = {
                name: 'name',
                ip: 'ipAddress',
                utilizador: 'user',
                tipo: 'type',
                departamento: 'department'
            };

            const orderBy: any = {};
            const field = input?.sortBy ? sortMapping[input.sortBy] || 'ipAddress' : 'ipAddress';
            orderBy[field] = input?.sortOrder || 'asc';

            const [devices, monitored] = await Promise.all([
                (prisma as any).device.findMany({
                    where,
                    orderBy,
                    include: DEVICE_INCLUDE
                }),
                prisma.monitoredDevice.findMany({ select: { ip: true } })
            ]);

            const monitoredIps = new Set(monitored.map(m => m.ip));
            const enriched = enrichDevices(devices, monitoredIps);
            return serializeBigInt(enriched);
        }),

    getDevicesPaginated: protectedProcedure
        .input(z.object({
            search: z.string().optional(),
            type: z.string().optional(),
            department: z.string().optional(),
            sortBy: z.string().optional(),
            sortOrder: z.enum(['asc', 'desc']).optional(),
            page: z.number().optional().default(1),
            limit: z.number().optional().default(25),
        }).optional())
        .query(async ({ input, ctx }) => {
            const where: any = {};

            if (input?.search) {
                if (input.search.includes('-')) {
                    const parts = input.search.split('-').map(p => p.trim());
                    if (parts.length === 2) {
                        where.ipAddress = { gte: parts[0], lte: parts[1] };
                    }
                } else {
                    where.OR = [
                        { name: { contains: input.search, mode: 'insensitive' } },
                        { ipAddress: { contains: input.search, mode: 'insensitive' } },
                        { hostname: { contains: input.search, mode: 'insensitive' } },
                        { user: { contains: input.search, mode: 'insensitive' } },
                    ];
                }
            }

            if (input?.type && input.type !== 'all') {
                where.type = input.type.toUpperCase();
            }

            if (input?.department) {
                where.OR = [
                    { department: { contains: input.department, mode: 'insensitive' } },
                    { departmentRef: { name: { contains: input.department, mode: 'insensitive' } } }
                ];
            }

            if (ctx.user?.role === 'USER' && ctx.user?.departmentId) {
                where.departmentId = ctx.user.departmentId;
            }

            const sortMapping: any = {
                name: 'name',
                ip: 'ipAddress',
                utilizador: 'user',
                tipo: 'type',
                departamento: 'department'
            };

            const orderBy: any = {};
            const field = input?.sortBy ? sortMapping[input.sortBy] || 'ipAddress' : 'ipAddress';
            orderBy[field] = input?.sortOrder || 'asc';

            const page = input?.page || 1;
            const limit = input?.limit || 25;
            const skip = (page - 1) * limit;

            const [total, devices, monitored] = await Promise.all([
                (prisma as any).device.count({ where }),
                (prisma as any).device.findMany({
                    where,
                    orderBy,
                    skip,
                    take: limit,
                    include: DEVICE_INCLUDE
                }),
                prisma.monitoredDevice.findMany({ select: { ip: true } })
            ]);

            const monitoredIps = new Set(monitored.map(m => m.ip));
            const enriched = enrichDevices(devices, monitoredIps);
            
            return serializeBigInt({ 
                devices: enriched,
                total,
                page,
                limit
            });
        }),
    
    // Riverside: added IP mapping fallback

    /**
     * Set Parent Device - Definir Dispositivo Pai (Topologia)
     * 
     * Define ou remove a relação parent-child entre dispositivos para
     * construção da topologia de rede. Usado para mapear conexões físicas
     * entre dispositivos (ex: computador conectado a um switch).
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.deviceId - ID do dispositivo filho
     * @param {string|null} input.parentId - ID do dispositivo pai (null para remover)
     * @returns {Promise<Device>} Dispositivo atualizado
     * 
     * @example
     * // Conectar dispositivo a um switch
     * await trpc.scan.setParentDevice.mutate({
     *   deviceId: 'device-123',
     *   parentId: 'switch-456'
     * });
     */
    setParentDevice: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            parentId: z.string().nullable()
        }))
        .mutation(async ({ input }) => {
            return prisma.device.update({
                where: { id: input.deviceId },
                data: { parentId: input.parentId }
            });
        }),

    /**
     * Update Device Position - Atualizar Posição na Topologia
     */
    updateDevicePosition: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            x: z.number().nullable(),
            y: z.number().nullable()
        }))
        .mutation(async ({ input }) => {
            return prisma.device.update({
                where: { id: input.deviceId },
                data: {
                    topoX: input.x,
                    topoY: input.y
                }
            });
        }),

    /**
     * Update Device Port - Atualizar Porta de Conexão
     * 
     * Atribui um dispositivo a uma porta específica em um switch.
     */
    updateDevicePort: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            portNumber: z.number().int().min(1).max(48).nullable()
        }))
        .mutation(async ({ input }) => {
            return prisma.device.update({
                where: { id: input.deviceId },
                data: {
                    connectedPort: input.portNumber
                }
            });
        }),

    /**
     * Get Port Connections - Obter Dispositivos Conectados a um Switch
     * 
     * Retorna todos os dispositivos conectados às portas de um switch específico.
     */
    getPortConnections: protectedProcedure
        .input(z.object({
            switchId: z.string()
        }))
        .query(async ({ input }) => {
            const devices = await prisma.device.findMany({
                where: {
                    parentId: input.switchId
                },
                select: {
                    id: true,
                    name: true,
                    ipAddress: true,
                    type: true,
                    status: true,
                    connectedPort: true,
                    lastLatency: true
                },
                orderBy: {
                    connectedPort: 'asc'
                }
            });

            return serializeBigInt(devices);
        }),

    /**
     * Update Device - Atualizar Dispositivo
     * 
     * Atualiza informações de um dispositivo específico.
     * Campos atualizáveis: nome, tipo, departamento, usuário, patrimônio.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.id - ID do dispositivo
     * @param {string} [input.name] - Novo nome
     * @param {string} [input.type] - Novo tipo
     * @param {string} [input.department] - Novo departamento
     * @param {string} [input.user] - Novo usuário
     * @param {string} [input.assetNumber] - Número de patrimônio
     * @param {Date} [input.purchaseDate] - Data de compra
     * @param {number} [input.purchaseValue] - Valor de compra
     * @param {string} [input.supplier] - Fornecedor
     * @param {Date} [input.warrantyExpiry] - Fim da garantia
     * @param {string} [input.notes] - Observações
     * @returns {Promise<Device>} Dispositivo atualizado
     */
    updateDevice: protectedProcedure
        .input(z.object({
            id: z.string().optional(),
            deviceId: z.string().optional(), // Alias for id
            name: z.string().optional(),
            ip: z.string().optional(), // For ipAddress
            type: z.string().optional(),
            department: z.string().optional(),
            user: z.string().optional(),
            parentId: z.string().nullable().optional(),
            vlan: z.string().optional(),
            // Campos de patrimônio
            assetNumber: z.string().optional(),
            purchaseDate: z.date().optional(),
            purchaseValue: z.number().optional(),
            supplier: z.string().optional(),
            warrantyExpiry: z.date().optional(),
            notes: z.string().optional(),
            maintenanceCost: z.number().optional(),
            topologyRole: z.string().optional(),
            additionalParents: z.any().optional(),
            voipExtension: z.string().optional(),
            hasWebcam: z.boolean().optional(),
            hasHeadset: z.boolean().optional(),
            macAddress: z.string().optional(),
            hostname: z.string().optional(),
            portSpeed: z.string().optional(), // Riverside: added portSpeed
        }))
        .mutation(async ({ input }) => {
            const deviceId = input.deviceId || input.id;
            console.log(`[updateDevice] Received update for deviceId: ${deviceId}`, input);

            if (!deviceId) {
                throw new Error('Device ID is required');
            }

            const { id, deviceId: _, ip, maintenanceCost, ...data } = input;
            const updateData: any = { ...data };

            if (data.type) {
                updateData.type = data.type.toUpperCase();
            }

            if (ip) {
                updateData.ipAddress = ip;
            }

            // Validar se o parentId existe no banco para evitar erro de Foreign Key
            if (updateData.parentId) {
                const parentExists = await prisma.device.findUnique({ where: { id: updateData.parentId } });
                if (!parentExists) {
                    updateData.parentId = null; // Se não existe, reseta para nulo para evitar crash
                }
            }

            const device = await prisma.device.update({
                where: { id: deviceId },
                data: updateData
            });

            console.log(`[updateDevice] Successfully updated device: ${deviceId}`, device);

            // Se houver custo de manutenção informado, registra no histórico
            // Se houver custo de manutenção informado, registra no histórico
            if (maintenanceCost && maintenanceCost > 0) {
                await prisma.maintenanceRecord.create({
                    data: {
                        deviceId: device.id,
                        cost: maintenanceCost,
                        title: 'Manutenção / Upgrade Manual',
                        description: 'Custo registrado via edição manual de dispositivo.',
                        type: 'UPGRADE',
                        status: 'COMPLETED',
                        scheduledDate: new Date(),
                        completedAt: new Date()
                    }
                });
            }

            return device;
        }),

    /**
     * Delete Device - Deletar Dispositivo
     * 
     * Remove permanentemente um dispositivo do sistema.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.id - ID do dispositivo a ser deletado
     * @returns {Promise<{success: boolean}>}
     */
    deleteDevice: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.device.delete({
                where: { id: input.id }
            });
            return { success: true };
        }),

    /**
     * Bulk Delete Devices - Deletar Múltiplos Dispositivos
     * 
     * Remove permanentemente múltiplos dispositivos em uma única operação.
     * Útil para limpeza de dispositivos obsoletos ou duplicados.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string[]} input.ids - Array de IDs dos dispositivos
     * @returns {Promise<{success: boolean, count: number}>}
     */
    bulkDeleteDevices: protectedProcedure
        .input(z.object({ ids: z.array(z.string()) }))
        .mutation(async ({ input }) => {
            await prisma.device.deleteMany({
                where: {
                    id: { in: input.ids }
                }
            });
            return { success: true, count: input.ids.length };
        }),

    /**
     * Bulk Update Devices - Atualização em Massa
     * 
     * Atualiza múltiplos dispositivos simultaneamente com os mesmos valores.
     * Útil para operações como:
     * - Mover dispositivos para outro departamento
     * - Atribuir dispositivos a um usuário
     * - Alterar tipo de múltiplos dispositivos
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string[]} input.ids - Array de IDs dos dispositivos
     * @param {string} [input.department] - Novo departamento
     * @param {string} [input.user] - Novo usuário
     * @param {string} [input.type] - Novo tipo
     * @returns {Promise<{success: boolean, count: number}>}
     */
    bulkUpdateDevices: protectedProcedure
        .input(z.object({
            ids: z.array(z.string()),
            department: z.string().optional(),
            user: z.string().optional(),
            type: z.string().optional(),
            parentId: z.string().optional(),
            parentPort: z.string().optional(),
            portSpeed: z.string().optional(),
            snmpCommunityId: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            const { ids, ...data } = input;
            const updateData: any = { ...data };
            if (data.type) {
                updateData.type = data.type.toUpperCase();
            }

            await prisma.device.updateMany({
                where: {
                    id: { in: ids }
                },
                data: updateData
            });

            return { success: true, count: ids.length };
        }),

    /**
     * Bulk Ping Test - Test ping connectivity for multiple devices
     */
    bulkPingTest: protectedProcedure
        .input(z.object({ ips: z.array(z.string()) }))
        .mutation(async ({ input }) => {
            const { PingService } = await import('../services/pingService');
            const pingService = new PingService();
            const results = await pingService.bulkPing(input.ips);
            return serializeBigInt({ results });
        }),

    /**
     * Bulk SNMP Test - Test SNMP connectivity for multiple devices
     * Also updates device names in the database when SNMP succeeds
     */
    bulkSnmpTest: protectedProcedure
        .input(z.object({
            ips: z.array(z.string()),
            community: z.string()
        }))
        .mutation(async ({ input }) => {
            const results = await snmpService.bulkProbeDevices(input.ips, input.community);

            // Update device names in database for successful SNMP queries
            const updatePromises = results
                .filter(r => r.success && r.sysName)
                .map(async (result) => {
                    try {
                        await prisma.device.updateMany({
                            where: { ipAddress: result.ip },
                            data: {
                                name: result.sysName,
                                lastSeen: new Date()
                            }
                        });
                    } catch (error) {
                        console.error(`[bulkSnmpTest] Failed to update device ${result.ip}:`, error);
                    }
                });

            await Promise.all(updatePromises);

            return serializeBigInt({ results });
        }),
});
