/**
 * Router de Configurações do Sistema
 * 
 * Gerencia parâmetros de configuração do sistema armazenados no banco de dados.
 * Permite configuração dinâmica sem necessidade de reiniciar o servidor.
 * 
 * Funcionalidades:
 * - CRUD de parâmetros do sistema
 * - Suporte a múltiplos tipos (STRING, NUMBER, BOOLEAN, JSON)
 * - Organização por categorias
 * - Busca por chave ou categoria
 * 
 * Exemplos de parâmetros:
 * - telegram_bot_token
 * - snmp_default_community
 * - scan_interval_ms
 * - max_concurrent_scans
 * 
 * @module routers/settingsRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';

export const settingsRouter = router({
    /**
     * Get Parameters - Listar Parâmetros
     * 
     * Retorna lista de parâmetros do sistema, opcionalmente filtrados por categoria.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} [input] - Filtros opcionais
     * @param {string} [input.category] - Filtrar por categoria
     * @returns {Promise<SystemParameter[]>} Lista de parâmetros ordenados por chave
     */
    getParameters: protectedProcedure
        .input(z.object({
            category: z.string().optional()
        }).optional())
        .query(async ({ input }) => {
            const where = input?.category ? { category: input.category } : {};
            return prisma.systemParameter.findMany({
                where,
                orderBy: { key: 'asc' }
            });
        }),

    /**
     * Get Parameter - Buscar Parâmetro por Chave
     * 
     * @procedure query
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.key - Chave do parâmetro
     * @returns {Promise<SystemParameter|null>} Parâmetro encontrado
     */
    getParameter: protectedProcedure
        .input(z.object({ key: z.string() }))
        .query(async ({ input }) => {
            return prisma.systemParameter.findUnique({
                where: { key: input.key }
            });
        }),

    /**
     * Upsert Parameter - Criar ou Atualizar Parâmetro
     * 
     * Cria um novo parâmetro ou atualiza se já existir.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.key - Chave única do parâmetro
     * @param {string} input.value - Valor do parâmetro
     * @param {string} [input.description] - Descrição
     * @param {string} [input.category] - Categoria (SNMP, SCAN, AGENT, etc)
     * @param {'STRING'|'NUMBER'|'BOOLEAN'|'JSON'} [input.type='STRING'] - Tipo do valor
     * @returns {Promise<SystemParameter>} Parâmetro criado/atualizado
     */
    upsertParameter: protectedProcedure
        .input(z.object({
            key: z.string(),
            value: z.string(),
            description: z.string().optional(),
            category: z.string().optional(),
            type: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON']).default('STRING')
        }))
        .mutation(async ({ input }) => {
            const { key, ...data } = input;
            return prisma.systemParameter.upsert({
                where: { key },
                update: data,
                create: { key, ...data }
            });
        }),

    /**
     * Delete Parameter - Deletar Parâmetro
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.key - Chave do parâmetro
     * @returns {Promise<SystemParameter>} Parâmetro deletado
     */
    deleteParameter: protectedProcedure
        .input(z.object({ key: z.string() }))
        .mutation(async ({ input }) => {
            return prisma.systemParameter.delete({
                where: { key: input.key }
            });
        }),

    /**
     * Reset All Parameters - Resetar para Configurações de Fábrica
     * 
     * Remove TODOS os parâmetros customizados do sistema.
     * CUIDADO: Isso reverterá todas as configurações para defaults hardcoded
     * ou exigirá reconfiguração manual.
     * 
     * @procedure mutation
     * @protected Requer autenticação (idealmente apenas ADMIN)
     */
    resetAllParameters: protectedProcedure
        .mutation(async () => {
            return prisma.systemParameter.deleteMany({});
        }),
});
