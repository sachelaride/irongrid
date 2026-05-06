/**
 * IPAMSchedulerService - Agendador de varreduras automáticas de IPs
 *
 * Executa varreduras por sub-rede nos horários configurados (GMT-4):
 *   - 09:00, 15:54, 20:43
 *
 * Para cada sub-rede, utiliza o IPAMDiscoveryService (ICMP + TCP + ARP + SNMP)
 * e registra estatísticas no banco via IPAMScanLog.
 */
import { prisma } from '../utils/prisma';
import { IPAMDiscoveryService } from './ipamDiscoveryService';

// Horários alvo em GMT-4, representados como [hora, minuto]
const SCHEDULE_TIMES_GMT4: [number, number][] = [
    [9, 0],
    [15, 54],
    [20, 43],
];

// Offset GMT-4 em horas
const GMT4_OFFSET_HOURS = -4;

function nowInGMT4(): Date {
    const now = new Date();
    // Converte para GMT-4
    now.setHours(now.getUTCHours() + GMT4_OFFSET_HOURS);
    return now;
}

/**
 * Calcula quantos milissegundos faltam para o próximo horário agendado
 * a partir do momento atual (em GMT-4).
 */
function msUntilNext(targetHour: number, targetMin: number): number {
    const now = nowInGMT4();
    const target = new Date(now);
    target.setHours(targetHour, targetMin, 0, 0);

    let diff = target.getTime() - now.getTime();
    if (diff <= 0) {
        // Já passou hoje → agendar para amanhã
        diff += 24 * 60 * 60 * 1000;
    }
    return diff;
}

export class IPAMSchedulerService {

    private static timers: NodeJS.Timeout[] = [];

    /**
     * Inicia o agendador. Deve ser chamado uma única vez no startup do servidor.
     */
    static start() {
        console.log('[IPAM Scheduler] Inicializando agendador de varreduras...');
        for (const [hour, min] of SCHEDULE_TIMES_GMT4) {
            IPAMSchedulerService.scheduleRun(hour, min);
        }
    }

    private static scheduleRun(hour: number, min: number) {
        const delay = msUntilNext(hour, min);
        const timeLabel = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} GMT-4`;

        console.log(`[IPAM Scheduler] Próxima varredura às ${timeLabel} em ${Math.round(delay / 60000)} minutos`);

        const t = setTimeout(async () => {
            console.log(`\n[IPAM Scheduler] === Iniciando varredura agendada (${timeLabel}) ===`);
            await IPAMSchedulerService.runAllSubnets('scheduler');

            // Reagendar para o mesmo horário no próximo dia
            IPAMSchedulerService.scheduleRun(hour, min);
        }, delay);

        IPAMSchedulerService.timers.push(t);
    }

    /**
     * Executa o discovery em TODAS as sub-redes cadastradas, uma por vez.
     * Registra resultados no IPAMScanLog para estatísticas.
     */
    static async runAllSubnets(triggeredBy: 'scheduler' | 'manual' = 'manual') {
        const subnets = await (prisma as any).iPAMSubnet.findMany({
            include: { addresses: true }
        });

        if (subnets.length === 0) {
            console.log('[IPAM Scheduler] Nenhuma sub-rede cadastrada para varrer.');
            return;
        }

        console.log(`[IPAM Scheduler] ${subnets.length} sub-rede(s) para varrer sequencialmente...`);

        for (const subnet of subnets) {
            await IPAMSchedulerService.runSubnet(subnet, triggeredBy);
        }

        console.log('[IPAM Scheduler] === Varredura completa de todas as sub-redes ===');
    }

    private static async runSubnet(subnet: any, triggeredBy: 'scheduler' | 'manual') {
        const startedAt = new Date();
        console.log(`[IPAM Scheduler] Varrendo ${subnet.subnet} (${subnet.addresses.length} IPs)...`);

        // Snapshot de estados antes da varredura
        const beforeStates = new Map<string, string>(
            subnet.addresses.map((a: any) => [a.id, a.status])
        );

        // Criar log de entrada no banco
        const log = await (prisma as any).iPAMScanLog.create({
            data: {
                subnetId: subnet.id,
                triggeredBy,
                startedAt,
                totalIPs: subnet.addresses.length,
            }
        });

        try {
            const result = await IPAMDiscoveryService.discoverSubnet(subnet.id);

            // Recarregar endereços para calcular mudanças
            const afterAddresses = await (prisma as any).iPAMAddress.findMany({
                where: { subnetId: subnet.id },
                select: { id: true, status: true }
            });

            let newIPs = 0;
            let freedIPs = 0;

            for (const addr of afterAddresses) {
                const before = beforeStates.get(addr.id);
                const after = addr.status;
                if (before === 'AVAILABLE' && after === 'USED') newIPs++;
                if (before === 'USED' && after === 'AVAILABLE') freedIPs++;
            }

            // Atualizar log com resultados
            await (prisma as any).iPAMScanLog.update({
                where: { id: log.id },
                data: {
                    completedAt: new Date(),
                    activeIPs: result.discovered,
                    newIPs,
                    freedIPs,
                    methods: ['icmp', 'tcp', 'arp', 'snmp']
                }
            });

            console.log(`[IPAM Scheduler] ${subnet.subnet}: ${result.discovered}/${result.total} ativos | +${newIPs} novos | -${freedIPs} liberados`);
        } catch (err) {
            console.error(`[IPAM Scheduler] Erro ao varrer ${subnet.subnet}:`, err);
            await (prisma as any).iPAMScanLog.update({
                where: { id: log.id },
                data: { completedAt: new Date() }
            });
        }
    }

    /**
     * Retorna os últimos logs de varredura
     */
    static async getRecentLogs(limit = 50) {
        return (prisma as any).iPAMScanLog.findMany({
            orderBy: { startedAt: 'desc' },
            take: limit,
            include: {
                subnet: { select: { subnet: true, name: true } }
            }
        });
    }

    static stop() {
        for (const t of IPAMSchedulerService.timers) {
            clearTimeout(t);
        }
        IPAMSchedulerService.timers = [];
        console.log('[IPAM Scheduler] Agendador parado.');
    }
}
