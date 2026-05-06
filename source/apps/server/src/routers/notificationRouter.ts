/**
 * Router de Canais de Notificação
 * 
 * Gerencia canais de notificação multi-canal (Webhook, Telegram, Slack, etc).
 * Permite configurar, testar e monitorar o envio de notificações de alertas.
 * 
 * @module routers/notificationRouter
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { NotificationService } from '../services/notificationService';
import { ChannelType, AlertSeverity } from '@prisma/client';

/**
 * Definição das rotas relacionadas a notificações
 */
export const notificationRouter = router({
    /**
     * Listar Canais de Notificação
     * Retorna todos os canais cadastrados com a contagem de logs de envio.
     */
    listChannels: protectedProcedure.query(async () => {
        // Busca todos os canais de notificação e inclui a contagem de mensagens enviadas (logs)
        return prisma.notificationChannel.findMany({
            include: {
                _count: {
                    select: { logs: true }
                }
            },
            orderBy: { createdAt: 'desc' } // Ordena pelos mais recentes
        });
    }),

    /**
     * Criar Canal de Notificação
     * Apenas administradores podem criar novos canais.
     */
    createChannel: protectedProcedure
        .input(z.object({
            name: z.string(), // Nome descritivo do canal
            type: z.nativeEnum(ChannelType), // Tipo: WEBHOOK, TELEGRAM, SLACK, etc.
            config: z.any(), // Configurações específicas (URL, tokens, etc) no formato JSON
            severities: z.array(z.nativeEnum(AlertSeverity)).default(['CRITICAL']) // Níveis de alerta que este canal recebe
        }))
        .mutation(async ({ input, ctx }) => {
            // Verifica se o usuário tem privilégios de administrador
            if (ctx.user?.role !== 'ADMIN') {
                throw new Error('Apenas administradores podem criar canais');
            }

            // Cria o novo canal no banco de dados
            return prisma.notificationChannel.create({
                data: {
                    name: input.name,
                    type: input.type,
                    config: input.config as any,
                    severities: input.severities
                }
            });
        }),

    /**
     * Atualizar Canal de Notificação
     * Permite modificar as configurações de um canal existente.
     */
    updateChannel: protectedProcedure
        .input(z.object({
            id: z.string(), // ID do canal a ser atualizado
            name: z.string().optional(),
            config: z.any().optional(),
            severities: z.array(z.nativeEnum(AlertSeverity)).optional(),
            enabled: z.boolean().optional()
        }))
        .mutation(async ({ input, ctx }) => {
            // Verifica permissão de administrador
            if (ctx.user?.role !== 'ADMIN') {
                throw new Error('Apenas administradores podem atualizar canais');
            }

            const { id, ...data } = input;
            const updateData: any = {};

            // Adiciona apenas os campos que foram fornecidos no input para atualização
            if (data.name !== undefined) updateData.name = data.name;
            if (data.config !== undefined) updateData.config = data.config;
            if (data.severities !== undefined) updateData.severities = data.severities;
            if (data.enabled !== undefined) updateData.enabled = data.enabled;

            // Atualiza o registro no Prisma
            return prisma.notificationChannel.update({
                where: { id },
                data: updateData
            });
        }),

    /**
     * Deletar Canal de Notificação
     * Remove permanentemente um canal de notificação.
     */
    deleteChannel: protectedProcedure
        .input(z.object({ id: z.string() })) // ID do canal a ser removido
        .mutation(async ({ input, ctx }) => {
            // Verifica permissão de administrador
            if (ctx.user?.role !== 'ADMIN') {
                throw new Error('Apenas administradores podem deletar canais');
            }

            // Deleta o canal pelo ID fornecido
            return prisma.notificationChannel.delete({
                where: { id: input.id }
            });
        }),

    /**
     * Testar Canal de Notificação
     * Envia uma mensagem de teste para validar a configuração.
     */
    testChannel: protectedProcedure
        .input(z.object({ id: z.string() })) // ID do canal para teste
        .mutation(async ({ input }) => {
            // Chama o serviço de notificação para executar o teste real
            return NotificationService.testChannel(input.id);
        }),

    /**
     * Obter Logs de Envio
     * Retorna o histórico de notificações enviadas.
     */
    getLogs: protectedProcedure
        .input(z.object({
            channelId: z.string().optional(), // Filtro opcional por canal
            limit: z.number().default(50)     // Limite de resultados para paginação/performance
        }).optional())
        .query(async ({ input }) => {
            // Busca os logs de notificação com informações básicas do canal associado
            return prisma.notificationLog.findMany({
                where: input?.channelId ? { channelId: input.channelId } : {},
                include: {
                    channel: {
                        select: { name: true, type: true }
                    }
                },
                orderBy: { sentAt: 'desc' }, // Mais recentes primeiro
                take: input?.limit || 50
            });
        }),

    // ============================================
    // GERENCIAMENTO DE CONFIGURAÇÕES DE EMAIL
    // ============================================

    /**
     * Listar Configurações de Email
     * Retorna os detalhes técnicos dos servidores SMTP configurados.
     */
    listEmailConfigs: protectedProcedure.query(async () => {
        // Busca as configurações de email, omitindo propositalmente o campo 'password' por segurança
        return (prisma as any).emailConfiguration.findMany({
            select: {
                id: true,
                host: true,
                port: true,
                secure: true,
                username: true,
                password: false, // Nunca retorna a senha para o front-end
                fromAddress: true,
                fromName: true,
                lastTested: true,
                testStatus: true,
                testError: true,
                enabled: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }),

    /**
     * Obter Configuração de Email por ID
     */
    getEmailConfig: protectedProcedure
        .input(z.object({ id: z.string() })) // ID da configuração específica
        .query(async ({ input }) => {
            // Busca um único registro, garantindo que a senha não seja carregada
            return (prisma as any).emailConfiguration.findUnique({
                where: { id: input.id },
                select: {
                    id: true,
                    host: true,
                    port: true,
                    secure: true,
                    username: true,
                    password: false,
                    fromAddress: true,
                    fromName: true,
                    lastTested: true,
                    testStatus: true,
                    testError: true,
                    enabled: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
        }),

    /**
     * Criar Configuração de Email (SMTP)
     */
    createEmailConfig: protectedProcedure
        .input(z.object({
            host: z.string(), // Endereço do servidor SMTP
            port: z.number(), // Porta (ex: 587, 465)
            secure: z.boolean().default(true), // Usar SSL/TLS direto
            username: z.string().optional(), // Usuário de autenticação
            password: z.string().optional(), // Senha de autenticação
            fromAddress: z.string().email(), // Email que aparecerá como remetente
            fromName: z.string().default('IronGrid Monitor') // Nome que aparecerá como remetente
        }))
        .mutation(async ({ input, ctx }) => {
            // Apenas administradores podem criar novas configurações
            if (ctx.user?.role !== 'ADMIN') {
                throw new Error('Apenas administradores podem criar configurações de email');
            }

            // Salva a nova configuração no banco de dados
            return (prisma as any).emailConfiguration.create({
                data: input
            });
        }),

    /**
     * Atualizar Configuração de Email
     */
    updateEmailConfig: protectedProcedure
        .input(z.object({
            id: z.string(),
            host: z.string().optional(),
            port: z.number().optional(),
            secure: z.boolean().optional(),
            username: z.string().optional(),
            password: z.string().optional(), // Atualiza a senha se fornecida
            fromAddress: z.string().email().optional(),
            fromName: z.string().optional(),
            enabled: z.boolean().optional()
        }))
        .mutation(async ({ input, ctx }) => {
            // Verifica permissão de administrador
            if (ctx.user?.role !== 'ADMIN') {
                throw new Error('Apenas administradores podem atualizar configurações de email');
            }

            const { id, ...data } = input;

            // Filtra apenas os campos fornecidos para atualizar
            const updateData: any = {};
            if (data.host !== undefined) updateData.host = data.host;
            if (data.port !== undefined) updateData.port = data.port;
            if (data.secure !== undefined) updateData.secure = data.secure;
            if (data.username !== undefined) updateData.username = data.username;
            if (data.password !== undefined) updateData.password = data.password;
            if (data.fromAddress !== undefined) updateData.fromAddress = data.fromAddress;
            if (data.fromName !== undefined) updateData.fromName = data.fromName;
            if (data.enabled !== undefined) updateData.enabled = data.enabled;

            // Realiza a atualização no banco de dados
            return (prisma as any).emailConfiguration.update({
                where: { id },
                data: updateData
            });
        }),

    /**
     * Deletar Configuração de Email
     */
    deleteEmailConfig: protectedProcedure
        .input(z.object({ id: z.string() })) // ID da configuração SMTP
        .mutation(async ({ input, ctx }) => {
            // Verifica permissão de administrador
            if (ctx.user?.role !== 'ADMIN') {
                throw new Error('Apenas administradores podem deletar configurações de email');
            }

            // Remove o registro do banco de dados
            return (prisma as any).emailConfiguration.delete({
                where: { id: input.id }
            });
        }),

    /**
     * Testar Configuração de Email
     * Envia um email de teste real para verificar se as configurações SMTP estão corretas.
     */
    testEmailConfig: protectedProcedure
        .input(z.object({
            id: z.string().optional(), // ID se estiver testando algo já salvo
            testEmail: z.string().email(), // Destinatário do teste
            // Permite testar uma nova configuração antes de salvá-la
            config: z.object({
                host: z.string(),
                port: z.number(),
                secure: z.boolean(),
                username: z.string().optional(),
                password: z.string().optional(),
                fromAddress: z.string().email(),
                fromName: z.string()
            }).optional()
        }))
        .mutation(async ({ input }) => {
            try {
                // Importação dinâmica do nodemailer para evitar carga desnecessária no arranque do servidor
                const nodemailer = await import('nodemailer');

                let smtpConfig: any;

                // Determina se usará a configuração temporária vinda do front ou buscará do banco via ID
                if (input.config) {
                    smtpConfig = input.config;
                } else if (input.id) {
                    const emailConfig = await (prisma as any).emailConfiguration.findUnique({
                        where: { id: input.id }
                    });

                    if (!emailConfig) {
                        throw new Error('Configuração de email não encontrada');
                    }

                    smtpConfig = {
                        host: emailConfig.host,
                        port: emailConfig.port,
                        secure: emailConfig.secure,
                        username: emailConfig.username,
                        password: emailConfig.password,
                        fromAddress: emailConfig.fromAddress,
                        fromName: emailConfig.fromName
                    };
                } else {
                    throw new Error('ID ou configuração devem ser fornecidos');
                }

                // Cria o transportador de email de acordo com as especificações SMTP
                const transporter = nodemailer.createTransport({
                    host: smtpConfig.host,
                    port: smtpConfig.port,
                    secure: smtpConfig.port === 465, // Considera conexão segura automática se for a porta 465
                    auth: smtpConfig.username ? {
                        user: smtpConfig.username,
                        pass: smtpConfig.password
                    } : undefined,
                    tls: {
                        // Permissividade configurada para evitar bloqueios de certificados auto-assinados/inválidos em servidores internos
                        rejectUnauthorized: false
                    }
                });

                // Envia o email de teste formatado em HTML
                const info = await transporter.sendMail({
                    from: `"${smtpConfig.fromName}" <${smtpConfig.fromAddress}>`,
                    to: input.testEmail,
                    subject: '[IronGrid] Teste de Configuração SMTP',
                    text: 'Este é um email de teste para verificar a configuração SMTP do IronGrid.',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-top: 4px solid #10b981; border-radius: 10px;">
                            <h2 style="color: #10b981; margin-top: 0;">✅ Teste de Configuração SMTP</h2>
                            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                                Este é um email de teste para verificar a configuração SMTP do sistema IronGrid.
                            </p>
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px;">
                                <p style="margin: 5px 0;"><b>Servidor SMTP:</b> ${smtpConfig.host}:${smtpConfig.port}</p>
                                <p style="margin: 5px 0;"><b>TLS/SSL:</b> ${smtpConfig.secure ? 'Habilitado' : 'Desabilitado'}</p>
                                <p style="margin: 5px 0;"><b>Data/Hora:</b> ${new Date().toLocaleString('pt-BR')}</p>
                            </div>
                            <p style="color: #10b981; font-size: 16px; font-weight: bold; margin-top: 20px;">
                                ✅ Configuração SMTP funcionando corretamente!
                            </p>
                        </div>
                    `
                });

                // Registra o sucesso do teste no banco de dados se um ID foi fornecido
                if (input.id) {
                    await (prisma as any).emailConfiguration.update({
                        where: { id: input.id },
                        data: {
                            lastTested: new Date(),
                            testStatus: 'success',
                            testError: null
                        }
                    });
                }

                return {
                    success: true,
                    message: 'Email de teste enviado com sucesso',
                    messageId: info.messageId
                };
            } catch (error: any) {
                // Registra a falha do teste e o motivo no banco de dados
                if (input.id) {
                    await (prisma as any).emailConfiguration.update({
                        where: { id: input.id },
                        data: {
                            lastTested: new Date(),
                            testStatus: 'failed',
                            testError: error.message
                        }
                    }).catch(() => { }); // Ignora erros na atualização do log de erro
                }

                return {
                    success: false,
                    message: `Falha ao enviar email: ${error.message}`,
                    error: error.message
                };
            }
        })
});

