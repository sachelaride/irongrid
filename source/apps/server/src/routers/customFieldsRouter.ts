/**
 * Router de Campos Customizáveis
 * 
 * Gerencia campos personalizados para tickets, permitindo que administradores
 * criem formulários dinâmicos por categoria de ticket. Isso aumenta a flexibilidade
 * do sistema ITSM, permitindo coletar informações específicas para cada tipo de chamado.
 * 
 * Funcionalidades:
 * - CRUD completo de campos customizáveis
 * - Suporte a múltiplos tipos de campo (texto, número, data, select, etc)
 * - Campos específicos por categoria de ticket
 * - Validação de campos obrigatórios
 * - Gerenciamento de valores customizados por ticket
 * 
 * @module routers/customFieldsRouter
 * @requires trpc - Framework tRPC
 * @requires zod - Validação de schemas
 * @requires prisma - ORM para banco de dados
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { TicketCategory, FieldType } from '@prisma/client';

export const customFieldsRouter = router({
    /**
     * List All - Listar Todos os Campos Customizáveis
     * 
     * Retorna todos os campos customizáveis cadastrados, opcionalmente
     * filtrados por categoria de ticket.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} [input] - Filtros opcionais
     * @param {TicketCategory} [input.category] - Filtrar por categoria
     * @param {boolean} [input.enabledOnly=true] - Retornar apenas campos ativos
     * @returns {Promise<CustomField[]>} Lista de campos ordenados por ordem
     */
    listAll: protectedProcedure
        .input(z.object({
            category: z.nativeEnum(TicketCategory).optional(),
            enabledOnly: z.boolean().default(true)
        }).optional())
        .query(async ({ input }) => {
            const where: any = {};

            if (input?.category) {
                where.OR = [
                    { category: input.category },
                    { category: null } // Campos globais
                ];
            }

            if (input?.enabledOnly) {
                where.enabled = true;
            }

            return prisma.customField.findMany({
                where,
                orderBy: { order: 'asc' }
            });
        }),

    /**
     * List By Category - Listar Campos por Categoria
     * 
     * Retorna campos customizáveis aplicáveis a uma categoria específica,
     * incluindo campos globais (sem categoria definida).
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} input
     * @param {TicketCategory} input.category - Categoria do ticket
     * @returns {Promise<CustomField[]>} Campos aplicáveis à categoria
     * 
     * @example
     * const fields = await trpc.customFields.listByCategory.query({
     *   category: 'INCIDENT'
     * });
     */
    listByCategory: protectedProcedure
        .input(z.object({
            category: z.nativeEnum(TicketCategory)
        }))
        .query(async ({ input }) => {
            return prisma.customField.findMany({
                where: {
                    enabled: true,
                    OR: [
                        { category: input.category },
                        { category: null }
                    ]
                },
                orderBy: { order: 'asc' }
            });
        }),

    /**
     * Create - Criar Campo Customizável
     * 
     * Cria um novo campo customizável para tickets.
     * Apenas administradores podem criar campos.
     * 
     * @procedure mutation
     * @protected Requer autenticação (ADMIN)
     * @param {Object} input
     * @param {string} input.name - Nome interno do campo
     * @param {string} input.label - Label exibido no formulário
     * @param {FieldType} input.type - Tipo do campo
     * @param {TicketCategory} [input.category] - Categoria específica (null = global)
     * @param {boolean} [input.required=false] - Campo obrigatório
     * @param {string[]} [input.options] - Opções para SELECT/RADIO
     * @param {string} [input.placeholder] - Texto de ajuda
     * @param {number} [input.order=0] - Ordem de exibição
     * @returns {Promise<CustomField>} Campo criado
     * 
     * @example
     * const field = await trpc.customFields.create.mutate({
     *   name: 'affected_users',
     *   label: 'Número de Usuários Afetados',
     *   type: 'NUMBER',
     *   category: 'INCIDENT',
     *   required: true
     * });
     */
    create: protectedProcedure
        .input(z.object({
            name: z.string().min(1),
            label: z.string().min(1),
            type: z.nativeEnum(FieldType),
            category: z.nativeEnum(TicketCategory).optional(),
            required: z.boolean().default(false),
            options: z.array(z.string()).optional(),
            placeholder: z.string().optional(),
            order: z.number().default(0)
        }))
        .mutation(async ({ input, ctx }) => {
            // Verificar se é admin
            if (ctx.user?.role !== 'ADMIN') {
                throw new Error('Apenas administradores podem criar campos customizáveis');
            }

            return prisma.customField.create({
                data: {
                    ...input,
                    category: input.category || null
                }
            });
        }),

    /**
     * Update - Atualizar Campo Customizável
     * 
     * Atualiza um campo customizável existente.
     * 
     * @procedure mutation
     * @protected Requer autenticação (ADMIN)
     * @param {Object} input
     * @param {string} input.id - ID do campo
     * @param {string} [input.label] - Novo label
     * @param {boolean} [input.required] - Novo status de obrigatoriedade
     * @param {string[]} [input.options] - Novas opções
     * @param {number} [input.order] - Nova ordem
     * @param {boolean} [input.enabled] - Ativar/desativar campo
     * @returns {Promise<CustomField>} Campo atualizado
     */
    update: protectedProcedure
        .input(z.object({
            id: z.string(),
            label: z.string().optional(),
            required: z.boolean().optional(),
            options: z.array(z.string()).optional(),
            placeholder: z.string().optional(),
            order: z.number().optional(),
            enabled: z.boolean().optional()
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new Error('Apenas administradores podem atualizar campos customizáveis');
            }

            const { id, ...data } = input;
            return prisma.customField.update({
                where: { id },
                data
            });
        }),

    /**
     * Delete - Deletar Campo Customizável
     * 
     * Remove um campo customizável e todos os seus valores associados.
     * 
     * @procedure mutation
     * @protected Requer autenticação (ADMIN)
     * @param {Object} input
     * @param {string} input.id - ID do campo
     * @returns {Promise<CustomField>} Campo deletado
     */
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new Error('Apenas administradores podem deletar campos customizáveis');
            }

            return prisma.customField.delete({
                where: { id: input.id }
            });
        }),

    /**
     * Get Ticket Values - Obter Valores de um Ticket
     * 
     * Retorna todos os valores de campos customizáveis de um ticket específico.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.ticketId - ID do ticket
     * @returns {Promise<TicketCustomValue[]>} Valores com informações do campo
     */
    getTicketValues: protectedProcedure
        .input(z.object({ ticketId: z.string() }))
        .query(async ({ input }) => {
            return prisma.ticketCustomValue.findMany({
                where: { ticketId: input.ticketId },
                include: { field: true }
            });
        }),

    /**
     * Update Ticket Values - Atualizar Valores de um Ticket
     * 
     * Atualiza ou cria valores de campos customizáveis para um ticket.
     * Remove valores antigos e cria novos em uma transação.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.ticketId - ID do ticket
     * @param {Array} input.values - Array de valores
     * @param {string} input.values[].fieldId - ID do campo
     * @param {string} input.values[].value - Valor do campo
     * @returns {Promise<{count: number}>} Número de valores criados
     * 
     * @example
     * await trpc.customFields.updateTicketValues.mutate({
     *   ticketId: 'ticket-123',
     *   values: [
     *     { fieldId: 'field-1', value: '50' },
     *     { fieldId: 'field-2', value: 'Servidor Web' }
     *   ]
     * });
     */
    updateTicketValues: protectedProcedure
        .input(z.object({
            ticketId: z.string(),
            values: z.array(z.object({
                fieldId: z.string(),
                value: z.string()
            }))
        }))
        .mutation(async ({ input }) => {
            // Usar transação para garantir atomicidade
            return prisma.$transaction(async (tx) => {
                // Deletar valores antigos
                await tx.ticketCustomValue.deleteMany({
                    where: { ticketId: input.ticketId }
                });

                // Criar novos valores
                if (input.values.length > 0) {
                    await tx.ticketCustomValue.createMany({
                        data: input.values.map(v => ({
                            ticketId: input.ticketId,
                            fieldId: v.fieldId,
                            value: v.value
                        }))
                    });
                }

                return { count: input.values.length };
            });
        }),

    /**
     * Validate Required Fields - Validar Campos Obrigatórios
     * 
     * Valida se todos os campos obrigatórios de uma categoria foram preenchidos.
     * Útil para validação antes de criar/atualizar um ticket.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} input
     * @param {TicketCategory} input.category - Categoria do ticket
     * @param {Array} input.values - Valores fornecidos
     * @returns {Promise<{valid: boolean, missingFields: string[]}>} Resultado da validação
     */
    validateRequiredFields: protectedProcedure
        .input(z.object({
            category: z.nativeEnum(TicketCategory),
            values: z.array(z.object({
                fieldId: z.string(),
                value: z.string()
            }))
        }))
        .query(async ({ input }) => {
            // Buscar campos obrigatórios da categoria
            const requiredFields = await prisma.customField.findMany({
                where: {
                    enabled: true,
                    required: true,
                    OR: [
                        { category: input.category },
                        { category: null }
                    ]
                }
            });

            // Verificar quais campos obrigatórios estão faltando
            const providedFieldIds = new Set(input.values.map(v => v.fieldId));
            const missingFields = requiredFields
                .filter(field => !providedFieldIds.has(field.id))
                .map(field => field.label);

            return {
                valid: missingFields.length === 0,
                missingFields
            };
        })
});
