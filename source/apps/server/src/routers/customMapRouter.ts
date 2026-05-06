import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { influxDB } from '../services/influxdb';
import { TRPCError } from '@trpc/server';
import { serializeBigInt } from '../utils/serialization';
import { ensureMonitoringEnabled, syncMonitoredDevices } from './snmpRouter';
import { resolveInterface } from '../utils/network';

export const customMapRouter = router({
    getAll: protectedProcedure.query(async () => {
        return prisma.customMap.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { nodes: true } }
            }
        });
    }),

    getById: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const map = await prisma.customMap.findUnique({
                where: { id: input.id },
                include: {
                    nodes: {
                        include: {
                            device: {
                                select: { id: true, name: true, ipAddress: true, status: true, type: true, agentId: true }
                            }
                        }
                    },
                    edges: {
                        include: {
                            target: {
                                include: {
                                    device: true
                                }
                            }
                        }
                    },
                    zones: true,
                    labels: true
                }
            });
            if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Mapa não encontrado' });
            return map;
        }),

    create: protectedProcedure
        .input(z.object({
            name: z.string().min(1, "O nome é obrigatório"),
            description: z.string().optional()
        }))
        .mutation(async ({ input }) => {
            return prisma.customMap.create({ data: input });
        }),

    update: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            description: z.string().optional()
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            return prisma.customMap.update({ where: { id }, data });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            return prisma.customMap.delete({ where: { id: input.id } });
        }),

    /**
     * Procedure: duplicate
     * Permite duplicar um Mapa Customizado existente de forma profunda (Deep Copy).
     * Essa função não copia apenas as propriedades da raiz do mapa, mas também percorre:
     * - Dispositivos e posições (Nodes)
     * - Conexões estruturais (Edges)
     * - Áreas semânticas (Zones)
     * - Caixas de Textos (Labels)
     * 
     * O maior desafio computacional e lógico de topologia aqui é garantir que as conexões (Edges) da
     * nova cópia apontem para os novos dispositivos (Nodes) copiados, e não para os originais.
     */
    duplicate: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            // Passo 1: Busca o mapa original completo (incluindo todas as entidades filhas/nested)
            const originalMap = await prisma.customMap.findUnique({
                where: { id: input.id },
                include: {
                    nodes: true,
                    edges: true,
                    zones: true,
                    labels: true,
                }
            });

            // Validação de segurança: aborta e retorna erro formal via tRPC se o id for inexistente
            if (!originalMap) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Mapa original não encontrado' });
            }

            // Passo 2: Cria o novo registro raiz do Mapa Customizado
            // O nome é modificado automaticamente acoplando o sufixo " (Cópia)" 
            const newMap = await prisma.customMap.create({
                data: {
                    name: `${originalMap.name} (Cópia)`,
                    description: originalMap.description,
                }
            });

            // Passo 3: Inicialização do Dicionário de Mapeamento (Lookup Table) para os IDs
            // Estrutura em memória: { [ID_do_Node_Original_em_String]: ID_do_Node_Novo_em_String }
            // Essencial para atualizar as pontas das linhas conectivas em Step 4.
            const nodeRemap: Record<string, string> = {};

            // Passo 3.1: Reproduz todos os Nós (Dispositivos) primeiro, pois eles são as âncoras.
            for (const node of originalMap.nodes) {
                const newNode = await prisma.customMapNode.create({
                    data: {
                        customMapId: newMap.id, // Amarra explicitamente ao NOVO mapa!
                        deviceId: node.deviceId, // Referência UUID pro hardware no Inventory do sistema
                        x: node.x, // Preserva coordenada no Canvas
                        y: node.y, // Preserva coordenada no Canvas
                        selectedPort: node.selectedPort, // Preserva a config SNMP configurada no nó original
                        zIndex: (node as any).zIndex,
                    } as any
                });
                // Guarda de onde este node veio e para qual novo GUID ele virou
                nodeRemap[node.id] = newNode.id;
            }

            // Passo 4: Cria todas as Novas Conexões (Edges / Links entre dispositivos)
            for (const edge of originalMap.edges) {
                // Checa com IF estrito se as extremidades do link constam no mapa de recriação (isso 
                // livra a Engine de quebrar a Promise se o DB original estiver mal formatado com edges fantasma)
                if (nodeRemap[edge.sourceId] && nodeRemap[edge.targetId]) {
                    await prisma.customMapEdge.create({
                        data: {
                            customMapId: newMap.id,
                            sourceId: nodeRemap[edge.sourceId], // Resolve novo ID base
                            targetId: nodeRemap[edge.targetId], // Resolve novo ID alvo
                            sourcePort: edge.sourcePort,
                            targetPort: edge.targetPort,
                        }
                    });
                }
            }

            // Passo 5: Copia Entidades Independentes de Fundo (Áreas - Zones)
            for (const zone of originalMap.zones) {
                await prisma.customMapZone.create({
                    data: {
                        customMapId: newMap.id,
                        label: zone.label,
                        x: zone.x,
                        y: zone.y,
                        width: zone.width,
                        height: zone.height,
                        color: zone.color,
                        zIndex: (zone as any).zIndex,
                    } as any
                });
            }

            // Passo 6: Copia Entidades Independentes de Frente (Textos livres - Labels)
            for (const label of originalMap.labels) {
                await prisma.customMapLabel.create({
                    data: {
                        customMapId: newMap.id,
                        text: label.text,
                        x: label.x,
                        y: label.y,
                        fontSize: label.fontSize,
                        color: label.color,
                        bgColor: label.bgColor, // Preserva se for HEX formatado ou literal 'transparent'
                        zIndex: (label as any).zIndex,
                    } as any
                });
            }

            // Ao retornar 'newMap', o front-end recebe confirmação de Success e invalida a cache de listagem
            return newMap;
        }),

    addNode: protectedProcedure
        .input(z.object({
            customMapId: z.string(),
            deviceId: z.string().optional(),
            x: z.number().default(0),
            y: z.number().default(0),
            zIndex: z.number().int().optional().default(0),
            selectedPort: z.string().optional(),
            name: z.string().optional(),
            type: z.string().optional()
        }))
        .mutation(async ({ input }) => {
            return prisma.customMapNode.create({ 
                data: {
                    ...input,
                    deviceId: input.deviceId as any
                } as any
            });
        }),

    updateNode: protectedProcedure
        .input(z.object({
            id: z.string(),
            x: z.number().optional(),
            y: z.number().optional(),
            zIndex: z.number().int().optional(),
            selectedPort: z.string().nullable().optional()
        }))
        .mutation(async ({ input }) => {
            const { id, selectedPort, ...data } = input;
            
            // Se uma porta foi selecionada no nó, garante o monitoramento (Apenas se for um dispositivo gerenciado)
            if (selectedPort) {
                const node = await prisma.customMapNode.findUnique({ where: { id } });
                if (node && node.deviceId) {
                    const iface = await resolveInterface(node.deviceId, selectedPort);
                    if (iface) {
                        await ensureMonitoringEnabled(node.deviceId, iface.index);
                    }
                }
            }
            
            return prisma.customMapNode.update({ 
                where: { id }, 
                data: { ...data, selectedPort } as any
            });
        }),

    removeNode: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            return prisma.customMapNode.delete({ where: { id: input.id } });
        }),

    addEdge: protectedProcedure
        .input(z.object({
            customMapId: z.string(),
            sourceId: z.string(),
            targetId: z.string(),
            sourcePort: z.string().optional(),
            targetPort: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            const edge = await prisma.customMapEdge.create({ data: input });
            
            // Ativa monitoramento se portas forem definidas na criação
            if (input.sourcePort || input.targetPort) {
                const fullEdge = await prisma.customMapEdge.findUnique({
                    where: { id: edge.id },
                    include: { source: true, target: true }
                });

                if (fullEdge) {
                    if (input.sourcePort && fullEdge.source?.deviceId) {
                        const iface = await resolveInterface(fullEdge.source.deviceId, input.sourcePort);
                        if (iface) await ensureMonitoringEnabled(fullEdge.source.deviceId, iface.index);
                    }
                    if (input.targetPort && fullEdge.target?.deviceId) {
                        const iface = await resolveInterface(fullEdge.target.deviceId, input.targetPort);
                        if (iface) await ensureMonitoringEnabled(fullEdge.target.deviceId, iface.index);
                    }
                }
            }
            return edge;
        }),

    updateEdge: protectedProcedure
        .input(z.object({
            id: z.string(),
            sourcePort: z.string().optional().nullable(),
            targetPort: z.string().optional().nullable(),
        }))
        .mutation(async ({ input }) => {
            // Busca o edge antes para pegar os deviceIds
            const edge = await prisma.customMapEdge.findUnique({
                where: { id: input.id },
                include: { source: true, target: true }
            });

            if (edge) {
                if (input.sourcePort && edge.source?.deviceId) {
                    const iface = await resolveInterface(edge.source.deviceId, input.sourcePort);
                    if (iface) await ensureMonitoringEnabled(edge.source.deviceId, iface.index);
                }
                if (input.targetPort && edge.target?.deviceId) {
                    const iface = await resolveInterface(edge.target.deviceId, input.targetPort);
                    if (iface) await ensureMonitoringEnabled(edge.target.deviceId, iface.index);
                }
            }

            return prisma.customMapEdge.update({
                where: { id: input.id },
                data: {
                    sourcePort: input.sourcePort,
                    targetPort: input.targetPort,
                }
            });
        }),

    removeEdge: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            return prisma.customMapEdge.delete({ where: { id: input.id } });
        }),

    addZone: protectedProcedure
        .input(z.object({
            customMapId: z.string(),
            label: z.string().optional(),
            x: z.number(),
            y: z.number(),
            width: z.number().optional(),
            height: z.number().optional(),
            color: z.number().optional().or(z.string().optional()),
            type: z.string().optional(),
            zIndex: z.number().int().optional().default(0)
        }))
        .mutation(async ({ input }) => {
            return prisma.customMapZone.create({ data: input as any });
        }),

    updateZone: protectedProcedure
        .input(z.object({
            id: z.string(),
            label: z.string().optional(),
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            color: z.number().optional().or(z.string().optional()),
            type: z.string().optional(),
            zIndex: z.number().int().optional()
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            return prisma.customMapZone.update({
                where: { id },
                data: data as any
            });
        }),

    removeZone: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            return prisma.customMapZone.delete({ where: { id: input.id } });
        }),

    addLabel: protectedProcedure
        .input(z.object({
            customMapId: z.string(),
            text: z.string().optional(),
            x: z.number(),
            y: z.number(),
            fontSize: z.number().int().optional(),
            color: z.string().optional(),
            bgColor: z.string().optional(),
            zIndex: z.number().int().optional().default(0)
        }))
        .mutation(async ({ input }) => {
            return prisma.customMapLabel.create({ data: input });
        }),

    updateLabel: protectedProcedure
        .input(z.object({
            id: z.string(),
            text: z.string().optional(),
            x: z.number().optional(),
            y: z.number().optional(),
            fontSize: z.number().int().optional(),
            color: z.string().optional(),
            bgColor: z.string().optional(),
            zIndex: z.number().int().optional()
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input;
            return prisma.customMapLabel.update({ where: { id }, data: data as any });
        }),

    removeLabel: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            return prisma.customMapLabel.delete({ where: { id: input.id } });
        }),

    getPortBandwidth: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            portName: z.string()
        }))
        .query(async ({ input }) => {
            const device = await prisma.device.findUnique({ 
                where: { id: input.deviceId },
                select: { id: true, ipAddress: true, agentId: true, name: true }
            });
            if (!device) return { in: 0, out: 0, speed: 0 };

            // Fetch the interface details to get index and description
            const iface = await resolveInterface(input.deviceId, input.portName);

            const filterIds = [];
            if (device.ipAddress) filterIds.push(device.ipAddress);
            if (device.agentId) filterIds.push(device.agentId);
            if (device.name) filterIds.push(device.name);
            
            if (filterIds.length === 0) return { in: 0, out: 0, speed: 0 };

            const deviceFilter = filterIds.map(id => `r["device"] == "${id}" or r["device_id"] == "${id}"`).join(" or ");
            
            // Build interface filters based on available information
            const ifaceFilterIds = new Set<string>([input.portName]);
            if (iface?.index != null) ifaceFilterIds.add(iface.index.toString());
            if (iface?.description) ifaceFilterIds.add(iface.description);
            if (iface?.name) ifaceFilterIds.add(iface.name);

            const ifaceFilter = Array.from(ifaceFilterIds)
                .map(id => `r["interface"] == "${id}" or r["interface_index"] == "${id}"`)
                .join(" or ");

            // Use 5m window — ensuring stability for both 5s and 60s polling
            const query = `
                from(bucket: "${influxDB.bucket}")
                  |> range(start: -5m)
                  |> filter(fn: (r) => r["_measurement"] == "interface_traffic")
                  |> filter(fn: (r) => ${deviceFilter})
                  |> filter(fn: (r) => ${ifaceFilter})
                  |> filter(fn: (r) => r["_field"] == "ifInOctets" or r["_field"] == "ifOutOctets" or r["_field"] == "in_bytes" or r["_field"] == "out_bytes")
                  |> sort(columns: ["_time"])
                  |> derivative(unit: 1s, nonNegative: true)
                  |> last()
            `;

            try {
                const result = await influxDB.queryRows(query) as any[];
                let bytesIn = 0;
                let bytesOut = 0;
                for (const row of result) {
                    if (row._field === 'ifInOctets' || row._field === 'in_bytes') bytesIn = row._value;
                    if (row._field === 'ifOutOctets' || row._field === 'out_bytes') bytesOut = row._value;
                }
                
                const speed = iface?.speed ? Number(iface.speed) : 0;

                return { in: bytesIn, out: bytesOut, speed };
            } catch (e) {
                console.error('Error fetching bandwidth for port', e);
                return { in: 0, out: 0, speed: 0 };
            }
        }),

    getDeviceInterfaces: protectedProcedure
        .input(z.object({ deviceId: z.string() }))
        .query(async ({ input }) => {
            const device = await prisma.device.findUnique({
                where: { id: input.deviceId },
                select: { ipAddress: true, agentId: true, id: true, name: true }
            });

            if (!device) return [];

            // 1. Get from database (NetworkInterface table)
            const dbInterfaces = await prisma.networkInterface.findMany({
                where: { deviceId: input.deviceId },
                orderBy: { name: 'asc' }
            });

            // 2. Discover from InfluxDB (active traffic)
            const filterIds = [device.ipAddress];
            if (device.agentId) filterIds.push(device.agentId);
            if (device.name) filterIds.push(device.name);
            const filterClause = filterIds.map(id => `r["device"] == "${id}" or r["device_id"] == "${id}"`).join(" or ");

            const query = `
                from(bucket: "${influxDB.bucket}")
                  |> range(start: -1h)
                  |> filter(fn: (r) => r["_measurement"] == "interface_traffic")
                  |> filter(fn: (r) => ${filterClause})
                  |> filter(fn: (r) => r["_field"] == "in_bytes" or r["_field"] == "ifInOctets")
                  |> group(columns: ["interface", "interface_index"])
                  |> last()
            `;

            const agentInterfaces: any[] = [];
            try {
                const rows = await influxDB.queryRows(query) as any[];
                for (const row of rows) {
                    const idx = row.interface || row.interface_index;
                    if (idx && !dbInterfaces.some(db => db.name === idx || db.index?.toString() === idx)) {
                        agentInterfaces.push({
                            id: `agent-${idx}`,
                            deviceId: device.id,
                            index: parseInt(idx) || 0,
                            name: idx,
                            description: `Descoberto via Agente/Monitoramento`,
                            status: 'up'
                        });
                    }
                }
            } catch (e) {
                console.error('Error discovering agent interfaces', e);
            }

            return serializeBigInt([...dbInterfaces, ...agentInterfaces]);
        }),

    enterMap: protectedProcedure
        .input(z.object({ mapId: z.string() }))
        .mutation(async ({ input }) => {
            const map = await prisma.customMap.findUnique({
                where: { id: input.mapId },
                include: {
                    nodes: true,
                    edges: true
                }
            });
            if (!map) throw new TRPCError({ code: 'NOT_FOUND', message: 'Mapa não encontrado' });

            const portsByDevice: Record<string, Set<string>> = {};
            
            // Collect ports from nodes
            map.nodes.forEach(n => {
                if (n.selectedPort && n.deviceId) {
                    if (!portsByDevice[n.deviceId]) portsByDevice[n.deviceId] = new Set();
                    portsByDevice[n.deviceId].add(n.selectedPort);
                }
            });

            // Collect ports from edges
            map.edges.forEach(e => {
                const source = map.nodes.find(n => n.id === e.sourceId);
                const target = map.nodes.find(n => n.id === e.targetId);
                
                if (e.sourcePort && source?.deviceId) {
                    if (!portsByDevice[source.deviceId]) portsByDevice[source.deviceId] = new Set();
                    portsByDevice[source.deviceId].add(e.sourcePort);
                }
                if (e.targetPort && target?.deviceId) {
                    if (!portsByDevice[target.deviceId]) portsByDevice[target.deviceId] = new Set();
                    portsByDevice[target.deviceId].add(e.targetPort);
                }
            });

            // Update autoEnabled for all identified ports
            for (const [deviceId, ports] of Object.entries(portsByDevice)) {
                for (const port of Array.from(ports)) {
                    const iface = await resolveInterface(deviceId, port);
                    if (iface) {
                        await prisma.networkInterface.update({
                            where: { id: iface.id },
                            data: { autoEnabled: true }
                        });
                    }
                }
            }

            await syncMonitoredDevices();
            return { success: true };
        }),

    leaveMap: protectedProcedure
        .input(z.object({ mapId: z.string() }))
        .mutation(async ({ input }) => {
            const map = await prisma.customMap.findUnique({
                where: { id: input.mapId },
                include: {
                    nodes: true,
                    edges: true
                }
            });
            if (!map) return { success: false };

            const portsByDevice: Record<string, Set<string>> = {};
            map.nodes.forEach(n => {
                if (n.selectedPort && n.deviceId) {
                    if (!portsByDevice[n.deviceId]) portsByDevice[n.deviceId] = new Set();
                    portsByDevice[n.deviceId].add(n.selectedPort);
                }
            });
            map.edges.forEach(e => {
                const source = map.nodes.find(n => n.id === e.sourceId);
                const target = map.nodes.find(n => n.id === e.targetId);
                if (e.sourcePort && source?.deviceId) {
                    if (!portsByDevice[source.deviceId]) portsByDevice[source.deviceId] = new Set();
                    portsByDevice[source.deviceId].add(e.sourcePort);
                }
                if (e.targetPort && target?.deviceId) {
                    if (!portsByDevice[target.deviceId]) portsByDevice[target.deviceId] = new Set();
                    portsByDevice[target.deviceId].add(e.targetPort);
                }
            });

            for (const [deviceId, ports] of Object.entries(portsByDevice)) {
                for (const port of Array.from(ports)) {
                    const iface = await resolveInterface(deviceId, port);
                    if (iface) {
                        await prisma.networkInterface.update({
                            where: { id: iface.id },
                            data: { autoEnabled: false }
                        });
                    }
                }
            }

            await syncMonitoredDevices();
            return { success: true };
        }),
});
