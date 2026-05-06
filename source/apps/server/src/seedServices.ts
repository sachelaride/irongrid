import { PrismaClient, TicketPriority } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script de Seeding para o Catálogo de Serviços.
 * Define a estrutura inicial de Grupos de Serviço e Tipos de Serviço (SLAs).
 */
const serviceCatalog = [
    {
        group: "1. Torre de Infraestrutura e Cloud",
        services: [
            { name: "Backup e Restore", desc: "Recuperação de dados críticos de servidores/usuários.", priority: "HIGH" as TicketPriority, response: 60, solution: 480 },
            { name: "Data Center (Climatização/Nobreak)", desc: "Monitoramento de energia e temperatura do DC.", priority: "CRITICAL" as TicketPriority, response: 1, solution: 120 },
            { name: "Storage e Armazenamento", desc: "Expansão ou correção de volumes de rede.", priority: "MEDIUM" as TicketPriority, response: 240, solution: 1440 },
            { name: "Cloud Computing (Azure/AWS/GCP)", desc: "Gestão de instâncias e recursos em nuvem.", priority: "HIGH" as TicketPriority, response: 120, solution: 720 },
            { name: "Links de Internet (Rede Nacional/Privada)", desc: "Gestão de redundância e largura de banda.", priority: "CRITICAL" as TicketPriority, response: 15, solution: 240 },
            { name: "DNS/DHCP/Active Directory", desc: "Serviços base que permitem login e navegação.", priority: "CRITICAL" as TicketPriority, response: 30, solution: 120 },
            { name: "PABX IP / VoIP", desc: "Telefonia interna e comunicação de ramais.", priority: "MEDIUM" as TicketPriority, response: 120, solution: 480 },
        ]
    },
    {
        group: "2. Torre de Hardware e Manutenção de Campo (Field Service)",
        services: [
            { name: "Manutenção Corretiva (Desktop/Note)", desc: "Troca de peças, telas, fontes e baterias.", priority: "MEDIUM" as TicketPriority, response: 240, solution: 2880 },
            { name: "Manutenção Preventiva Semestral", desc: "Limpeza física e testes de stress em laboratórios.", priority: "LOW" as TicketPriority, response: 0, solution: 10080 },
            { name: "Gestão de Inventário/Patrimônio", desc: "Etiquetagem e movimentação física de ativos.", priority: "LOW" as TicketPriority, response: 480, solution: 4320 },
            { name: "Configuração de Estação (Masterização)", desc: "Instalação de imagem padrão do SO via rede.", priority: "MEDIUM" as TicketPriority, response: 240, solution: 1440 },
            { name: "Manutenção de Periféricos Especiais", desc: "Mesas digitalizadoras, scanners de alta produção.", priority: "MEDIUM" as TicketPriority, response: 480, solution: 2880 },
            { name: "Descarte Ecológico", desc: "Coleta de lixo eletrônico seguindo normas.", priority: "LOW" as TicketPriority, response: 0, solution: 21600 },
        ]
    },
    {
        group: "3. Torre de Impressão e Documentos (Managed Print Services)",
        services: [
            { name: "Impressoras Térmicas (Etiquetas)", desc: "Usadas em laboratórios de saúde ou bibliotecas.", priority: "HIGH" as TicketPriority, response: 120, solution: 480 },
            { name: "Plotters e Grandes Formatos", desc: "Impressoras de Engenharia/Arquitetura.", priority: "MEDIUM" as TicketPriority, response: 240, solution: 1440 },
            { name: "Totens de Autoatendimento", desc: "Impressão de boletos e históricos.", priority: "HIGH" as TicketPriority, response: 60, solution: 240 },
            { name: "Gestão de Cotas de Impressão", desc: "Configurar limites de impressão para alunos.", priority: "LOW" as TicketPriority, response: 240, solution: 720 },
            { name: "Digitalização de Acervo (GED)", desc: "Suporte aos scanners de arquivos históricos.", priority: "MEDIUM" as TicketPriority, response: 240, solution: 1440 },
        ]
    },
    {
        group: "4. Torre de Segurança da Informação e Redes",
        services: [
            { name: "Firewall / IPS / IDS", desc: "Gestão de regras de acesso e bloqueio de ataques.", priority: "CRITICAL" as TicketPriority, response: 15, solution: 240 },
            { name: "Gestão de Certificados Digitais", desc: "Renovação de certificados SSL para sites e e-mail.", priority: "HIGH" as TicketPriority, response: 240, solution: 1440 },
            { name: "CCTV / Monitoramento IP", desc: "Manutenção nas câmeras de segurança do campus.", priority: "HIGH" as TicketPriority, response: 120, solution: 720 },
            { name: "Controle de Acesso (Catracas)", desc: "Integração técnica das catracas com o sistema.", priority: "CRITICAL" as TicketPriority, response: 60, solution: 240 },
            { name: "Análise de Vulnerabilidade", desc: "Scan periódico de brechas nos sistemas.", priority: "LOW" as TicketPriority, response: 0, solution: 43200 },
            { name: "Gestão de VPN", desc: "Acesso seguro para colaboradores em home office.", priority: "MEDIUM" as TicketPriority, response: 120, solution: 480 },
        ]
    },
    {
        group: "5. Torre Acadêmica, Pesquisa e Software",
        services: [
            { name: "HPC (Computação de Alto Desempenho)", desc: "Suporte a clusters de processamento para pesquisa.", priority: "HIGH" as TicketPriority, response: 240, solution: 1440 },
            { name: "Gestão de Licenciamento (Software)", desc: "Controle de chaves (Microsoft, Adobe, Autodesk).", priority: "MEDIUM" as TicketPriority, response: 480, solution: 2880 },
            { name: "Sistemas de Gestão de Bibliotecas", desc: "Suporte ao software de busca e devolução.", priority: "HIGH" as TicketPriority, response: 120, solution: 480 },
            { name: "Ambientes Virtuais (VDI)", desc: "Laboratórios de informática rodando virtualizados.", priority: "HIGH" as TicketPriority, response: 60, solution: 360 },
            { name: "Anti-Plágio", desc: "Suporte a ferramentas como Turnitin.", priority: "MEDIUM" as TicketPriority, response: 240, solution: 1440 },
            { name: "Publicação de Sites de Eventos", desc: "Criação de subdomínios para congressos.", priority: "LOW" as TicketPriority, response: 480, solution: 4320 },
        ]
    },
    {
        group: "6. Torre de Audiovisual e Smart Campus",
        services: [
            { name: "Videoconferência / Teams / Zoom", desc: "Suporte a salas de reunião híbridas.", priority: "HIGH" as TicketPriority, response: 30, solution: 120 },
            { name: "Digital Signage (Murais Digitais)", desc: "Gestão das TVs com avisos pelo campus.", priority: "LOW" as TicketPriority, response: 240, solution: 1440 },
            { name: "Sonorização de Ambientes", desc: "Suporte a áudio em auditórios e pátios.", priority: "MEDIUM" as TicketPriority, response: 120, solution: 480 },
            { name: "Transmissão via Streaming", desc: "Suporte para lives de formaturas e eventos.", priority: "HIGH" as TicketPriority, response: 60, solution: 120 },
        ]
    }
];

