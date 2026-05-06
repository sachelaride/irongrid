import { prisma } from './src/utils/prisma';

async function test() {
    try {
        console.log('--- Prisma Runtime Test ---');
        console.log('Prisma Instance Keys:', Object.keys(prisma).filter(k => !k.startsWith('_')));
        console.log('IPAMSubnet model present:', !!(prisma as any).iPAMSubnet);
        console.log('IPAMAddress model present:', !!(prisma as any).iPAMAddress);

        if ((prisma as any).iPAMSubnet) {
            console.log('Attempting to count IPAMSubnet...');
            const count = await (prisma as any).iPAMSubnet.count();
            console.log('IPAMSubnet count:', count);
        } else {
            console.error('CRITICAL: ipamSubnet is missing from the prisma instance at runtime.');
        }
    } catch (err) {
        console.error('Prisma Runtime Error:', err);
    } finally {
        process.exit(0);
    }
}

test();
