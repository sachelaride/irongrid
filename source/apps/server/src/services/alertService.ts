/**
 * Serviço de Alertas e Automação
 * 
 * Responsável por gerenciar o ciclo de vida de alertas no sistema,
 * incluindo criação, resolução e automação de abertura de chamados (tickets)
 * para incidentes críticos.
 * 
 * Funcionalidades:
 * - Criação de novos alertas (Manual ou Automático)
 * - Registro em trilha de auditoria
 * - Automação: Alertas CRITICAL geram chamados automaticamente
 * - Integração com NotificationService para avisos urgentes
 * 
 * @module services/alertService
 */

import { prisma } from '../utils/prisma';
import { AlertSeverity, AlertStatus, TicketImpact, TicketUrgency, TicketCategory } from '@prisma/client';
import { SLAService } from './slaService';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export class AlertService {
    /**
     * Create Alert - Criar um novo alerta
     * 
     * Registra um alerta no banco de dados e verifica regras de automação.
     * Alertas com severidade CRITICAL disparam o fluxo de auto-chamado e notificação.
     * 
     * @param {Object} data - Dados do alerta
     * @param {string} data.title - Título resumido
     * @param {string} data.message - Detalhamento técnico
     * @param {AlertSeverity} data.severity - Severidade (INFO, WARNING, CRITICAL, etc)
     * @param {string} [data.deviceId] - ID do dispositivo vinculado
     */
    async createAlert(data: {
        title: string;
        message: string;
        severity: AlertSeverity;
        deviceId?: string;
    }) {
        const alert = await prisma.alert.create({
            data: {
                ...data,
                status: AlertStatus.ACTIVE
            }
        });

        console.log(`[AlertService] New Alert: [${data.severity}] ${data.title}`);

        // Log de Auditoria
        await AuditService.log({
            action: 'CREATE_ALERT',
            resource: 'Alert',
            resourceId: alert.id,
            details: { severity: data.severity, title: data.title }
        });

        // Regra de Automação: Alerta CRÍTICO -> Gera Chamado Automático + Notificação Externa
        if (data.severity === AlertSeverity.CRITICAL) {
            await this.autoCreateTicket(alert);

            // Buscar nível do dispositivo para saber se deve silenciar notificação global
            let shouldNotify = true;
            if (data.deviceId) {
                const device = await prisma.device.findUnique({
                    where: { id: data.deviceId },
                    select: { monitoringLevel: true }
                });
                if (device && device.monitoringLevel === 0) {
                    shouldNotify = false;
                    console.log(`[AlertService] Silencing global notification for Level 0 device: ${data.deviceId}`);
                }
            }

            if (shouldNotify) {
                await NotificationService.notifyCritical(data.title, data.message);
            }
        }

        return alert;
    }

    /**
     * Resolve Alert - Resolver um alerta
     * 
     * Marca o alerta como resolvido e registra o horário da solução.
     * 
     * @param {string} id - ID do alerta no banco
     */
    async resolveAlert(id: string) {
        const alert = await prisma.alert.update({
            where: { id },
            data: {
                status: AlertStatus.RESOLVED,
                resolvedAt: new Date()
            },
            include: { device: true }
        });

        // Notificar resolução por email - Silenciar se nível 0
        const level = (alert.device as any)?.monitoringLevel ?? 0;
        if (level > 0) {
            await NotificationService.notifyAlertResolved(alert);
        } else {
            console.log(`[AlertService] Silencing resolution notification for Level 0 device: ${alert.deviceId}`);
        }

        return alert;
    }

    /**
     * Auto-create Ticket - Abertura Automática de Chamado
     * 
     * Fluxo interno para transformar um alerta crítico em um chamado ITSM vinculando
     * o dispositivo, calculando SLA baseado na prioridade e notificando a equipe.
     * 
     * @param {Alert} alert - Registro do alerta original
     */
    private async autoCreateTicket(alert: any) {
        try {
            console.log(`[AlertService] Auto-creating ticket for critical alert: ${alert.id}`);

            // Evitar duplicidade: Verifica se já existe um chamado vinculado a este alerta
            const existingTicket = await (prisma as any).ticket.findFirst({
                where: { alertId: alert.id }
            });

            if (existingTicket) return;

            const slaService = new SLAService();
            // Alerta Crítico = Impacto Alto / Urgência Alta
            const priority = SLAService.calculatePriority(TicketImpact.HIGH, TicketUrgency.HIGH);
            const slaDeadline = await slaService.calculateDeadline(priority, 'RESOLUTION');
            const slaResponse = await slaService.calculateDeadline(priority, 'RESPONSE');

            await (prisma as any).ticket.create({
                data: {
                    title: `[AUTO] ${alert.title}`,
                    description: `Chamado aberto automaticamente devido ao alerta crítico: \n\n${alert.message}`,
                    impact: TicketImpact.HIGH,
                    urgency: TicketUrgency.HIGH,
                    priority,
                    category: TicketCategory.INCIDENT,
                    deviceId: alert.deviceId,
                    alertId: alert.id,
                    slaDeadline,
                    slaResponseTime: slaResponse,
                    activities: {
                        create: {
                            message: 'Chamado aberto automaticamente pelo IronGrid Automation System',
                            type: 'COMMENT'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('[AlertService] Failed to auto-create ticket:', error);
        }
    }

    /**
     * List Active - Listar Alertas Ativos
     * 
     * Retorna todos os alertas com status ACTIVE com os dados do dispositivo vinculado.
     */
    async listActive() {
        return prisma.alert.findMany({
            where: { status: AlertStatus.ACTIVE },
            include: { device: { select: { name: true, ipAddress: true } } },
            orderBy: { createdAt: 'desc' }
        });
    }
}
