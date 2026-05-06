import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = 'admin';
    const password = 'lizard1240king';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`Seeding user: ${username}...`);

    const user = await prisma.user.upsert({
        where: { username },
        update: {
            password: hashedPassword,
            role: UserRole.ADMIN,
        },
        create: {
            username,
            password: hashedPassword,
            name: 'Administrador IronGrid',
            role: UserRole.ADMIN,
        },
    });

    console.log(`User ${user.username} created/updated with role ${user.role}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