/**
 * Função principal que executa a carga de dados (Seed).
 * Utiliza e sincroniza os Grupos e Tipos de Serviço definidos acima com o banco de dados.
 */
async function main() {
    console.log("Iniciando a carga do catálogo de serviços...");

    // Itera sobre cada grupo (Torre) definido no catálogo
    for (const groupData of serviceCatalog) {
        // Cria ou atualiza o grupo no banco de dados
        const group = await prisma.serviceGroup.upsert({
            where: { name: groupData.group },
            update: {}, // Não altera se já existir
            create: { name: groupData.group }
        });

        console.log(`Grupo: ${group.name}`);

        // Itera sobre cada serviço dentro do grupo atual
        for (const serviceData of groupData.services) {
            // Cria ou atualiza o tipo de serviço vinculando ao grupo
            await prisma.serviceType.upsert({
                where: {
                    name_groupId: {
                        name: serviceData.name,
                        groupId: group.id
                    }
                },
                update: {
                    // Atualiza campos de SLA e descrição caso tenham mudado
                    description: serviceData.desc,
                    priority: serviceData.priority,
                    responseTimeMinutes: serviceData.response,
                    resolutionTimeMinutes: serviceData.solution
                },
                create: {
                    name: serviceData.name,
                    description: serviceData.desc,
                    groupId: group.id,
                    priority: serviceData.priority,
                    responseTimeMinutes: serviceData.response,
                    resolutionTimeMinutes: serviceData.solution
                }
            });
            console.log(`  - Serviço: ${serviceData.name}`);
        }
    }

    console.log("Carga concluída com sucesso!");
}

// Execução do script com tratamento de erros e fechamento de conexão
main()
    .catch((e) => {
        console.error("Erro fatal durante o seed:", e);
        process.exit(1);
    })
    .finally(async () => {
        // Desconecta o cliente Prisma para liberar recursos
        await prisma.$disconnect();
    });
