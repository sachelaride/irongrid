/**
 * Ponto de entrada do Agente IronGrid.
 * Responsável por inicializar a coleta de métricas, inventário, acesso remoto
 * e comunicação com o servidor central.
 */
import 'cross-fetch/polyfill';
import { getSystemMetrics } from './collector';
import { InventoryCollector } from './collectors/inventoryCollector';
import { InventoryTransport } from './websocket/inventoryTransport';
import { AgentSocket } from './websocket/sharedSocket';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
// import type { AppRouter } from '@irongrid/server';
type AppRouter = any;
import os from 'os';
import { loadConfig } from './config';
import 'dotenv/config';
import { io } from 'socket.io-client';
import { Logger } from './utils/logger';
import { FocusTracker } from './focusTracker';
import { TrayManager } from './trayManager';

// Carrega configurações (ID do agente, URL do servidor, etc)
const config = loadConfig();
const AGENT_ID = config.agentId;
const SERVER_URL = config.serverUrl;

// Inicializa o cliente tRPC para comunicação estruturada com o servidor
const client = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: `${SERVER_URL}/trpc`,
        }),
    ],
});

// Inicializa componentes responsáveis pelo inventário de hardware/software
const inventoryCollector = new InventoryCollector();
const inventoryTransport = new InventoryTransport(SERVER_URL, AGENT_ID);

/**
 * Coleta e envia o inventário do dispositivo para o servidor.
 * @param force Se verdadeiro, envia o inventário completo ignorando o cache local.
 */
async function reportInventory(force = false) {
    try {
        console.log(`[Inventory] Iniciando coleta (force=${force})...`);
        const payload = force
            ? await inventoryCollector.collectFullInventory()
            : await inventoryCollector.collectDeltaInventory();

        if (payload) {
            await inventoryTransport.sendInventory(payload);
            console.log(`[Inventory] Inventário enviado ao servidor.`);
        } else {
            console.log(`[Inventory] Inventário sem alterações, envio pulado.`);
        }
    } catch (e) {
        console.error(`[Inventory] Falha ao reportar inventário:`, e);
    }
}

import { RemoteAccessModule } from './remote';
import { RemoteActionExecutor } from './remoteActions';
import { installAgent, uninstallAgent } from './install';

/**
 * Função principal de inicialização do agente.
 */
async function startAgent() {
    // Captura erros fatais para log local
    process.on('uncaughtException', (err) => {
        Logger.error('FATAL: Uncaught Exception', { error: err.message, stack: err.stack });
        // Somente encerra se for um erro realmente crítico que impede o funcionamento básico
        if (err.message.includes('EADDRINUSE') || err.message.includes('Prisma')) {
            process.exit(1);
        }
    });

    process.on('unhandledRejection', (reason, promise) => {
        Logger.error('FATAL: Unhandled Rejection', { reason });
        // Prevenir saída do processo para rejeições em módulos não-críticos (como Tray)
    });

    // Processamento de argumentos de linha de comando (instalação/desinstalação)
    const args = process.argv.slice(2);

    if (args.includes('--uninstall')) {
        await uninstallAgent();
        process.exit(0);
    }

    if (args.includes('--install')) {
        const serverUrlArg = args.find(a => a.startsWith('--server='))?.split('=')[1];
        await installAgent(serverUrlArg);
        process.exit(0);
    }

    console.log(`\x1b[36m⚡ \x1b[0m\x1b[31m====================================================\x1b[0m`);
    console.log(`\x1b[36m⚡ \x1b[1mIRONGRID AGENT\x1b[0m \x1b[31m- DISPUTE PROTOCOL ACTIVE\x1b[0m`);
    console.log(`\x1b[36m⚡ \x1b[0m\x1b[36mID: ${AGENT_ID}\x1b[0m`);
    console.log(`\x1b[36m⚡ \x1b[0m\x1b[36mVERSION: 4.0.1-ENTERPRISE (TRON CORE)\x1b[0m`);
    console.log(`\x1b[36m⚡ \x1b[0m\x1b[31mSERVER: ${SERVER_URL}\x1b[0m`);
    console.log(`\x1b[36m⚡ \x1b[0m\x1b[31m====================================================\x1b[0m`);

    // Obtém instância do Socket para comunicação persistente (eventos e ações remotas)
    const socket = AgentSocket.getInstance(SERVER_URL, AGENT_ID);

    // Inicializa o módulo de Acesso Remoto (VNC/Screen Sharing)
    new RemoteAccessModule(socket, AGENT_ID);

    // Inicializa o executor de ações remotas (reiniciar, executar comandos, etc)
    const remoteExecutor = new RemoteActionExecutor(socket, client);

    // Inicializa o rastreador de janelas ativas
    const focusTracker = new FocusTracker();

    const isTrayMode = args.includes('--tray');
    if (isTrayMode) {
        console.log('[Agent] Modo INTERATIVO detectado. Inicializando ícone da bandeja...');
        // Inicializa a interface da bandeja do sistema (Tray Icon)
        new TrayManager(socket, AGENT_ID, async () => await reportInventory(true));
    } else {
        console.log('[Agent] Modo SERVIÇO detectado. Pulando inicialização da bandeja.');
    }

    // Relatório inicial de inventário após 5 segundos da conexão
    setTimeout(async () => {
        try {
            await reportInventory(true); // Envio completo no startup
        } catch (reportErr) {
            console.error('[Agent] Falha no relatório inicial de inventário:', reportErr);
        }
    }, 5000);

    // Escuta pedido de forçar inventário (ex: do Tray local ou do Server remoto)
    socket.on('trigger-inventory', async (data: any) => {
        if (!data || data.agentId === AGENT_ID) {
            await reportInventory(data?.force || true);
        }
    });

    // Loop rotineiro de coleta de métricas de performance
    const metricsInterval = (config as any).metricsInterval || 60000;
    setInterval(async () => {
        try {
            // Coleta estatísticas de foco e passa para o coletor geral
            const activityStats = focusTracker.getAndResetStats();
            
            // Coleta CPU, memória, disco, rede atual
            const metrics = await getSystemMetrics(activityStats);
            Logger.info(`Snapshot de Performance`, { cpu: metrics.cpu.load, ram: metrics.memory.percent, focus: metrics.activity?.currentWindow });

            try {
                // Tenta ingerir as métricas no servidor via tRPC
                await (client as any).metrics.ingest.mutate({
                    ...metrics,
                    agentId: AGENT_ID
                });
            } catch (sendError) {
                Logger.error('Falha ao enviar métricas ao servidor', sendError instanceof Error ? sendError.message : sendError);
            }
        } catch (error) {
            Logger.error('Erro ao coletar métricas', error);
        }
    }, metricsInterval);

    // Loop de relatório de inventário de software (padrão 1 hora)
    const inventoryInterval = (config as any).inventoryInterval || 3600000;
    setInterval(reportInventory, inventoryInterval);
}

// Inicia o agente
startAgent();
