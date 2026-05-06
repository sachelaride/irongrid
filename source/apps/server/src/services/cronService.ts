import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '../utils/prisma';
import { RemoteActionService } from './remoteActionService';
import fs from 'fs';
import path from 'path';
import { Server as SocketServer } from 'socket.io';

const LOG_DIR = path.join(process.cwd(), 'cron_logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const remoteActionService = new RemoteActionService();

export class CronService {
    private static scheduledJobs: Map<string, ScheduledTask> = new Map();
    private static io: SocketServer | null = null;

    /**
     * Start - Inicializa o serviço e carrega agendamentos do banco
     */
    static async start(io: SocketServer) {
        this.io = io;
        console.log('[CronService] Iniciando serviço de agendamento...');
        
        // Limpa qualquer execução pendente (status RUNNING) que possa ter ficado presa no restart
        await (prisma as any).cronJobLog.updateMany({
            where: { status: 'RUNNING' },
            data: { status: 'FAILED', error: 'Servidor reiniciado durante execução', finishedAt: new Date() }
        });

        const jobs = await (prisma as any).cronJob.findMany({
            where: { enabled: true }
        });

        for (const job of jobs) {
            this.scheduleJob(job);
        }
        
        console.log(`[CronService] ${jobs.length} tarefas agendadas com sucesso.`);
    }

    /**
     * Schedule Job - Registra uma tarefa no node-cron
     */
    static scheduleJob(job: any) {
        // Se já existe, interrompe antes de reagendar
        if (this.scheduledJobs.has(job.id)) {
            this.scheduledJobs.get(job.id)?.stop();
        }

        try {
            const task = cron.schedule(job.schedule, async () => {
                await this.executeJob(job.id);
            });
            this.scheduledJobs.set(job.id, task);
            console.log(`[CronService] Tarefa agendada: ${job.name} (${job.schedule})`);
        } catch (error) {
            console.error(`[CronService] Erro ao agendar tarefa ${job.name}:`, error);
        }
    }

    /**
     * Unschedule Job - Remove uma tarefa do node-cron
     */
    static unscheduleJob(jobId: string) {
        if (this.scheduledJobs.has(jobId)) {
            this.scheduledJobs.get(jobId)?.stop();
            this.scheduledJobs.delete(jobId);
            console.log(`[CronService] Tarefa removida do agendamento: ${jobId}`);
        }
    }

    /**
     * Execute Job - Dispara a execução de uma tarefa
     */
    static async executeJob(jobId: string) {
        const job = await (prisma as any).cronJob.findUnique({
            where: { id: jobId }
        });

        if (!job || !job.enabled) return;

        console.log(`[CronService] Executando tarefa: ${job.name}`);
        
        // 1. Cria registro de Log no DB
        const log = await (prisma as any).cronJobLog.create({
            data: {
                cronJobId: job.id,
                status: 'RUNNING',
                startedAt: new Date()
            }
        });

        const logFilePath = path.join(LOG_DIR, `job_${job.id}.log`);
        const timestamp = new Date().toLocaleString();
        fs.writeFileSync(logFilePath, `--- Início da Execução: ${timestamp} ---\n`);

        try {
            let output = '';
            
            // 2. Executa a Ação (Ex: Remote Script)
            if (job.action === 'executeScript' && job.targetId && this.io) {
                const device = await prisma.device.findUnique({ where: { id: job.targetId } });
                if (device?.agentId) {
                    const actionLog = await remoteActionService.triggerAction(this.io, {
                        agentId: device.agentId,
                        action: 'executeScript',
                        parameters: {
                            ...(job.parameters as any),
                            cronJobLogId: log.id // Link to this cron log
                        }
                    });
                    
                    output = `Script remoto disparado para dispositivo ${device.name}. LogId: ${actionLog.id}. Aguardando retorno do agente...`;
                    
                    // Nota: Não atualizamos o status para SUCCESS aqui. 
                    // Esperamos o RemoteActionService receber o resultado.
                    fs.appendFileSync(logFilePath, output + '\n');
                    return; // Sai da função sem marcar como finalizada
                } else {
                    throw new Error('Dispositivo alvo offline ou sem agente.');
                }
            } else {
                throw new Error(`Ação '${job.action}' não suportada ou parâmetros insuficientes.`);
            }

            // 3. Atualiza Log de Sucesso
            fs.appendFileSync(logFilePath, output + `\n--- Sucesso: ${new Date().toLocaleString()} ---\n`);
            
            await (prisma as any).cronJobLog.update({
                where: { id: log.id },
                data: {
                    status: 'SUCCESS',
                    output,
                    finishedAt: new Date()
                }
            });

            await (prisma as any).cronJob.update({
                where: { id: job.id },
                data: { lastRun: new Date() }
            });

        } catch (error: any) {
            console.error(`[CronService] Falha na execução da tarefa ${job.name}:`, error);
            
            const errorMsg = error?.message || String(error);
            fs.appendFileSync(logFilePath, `ERRO: ${errorMsg}\n--- Falha: ${new Date().toLocaleString()} ---\n`);

            await (prisma as any).cronJobLog.update({
                where: { id: log.id },
                data: {
                    status: 'FAILED',
                    error: errorMsg,
                    finishedAt: new Date()
                }
            });
        }
    }
}
