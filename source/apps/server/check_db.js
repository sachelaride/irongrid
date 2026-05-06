const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const devices = await prisma.device.findMany({
        include: {
            hardware: true,
            _count: { select: { software: true } }
        }
    });
    console.log('Total devices:', devices.length);
    devices.forEach(d => {
        console.log(`\n[${d.name || d.ipAddress}]`);
        console.log(`  IP: ${d.ipAddress}`);
        console.log(`  AgentID: ${d.agentId || 'N/A'}`);
        console.log(`  Status: ${d.status}`);
        console.log(`  Software Count: ${d._count.software}`);
        console.log(`  Has Hardware: ${d.hardware ? 'Yes' : 'No'}`);
        console.log(`  Last Seen: ${d.lastSeen || 'Never'}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
