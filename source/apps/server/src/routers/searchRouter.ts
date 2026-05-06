import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';

/**
 * Router de Busca Global
 * Centraliza as pesquisas em diferentes entidades do sistema.
 */
export const searchRouter = router({
    globalSearch: protectedProcedure
        .input(z.object({
            query: z.string().min(2),
        }))
        .query(async ({ input }) => {
            const { query } = input;

            // 1. Busca de Dispositivos (IP, Nome, Modelo, MAC)
            const devices = await prisma.device.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { ipAddress: { contains: query, mode: 'insensitive' } },
                        { model: { contains: query, mode: 'insensitive' } },
                        { macAddress: { contains: query, mode: 'insensitive' } },
                    ]
                },
                take: 10,
                select: { id: true, name: true, ipAddress: true, type: true }
            });

            // 2. Busca de Usuários (ID, Nome, Username)
            const users = await (prisma as any).user.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { username: { contains: query, mode: 'insensitive' } },
                    ]
                },
                take: 5,
                select: { id: true, name: true, username: true }
            });

            // 3. Busca de Unidades / Locais (Locations)
            const locations = await (prisma as any).location.findMany({
                where: { name: { contains: query, mode: 'insensitive' } },
                take: 5
            });

            // 4. Busca de Setores
            const sectors = await (prisma as any).sector.findMany({
                where: { name: { contains: query, mode: 'insensitive' } },
                take: 5,
                include: { location: { select: { name: true } } }
            });

            // 5. Busca de Departamentos
            const departments = await (prisma as any).department.findMany({
                where: { name: { contains: query, mode: 'insensitive' } },
                take: 5,
                include: { sector: { select: { name: true, location: { select: { name: true } } } } }
            });

            // Retorna os resultados categorizados para o frontend
            return {
                devices: devices.map(d => ({ ...d, category: 'Dispositivo' })),
                users: users.map((u: any) => ({ ...u, category: 'Usuário' })),
                locations: locations.map((l: any) => ({ ...l, category: 'Unidade' })),
                sectors: sectors.map((s: any) => ({ ...s, category: 'Setor' })),
                departments: departments.map((d: any) => ({ ...d, category: 'Departamento' })),
            };
        }),
});
