/**
 * DiscoverySchedulerService - Agendador de descobertas de rede
 * 
 * Gerencia a execução periódica de varreduras em NetworkRanges.
 * Verifica a cada hora quais faixas precisam de atualização com base no intervalo definido.
 */
import { prisma } from '../utils/prisma';
import { DiscoveryService } from './discoveryService';

const discoveryService = new DiscoveryService();

export class DiscoverySchedulerService {
    private static interval: NodeJS.Timeout | null = null;

    /**
     * Inicia o serviço de agendamento
     */
    static start() {
        console.log('[Discovery Scheduler] Iniciando agendador...');
        
        // Executa uma verificação imediata
        this.checkAndRunScans();

        // Agenda verificação a cada hora
        this.interval = setInterval(() => {
            this.checkAndRunScans();
        }, 60 * 60 * 1000); 
    }

    /**
     * Verifica quais ranges precisam de scan e os executa
     */
    static async checkAndRunScans() {
        const now = new Date();
        const currentHour = now.getHours();

        console.log(`[Discovery Scheduler] Verificando agendamentos (Hora atual: ${currentHour}h)...`);

        try {
            const ranges = await prisma.networkRange.findMany({
                where: { enabled: true }
            });

            for (const range of ranges) {
                const interval = range.scanIntervalDays || 7;
                const targetHour = range.scanHour ?? 3;

                // 1. Verificar se é a hora correta
                if (currentHour !== targetHour) continue;

                // 2. Verificar se já passou o intervalo desde o último scan
                let shouldScan = false;
                if (!range.lastScanAt) {
                    shouldScan = true;
                } else {
                    const daysSinceLast = (now.getTime() - range.lastScanAt.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSinceLast >= interval) {
                        shouldScan = true;
                    }
                }

                if (shouldScan) {
                    console.log(`[Discovery Scheduler] Iniciando scan agendado para: ${range.subnet} (${range.name})`);
                    
                    // Executa o scan em background (não espera concluir para não travar o loop)
                    this.runScan(range.id);
                }
            }
        } catch (error) {
            console.error('[Discovery Scheduler] Erro ao processar agendamentos:', error);
        }
    }

    private static async runScan(rangeId: string) {
        try {
            await discoveryService.scanNetworkRange(rangeId);
            
            // Atualiza a data do último scan
            await prisma.networkRange.update({
                where: { id: rangeId },
                data: { lastScanAt: new Date() }
            });

            console.log(`[Discovery Scheduler] Scan concluído para range ${rangeId}`);
        } catch (error) {
            console.error(`[Discovery Scheduler] Erro no scan do range ${rangeId}:`, error);
        }
    }

    /**
     * Para o serviço
     */
    static stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        console.log('[Discovery Scheduler] Agendador parado.');
    }
}
