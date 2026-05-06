
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Devices ---');
    const devices = await prisma.device.findMany({
        select: { id: true, name: true, ipAddress: true, agentId: true, hostname: true }
    });
    console.table(devices);

    console.log('\n--- MonitoredDevices ---');
    const monitored = await prisma.monitoredDevice.findMany();
    console.table(monitored);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
