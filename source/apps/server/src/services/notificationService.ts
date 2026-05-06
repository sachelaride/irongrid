/**
 * Serviço de Notificações Multi-Canal
 * 
 * Gerencia o envio de alertas e notificações por meio de diversos canais configurados,
 * como Webhooks, Telegram, Slack, Discord e Email. O serviço suporta roteamento
 * baseado em severidade e registro de logs para auditoria de envios.
 * 
 * Canais Suportados:
 * - WEBHOOK: Envio de payload JSON para URLs externas.
 * - TELEGRAM: Mensagens formatadas via Bot API.
 * - SLACK/DISCORD: Integração via Incoming Webhooks.
 * - EMAIL: Envio de mensagens formatadas via SMTP (Nodemailer).
 * 
 * @module services/notificationService
 */

import axios from 'axios';
import { prisma } from '../utils/prisma';
import { Alert, AlertSeverity, ChannelType, User, Ticket } from '@prisma/client';


export class NotificationService {
    /**
     * Send Alert - Enviar alerta para múltiplos canais
     * 
     * Identifica todos os canais de notificação habilitados que aceitam a severidade
     * do alerta atual e dispara as mensagens em paralelo.
     * 
     * @param {Alert & { device?: any }} alert - Objeto do alerta com dados do dispositivo vinculado
     */
    static async sendAlert(alert: Alert & { device?: any }) {
        try {
            // Buscar canais habilitados que aceitam esta severidade
            const channels = await prisma.notificationChannel.findMany({
                where: {
                    enabled: true,
                    severities: {
                        has: alert.severity
                    }
                }
            });

            console.log(`[NotificationService] Sending alert to ${channels.length} channels`);

            // Disparo em paralelo controlado
            const promises = channels.map(channel =>
                this.sendToChannel(channel, alert).catch(error => {
                    console.error(`[NotificationService] Failed to send to ${channel.name}:`, error);
                })
            );

            await Promise.allSettled(promises);
        } catch (error: any) {
            console.error('[NotificationService] Error sending alert:', error.message);
        }
    }

    /**
     * Send to Channel - Direcionar alerta para o driver correto
     * 
     * @param {any} channel - Configuração do canal (banco de dados)
     * @param {Alert & { device?: any }} alert - Dados do alerta
     */
    private static async sendToChannel(channel: any, alert: Alert & { device?: any }) {
        const startTime = Date.now();
        let status = 'sent';
        let response = '';
        let error = '';

        try {
            switch (channel.type) {
                case 'WEBHOOK':
                    response = await this.sendWebhook(channel.config, alert);
                    break;
                case 'TELEGRAM':
                    response = await this.sendTelegram(channel.config, alert);
                    break;
                case 'SLACK':
                    response = await this.sendSlack(channel.config, alert);
                    break;
                case 'DISCORD':
                    response = await this.sendDiscord(channel.config, alert);
                    break;
                case 'EMAIL':
                    response = await this.sendEmail(channel.config, alert);
                    break;
                default:
                    throw new Error(`Unsupported channel type: ${channel.type}`);
            }
        } catch (err: any) {
            status = 'failed';
            error = err.message;
            throw err;
        } finally {
            // Registro de Log de Notificação para fins de rastreabilidade
            await prisma.notificationLog.create({
                data: {
                    channelId: channel.id,
                    alertId: alert.id,
                    status,
                    message: this.formatAlertMessage(alert),
                    response: response.substring(0, 1000), // Limitar tamanho
                    error: error.substring(0, 1000)
                }
            }).catch(err => console.error('[NotificationService] Failed to log:', err));
        }
    }

    /**
     * Send Webhook - Driver HTTP Webhook
     */
    private static async sendWebhook(config: any, alert: Alert & { device?: any }): Promise<string> {
        const payload = {
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            device: alert.device?.name || 'Unknown',
            deviceIp: alert.device?.ipAddress,
            timestamp: alert.createdAt,
            alertId: alert.id
        };

        const response = await axios.post(config.url, payload, {
            headers: config.headers || {},
            timeout: 10000
        });

        return `Status: ${response.status}`;
    }

    /**
     * Send Telegram - Driver Bot API
     */
    private static async sendTelegram(config: any, alert: Alert & { device?: any }): Promise<string> {
        const severityEmoji = {
            INFO: 'ℹ️',
            WARNING: '⚠️',
            CRITICAL: '🚨'
        };

        const message =
            `${severityEmoji[alert.severity]} *${alert.title}*\n\n` +
            `${alert.message}\n\n` +
            `📍 Dispositivo: ${alert.device?.name || 'N/A'}\n` +
            `🌐 IP: ${alert.device?.ipAddress || 'N/A'}\n` +
            `⏰ ${new Date(alert.createdAt).toLocaleString('pt-BR')}`;

        const response = await axios.post(
            `https://api.telegram.org/bot${config.botToken}/sendMessage`,
            {
                chat_id: config.chatId,
                text: message,
                parse_mode: 'Markdown'
            },
            { timeout: 10000 }
        );

        return `Message ID: ${response.data.result.message_id}`;
    }

