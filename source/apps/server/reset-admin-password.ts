/**
 * Script para resetar a senha do admin
 * Execute com: npx tsx reset-admin-password.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const newPassword = 'admin123'; // Senha padrão

    console.log('Resetando senha do usuário admin...');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await (prisma as any).user.update({
        where: { username: 'admin' },
        data: { password: hashedPassword },
        select: { id: true, username: true, name: true, role: true }
    });

    console.log('✅ Senha resetada com sucesso!');
    console.log('Usuário:', user);
    console.log('\n📝 Credenciais:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
