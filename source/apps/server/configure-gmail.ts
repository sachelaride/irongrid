/**
 * Script para configurar email SMTP do Gmail
 * 
 * Execute com: npx tsx configure-gmail.ts
 */

// Importa o cliente do Prisma para interação com o banco de dados
import { PrismaClient } from '@prisma/client';

// Inicializa a instância do Prisma
const prisma = new PrismaClient();

/**
 * Função principal que executa a configuração do SMTP
 */
async function main() {
    console.log('Configurando SMTP do Gmail...');

    // Cria ou atualiza a configuração de email no banco de dados para o Gmail
    const config = await (prisma as any).emailConfiguration.upsert({
        // Identificador fixo para a configuração do gmail
        where: { id: 'gmail-config' },
        // Dados para atualizar caso já exista
        update: {
            password: 'iujnbozyoqjqaqbg', // Senha de app gerada no Google (sem espaços)
            enabled: true,                // Ativa a configuração
            updatedAt: new Date()         // Atualiza a data de modificação
        },
        // Dados para criar caso não exista
        create: {
            id: 'gmail-config',
            host: 'smtp.gmail.com',       // Servidor SMTP do Gmail
            port: 587,                    // Porta padrão para STARTTLS
            secure: false,                 // false pois a porta 587 usa STARTTLS, não SSL direto
            username: 'german.sachelaride@gmail.com', // Usuário/Email do Gmail
            password: 'iujnbozyoqjqaqbg', // Senha de app do Gmail
            fromAddress: 'german.sachelaride@gmail.com', // Endereço de remetente
            fromName: 'IronGrid Monitor',   // Nome que aparecerá no remetente
            enabled: true                 // Garante que comece ativado
        }
    });

    // Exibe no console os detalhes da configuração criada/atualizada
    console.log('✅ Configuração de email criada/atualizada:', {
        id: config.id,
        host: config.host,
        port: config.port,
        username: config.username,
        enabled: config.enabled
    });

    console.log('\n📧 Testando envio de email...');

    // Importação dinâmica do nodemailer para realizar o teste de envio
    const nodemailer = await import('nodemailer');

    // Cria o transportador do nodemailer com as configurações obtidas
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        requireTLS: true, // Força o uso de STARTTLS para segurança
        auth: {
            user: config.username,
            pass: config.password
        },
        tls: {
            minVersion: 'TLSv1.2' // Define a versão mínima do TLS suportada
        }
    });

    try {
        // Tenta enviar um email de teste para o próprio usuário
        const info = await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromAddress}>`,
            to: config.username, // Envia para o próprio email configurado
            subject: '[IronGrid] Configuração SMTP Ativada',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-top: 4px solid #10b981; border-radius: 10px;">
                    <h2 style="color: #10b981; margin-top: 0;">✅ SMTP Configurado com Sucesso!</h2>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        A configuração de email do sistema IronGrid foi ativada com sucesso.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px;">
                        <p style="margin: 5px 0;"><b>Servidor:</b> ${config.host}:${config.port}</p>
                        <p style="margin: 5px 0;"><b>Conta:</b> ${config.username}</p>
                        <p style="margin: 5px 0;"><b>Data/Hora:</b> ${new Date().toLocaleString('pt-BR')}</p>
                    </div>
                    <p style="color: #10b981; font-size: 16px; font-weight: bold; margin-top: 20px;">
                        O sistema está pronto para enviar notificações por email!
                    </p>
                </div>
            `
        });

        console.log('✅ Email de teste enviado com sucesso!');
        console.log('   Message ID:', info.messageId);

        // Atualiza o banco de dados marcando o teste como bem-sucedido
        await (prisma as any).emailConfiguration.update({
            where: { id: 'gmail-config' },
            data: {
                lastTested: new Date(),
                testStatus: 'success',
                testError: null
            }
        });

    } catch (error: any) {
        // Caso ocorra erro no envio, exibe no console
        console.error('❌ Erro ao enviar email:', error.message);

        // Atualiza o banco de dados registrando a falha no teste e a mensagem de erro
        await (prisma as any).emailConfiguration.update({
            where: { id: 'gmail-config' },
            data: {
                lastTested: new Date(),
                testStatus: 'failed',
                testError: error.message
            }
        });
    }
}

// Executa a função principal, captura erros globais e desconecta do Prisma ao finalizar
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

