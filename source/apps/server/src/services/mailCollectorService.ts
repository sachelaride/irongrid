import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { prisma } from '../utils/prisma';
import { TicketCategory, TicketPriority } from '@prisma/client';
const TicketSource = (require('@prisma/client') as any).TicketSource || { PORTAL: 'PORTAL', MAIL: 'MAIL', API: 'API', SYSTEM: 'SYSTEM' };

export class MailCollectorService {
    private static isPolling = false;

    /**
     * Start Polling - Inicia o monitoramento das caixas de e-mail
     * 
     * Executa a verificação periodicamente conforme o intervalo configurado.
     */
    static startPolling() {
        // Executar a cada 5 minutos
        setInterval(() => this.pollAll(), 5 * 60 * 1000);
        // Execução imediata ao iniciar
        this.pollAll();
    }

    /**
     * Poll All - Verifica todas as contas de e-mail habilitadas
     */
    static async pollAll() {
        if (this.isPolling) return;
        this.isPolling = true;

        try {
            const configs = await (prisma as any).mailCollectorConfig.findMany({
                where: { enabled: true }
            });

            for (const config of configs) {
                await this.processAccount(config).catch(err => {
                    console.error(`[MailCollector] Error processing account ${config.name}:`, err.message);
                });
            }
        } catch (error: any) {
            console.error('[MailCollector] Failed to fetch configurations:', error.message);
        } finally {
            this.isPolling = false;
        }
    }

    /**
     * Process Account - Conecta e processa mensagens de uma conta específica
     */
    private static async processAccount(config: any) {
        const imapConfig = {
            imap: {
                user: config.user,
                password: config.password, // TODO: Descriptografar se estiver criptografado
                host: config.host,
                port: config.port,
                tls: config.secure,
                authTimeout: 3000,
                tlsOptions: { rejectUnauthorized: false }
            }
        };

        const connection = await imaps.connect(imapConfig);
        await connection.openBox(config.folder || 'INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: true
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        for (const message of messages) {
            const all = message.parts.find(p => p.which === '');
            const id = message.attributes.uid;

            if (all) {
                const parsed = await simpleParser(all.body);
                await this.createTicketFromEmail(parsed, config);

                if (config.deleteAfter) {
                    await connection.deleteMessage(id);
                }
            }
        }

        // Atualizar timestamp da última sincronização
        await (prisma as any).mailCollectorConfig.update({
            where: { id: config.id },
            data: { lastSync: new Date() }
        });

        connection.end();
    }

    /**
     * Create Ticket From Email - Converte e-mail em ticket no sistema
     */
    private static async createTicketFromEmail(mail: any, config: any) {
        try {
            const sender = mail.from?.value?.[0]?.address;
            if (!sender) return;

            // Tentar encontrar o usuário pelo e-mail
            const user = await prisma.user.findFirst({
                where: { email: sender }
            });

            // Criar o ticket
            const ticket = await (prisma as any).ticket.create({
                data: {
                    title: mail.subject || '(Sem Assunto)',
                    description: mail.text || mail.html || '',
                    status: 'OPEN',
                    priority: 'MEDIUM',
                    category: config.category || 'INCIDENT',
                    source: 'MAIL',
                    requesterId: user?.id || null, // Se não achar o usuário, fica anônimo ou cai em fila de triagem
                }
            });

            // Registrar atividade inicial
            await (prisma as any).ticketActivity.create({
                data: {
                    ticketId: ticket.id,
                    userId: 'SYSTEM', // Identificador de automação
                    message: `Ticket aberto automaticamente via e-mail (${sender})`,
                    type: 'COMMENT'
                }
            });

            console.log(`[MailCollector] New ticket #${ticket.ticketNumber} created from ${sender}`);
        } catch (error: any) {
            console.error('[MailCollector] Failed to create ticket from email:', error.message);
        }
    }
}
