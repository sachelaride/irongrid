import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({
    where: { username: 'admin' }
  });
  console.log('Admin user found:', admin ? 'YES' : 'NO');
  if (admin) {
    console.log('Admin role:', admin.role);
    console.log('Admin ID:', admin.id);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
