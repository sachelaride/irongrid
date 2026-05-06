/**
 * Router de Autenticação e Gerenciamento de Usuários
 * 
 * Responsável por todas as operações relacionadas à autenticação e gerenciamento
 * de usuários do sistema IronGrid. Inclui:
 * 
 * - Login e logout de usuários
 * - Geração e validação de tokens JWT
 * - Gerenciamento de cookies de sessão
 * - CRUD de usuários (criar, listar, deletar)
 * - Verificação de identidade (me)
 * - Controle de permissões por role (ADMIN, OPERATOR, USER)
 * 
 * @module routers/authRouter
 * @requires trpc - Framework tRPC para APIs type-safe
 * @requires zod - Validação de schemas
 * @requires bcryptjs - Hash de senhas
 * @requires jsonwebtoken - Geração e validação de tokens JWT
 */

import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';

const JWT_SECRET = process.env.JWT_SECRET || 'irongrid-super-secret-key-12345';

export const authRouter = router({
    /**
     * Login - Autenticação de Usuário
     * 
     * Autentica um usuário no sistema verificando username e senha.
     * Em caso de sucesso, gera um token JWT válido por 7 dias e
     * configura um cookie httpOnly para manter a sessão.
     * 
     * @procedure mutation
     * @public Não requer autenticação prévia
     * @param {Object} input
     * @param {string} input.username - Nome de usuário
     * @param {string} input.password - Senha em texto plano
     * @returns {Promise<{user: Object, token: string}>} Dados do usuário e token JWT
     * @throws {TRPCError} UNAUTHORIZED - Credenciais inválidas
     * 
     * @example
     * const result = await trpc.auth.login.mutate({
     *   username: 'admin',
     *   password: 'senha123'
     * });
     */
    login: publicProcedure
        .input(z.object({
            username: z.string(),
            password: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            console.log(`[AUTH] Login attempt: ${input.username}`);
            const user = await (prisma as any).user.findUnique({
                where: { username: input.username },
            });

            if (!user) {
                console.log(`[AUTH] User not found: ${input.username}`);
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Usuário ou senha inválidos',
                });
            }

            const passwordMatch = await bcrypt.compare(input.password, user.password);

            if (!passwordMatch) {
                console.log(`[AUTH] Invalid password for: ${input.username}`);
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Usuário ou senha inválidos',
                });
            }

            console.log(`[AUTH] Success: ${input.username}`);

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Set cookie in response if possible
            ctx.res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            return {
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                },
                token,
            };
        }),

    /**
     * Me - Obter Usuário Atual
     * 
     * Retorna os dados do usuário autenticado atualmente.
     * Usado para verificar a sessão e obter informações do perfil.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @returns {Promise<User>} Dados do usuário (id, username, name, role)
     * @throws {TRPCError} UNAUTHORIZED - Usuário não autenticado
     * @throws {TRPCError} NOT_FOUND - Usuário não encontrado no banco
     */
    me: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.user) {
            throw new TRPCError({ code: 'UNAUTHORIZED' });
        }

        const user = await (prisma as any).user.findUnique({
            where: { id: ctx.user.id },
            select: { id: true, username: true, name: true, role: true, email: true }
        });

        if (!user) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }

        return user;
    }),

    /**
     * Logout - Encerrar Sessão
     * 
     * Remove o cookie de autenticação, encerrando a sessão do usuário.
     * 
     * @procedure mutation
     * @public Não requer autenticação
     * @returns {Promise<{success: boolean}>}
     */
    logout: publicProcedure.mutation(async ({ ctx }) => {
        ctx.res.clearCookie('token');
        return { success: true };
    }),

    /**
     * List Users - Listar Todos os Usuários
     * 
     * Retorna lista de todos os usuários cadastrados no sistema.
     * Não inclui senhas por segurança.
     * 
     * @procedure query
     * @protected Requer autenticação
     * @returns {Promise<User[]>} Lista de usuários
     */
    listUsers: protectedProcedure.query(async () => {
        return (prisma as any).user.findMany({
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                email: true,
                departmentId: true,
                department: { select: { id: true, name: true } },
                createdAt: true
            }
        });
    }),

    /**
     * Create User - Criar Novo Usuário
     * 
     * Cria um novo usuário no sistema com senha hasheada.
     * Apenas usuários autenticados podem criar novos usuários.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.username - Nome de usuário único
     * @param {string} input.password - Senha em texto plano (será hasheada)
     * @param {string} input.name - Nome completo do usuário
     * @param {'ADMIN'|'OPERATOR'|'USER'} input.role - Nível de permissão
     * @returns {Promise<User>} Usuário criado
     */
    createUser: protectedProcedure
        .input(z.object({
            username: z.string(),
            password: z.string(),
            name: z.string(),
            email: z.string().email().optional().nullable(),
            role: z.enum(['ADMIN', 'OPERATOR', 'TECNICO', 'USER']),
        }))
        .mutation(async ({ input }) => {
            const hashedPassword = await bcrypt.hash(input.password, 10);
            return (prisma as any).user.create({
                data: {
                    ...input,
                    password: hashedPassword,
                }
            });
        }),

    /**
     * Update User - Atualizar Usuário Existente
     * 
     * Atualiza informações de um usuário existente.
     * Não permite que usuários não-ADMIN modifiquem roles.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.id - ID do usuário a ser atualizado
     * @param {string} input.name - Nome completo do usuário (opcional)
     * @param {string} input.email - Email do usuário (opcional)
     * @param {'ADMIN'|'OPERATOR'|'TECNICO'|'USER'} input.role - Nível de permissão (opcional, apenas ADMIN)
     * @param {string} input.departmentId - ID do departamento (opcional)
     * @param {string} input.password - Nova senha (opcional)
     * @returns {Promise<User>} Usuário atualizado
     */
    updateUser: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            email: z.string().email().optional().nullable(),
            role: z.enum(['ADMIN', 'OPERATOR', 'TECNICO', 'USER']).optional(),
            departmentId: z.string().optional().nullable(),
            password: z.string().optional(), // Nova senha (se fornecida)
        }))
        .mutation(async ({ input, ctx }) => {
            const { id, password, role, ...updateData } = input;

            // Verificar se usuário está tentando modificar seu próprio role
            const isSelf = ctx.user?.id === id;
            if (role && isSelf && role !== ctx.user?.role) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Você não pode modificar seu próprio nível de permissão.'
                });
            }

            // Verificar se usuário não-ADMIN está tentando modificar role de outro usuário
            if (role && ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Apenas administradores podem modificar níveis de permissão.'
                });
            }

            // Preparar dados de atualização
            const data: any = { ...updateData };

            if (role) {
                data.role = role;
            }

            // Se senha foi fornecida, hash it
            if (password) {
                data.password = await bcrypt.hash(password, 10);
            }

            return (prisma as any).user.update({
                where: { id },
                data,
                select: {
                    id: true,
                    username: true,
                    name: true,
                    role: true,
                    email: true,
                    departmentId: true,
                    createdAt: true
                }
            });
        }),

    /**
     * Delete User - Deletar Usuário
     * 
     * Remove um usuário do sistema. Usuários não podem deletar a si mesmos.
     * 
     * @procedure mutation
     * @protected Requer autenticação
     * @param {Object} input
     * @param {string} input.id - ID do usuário a ser deletado
     * @returns {Promise<User>} Usuário deletado
     * @throws {TRPCError} BAD_REQUEST - Tentativa de auto-exclusão
     */
    deleteUser: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.id === input.id) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode excluir seu próprio usuário.' });
            }
            return (prisma as any).user.delete({ where: { id: input.id } });
        }),
});
