/**
 * Router de Geração de Relatórios (PDF/BI)
 * 
 * Responsável por consolidar dados técnicos e de inventário em documentos formatados (PDF).
 * Utiliza o pdfkit para geração dinâmica de relatórios de infraestrutura.
 * 
 * Funcionalidades:
 * - Relatórios de disponibilidade e performance de ativos
 * - Relatórios detalhados de inventário (Software, Hardware, Periféricos)
 * - Consolidação de dados por departamento e unidade
 * 
 * @module routers/reportRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { influxDB } from '../services/influxdb';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

export const reportRouter = router({
    /**
     * Generate Device Report - Relatório de Ativos e Disponibilidade
     * 
     * Gera um PDF com a lista de dispositivos monitorados, seus status,
     * IPs e latência média.
     * 
     * @procedure mutation
     * @param {Object} input
     * @param {string} [input.deviceId] - Dispositivo específico (se omitido, lista ativos ONLINE)
     * @param {string} [input.timeRange] - Janela temporal para métricas
     * @returns {Promise<Object>} Base64 do PDF gerado
     */
    generateDeviceReport: protectedProcedure
        .input(z.object({
            deviceId: z.string().optional(),
            timeRange: z.enum(['1h', '24h', '7d']).default('1h')
        }))
        .mutation(async ({ input }) => {
            const doc = new PDFDocument({ margin: 50 });
            const stream = new PassThrough();
            doc.pipe(stream);
            const chunks: Buffer[] = [];

            stream.on('data', (chunk) => chunks.push(chunk));

            // Header
            doc.fillColor('#1e293b').fontSize(24).text('IronGrid - Network Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).fillColor('#64748b').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown(2);

            // Devices Section
            doc.fontSize(18).fillColor('#0f172a').text('Monitored Devices', { underline: true });
            doc.moveDown();

            const devices = await prisma.device.findMany({
                where: input.deviceId ? { id: input.deviceId } : { status: 'ONLINE' },
                orderBy: { ipAddress: 'asc' }
            });

            devices.forEach((device, index) => {
                const d = device as any;
                doc.fontSize(12).fillColor('#334155').text(`${index + 1}. ${d.name} (${d.ipAddress})`);
                doc.fontSize(10).fillColor('#64748b').text(`   Type: ${d.type} | Status: ${d.status}`);
                doc.fontSize(10).fillColor('#64748b').text(`   Latency: ${d.lastLatency ? d.lastLatency.toFixed(2) + ' ms' : 'N/A'}`);
                doc.moveDown(0.5);
            });

            if (devices.length === 0) {
                doc.fontSize(12).fillColor('#ef4444').text('No active devices found for this report.');
            }

            doc.moveDown();

            doc.end();

            return new Promise<{ base64: string }>((resolve) => {
                stream.on('end', () => {
                    const pdfBuffer = Buffer.concat(chunks);
                    resolve({ base64: pdfBuffer.toString('base64') });
                });
            });
        }),

    /**
     * Generate Inventory PDF - Relatório de Inteligência de Inventário
     * 
     * Gera relatórios formatados em PDF para diferentes categorias de ativos:
     * 1. Software: Lista de instalações por máquina/departamento
     * 2. Hardware: Especificações técnicas (CPU/RAM/Disco) consolidado
     * 3. Periféricos: Inventário de acessórios (monitores, etc)
     * 
     * @procedure mutation
     * @param {Object} input
     * @param {string} input.type - 'software' | 'hardware' | 'peripherals'
     * @param {Object} [input.filters] - Filtros técnicos e organizacionais
     */
    generateInventoryPDF: protectedProcedure
        .input(z.object({
            type: z.enum(['software', 'hardware', 'peripherals', 'explorer']),
            filters: z.object({
                deviceId: z.string().optional(),
                softwareName: z.string().optional(),
                departmentId: z.string().optional(),
                peripheralType: z.string().optional(),
                ramMin: z.number().optional(),
                ramMax: z.number().optional(),
                deviceType: z.string().optional()
            }).optional()
        }))
        .mutation(async ({ input }) => {
            const { type, filters } = input;
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const stream = new PassThrough();
            doc.pipe(stream);
            const chunks: Buffer[] = [];

            stream.on('data', (chunk) => chunks.push(chunk));

            // Header
            doc.fillColor('#0f172a').fontSize(22).text('IronGrid Inventory Intelligence', { align: 'center' });
            doc.fontSize(10).fillColor('#64748b').text(`Tipo de Relatório: ${type.toUpperCase()} | Gerado em: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown(2);

            if (type === 'software') {
                const whereClause: any = {};
                if (filters?.softwareName) whereClause.name = { contains: filters.softwareName, mode: 'insensitive' };
                if (filters?.departmentId) whereClause.device = { departmentId: filters.departmentId };
                if (filters?.deviceId) whereClause.deviceId = filters.deviceId;

                const software = await prisma.software.findMany({
                    where: whereClause,
                    include: { device: { include: { departmentRef: true } } },
                    orderBy: { name: 'asc' }
                });

                doc.fontSize(16).fillColor('#1e293b').text('Relatório de Instalações de Software');
                if (filters?.softwareName) doc.fontSize(10).text(`Filtro: Software contendo "${filters.softwareName}"`);
                doc.moveDown();

                // Table Header with Background
                const tableTop = doc.y;
                doc.rect(50, tableTop, 500, 20).fill('#f1f5f9');
                doc.fillColor('#475569').fontSize(10).font('Helvetica-Bold');
                doc.text('Software', 60, tableTop + 6);
                doc.text('Versão', 210, tableTop + 6);
                doc.text('Dispositivo', 340, tableTop + 6);
                doc.text('Departamento', 460, tableTop + 6);
                doc.moveDown(1.5);

                doc.font('Helvetica').fontSize(9);
                software.forEach(s => {
                    if (doc.y > 750) {
                        doc.addPage();
                        // Redraw header on new page
                        const newTop = doc.y;
                        doc.rect(50, newTop, 500, 20).fill('#f1f5f9');
                        doc.fillColor('#475569').font('Helvetica-Bold').text('Software', 60, newTop + 6);
                        doc.text('Versão', 210, newTop + 6);
                        doc.text('Dispositivo', 340, newTop + 6);
                        doc.text('Departamento', 460, newTop + 6);
                        doc.font('Helvetica').moveDown(1.5);
                    }

                    const rowY = doc.y;
                    doc.fillColor('#334155');
                    doc.text(s.name, 60, rowY, { width: 140 });
                    doc.text(s.version || '-', 210, rowY, { width: 120 });
                    doc.text(s.device.name || s.device.hostname || '-', 340, rowY, { width: 110 });
                    doc.text(s.device.departmentRef?.name || 'Geral', 460, rowY, { width: 90 });

                    doc.moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
                    doc.moveDown(1.2);
                });
            } else if (type === 'hardware') {
                const whereClause: any = {};
                if (filters?.departmentId) whereClause.device = { departmentId: filters.departmentId };
                if (filters?.deviceType) whereClause.device = { ...whereClause.device, type: filters.deviceType };
                if (filters?.deviceId) whereClause.deviceId = filters.deviceId;

                if (filters?.ramMin !== undefined || filters?.ramMax !== undefined) {
                    whereClause.totalMemory = {
                        gte: filters.ramMin !== undefined ? BigInt(filters.ramMin * 1024 * 1024 * 1024) : undefined,
                        lte: filters.ramMax !== undefined ? BigInt(filters.ramMax * 1024 * 1024 * 1024) : undefined,
                    };
                }

                const hardwares = await prisma.hardware.findMany({
                    where: whereClause,
                    include: { device: { include: { departmentRef: true } } }
                });

                doc.fontSize(16).fillColor('#1e293b').text('Inventário de Hardware e Especificações');
                doc.moveDown();

                hardwares.forEach(h => {
                    if (doc.y > 700) doc.addPage();

                    const startY = doc.y;
                    doc.rect(50, startY, 500, 60).strokeColor('#e2e8f0').lineWidth(1).stroke();

                    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(`${h.device.name || h.device.hostname} (${h.device.ipAddress})`, 60, startY + 10);
                    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(`Depto: ${h.device.departmentRef?.name || 'Geral'}`, 60, startY + 25);
                    doc.fillColor('#334155').text(`CPU: ${h.cpuModel || '-'} | RAM: ${h.totalMemory ? (Number(h.totalMemory) / (1024 ** 3)).toFixed(1) + ' GB' : '-'} | Disco: ${h.totalDisk ? (Number(h.totalDisk) / (1024 ** 3)).toFixed(1) + ' GB' : '-'}`, 60, startY + 40);
                    doc.moveDown(5);
                });
            } else if (type === 'explorer') {
                const whereClause: any = {};

                // Aplicar filtros avançados
                if (filters?.deviceType) whereClause.type = filters.deviceType;
                if (filters?.departmentId) whereClause.departmentId = filters.departmentId;

                const hardwareFilter: any = {};
                if (filters?.ramMin !== undefined) {
                    hardwareFilter.totalMemory = { ...hardwareFilter.totalMemory, gte: BigInt(filters.ramMin * 1024 * 1024 * 1024) };
                }
                if (filters?.ramMax !== undefined) {
                    hardwareFilter.totalMemory = { ...hardwareFilter.totalMemory, lte: BigInt(filters.ramMax * 1024 * 1024 * 1024) };
                }
                if (Object.keys(hardwareFilter).length > 0) {
                    whereClause.hardware = hardwareFilter;
                }

                if (filters?.peripheralType) {
                    whereClause.peripherals = {
                        some: {
                            type: { contains: filters.peripheralType, mode: 'insensitive' }
                        }
                    };
                }

                const devices = await prisma.device.findMany({
                    where: whereClause,
                    include: {
                        hardware: true,
                        departmentRef: true,
                        location: true
                    },
                    orderBy: { name: 'asc' }
                });

                doc.fontSize(16).fillColor('#1e293b').text('Relatório de Explorador de Ativos');
                doc.fontSize(10).fillColor('#64748b').text(`Filtros: ${filters?.deviceType || 'Todos'} | Dept: ${filters?.departmentId ? 'Específico' : 'Todos'} | RAM: ${filters?.ramMin || 0}-${filters?.ramMax || 'Inf'} GB`);
                doc.moveDown();

                devices.forEach(d => {
                    if (doc.y > 700) doc.addPage();

                    const startY = doc.y;
                    doc.rect(50, startY, 500, 70).strokeColor('#e2e8f0').lineWidth(1).stroke();

                    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(`${d.name || d.hostname} (${d.ipAddress})`, 60, startY + 10);
                    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(`Tipo: ${d.type} | Local: ${d.location?.name || '-'} / ${d.departmentRef?.name || '-'}`, 60, startY + 25);

                    const ram = d.hardware?.totalMemory ? (Number(d.hardware.totalMemory) / (1024 ** 3)).toFixed(1) + ' GB' : '-';
                    const cpu = d.hardware?.cpuModel || '-';

                    doc.fillColor('#334155').text(`Hardware: ${cpu} | RAM: ${ram}`, 60, startY + 40);
                    doc.fillColor('#475569').fontSize(8).text(`ID: ${d.id}`, 60, startY + 55);

                    doc.moveDown(5.5);
                });

                if (devices.length === 0) {
                    doc.moveDown();
                    doc.fontSize(12).fillColor('#94a3b8').text('Nenhum ativo encontrado para os filtros selecionados.', { align: 'center' });
                }
            } else if (type === 'peripherals') {
                const peripherals = await prisma.peripheral.findMany({
                    include: { device: { include: { departmentRef: true } } },
                    orderBy: { type: 'asc' }
                });

                doc.fontSize(16).fillColor('#1e293b').text('Inventário de Periféricos');
                doc.moveDown();

                // Peripheral Table Header
                const tableTop = doc.y;
                doc.rect(50, tableTop, 500, 20).fill('#f1f5f9');
                doc.fillColor('#475569').font('Helvetica-Bold').fontSize(10);
                doc.text('Tipo', 60, tableTop + 6);
                doc.text('Modelo', 150, tableTop + 6);
                doc.text('Fabricante', 300, tableTop + 6);
                doc.text('Conectado a', 420, tableTop + 6);
                doc.moveDown(1.5);

                doc.font('Helvetica').fontSize(9);
                peripherals.forEach(p => {
                    if (doc.y > 750) doc.addPage();
                    const rowY = doc.y;
                    doc.fillColor('#334155');
                    doc.text(p.type, 60, rowY, { width: 80 });
                    doc.text(p.model || 'N/A', 150, rowY, { width: 140 });
                    doc.text(p.manufacturer || 'OEM', 300, rowY, { width: 110 });
                    doc.text(p.device.name || '-', 420, rowY, { width: 120 });

                    doc.moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
                    doc.moveDown(1.2);
                });
            }

            doc.end();

            return new Promise<{ base64: string }>((resolve) => {
                stream.on('end', () => {
                    const pdfBuffer = Buffer.concat(chunks);
                    resolve({ base64: pdfBuffer.toString('base64') });
                });
            });
        }),

    /**
     * Get Health Indicators - Indicadores de Saúde do Ambiente
     */
    getHealthIndicators: protectedProcedure
        .query(async () => {
            const totalDevices = await prisma.device.count();
            if (totalDevices === 0) return { ramCompliance: 0, backupCompliance: 0, upsCompliance: 0, healthyDevices: 0 };

            const [ramGte8GB, withBackup, withUPS, onlineDevices] = await Promise.all([
                prisma.hardware.count({ where: { totalMemory: { gte: BigInt(8 * 1024 * 1024 * 1024) } } }),
                prisma.device.count({ where: { hasBackup: true } }),
                prisma.device.count({ where: { hasUPS: true } }),
                prisma.device.count({ where: { status: 'ONLINE' } })
            ]);

            return {
                totalDevices,
                ramCompliance: parseFloat(((ramGte8GB / totalDevices) * 100).toFixed(1)),
                backupCompliance: parseFloat(((withBackup / totalDevices) * 100).toFixed(1)),
                upsCompliance: parseFloat(((withUPS / totalDevices) * 100).toFixed(1)),
                onlineRate: parseFloat(((onlineDevices / totalDevices) * 100).toFixed(1)),
                healthyDevices: onlineDevices
            };
        }),

    /**
     * Get Risk Assessment - Avaliação de Risco Institucional
     */
    getRiskAssessment: protectedProcedure
        .query(async () => {
            const devices = await prisma.device.findMany({
                select: {
                    id: true,
                    name: true,
                    ipAddress: true,
                    criticality: true,
                    status: true,
                    hasBackup: true,
                    hasUPS: true
                }
            });

            const risks = devices.map(d => {
                let score = 0;
                if (d.status === 'OFFLINE') score += 40;
                if (!d.hasBackup) score += 30;
                if (!d.hasUPS && d.criticality === 'CRITICAL') score += 20;
                if (d.criticality === 'CRITICAL') score += 10;

                return {
                    ...d,
                    riskScore: score,
                    riskLevel: score > 70 ? 'CRITICAL' : score > 40 ? 'HIGH' : score > 20 ? 'MEDIUM' : 'LOW'
                };
            });

            const criticalRisks = risks.filter(r => r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH');

            return {
                matrix: {
                    critical: risks.filter(r => r.riskLevel === 'CRITICAL').length,
                    high: risks.filter(r => r.riskLevel === 'HIGH').length,
                    medium: risks.filter(r => r.riskLevel === 'MEDIUM').length,
                    low: risks.filter(r => r.riskLevel === 'LOW').length
                },
                criticalDevices: criticalRisks.slice(0, 5)
            };
        }),

    /**
     * Get Financial Report - Inteligência Financeira de Ativos
     */
    getFinancialReport: protectedProcedure
        .query(async () => {
            const devices = await prisma.device.findMany({
                where: { purchaseValue: { not: null } },
                select: {
                    id: true,
                    name: true,
                    purchaseValue: true,
                    purchaseDate: true
                }
            });

            const maintenance = await prisma.maintenanceCost.aggregate({
                _sum: { cost: true }
            });

            const currentYear = new Date().getFullYear();
            let totalAssetValue = 0;
            let totalDepreciatedValue = 0;

            devices.forEach(d => {
                const val = Number(d.purchaseValue || 0);
                totalAssetValue += val;

                if (d.purchaseDate) {
                    const age = currentYear - new Date(d.purchaseDate).getFullYear();
                    const depreciationRate = 0.2; // 20% ao ano
                    const currentVal = Math.max(0, val * (1 - (depreciationRate * age)));
                    totalDepreciatedValue += currentVal;
                } else {
                    totalDepreciatedValue += val;
                }
            });

            return {
                totalInvested: totalAssetValue,
                currentAssetValue: totalDepreciatedValue,
                totalMaintenance: Number(maintenance._sum.cost || 0),
                roi: totalAssetValue > 0 ? (totalDepreciatedValue / totalAssetValue) * 100 : 0
            };
        }),

    /**
     * Get Helpdesk Integration - Impacto de Ativos no Suporte
     */
    getHelpdeskIntegration: protectedProcedure
        .query(async () => {
            const topDevices = await prisma.device.findMany({
                take: 5,
                select: {
                    id: true,
                    name: true,
                    _count: {
                        select: { tickets: true }
                    },
                    maintenanceCosts: {
                        select: { cost: true }
                    }
                },
                orderBy: {
                    tickets: {
                        _count: 'desc'
                    }
                }
            });

            const formatted = topDevices.map(d => ({
                id: d.id,
                name: d.name,
                ticketCount: d._count.tickets,
                totalMaintenanceCost: (d.maintenanceCosts as any[]).reduce((acc: number, curr: any) => acc + Number(curr.cost), 0)
            }));

            return {
                problematicDevices: formatted,
                totalTickets: await prisma.ticket.count()
            };
        }),

    /**
     * Get Energy Report - Sustentabilidade e Consumo
     */
    getEnergyReport: protectedProcedure
        .query(async () => {
            const energyData = await prisma.device.aggregate({
                _sum: { energyConsumption: true },
                _avg: { energyConsumption: true },
                _count: { energyConsumption: true }
            });

            const totalWatts = Number(energyData?._sum?.energyConsumption || 0);
            const kwhMonth = (totalWatts * 24 * 30) / 1000;
            const estimatedCost = kwhMonth * 0.85; // Tarifa média R$ 0,85

            return {
                totalWatts,
                avgWattsPerDevice: Number(energyData?._avg?.energyConsumption || 0),
                estimatedMonthlyKwh: kwhMonth,
                estimatedMonthlyCost: estimatedCost,
                simulatedSavings: estimatedCost * 0.15 // 15% de economia com otimização
            };
        }),

    /**
     * Get Active Alerts - Central de Alertas Estratégicos
     */
    getActiveAlerts: protectedProcedure
        .query(async () => {
            const alerts = await prisma.deviceAlert.findMany({
                where: { resolvedAt: null },
                include: { device: { select: { name: true, ipAddress: true } } },
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            return alerts;
        }),

    /**
     * Get Strategic Dashboard - KPI Overheads
     */
    getStrategicDashboard: protectedProcedure
        .query(async () => {
            const [totalAtivos, onlineAtivos, totalTickets] = await Promise.all([
                prisma.device.count(),
                prisma.device.count({ where: { status: 'ONLINE' } }),
                prisma.ticket.count()
            ]);

            return {
                totalAtivos,
                availability: totalAtivos > 0 ? (onlineAtivos / totalAtivos) * 100 : 0,
                supportLoad: totalTickets,
                lastUpdate: new Date()
            };
        }),

    /**
     * Get Network Visualization - Dados para Mapa de Topologia Estratégico
     */
    getNetworkVisualization: protectedProcedure
        .query(async () => {
            const devices = await prisma.device.findMany({
                select: {
                    id: true,
                    name: true,
                    ipAddress: true,
                    type: true,
                    status: true,
                    parentId: true,
                    connectedPort: true,
                    location: { select: { name: true } },
                    departmentRef: { select: { name: true } }
                }
            });

            return devices;
        }),
 
    /**
     * Get App Usage Report - Relatório de Aplicativos Mais Utilizados
     * 
     * Consolida o tempo de uso das janelas em foco reportadas pelos agentes.
     * Retorna o Top 10 para o período solicitado.
     */
    getAppUsageReport: protectedProcedure
        .input(z.object({
            deviceId: z.string().optional(),
            days: z.number().default(7)
        }))
        .query(async ({ input }) => {
            const dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - input.days);

            const usage = await prisma.activityLog.groupBy({
                by: ['appName'],
                where: {
                    date: { gte: dateThreshold },
                    deviceId: input.deviceId ? input.deviceId : undefined
                },
                _sum: {
                    durationSeconds: true
                },
                orderBy: {
                    _sum: {
                        durationSeconds: 'desc'
                    }
                },
                take: 10
            });

            return usage.map(u => ({
                appName: u.appName,
                totalMinutes: Math.round((u._sum.durationSeconds || 0) / 60)
            }));
        }),
});