    /**
     * Send Slack - Driver Incoming Webhook
     */
    private static async sendSlack(config: any, alert: Alert & { device?: any }): Promise<string> {
        const colorMap = {
            INFO: '#36a64f',
            WARNING: '#ff9900',
            CRITICAL: '#ff0000'
        };

        const payload = {
            text: `*${alert.title}*`,
            attachments: [{
                color: colorMap[alert.severity],
                fields: [
                    { title: 'Mensagem', value: alert.message, short: false },
                    { title: 'Dispositivo', value: alert.device?.name || 'N/A', short: true },
                    { title: 'IP', value: alert.device?.ipAddress || 'N/A', short: true },
                    { title: 'Severidade', value: alert.severity, short: true },
                    { title: 'Data/Hora', value: new Date(alert.createdAt).toLocaleString('pt-BR'), short: true }
                ]
            }]
        };

        await axios.post(config.webhookUrl, payload, { timeout: 10000 });
        return 'Sent to Slack';
    }

    /**
     * Send Discord - Driver Webhook
     */
    private static async sendDiscord(config: any, alert: Alert & { device?: any }): Promise<string> {
        const colorMap = {
            INFO: 3447003,    // Azul
            WARNING: 16776960, // Amarelo
            CRITICAL: 15158332 // Vermelho
        };

        const payload = {
            embeds: [{
                title: alert.title,
                description: alert.message,
                color: colorMap[alert.severity],
                fields: [
                    { name: 'Dispositivo', value: alert.device?.name || 'N/A', inline: true },
                    { name: 'IP', value: alert.device?.ipAddress || 'N/A', inline: true },
                    { name: 'Severidade', value: alert.severity, inline: true }
                ],
                timestamp: alert.createdAt
            }]
        };

        await axios.post(config.webhookUrl, payload, { timeout: 10000 });
        return 'Sent to Discord';
    }

