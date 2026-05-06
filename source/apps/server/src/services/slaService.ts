/**
 * Serviço de Gestão de SLA (Service Level Agreement)
 * 
 * Responsável pelo cálculo automatizado de prazos de atendimento (Resposta) e 
 * solução (Resolução) de chamados, baseando-se na criticidade (Impacto x Urgência)
 * e respeitando o horário comercial configurado.
 * 
 * Regras de Negócio:
 * - Horário Comercial: 08:00 às 17:00
 * - Dias Úteis: Segunda a Sexta-feira
 * - Matriz de Prioridade: Cálculos dinâmicos baseados no cruzamento de impacto e urgência.
 * 
 * @module services/slaService
 */

import { prisma } from '../utils/prisma';
import { TicketPriority, TicketImpact, TicketUrgency } from '@prisma/client';

export class SLAService {
    /**
     * Calculate Priority - Determinar prioridade via Matriz de Criticidade
     * 
     * @param {TicketImpact} impact - Nível de impacto no negócio
     * @param {TicketUrgency} urgency - Nível de urgência da solicitação
     * @returns {TicketPriority} Prioridade resultante (LOW, MEDIUM, HIGH, CRITICAL)
     */
    static calculatePriority(impact: TicketImpact, urgency: TicketUrgency): TicketPriority {
        if (impact === 'HIGH' && urgency === 'HIGH') return 'CRITICAL';
        if (impact === 'HIGH' || urgency === 'HIGH') return 'HIGH';
        if (impact === 'LOW' && urgency === 'LOW') return 'LOW';
        return 'MEDIUM';
    }

    /**
     * Calculate Deadline - Calcular data limite para Resposta ou Resolução
     * 
     * Verifica se existe um SLA específico para o tipo de serviço. Caso contrário,
     * utiliza as configurações globais por prioridade. O cálculo ignora horários
     * fora do expediente e finais de semana.
     * 
     * @param {TicketPriority} priority - Prioridade do chamado
     * @param {'RESPONSE' | 'RESOLUTION'} type - Tipo de deadline desejado
     * @param {string} [serviceTypeId] - ID opcional do tipo de serviço para SLA customizado
     * @returns {Promise<Date>} Data e hora limite calculada
     */
    async calculateDeadline(priority: TicketPriority, type: 'RESPONSE' | 'RESOLUTION', serviceTypeId?: string): Promise<Date> {
        let minutes = 0;

        // 1. Tenta obter SLA específico do Tipo de Serviço
        if (serviceTypeId) {
            const serviceType = await prisma.serviceType.findUnique({
                where: { id: serviceTypeId }
            });

            if (serviceType) {
                const specificMinutes = type === 'RESPONSE' ? serviceType.responseTimeMinutes : serviceType.resolutionTimeMinutes;
                if (specificMinutes !== null && specificMinutes !== undefined) {
                    minutes = specificMinutes;
                }
            }
        }

        // 2. Fallback para configuração global por prioridade
        if (minutes === 0) {
            const config = await prisma.sLAConfiguration.findUnique({
                where: { priority }
            });

            // Tempos padrão em minutos (caso o banco não esteja populado)
            const defaults = {
                CRITICAL: { response: 15, resolution: 60 },    // 15min / 1h
                HIGH: { response: 30, resolution: 240 },       // 30min / 4h
                MEDIUM: { response: 60, resolution: 480 },     // 1h / 8h
                LOW: { response: 120, resolution: 1440 },      // 2h / 24h (úteis)
            };

            minutes = config
                ? (type === 'RESPONSE' ? config.responseTimeMinutes : config.resolutionTimeMinutes)
                : defaults[priority][type.toLowerCase() as 'response' | 'resolution'];
        }

        return this.addBusinessMinutes(new Date(), minutes);
    }

    /**
     * Add Business Minutes - Adicionar minutos respeitando o calendário comercial
     * 
     * Pula finais de semana e ajusta o horário para dentro da janela 08:00 - 17:00.
     * 
     * @param {Date} startDate - Data de início (geralmente data de abertura)
     * @param {number} minutesToAdd - Quantidade de minutos úteis a adicionar
     * @returns {Date} Nova data calculada
     * @private
     */
    private addBusinessMinutes(startDate: Date, minutesToAdd: number): Date {
        let currentDate = new Date(startDate);
        let remainingMinutes = minutesToAdd;

        const BUSINESS_START = 8;
        const BUSINESS_END = 17;

        while (remainingMinutes > 0) {
            const day = currentDate.getDay();

            // Tratamento de fds (Sábado=6, Domingo=0)
            if (day === 0) {
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(BUSINESS_START, 0, 0, 0);
            } else if (day === 6) {
                currentDate.setDate(currentDate.getDate() + 2);
                currentDate.setHours(BUSINESS_START, 0, 0, 0);
                continue;
            }

            // Ajusta se estiver antes do início do expediente
            if (currentDate.getHours() < BUSINESS_START) {
                currentDate.setHours(BUSINESS_START, 0, 0, 0);
            }

            // Ajusta se estiver após o fim do expediente
            if (currentDate.getHours() >= BUSINESS_END) {
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(BUSINESS_START, 0, 0, 0);
                continue;
            }

            // Calcula tempo restante dentro do dia comercial atual
            const endOfDay = new Date(currentDate);
            endOfDay.setHours(BUSINESS_END, 0, 0, 0);

            const diffMs = endOfDay.getTime() - currentDate.getTime();
            const availableMinutes = Math.floor(diffMs / 60000);

            if (remainingMinutes <= availableMinutes) {
                currentDate.setMinutes(currentDate.getMinutes() + remainingMinutes);
                remainingMinutes = 0;
            } else {
                remainingMinutes -= availableMinutes;
                currentDate.setDate(currentDate.getDate() + 1);
                currentDate.setHours(BUSINESS_START, 0, 0, 0);
            }
        }

        return currentDate;
    }

    /**
     * Seed Defaults - Popular configurações iniciais de SLA
     * Útil em ambiente de primeira instalação.
     */
    async seedDefaults() {
        const defaults = [
            { priority: TicketPriority.CRITICAL, responseTimeMinutes: 15, resolutionTimeMinutes: 60 },
            { priority: TicketPriority.HIGH, responseTimeMinutes: 30, resolutionTimeMinutes: 240 },
            { priority: TicketPriority.MEDIUM, responseTimeMinutes: 60, resolutionTimeMinutes: 480 },
            { priority: TicketPriority.LOW, responseTimeMinutes: 120, resolutionTimeMinutes: 1440 },
        ];

        for (const item of defaults) {
            await prisma.sLAConfiguration.upsert({
                where: { priority: item.priority },
                update: {},
                create: item
            });
        }
    }
}
