import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Script de Manutenção: Limpeza de Agentes Duplicados
 * 
 * Localiza dispositivos que compartilham o mesmo agentId e remove as duplicatas,
 * mantendo apenas o registro mais antigo (original). Isso resolve conflitos
 * causados por reinstalações ou troca de IPs.
 */
async function cleanup() {
    console.log('====================================================');
    console.log('[Maintenance] Iniciando limpeza de agentes duplicados...');
    console.log('====================================================');
    
    // Busca todos os dispositivos que possuem um agentId vinculado
    const devices = await prisma.device.findMany({
        where: {
            agentId: { not: null, not: 'unknown' }
        },
        orderBy: { createdAt: 'asc' }
    });

    const agentGroups = new Map<string, any[]>();
    for (const device of devices) {
        const id = device.agentId!;
        if (!agentGroups.has(id)) agentGroups.set(id, []);
        agentGroups.get(id)!.push(device);
    }

    let DeletedCount = 0;

    for (const [agentId, duplicates] of agentGroups.entries()) {
        if (duplicates.length > 1) {
            console.log(`\n[Agent: ${agentId}] Encontradas ${duplicates.length} duplicatas.`);
            
            // O primeiro da lista (mais antigo) é mantido como primário
            const primary = duplicates[0];
            const toDelete = duplicates.slice(1);

            console.log(`  -> Mantendo Primário: ID ${primary.id} (IP: ${primary.ipAddress})`);

            for (const duplicate of toDelete) {
                try {
                    console.log(`  -> Removendo Duplicata: ID ${duplicate.id} (IP: ${duplicate.ipAddress})`);
                    
                    // Em um cenário real, poderíamos mover métricas do InfluxDB aqui, 
                    // mas como são séries temporais vinculadas ao agentId, elas já "seguem" o ID.
                    // No Postgres, apenas removemos o registro redundante do dispositivo.
                    
                    await prisma.device.delete({
                        where: { id: duplicate.id }
                    });
                    DeletedCount++;
                } catch (err: any) {
                    console.error(`  [!] Falha ao remover ID ${duplicate.id}: ${err.message}`);
                }
            }
        }
    }

    console.log('\n====================================================');
    console.log(`[Maintenance] Limpeza concluída. Total removido: ${DeletedCount}`);
    console.log('====================================================');
}

cleanup()
    .catch((e) => {
        console.error('[Maintenance] Erro fatal na limpeza:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
