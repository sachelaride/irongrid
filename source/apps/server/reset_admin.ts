import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = 'admin';
  const password = 'irongrid-admin-password'; // Senha padrão ou solicitada
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const user = await prisma.user.upsert({
    where: { username },
    update: { 
      password: hashedPassword,
      role: 'ADMIN'
    },
    create: {
      username,
      password: hashedPassword,
      name: 'Administrador do Sistema',
      role: 'ADMIN'
    }
  });
  
  console.log('Admin user reset successfully');
  console.log('Username:', username);
  console.log('New Password:', password);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
