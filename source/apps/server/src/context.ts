import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'irongrid-super-secret-key-12345';

export const createContext = async ({ req, res }: CreateExpressContextOptions, io?: SocketServer) => {
    let user = null;

    try {
        const token = req.headers.authorization?.split(' ')[1] || (req as any).cookies?.token;
        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };

            // Buscar departmentId do banco de dados (não está no JWT por segurança/frescor)
            const { prisma } = require('./utils/prisma');
            const dbUser = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { departmentId: true }
            });

            user = {
                ...decoded,
                departmentId: dbUser?.departmentId
            };
        }
    } catch (e) {
        // Token invalid, context user remains null
    }

    return {
        req,
        res,
        io,
        user,
    };
};

export type Context = inferAsyncReturnType<typeof createContext>;
