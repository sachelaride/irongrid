/**
 * Router de Tickets - Sistema ITSM Completo
 * 
 * Gerencia o ciclo de vida completo de tickets/chamados com suporte a:
 * - Cálculo automático de prioridade baseado em impacto e urgência
 * - SLA (Service Level Agreement) com prazos de resposta e resolução
 * - Controle de acesso por departamento
 * - Histórico de atividades e comentários
 * - Integração com alertas e dispositivos
 * - Auditoria completa de ações
 * 
 * Funcionalidades:
 * - CRUD completo de tickets
 * - Gestão de status e workflow
 * - Sistema de comentários
 * - Cálculo automático de SLA
 * - Controle de permissões por role
 * 
 * @module routers/ticketRouter
 * @requires services/slaService - Cálculo de SLA e prioridades
 * @requires services/auditService - Registro de auditoria
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { SLAService } from '../services/slaService';
import { AuditService } from '../services/auditService';
import { NotificationService } from '../services/notificationService';
import { TicketStatus, TicketPriority, TicketImpact, TicketUrgency, TicketCategory, ActivityType } from '@prisma/client';
import { TRPCError } from '@trpc/server';

const slaService = new SLAService();

export const ticketRouter = router({
    /**
     * List - Listar Tickets com Filtros
     * 
     * Retorna lista de tickets com suporte a filtros e paginação.
     * Usuários comuns (USER) veem apenas seus próprios tickets ou
     * tickets de dispositivos do seu departamento.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} [input] - Filtros opcionais
     * @param {string} [input.deviceId] - Filtrar por dispositivo
     * @param {TicketStatus} [input.status] - Filtrar por status
     * @param {number} [input.limit=50] - Limite de resultados
     * @param {number} [input.offset=0] - Offset para paginação
     * @returns {Promise<Ticket[]>} Lista de tickets ordenados por data
     */
    list: protectedProcedure
        .input(z.object({
            deviceId: z.string().optional(),
            status: z.union([z.nativeEnum(TicketStatus), z.literal('COMPLETED')]).optional(),
            departmentId: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            assignedToId: z.string().optional(),
            limit: z.number().default(50),
            offset: z.number().default(0),
        }))
        .query(async ({ input, ctx }) => {
            const { deviceId, status, departmentId, startDate, endDate, assignedToId, limit, offset } = input;

            let whereClause: any = {
                ...(deviceId ? { deviceId } : {}),
                ...(assignedToId ? { assignedToId } : {}),
            };

            if (status) {
                if (status === 'COMPLETED' as any) {
                    whereClause.status = { in: ['RESOLVED', 'CLOSED'] };
                } else {
                    whereClause.status = status;
                }
            }

            if (departmentId) {
                whereClause.device = {
                    departmentId: departmentId
                };
            }

            if (startDate || endDate) {
                whereClause.createdAt = {
                    ...(startDate ? { gte: new Date(startDate) } : {}),
                    ...(endDate ? { lte: new Date(endDate) } : {}),
                };
            }

            // Restrição para usuários comuns
            if (ctx.user?.role === 'USER') {
                whereClause = {
                    ...whereClause,
                    OR: [
                        { requesterId: ctx.user.id }, // Seus próprios chamados
                        { device: { departmentId: ctx.user.departmentId } } // Chamados do seu departamento
                    ]
                };
            }

            return prisma.ticket.findMany({
                where: whereClause,
                take: limit,
                skip: offset,
                orderBy: { createdAt: 'desc' },
                include: {
                    device: {
                        include: {
                            departmentRef: { select: { name: true } }
                        }
                    },
                    serviceType: { select: { name: true } },
                    assignedTo: { select: { name: true, role: true } },
                }
            });
        }),

    /**
     * Get By ID - Buscar Ticket por ID
     * 
     * Retorna detalhes completos de um ticket incluindo:
     * - Dados do dispositivo relacionado
     * - Histórico de atividades
     * - Alerta associado (se houver)
     * 
     * Valida permissões de acesso para usuários comuns.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.id - ID do ticket
     * @returns {Promise<Ticket>} Ticket com relacionamentos
     * @throws {TRPCError} NOT_FOUND - Ticket não encontrado
     * @throws {TRPCError} FORBIDDEN - Sem permissão de acesso
     */
    getById: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            const ticket = await prisma.ticket.findUnique({
                where: { id: input.id },
                select: {
                    id: true,
                    ticketNumber: true,
                    title: true,
                    description: true,
                    status: true,
                    priority: true,
                    category: true,
                    createdAt: true,
                    slaDeadline: true,
                    slaPaused: true,
                    assignedToId: true, // Para verificar "sem atendimento"
                    requesterId: true, // Necessário para validação de acesso
                    device: {
                        select: { name: true, departmentId: true } // departmentId necessário para validação
                    },
                    serviceType: {
                        select: { name: true }
                    },
                    requester: {
                        select: { name: true }
                    },
                    activities: { orderBy: { createdAt: 'asc' } },
                    alert: true,
                    customValues: {
                        include: {
                            field: true
                        }
                    },
                }
            });

            if (!ticket) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Chamado não encontrado.' });
            }

            // Validar acesso se for USER
            if (ctx.user?.role === 'USER') {
                const isRequester = ticket.requesterId === ctx.user.id;
                const isSameDepartment = ticket.device?.departmentId === ctx.user.departmentId;

                if (!isRequester && !isSameDepartment) {
                    throw new TRPCError({ code: 'FORBIDDEN', message: 'Você não tem permissão para acessar este chamado.' });
                }
            }

            return ticket;
        }),

    /**
     * Create - Criar Novo Ticket
     * 
     * Cria um novo ticket com cálculo automático de:
     * - Prioridade (baseado em impacto + urgência)
     * - Prazo de SLA para resposta
     * - Prazo de SLA para resolução
     * 
     * Valida permissões de departamento para usuários comuns.
     * Registra atividade inicial e log de auditoria.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.title - Título do ticket
     * @param {string} [input.description] - Descrição detalhada
     * @param {TicketImpact} input.impact - Impacto (LOW, MEDIUM, HIGH)
     * @param {TicketUrgency} input.urgency - Urgência (LOW, MEDIUM, HIGH)
     * @param {TicketCategory} input.category - Categoria (INCIDENT, REQUEST, PROBLEM, CHANGE)
     * @param {string} [input.deviceId] - ID do dispositivo relacionado
     * @param {string} [input.alertId] - ID do alerta relacionado
     * @returns {Promise<Ticket>} Ticket criado
     * @throws {TRPCError} FORBIDDEN - Dispositivo não pertence ao departamento do usuário
     * 
     * @example
     * const ticket = await trpc.tickets.create.mutate({
     *   title: 'Servidor Web Offline',
     *   description: 'Servidor não responde a requisições HTTP',
     *   impact: 'HIGH',
     *   urgency: 'HIGH',
     *   category: 'INCIDENT',
     *   deviceId: 'device-123'
     * });
     */
    create: protectedProcedure
        .input(z.object({
            title: z.string(),
            description: z.string().optional(),
            impact: z.nativeEnum(TicketImpact).optional(),
            urgency: z.nativeEnum(TicketUrgency).optional(),
            category: z.nativeEnum(TicketCategory),
            deviceId: z.string().optional(),
            alertId: z.string().optional(),
            serviceTypeId: z.string().optional(),
            customFields: z.array(z.object({
                fieldId: z.string(),
                value: z.string()
            })).optional()
        }))
        .mutation(async ({ input, ctx }) => {
            // Validar departamento se for USER e dispositivo informado
            if (ctx.user?.role === 'USER' && input.deviceId) {
                const device = await prisma.device.findUnique({
                    where: { id: input.deviceId },
                    select: { departmentId: true }
                });

                if (!device || device.departmentId !== ctx.user.departmentId) {
                    throw new TRPCError({
                        code: 'FORBIDDEN',
                        message: 'Você só pode abrir chamados para dispositivos vinculados ao seu departamento.'
                    });
                }
            }

            let priority: TicketPriority = TicketPriority.MEDIUM;

            if (input.serviceTypeId) {
                const st = await prisma.serviceType.findUnique({
                    where: { id: input.serviceTypeId }
                });
                if (st) {
                    priority = st.priority;
                }
            } else if (input.impact && input.urgency) {
                priority = SLAService.calculatePriority(input.impact, input.urgency);
            }

            const slaDeadline = await slaService.calculateDeadline(priority, 'RESOLUTION', input.serviceTypeId);
            const slaResponse = await slaService.calculateDeadline(priority, 'RESPONSE', input.serviceTypeId);

            const { deviceId, serviceTypeId, customFields, ...rest } = input;
            const normalizedDeviceId = deviceId && deviceId !== '' ? deviceId : null;
            const normalizedServiceTypeId = serviceTypeId && serviceTypeId !== '' ? serviceTypeId : null;

            const ticket = await (prisma as any).ticket.create({
                data: {
                    ...rest,
                    deviceId: normalizedDeviceId,
                    serviceTypeId: normalizedServiceTypeId,
                    impact: input.impact || TicketImpact.MEDIUM,
                    urgency: input.urgency || TicketUrgency.MEDIUM,
                    priority,
                    slaDeadline,
                    slaResponseTime: slaResponse,
                    requesterId: ctx.user.id,
                    activities: {
                        create: {
                            message: 'Ticket aberto via portal IronGrid',
                            type: ActivityType.COMMENT,
                            userId: ctx.user.id
                        }
                    },
                    customValues: customFields ? {
                        create: customFields.map(cf => ({
                            fieldId: cf.fieldId,
                            value: cf.value
                        }))
                    } : undefined
                }
            });

            // Log de auditoria para criação
            await AuditService.log({
                action: 'CREATE_TICKET',
                resource: 'Ticket',
                resourceId: ticket.id,
                details: { title: ticket.title, priority }
            });

            // Notificar atendentes
            NotificationService.notifyTicketOpened(ticket).catch(console.error);

            return ticket;
        }),

    /**
     * Update Status - Atualizar Status do Ticket
     * 
     * Atualiza o status de um ticket e registra a mudança no histórico.
     * Atualiza automaticamente timestamps de resolução/fechamento.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.id - ID do ticket
     * @param {TicketStatus} input.status - Novo status
     * @param {string} [input.comment] - Comentário sobre a mudança
     * @returns {Promise<Ticket>} Ticket atualizado
     */
    updateStatus: protectedProcedure
        .input(z.object({
            id: z.string(),
            status: z.nativeEnum(TicketStatus),
            comment: z.string().optional(),
            cost: z.number().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const updateData: any = { status: input.status };

            if (input.status === 'RESOLVED') updateData.resolvedAt = new Date();
            if (input.status === 'CLOSED') updateData.closedAt = new Date();

            const ticket = await prisma.ticket.update({
                where: { id: input.id },
                data: {
                    ...updateData,
                    activities: {
                        create: {
                            message: input.comment || `Status alterado para ${input.status}${input.cost ? ` (Custo: R$ ${input.cost.toFixed(2)})` : ''}`,
                            type: ActivityType.STATUS_CHANGE,
                            userId: ctx.user.id
                        }
                    }
                },
                include: {
                    device: true
                }
            });

            // Se houver custo e um dispositivo vinculado, registra na manutenção do ativo
            if (input.cost && input.cost > 0 && ticket.deviceId) {
                await prisma.maintenanceRecord.create({
                    data: {
                        deviceId: ticket.deviceId,
                        title: `Chamado #${ticket.ticketNumber} - ${ticket.title}`,
                        description: `Custo de mão de obra/serviço registrado via Helpdesk.\nComentário: ${input.comment || 'N/A'}`,
                        type: 'CORRECTIVE',
                        status: 'COMPLETED',
                        cost: input.cost,
                        scheduledDate: new Date(),
                        completedAt: new Date(),
                        performer: (ctx.user as any)?.name || 'Técnico IronGrid'
                    }
                });
            }

            // Log de auditoria para mudança de status
            await AuditService.log({
                action: 'UPDATE_TICKET_STATUS',
                resource: 'Ticket',
                resourceId: input.id,
                details: { status: input.status }
            });

            // Notificar solicitante se resolvido
            if (input.status === 'RESOLVED') {
                NotificationService.notifyTicketResolved(input.id).catch(console.error);
            }

            return ticket;
        }),

    /**
     * Assign - Atribuir Técnico ao Chamado
     * 
     * Permite que um administrador defina ou troque o técnico responsável.
     * Registra o evento no histórico de atividades.
     */
    assign: protectedProcedure
        .input(z.object({
            id: z.string(),
            userId: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const ticket = await prisma.ticket.findUnique({
                where: { id: input.id },
                select: { assignedToId: true, assignedAt: true }
            });

            if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Chamado não encontrado.' });

            // Se já tem técnico, apenas ADMIN pode trocar
            if (ticket.assignedToId && ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Apenas administradores podem trocar o técnico de um chamado já atribuído.'
                });
            }

            // Se não tem técnico, qualquer um (não USER) pode atribuir
            if (!ticket.assignedToId && ctx.user?.role === 'USER') {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Usuários não podem realizar atribuições.'
                });
            }

            const user = await prisma.user.findUnique({
                where: { id: input.userId },
                select: { name: true }
            });

            if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Técnico não encontrado.' });

            return prisma.ticket.update({
                where: { id: input.id },
                data: {
                    assignedToId: input.userId,
                    assignedAt: ticket.assignedAt || new Date(),
                    status: 'IN_PROGRESS', // Move para atendimento se já não estiver
                    activities: {
                        create: {
                            message: `Chamado atribuído a @${user.name} por @${(ctx.user as any)?.name || 'Sistema'}.`,
                            type: ActivityType.COMMENT,
                            userId: ctx.user.id
                        }
                    }
                }
            });
        }),

    /**
     * Add Comment - Adicionar Comentário
     * 
     * Adiciona um comentário manual ao histórico do ticket.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.ticketId - ID do ticket
     * @param {string} input.message - Mensagem do comentário
     * @returns {Promise<TicketActivity>} Atividade criada
     */
    addComment: protectedProcedure
        .input(z.object({
            ticketId: z.string(),
            message: z.string(),
            isTechnical: z.boolean().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            return prisma.ticketActivity.create({
                data: {
                    ticketId: input.ticketId,
                    message: input.message,
                    type: input.isTechnical ? ActivityType.TECHNICAL_NOTE : ActivityType.COMMENT,
                    userId: ctx.user.id
                }
            });
        }),

    /**
     * Seed SLA - Inicializar Configurações de SLA
     * 
     * Cria configurações padrão de SLA para todas as prioridades.
     * Útil para setup inicial do sistema.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @returns {Promise<{success: boolean}>}
     */
    seedSLA: protectedProcedure.mutation(async () => {
        await slaService.seedDefaults();
        return { success: true };
    }),

    /**
     * Rate Ticket - Avaliar Atendimento
     */
    rateTicket: protectedProcedure
        .input(z.object({
            id: z.string(),
            rating: z.number().min(1).max(5),
            comment: z.string().optional()
        }))
        .mutation(async ({ input, ctx }) => {
            const ticket = await prisma.ticket.findUnique({ where: { id: input.id } });
            if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Chamado não encontrado' });

            // Apenas o solicitante pode avaliar
            if (ticket.requesterId !== ctx.user.id && ctx.user.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas o solicitante pode avaliar este chamado' });
            }

            return prisma.ticket.update({
                where: { id: input.id },
                data: {
                    rating: input.rating,
                    ratingComment: input.comment,
                    status: 'CLOSED', // Fecha automaticamente ao avaliar
                    closedAt: new Date(),
                    activities: {
                        create: {
                            message: `Chamado avaliado com nota ${input.rating}. Comentário: ${input.comment || 'N/A'}`,
                            type: ActivityType.COMMENT,
                            userId: ctx.user.id
                        }
                    }
                }
            });
        }) as any,

    /**
     * List SLA - Listar Configurações de SLA
     */
    listSLA: protectedProcedure.query(async () => {
        const configs = await prisma.sLAConfiguration.findMany({
            orderBy: { priority: 'desc' }
        });

        // Se estiver vazio, gera os padrões
        if (configs.length === 0) {
            await slaService.seedDefaults();
            return prisma.sLAConfiguration.findMany({
                orderBy: { priority: 'desc' }
            });
        }

        return configs;
    }),

    /**
     * Update SLA - Atualizar Prazos de SLA
     */
    updateSLA: protectedProcedure
        .input(z.object({
            id: z.string(),
            responseTimeMinutes: z.number().min(1),
            resolutionTimeMinutes: z.number().min(1),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem alterar o SLA' });
            }

            const config = await prisma.sLAConfiguration.update({
                where: { id: input.id },
                data: {
                    responseTimeMinutes: input.responseTimeMinutes,
                    resolutionTimeMinutes: input.resolutionTimeMinutes,
                }
            });

            await AuditService.log({
                action: 'UPDATE_SLA',
                resource: 'SLAConfiguration',
                resourceId: config.id,
                details: {
                    priority: config.priority,
                    response: config.responseTimeMinutes,
                    resolution: config.resolutionTimeMinutes
                }
            });

            return config;
        }),

    /**
     * Dashboard de SLA - Métricas e Gráficos
     * 
     * Retorna indicadores de performance (KPIs) relacionados ao SLA:
     * - Percentual de conformidade (Compliance)
     * - Tempo médio de resolução por prioridade
     * - Volume de chamados por Torre (Service Group)
     * - Status dos SLAs (Dentro do prazo vs Atrasados)
     */
    getSLADashboard: protectedProcedure
        .input(z.object({
            startDate: z.string().optional(), // ISO string
            endDate: z.string().optional(),   // ISO string
        }))
        .query(async ({ input }) => {
            const dateFilter: any = {};
            if (input.startDate || input.endDate) {
                dateFilter.createdAt = {
                    ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
                    ...(input.endDate ? { lte: new Date(input.endDate) } : {}),
                };
            }

            const tickets = await prisma.ticket.findMany({
                where: {
                    ...dateFilter,
                    status: { not: 'CLOSED' }
                },
                include: {
                    serviceType: { include: { group: true } },
                    device: { include: { departmentRef: true } },
                    assignedTo: { select: { name: true } }
                }
            });

            const resolvedTickets = await prisma.ticket.findMany({
                where: {
                    ...dateFilter,
                    status: { in: ['RESOLVED', 'CLOSED'] },
                    resolvedAt: { not: null }
                },
                include: {
                    serviceType: { include: { group: true } },
                    device: { include: { departmentRef: true } },
                    assignedTo: { select: { name: true } }
                }
            });

            // 1. Conformidade Geral (SLA Meta)
            const totalResolved = resolvedTickets.length;
            const onTime = resolvedTickets.filter(t => t.resolvedAt && t.slaDeadline && t.resolvedAt <= t.slaDeadline).length;
            const complianceRate = totalResolved > 0 ? (onTime / totalResolved) * 100 : 100;

            // 2. Volume por Torre (Service Group)
            const volumeByGroup = resolvedTickets.concat(tickets).reduce((acc: any, t) => {
                const groupName = t.serviceType?.group?.name || 'Sem Torre';
                acc[groupName] = (acc[groupName] || 0) + 1;
                return acc;
            }, {});

            // 3. Tempo Médio de Resolução (MTTR) por Prioridade (em horas)
            const mttrByPriority = resolvedTickets.reduce((acc: any, t) => {
                if (t.resolvedAt && t.createdAt) {
                    const diffHours = (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
                    if (!acc[t.priority]) acc[t.priority] = { total: 0, count: 0 };
                    acc[t.priority].total += diffHours;
                    acc[t.priority].count += 1;
                }
                return acc;
            }, {});

            // MTTR por Departamento
            const complianceByDept = resolvedTickets.reduce((acc: any, t) => {
                const deptName = (t.device as any)?.departmentRef?.name || 'Sem Departamento';
                if (!acc[deptName]) acc[deptName] = { total: 0, onTime: 0 };
                acc[deptName].total += 1;
                if (t.resolvedAt && t.slaDeadline && t.resolvedAt <= t.slaDeadline) {
                    acc[deptName].onTime += 1;
                }
                return acc;
            }, {});

            // Compliance por Atendente (AssignedTo)
            const complianceByAttendant = resolvedTickets.reduce((acc: any, t) => {
                const attendantName = t.assignedTo?.name || 'Sem Atendente';
                if (!acc[attendantName]) acc[attendantName] = { total: 0, onTime: 0 };
                acc[attendantName].total += 1;
                if (t.resolvedAt && t.slaDeadline && t.resolvedAt <= t.slaDeadline) {
                    acc[attendantName].onTime += 1;
                }
                return acc;
            }, {});

            // Análise de Atraso (Overdue) - Tempo médio de atraso em horas
            const overdueTickets = resolvedTickets.filter(t => t.resolvedAt && t.slaDeadline && t.resolvedAt > t.slaDeadline);
            const avgDelayHours = overdueTickets.length > 0
                ? overdueTickets.reduce((sum, t) => sum + ((t.resolvedAt!.getTime() - t.slaDeadline!.getTime()) / (1000 * 60 * 60)), 0) / overdueTickets.length
                : 0;

            const mttrData = Object.entries(mttrByPriority).map(([priority, data]: [string, any]) => ({
                priority,
                hours: Math.round((data.total / data.count) * 10) / 10
            }));

            // 4. Status atual dos SLAs (Tickets Abertos)
            const now = new Date();
            const openSLAStatus = tickets.reduce((acc: any, t) => {
                const isOverdue = t.slaDeadline && t.slaDeadline < now;
                const status = isOverdue ? 'Atrasado' : 'No Prazo';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {});

            return {
                complianceRate: Math.round(complianceRate),
                totalResolved,
                onTime,
                overdue: totalResolved - onTime,
                avgDelayHours: Math.round(avgDelayHours * 10) / 10,
                volumeByGroup: Object.entries(volumeByGroup).map(([name, value]) => ({ name, value })),
                mttrByPriority: mttrData,
                complianceByDept: Object.entries(complianceByDept).map(([name, data]: [string, any]) => ({
                    name,
                    rate: Math.round((data.onTime / data.total) * 100),
                    total: data.total
                })),
                complianceByAttendant: Object.entries(complianceByAttendant).map(([name, data]: [string, any]) => ({
                    name,
                    rate: Math.round((data.onTime / data.total) * 100),
                    total: data.total
                })),
                openSLAStatus: Object.entries(openSLAStatus).map(([name, value]) => ({ name, value })),
                totalOpen: tickets.length
            };
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem excluir chamados.' });
            }

            try {
                // deleteMany não lança erro se o registro não existir
                await prisma.ticket.deleteMany({
                    where: { id: input.id }
                });

                // Log de auditoria
                await AuditService.log({
                    action: 'DELETE_TICKET',
                    resource: 'Ticket',
                    resourceId: input.id,
                    userId: ctx.user.id,
                    details: { id: input.id }
                });

                return { success: true };
            } catch (error: any) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Erro ao excluir ticket: ${error.message}`
                });
            }
        }),

    extendSLA: protectedProcedure
        .input(z.object({
            id: z.string(),
            newDeadline: z.string(), // ISO String
            justification: z.string()
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem expandir o SLA.' });
            }

            const ticket = await prisma.ticket.update({
                where: { id: input.id },
                data: {
                    slaDeadline: new Date(input.newDeadline),
                    slaExtensionJustification: input.justification,
                    activities: {
                        create: {
                            type: ActivityType.COMMENT,
                            message: `SLA estendido pelo administrador. Justificativa: ${input.justification}`,
                            userId: ctx.user.id
                        }
                    }
                }
            });

            return ticket;
        }),

    togglePause: protectedProcedure
        .input(z.object({
            id: z.string(),
            justification: z.string()
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem pausar o clock do SLA.' });
            }

            const ticket = await prisma.ticket.findUnique({
                where: { id: input.id }
            });

            if (!ticket) throw new TRPCError({ code: 'NOT_FOUND' });

            if (ticket.slaPaused) {
                // Despausar
                const pausedAt = ticket.slaPausedAt;
                let newDeadline = ticket.slaDeadline;

                if (pausedAt && newDeadline) {
                    const pauseDuration = new Date().getTime() - pausedAt.getTime();
                    newDeadline = new Date(newDeadline.getTime() + pauseDuration);
                }

                return await prisma.ticket.update({
                    where: { id: input.id },
                    data: {
                        slaPaused: false,
                        slaPausedAt: null,
                        slaDeadline: newDeadline,
                        slaPauseJustification: input.justification,
                        activities: {
                            create: {
                                type: ActivityType.COMMENT,
                                message: `SLA retomado pelo administrador. Justificativa: ${input.justification}`,
                                userId: ctx.user.id
                            }
                        }
                    }
                });
            } else {
                // Pausar
                return await prisma.ticket.update({
                    where: { id: input.id },
                    data: {
                        slaPaused: true,
                        slaPausedAt: new Date(),
                        slaPauseJustification: input.justification,
                        activities: {
                            create: {
                                type: ActivityType.COMMENT,
                                message: `SLA pausado pelo administrador. Justificativa: ${input.justification}`,
                                userId: ctx.user.id
                            }
                        }
                    }
                });
            }
        })
});
