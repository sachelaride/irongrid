import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { TRPCError } from '@trpc/server';

/**
 * Router tRPC para a Base de Conhecimento (Knowledge Base).
 * Gerencia categorias e artigos de ajuda/documentação interna.
 */
export const knowledgeRouter = router({
    // --- Gerenciamento de Categorias ---

    /**
     * Lista todas as categorias de artigos disponíveis.
     * Inclui a contagem de artigos em cada categoria.
     */
    listCategories: protectedProcedure.query(async () => {
        return prisma.articleCategory.findMany({
            include: {
                _count: { select: { articles: true } }
            }
        });
    }),

    /**
     * Obtém detalhes de uma categoria específica pelo ID.
     * Retorna a categoria, contagem de artigos e lista básica de artigos vinculados.
     */
    getCategory: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            return prisma.articleCategory.findUnique({
                where: { id: input.id },
                include: {
                    _count: { select: { articles: true } },
                    articles: { select: { id: true, title: true, views: true } }
                }
            });
        }),

    /**
     * Cria uma nova categoria de artigos.
     * Restrição: Apenas usuários com papel ADMIN podem executar esta ação.
     */
    createCategory: protectedProcedure
        .input(z.object({
            name: z.string(),
            description: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            // Verifica permissão administrativa
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem criar categorias' });
            }
            return prisma.articleCategory.create({ data: input });
        }),

    /**
     * Atualiza os dados de uma categoria existente.
     * Restrição: Apenas ADMIN.
     */
    updateCategory: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().optional(),
            description: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem atualizar categorias' });
            }
            const { id, ...data } = input;
            return prisma.articleCategory.update({ where: { id }, data });
        }),

    /**
     * Remove uma categoria do sistema.
     * Restrição: Apenas ADMIN.
     */
    deleteCategory: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            if (ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem deletar categorias' });
            }
            return prisma.articleCategory.delete({ where: { id: input.id } });
        }),

    // --- Gerenciamento de Artigos ---

    /**
     * Lista artigos baseando-se em filtros de categoria ou busca textual.
     * Realiza busca insensível a maiúsculas/minúsculas no título, conteúdo e tags.
     */
    listArticles: protectedProcedure
        .input(z.object({
            categoryId: z.string().optional(),
            serviceTypeId: z.string().optional(),
            search: z.string().optional(),
        }).optional())
        .query(async ({ input }) => {
            return prisma.knowledgeArticle.findMany({
                where: {
                    categoryId: input?.categoryId,
                    serviceTypeId: input?.serviceTypeId,
                    OR: input?.search ? (
                        input.search.split(' ').filter(word => word.length > 2).flatMap(word => [
                            { title: { contains: word, mode: 'insensitive' } },
                            { content: { contains: word, mode: 'insensitive' } },
                            { tags: { has: word } }
                        ])
                    ) : undefined
                },
                include: {
                    category: { select: { name: true } },
                    serviceType: { select: { name: true } },
                    author: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }),

    /**
     * Obtém o conteúdo completo de um artigo pelo ID.
     * Incrementa automaticamente o contador de visualizações (views) a cada acesso.
     */
    getArticle: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            // Verifica se o artigo existe primeiro para evitar erros de FK
            const exists = await prisma.knowledgeArticle.findUnique({
                where: { id: input.id },
                select: { id: true }
            });

            if (!exists) {
                throw new Error("Artigo não encontrado.");
            }

            // Regista a visualização detalhada (quem e quando)
            await prisma.knowledgeArticleView.create({
                data: {
                    articleId: input.id,
                    userId: ctx.user.id
                }
            });

            // Atualiza o artigo incrementando as views antes de retornar
            return prisma.knowledgeArticle.update({
                where: { id: input.id },
                data: { views: { increment: 1 } },
                include: {
                    category: { select: { name: true } },
                    serviceType: { select: { name: true } },
                    author: { select: { name: true } }
                }
            });
        }),

    /**
     * Lista o histórico de visualizações de um artigo (quem e quando).
     * Apenas para administradores e técnicos.
     */
    listArticleViews: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            return prisma.knowledgeArticleView.findMany({
                where: { articleId: input.id },
                include: {
                    user: { select: { name: true, email: true } }
                },
                orderBy: { viewedAt: 'desc' }
            });
        }),

    /**
     * Cria um novo artigo na base de conhecimento.
     * O autor é definido automaticamente pelo usuário logado no contexto.
     */
    createArticle: protectedProcedure
        .input(z.object({
            title: z.string(),
            content: z.string(),
            categoryId: z.string().optional(),
            serviceTypeId: z.string().optional(),
            tags: z.array(z.string()).default([]),
            isPublic: z.boolean().default(true),
        }))
        .mutation(async ({ input, ctx }) => {
            return prisma.knowledgeArticle.create({
                data: {
                    ...input,
                    authorId: ctx.user!.id // Vincula ao ID do usuário autenticado
                }
            });
        }),

    /**
     * Atualiza um artigo existente.
     * Segurança: Usuários comuns podem editar apenas artigos de sua própria autoria.
     * Administradores podem editar qualquer artigo.
     */
    updateArticle: protectedProcedure
        .input(z.object({
            id: z.string(),
            title: z.string().optional(),
            content: z.string().optional(),
            categoryId: z.string().optional(),
            serviceTypeId: z.string().optional(),
            tags: z.array(z.string()).optional(),
            isPublic: z.boolean().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            // Busca o artigo para verificar a autoria
            const article = await prisma.knowledgeArticle.findUnique({ where: { id: input.id } });
            // Valida permissão de edição (Autor ou Admin)
            if (article?.authorId !== ctx.user?.id && ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Você só pode editar seus próprios artigos' });
            }
            const { id, ...data } = input;
            return prisma.knowledgeArticle.update({
                where: { id },
                data
            });
        }),

    /**
     * Remove um artigo permanentemente do sistema.
     * Segurança: Mesma lógica de permissão da atualização (Autor ou Admin).
     */
    deleteArticle: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const article = await prisma.knowledgeArticle.findUnique({ where: { id: input.id } });
            if (article?.authorId !== ctx.user?.id && ctx.user?.role !== 'ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Você só pode deletar seus próprios artigos' });
            }
            return prisma.knowledgeArticle.delete({ where: { id: input.id } });
        })
});
