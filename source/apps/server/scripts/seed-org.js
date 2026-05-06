const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando Limpeza de Estrutura Organizacional ---');

    // 1. Limpar vínculos para evitar erros de FK (Setores, Deptos, Locais)
    await prisma.device.updateMany({
        data: {
            sectorId: null,
            departmentId: null,
            locationId: null,
            userId: null
        }
    });

    // 2. Limpar Entidades
    // Deletar Departamentos primeiro (folhas na nova hierarquia), depois Setores, depois Locais
    await prisma.department.deleteMany({});
    await prisma.sector.deleteMany({});
    await prisma.location.deleteMany({});

    console.log('--- Estrutura Limpa. Iniciando Novos Cadastros ---');

    // 3. Criar Unidades (Locais)
    const ead = await prisma.location.create({ data: { name: 'EAD' } });
    const presencial = await prisma.location.create({ data: { name: 'Presencial' } });

    console.log('Unidades criadas: EAD, Presencial');

    // 4. Setores e Departamentos requisitados
    const deptoNames = [
        'Secretaria', 'Financeiro', 'Tesouraria', 'Coordenação',
        'Provas', 'Apostilas', 'Marketing', 'Informatica',
        'Captação', 'CallCenter'
    ];

    // Criar uma estrutura para cada Unidade
    const unidades = [ead, presencial];

    for (const unit of unidades) {
        // Criar um Setor "Administrativo" ou similar para agrupar? 
        // O usuário disse: "setor EAD, Presencial tenho [Lista]"
        // Então EAD/Presencial são os SE TORES e a Lista são os DEPARTAMENTOS.

        const sector = await prisma.sector.create({
            data: {
                name: `Geral ${unit.name}`,
                locationId: unit.id,
                description: `Setor geral da unidade ${unit.name}`
            }
        });

        for (const deptName of deptoNames) {
            await prisma.department.create({
                data: {
                    name: deptName,
                    sectorId: sector.id,
                    description: `${deptName} - ${unit.name}`
                }
            });
        }
    }

    console.log('--- Cadastro Concluído com Sucesso ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
