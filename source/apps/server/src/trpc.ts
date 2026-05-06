import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import { z } from 'zod';

// Inicialização do tRPC com Contexto Tipado
const t = initTRPC.context<Context>().create();

// Middleware de autenticação simples
const isAuthed = t.middleware(({ next, ctx }) => {
    if (!ctx.user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Você deve estar autenticado para realizar esta ação.',
        });
    }

    return next({
        ctx: {
            user: ctx.user,
        },
    });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);

// Middleware para administradores
const isAdmin = isAuthed.unstable_pipe(({ next, ctx }) => {
    if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Acesso restrito a administradores.',
        });
    }

    return next({
        ctx: {
            user: ctx.user,
        },
    });
});

export const adminProcedure = t.procedure.use(isAdmin);
