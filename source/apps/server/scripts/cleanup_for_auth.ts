import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up data for schema migration...');

    // Disable constraints temporarily or just truncate in order
    try {
        await prisma.ticketActivity.deleteMany({});
        await prisma.ticket.deleteMany({});
        await prisma.auditLog.deleteMany({});
        await prisma.remoteActionLog.deleteMany({});

        console.log('Data cleaned successfully.');
    } catch (error) {
        console.error('Error cleaning data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
