const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Delete the localhost duplicate (127.0.0.1) that has the agentId
    const deleted = await prisma.device.deleteMany({
        where: {
            ipAddress: '127.0.0.1',
            agentId: 'german-sachelaride'
        }
    });

    console.log(`Deleted ${deleted.count} duplicate device(s)`);

    // Update the 192.168.0.121 device to have the correct agentId
    const updated = await prisma.device.updateMany({
        where: {
            ipAddress: '192.168.0.121'
        },
        data: {
            agentId: 'german-sachelaride',
            name: 'german-sachelaride'
        }
    });

    console.log(`Updated ${updated.count} device(s)`);
    console.log('\nNow restart the agent service:');
    console.log('sudo systemctl restart irongrid-agent');
}

main().catch(console.error).finally(() => prisma.$disconnect());