    /**
     * Send Email - Driver SMTP
     */
    public static async sendEmail(config: any, alert: Alert & { device?: any }): Promise<string> {
        try {
            const nodemailer = await import('nodemailer');

            // If config doesn't have SMTP settings, load from EmailConfiguration
            let smtpConfig = config;
            if (!config.host) {
                const emailConfig = await (prisma as any).emailConfiguration.findFirst({
                    where: { enabled: true }
                });

                if (!emailConfig) throw new Error('No email configuration found');

                smtpConfig = {
                    host: emailConfig.host,
                    port: emailConfig.port,
                    secure: emailConfig.secure,
                    user: emailConfig.username,
                    pass: emailConfig.password,
                    from: `"${emailConfig.fromName}" <${emailConfig.fromAddress}>`
                };
            }

            const transporter = nodemailer.createTransport({
                host: smtpConfig.host,
                port: parseInt(smtpConfig.port) || 587,
                secure: parseInt(smtpConfig.port) === 465, // Only 465 is implicit SSL
                auth: (smtpConfig.user || smtpConfig.username) ? {
                    user: smtpConfig.user || smtpConfig.username,
                    pass: smtpConfig.pass || smtpConfig.password
                } : undefined,
                tls: {
                    rejectUnauthorized: false
                }
            });

            const severityColors = {
                INFO: '#2563eb',
                WARNING: '#ff9900',
                CRITICAL: '#ff0000'
            };

            const info = await transporter.sendMail({
                from: smtpConfig.from || config.from || '"IronGrid Monitor" <noreply@irongrid.com>',
                to: config.to || config.recipients,
                subject: `[IronGrid - ${alert.severity}] ${alert.title}`,
                text: this.formatAlertMessage(alert),
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-top: 4px solid ${severityColors[alert.severity]}; border-radius: 10px;">
                        <h2 style="color: ${severityColors[alert.severity]}; margin-top: 0;">${alert.title}</h2>
                        <p style="font-size: 16px; color: #374151; line-height: 1.6;">${alert.message}</p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                            <p style="margin: 5px 0;"><b>Dispositivo:</b> ${alert.device?.name || 'N/A'}</p>
                            <p style="margin: 5px 0;"><b>IP:</b> ${alert.device?.ipAddress || 'N/A'}</p>
                            <p style="margin: 5px 0;"><b>Severidade:</b> ${alert.severity}</p>
                            <p style="margin: 5px 0;"><b>Data/Hora:</b> ${new Date(alert.createdAt).toLocaleString('pt-BR')}</p>
                        </div>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">Esta mensagem foi enviada automaticamente pelo sistema IronGrid.</p>
                    </div>
                `
            });

            return `Email sent: ${info.messageId}`;
        } catch (error: any) {
            console.error('[NotificationService] Email error:', error.message);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    /**
     * Notify Ticket Opened - Notificar abertura de chamado
     * 
     * Envia um email para os atendentes (vínculo com depto de Informática)
     * quando um novo chamado de suporte é criado.
     * 
     * @param {any} ticket - Objeto do ticket recém-criado
     */
    static async notifyTicketOpened(ticket: any) {
        try {
            // Buscar emails dos atendentes (ADMIN, OPERATOR, TECNICO) que pertencem ao departamento de Informatica
            const attendants = await prisma.user.findMany({
                where: {
                    role: { in: ['ADMIN', 'OPERATOR', 'TECNICO' as any] },
                    email: { not: null } as any,
                    department: {
                        name: {
                            contains: 'Informatica',
                            mode: 'insensitive'
                        }
                    }
                },
                select: { email: true }
            }) as any;

            const recipients = attendants.map((a: any) => a.email).filter(Boolean) as string[];
            if (recipients.length === 0) return;

            // Buscar canal de email padrão
            const emailChannel = await prisma.notificationChannel.findFirst({
                where: { type: 'EMAIL', enabled: true }
            });

            if (!emailChannel) {
                console.log('[NotificationService] No enabled EMAIL channel found for ticket notification');
                return;
            }

            const config = emailChannel.config as any;

            const nodemailer = await import('nodemailer');
            const transporter = nodemailer.createTransport({
                host: config.host,
                port: parseInt(config.port) || 587,
                secure: parseInt(config.port) === 465,
                auth: {
                    user: config.user || config.username,
                    pass: config.pass || config.password
                }
            });

            await transporter.sendMail({
                from: config.from || '"IronGrid Services" <noreply@irongrid.com>',
                to: recipients.join(', '),
                subject: `[NOVO CHAMADO] #${ticket.ticketNumber}: ${ticket.title}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-top: 4px solid #2563eb; border-radius: 10px;">
                        <h2 style="color: #2563eb; margin-top: 0;">Novo Chamado de Suporte</h2>
                        <p>Um novo chamado foi aberto e aguarda atendimento.</p>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p><b>Número:</b> #${ticket.ticketNumber}</p>
                            <p><b>Título:</b> ${ticket.title}</p>
                            <p><b>Prioridade:</b> ${ticket.priority}</p>
                            <p><b>Solicitante:</b> ${ticket.requesterId}</p>
                        </div>
                        <p><a href="http://irongrid.local/tickets" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Portal de Chamados</a></p>
                    </div>
                `
            });

            console.log(`[NotificationService] Ticket notification sent to ${recipients.length} attendants`);
        } catch (error: any) {
            console.error('[NotificationService] Error notifying attendants:', error.message);
        }
    }

    /**
     * Notify Ticket Resolved - Notificar conclusão de chamado
     * 
     * Envia um email para o solicitante informando que seu chamado foi resolvido.
     * 
     * @param {string} ticketId - ID único do ticket
     */
    static async notifyTicketResolved(ticketId: string) {
        try {
            const ticket = await prisma.ticket.findUnique({
                where: { id: ticketId },
                include: { requester: true }
            });

            if (!ticket || !(ticket.requester as any)?.email) return;

            const emailChannel = await prisma.notificationChannel.findFirst({
                where: { type: 'EMAIL', enabled: true }
            });

            if (!emailChannel) return;

            const config = emailChannel.config as any;

            const nodemailer = await import('nodemailer');
            const transporter = nodemailer.createTransport({
                host: config.host,
                port: parseInt(config.port) || 587,
                secure: parseInt(config.port) === 465,
                auth: {
                    user: config.user || config.username,
                    pass: config.pass || config.password
                }
            });

            await transporter.sendMail({
                from: config.from || '"IronGrid Services" <noreply@irongrid.com>',
                to: (ticket.requester as any).email,
                subject: `[RESOLVIDO] Chamado #${ticket.ticketNumber}: ${ticket.title}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-top: 4px solid #10b981; border-radius: 10px;">
                        <h2 style="color: #059669; margin-top: 0;">Chamado Resolvido!</h2>
                        <p>Olá <b>${ticket.requester?.name || 'Solicitante'}</b>,</p>
                        <p>Informamos que o seu chamado <b>#${ticket.ticketNumber}</b> foi solucionado pela nossa equipe técnica.</p>
                        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p><b>Assunto:</b> ${ticket.title}</p>
                            <p><b>Status:</b> RESOLVIDO</p>
                        </div>
                        <p>Por favor, acesse o sistema para avaliar o atendimento e fechar o chamado.</p>
                        <p><a href="http://irongrid.local/tickets" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Avaliar Atendimento</a></p>
                    </div>
                `
            });

            console.log(`[NotificationService] Resolution notification sent to ${ticket.requester?.email}`);
        } catch (error: any) {
            console.error('[NotificationService] Error notifying requester:', error.message);
        }
    }

    /**
     * Test Channel - Testar conectividade de um canal
     * 
     * Dispara um alerta fictício para validar se a integração está ativa e correta.
     * 
     * @param {string} channelId - ID do canal a ser testado
     * @returns {Promise<Object>} Resultado do teste (sucesso/falha e mensagem)
     */
    static async testChannel(channelId: string): Promise<{ success: boolean; message: string }> {
        try {
            const channel = await prisma.notificationChannel.findUnique({
                where: { id: channelId }
            });

            if (!channel) return { success: false, message: 'Canal não encontrado' };

            // Criar alerta de teste
            const testAlert: any = {
                id: 'test',
                title: 'Teste de Conectividade',
                message: 'Este é um teste de notificação do IronGrid',
                severity: 'INFO',
                createdAt: new Date(),
                device: { name: 'Sistema IronGrid', ipAddress: 'localhost' }
            };

            await this.sendToChannel(channel, testAlert);

            // Atualizar status do teste
            await prisma.notificationChannel.update({
                where: { id: channelId },
                data: { lastTested: new Date(), testStatus: 'success' }
            });

            return { success: true, message: 'Teste enviado com sucesso' };
        } catch (error: any) {
            // Atualizar status do teste
            await prisma.notificationChannel.update({
                where: { id: channelId },
                data: { lastTested: new Date(), testStatus: 'failed' }
            }).catch(() => { });

            return { success: false, message: error.message };
        }
    }

    /**
     * Notify Alert Resolved - Notificar resolução de alerta
     * 
     * Envia um email informando que um alerta específico foi resolvido.
     * 
     * @param {Alert & { device?: any }} alert - Objeto do alerta resolvido
     */
    static async notifyAlertResolved(alert: Alert & { device?: any }) {
        try {
            const emailChannel = await prisma.notificationChannel.findFirst({
                where: { type: 'EMAIL', enabled: true }
            });

            if (!emailChannel) return;

            const config = emailChannel.config as any;
            const nodemailer = await import('nodemailer');

            const transporter = nodemailer.createTransport({
                host: config.host,
                port: parseInt(config.port) || 587,
                secure: parseInt(config.port) === 465,
                auth: {
                    user: config.user || config.username,
                    pass: config.pass || config.password
                },
                tls: { rejectUnauthorized: false }
            });

            await transporter.sendMail({
                from: config.from || '"IronGrid Monitor" <noreply@irongrid.com>',
                to: config.to || config.recipients,
                subject: `[RESOLVIDO] ${alert.title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-top: 4px solid #10b981; border-radius: 10px;">
                        <h2 style="color: #059669; margin-top: 0;">Alerta Resolvido</h2>
                        <p style="font-size: 16px; color: #374151; line-height: 1.6;">O seguinte incidente foi marcado como resolvido:</p>
                        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><b>Incidente:</b> ${alert.title}</p>
                            <p style="margin: 5px 0;"><b>Dispositivo:</b> ${alert.device?.name || 'N/A'}</p>
                            <p style="margin: 5px 0;"><b>Resolvido em:</b> ${new Date().toLocaleString('pt-BR')}</p>
                        </div>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">Esta mensagem foi enviada automaticamente pelo sistema IronGrid.</p>
                    </div>
                `
            });

            console.log(`[NotificationService] Resolution notification sent for alert ${alert.id}`);
        } catch (error: any) {
            console.error('[NotificationService] Error notifying alert resolution:', error.message);
        }
    }

    /**
     * Format Alert Message - Formatação para texto simples
     * @private
     */
    private static formatAlertMessage(alert: Alert & { device?: any }): string {
        return `[${alert.severity}] ${alert.title}: ${alert.message} (${alert.device?.name || 'N/A'})`;
    }

    /**
     * Notify Critical - Notificação manual de erro crítico
     * 
     * Método utilitário para disparar notificações fora do fluxo padrão de triggers do DB.
     * 
     * @param {string} title - Título da mensagem
     * @param {string} message - Conteúdo detalhado
     */
    static async notifyCritical(title: string, message: string) {
        const alert: any = {
            id: 'manual',
            title,
            message,
            severity: 'CRITICAL',
            createdAt: new Date()
        };

        await this.sendAlert(alert);
    }
}
