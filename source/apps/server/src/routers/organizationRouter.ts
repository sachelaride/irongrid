/**
 * Router de Estrutura Organizacional e Atribuição
 * 
 * Gerencia a hierarquia de locais (unidades), departamentos e a associação
 * de dispositivos e usuários a estes níveis organizacionais.
 * 
 * Funcionalidades:
 * - Gestão de Departamentos (CRUD)
 * - Gestão de Localizações/Unidades (CRUD)
 * - Atribuição de dispositivos a responsáveis técnicos e locais
 * - Listagem de ativos por centro de custo/departamento
 * 
 * @module routers/organizationRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { TRPCError } from '@trpc/server';

export const organizationRouter = router({
    // --- Departments (Departamentos) ---

    /**
     * List Departments - Listar Departamentos
     * 
     * Retorna todos os departamentos cadastrados, incluindo a contagem
     * de dispositivos vinculados e o nome da localização pai.
     * 
     * @procedure query
     */
    listDepartments: protectedProcedure.query(async () => {
        return prisma.department.findMany({
            include: {
                _count: { select: { devices: true } },
                location: { select: { name: true } }
            }
        });
    }),

    /**
     * Get Department - Detalhes do Departamento
     * 
     * Retorna informações detalhadas de um departamento, incluindo
     * a lista de dispositivos e usuários pertencentes.
     * 
     * @procedure query
     */
    getDepartment: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            return prisma.department.findUnique({
                where: { id: input.id },
                include: {
                    _count: { select: { devices: true, users: true } },
                    location: true,
                    devices: {
                        select: { id: true, name: true, ipAddress: true, status: true }
                    }
                }
            });
        }),

    /**
     * Create Department - Criar Novo Departamento
     * 
     * @procedure mutation
     */
    createDepartment: protectedProcedure
        .input(z.object({
            name: z.string(),
            description: z.string().optional(),
            locationId: z.string().optional()
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem criar departamentos' });
            }
            return prisma.department.create({ data: input });
        }),

    /**
     * Delete Department - Remover Departamento
     * 
     * @procedure mutation
     */
    deleteDepartment: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem deletar departamentos' });
            }
            return prisma.department.delete({ where: { id: input.id } });
        }),

    /**
     * Update Department - Atualizar Dados do Departamento
     * 
     * @procedure mutation
     */
    updateDepartment: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            description: z.string().optional(),
            locationId: z.string().optional()
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem atualizar departamentos' });
            }
            const { id, ...data } = input;
            return prisma.department.update({ where: { id }, data });
        }),

    // --- Locations (Localizações / Unidades) ---

    /**
     * List Locations - Listar Localizações
     * 
     * Retorna todas as unidades físicas da organização.
     * 
     * @procedure query
     */
    listLocations: protectedProcedure.query(async () => {
        return prisma.location.findMany({
            include: {
                _count: { select: { devices: true } },
                departments: { select: { id: true, name: true } }
            }
        });
    }),

    /**
     * Get Location - Detalhes da Localização
     * 
     * @procedure query
     */
    getLocation: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            return prisma.location.findUnique({
                where: { id: input.id },
                include: {
                    _count: { select: { devices: true, departments: true } },
                    departments: true,
                    devices: {
                        select: { id: true, name: true, ipAddress: true, status: true }
                    }
                }
            });
        }),

    /**
     * Create Location - Criar Unidade/Filial
     * 
     * @procedure mutation
     */
    createLocation: protectedProcedure
        .input(z.object({
            name: z.string(),
            description: z.string().optional(),
            address: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem criar localizações' });
            }
            return prisma.location.create({ data: input });
        }),

    /**
     * Delete Location - Remover Unidade
     * 
     * @procedure mutation
     */
    deleteLocation: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem deletar localizações' });
            }
            return prisma.location.delete({ where: { id: input.id } });
        }),

    /**
     * Update Location - Atualizar Localização
     * 
     * @procedure mutation
     */
    updateLocation: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            description: z.string().optional(),
            address: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem atualizar localizações' });
            }
            const { id, ...data } = input;
            return prisma.location.update({ where: { id }, data });
        }),

    // --- Assignments (Vínculos e Atribuições) ---

    /**
     * Assign Device - Vincular Ativo a Contexto
     * 
     * Atalho para associar um dispositivo a um departamento, local ou usuário.
     * 
     * @procedure mutation
     */
    assignDevice: protectedProcedure
        .input(z.object({
            deviceId: z.string(),
            departmentId: z.string().nullable().optional(),
            locationId: z.string().nullable().optional(),
            userId: z.string().nullable().optional(),
            type: z.string().nullable().optional(),
        }))
        .mutation(async ({ input }) => {
            const { deviceId, ...data } = input;
            const validTypes = ['SERVER', 'ROUTER', 'SWITCH', 'FIREWALL', 'GATEWAY', 'VOIP', 'NAS', 'CAMERA', 'ACCESS_POINT', 'DATABASE', 'PRINTER', 'WORKSTATION', 'OTHER'];
            const finalType = (data.type && validTypes.includes(data.type.toUpperCase())) ? data.type.toUpperCase() : 'OTHER';

            return prisma.device.update({
                where: { id: deviceId },
                data: {
                    departmentId: data.departmentId === "" ? null : data.departmentId,
                    locationId: data.locationId === "" ? null : data.locationId,
                    userId: data.userId === "" ? null : data.userId,
                    type: finalType as any,
                }
            });
        }),

    /**
     * Create Device - Criar Dispositivo Manualmente
     * 
     * Permite o cadastro manual de ativos que não foram descobertos via scan.
     * 
     * @procedure mutation
     */
    createDevice: protectedProcedure
        .input(z.object({
            name: z.string(),
            ipAddress: z.string(),
            type: z.enum(['SERVER', 'ROUTER', 'SWITCH', 'FIREWALL', 'GATEWAY', 'VOIP', 'NAS', 'CAMERA', 'ACCESS_POINT', 'DATABASE', 'INTERNET', 'PRINTER', 'WORKSTATION', 'OTHER']),
            model: z.string().optional(),
            hostname: z.string().optional(),
            macAddress: z.string().optional(),
            departmentId: z.string().optional(),
            locationId: z.string().optional(),
            userId: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem criar dispositivos' });
            }

            if (input.type !== 'INTERNET') {
                const existingDevice = await prisma.device.findFirst({
                    where: { ipAddress: input.ipAddress }
                });

                if (existingDevice) {
                    return prisma.device.update({
                        where: { id: existingDevice.id },
                        data: input
                    });
                }
            }

            return prisma.device.create({ data: input });
        }),

    /**
     * Update Device - Atualizar Cadastro de Ativo
     * 
     * @procedure mutation
     */
    updateDevice: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            ipAddress: z.string().optional(),
            status: z.enum(['ONLINE', 'OFFLINE', 'WARNING', 'CRITICAL']).optional(),
            type: z.enum(['SERVER', 'ROUTER', 'SWITCH', 'FIREWALL', 'GATEWAY', 'VOIP', 'NAS', 'CAMERA', 'ACCESS_POINT', 'DATABASE', 'INTERNET', 'PRINTER', 'WORKSTATION', 'OTHER']).optional(),
            departmentId: z.string().optional(),
            locationId: z.string().optional(),
            userId: z.string().nullable().optional(),
            parentId: z.string().nullable().optional(),
            purchaseValue: z.number().optional(),
            maintenanceCost: z.number().optional(),
            // Patrimônio
            assetNumber: z.string().optional(),
            supplier: z.string().optional(),
            purchaseDate: z.date().optional(),
            warrantyExpiry: z.date().optional(),
            notes: z.string().optional(),
            // Rede
            portSpeed: z.string().optional(),
            topologyRole: z.string().nullable().optional(),
            voipExtension: z.string().optional(),
            hasWebcam: z.boolean().optional(),
            hasHeadset: z.boolean().optional(),
            macAddress: z.string().optional(),
            hostname: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem atualizar dispositivos' });
            }
            const { id, maintenanceCost, ...data } = input;

            const device = await prisma.device.update({
                where: { id },
                data
            });

            // Se houver custo de manutenção informado, registra no histórico de ordens
            if (maintenanceCost && maintenanceCost > 0) {
                await prisma.maintenanceRecord.create({
                    data: {
                        deviceId: id,
                        title: 'Upgrade / Manutenção Manual',
                        description: 'Custo registrado manualmente via edição de ativo.',
                        type: 'UPGRADE',
                        status: 'COMPLETED',
                        cost: maintenanceCost,
                        scheduledDate: new Date(),
                        completedAt: new Date(),
                        performer: (ctx.user as any)?.name || 'Administrador'
                    }
                });
            }

            return device;
        }),

    /**
     * Delete Device - Remover Ativo do Sistema
     * 
     * @procedure mutation
     */
    deleteDevice: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem deletar dispositivos' });
            }
            return prisma.device.delete({ where: { id: input.id } });
        }),
});
