import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { metricsRouter } from './metrics';
import { scanRouter } from './scanRouter';
import { snmpRouter } from './snmpRouter';
import { monitoringRouter } from './monitoringRouter';
import { inventoryRouter } from './inventoryRouter';
import { dashboardRouter } from './dashboardRouter';
import { reportRouter } from './reportRouter';
import { remoteRouter } from './remoteRouter';
import { settingsRouter } from './settingsRouter';

import { organizationRouter } from './organizationRouter';
import { actionRouter } from './actionRouter';
import { ticketRouter } from './ticketRouter';
import { customFieldsRouter } from './customFieldsRouter';
import { alertRouter } from './alertRouter';
import { authRouter } from './authRouter';
import { searchRouter } from './searchRouter';
import { discoveryRouter } from './discoveryRouter';
import { knowledgeRouter } from './knowledgeRouter';
import { maintenanceRouter } from './maintenanceRouter';
import { notificationRouter } from './notificationRouter';
import { systemRouter } from './systemRouter';
import { serviceTypeRouter } from './serviceTypeRouter';
import { syslogRouter } from './syslogRouter';
import { mailCollectorRouter } from './mailCollectorRouter';
import { ipamRouter } from './ipamRouter';
import { customMapRouter } from './customMapRouter';
import { cronRouter } from './cronRouter';
import { grafanaRouter } from './grafanaRouter';

// Router principal da aplicação
export const appRouter = router({
    // Sub-router de autenticação
    auth: authRouter,

    // Sub-router de métricas (Ingest + Query)
    metrics: metricsRouter,

    // Sub-router de scanning
    scan: scanRouter,

    // Sub-router de SNMP
    snmp: snmpRouter,

    // Sub-router de monitoramento adicional (Interface traffic etc)
    monitoring: monitoringRouter,

    // Sub-router de inventário de software
    inventory: inventoryRouter,

    // Sub-router de organização
    organization: organizationRouter,

    // Sub-router de ações remotas
    actions: actionRouter,

    // Sub-router de Tickets (ITSM)
    tickets: ticketRouter,

    // Sub-router de Campos Customizáveis
    customFields: customFieldsRouter,

    // Sub-router de Alertas
    alerts: alertRouter,

    // Sub-router de dashboard
    dashboard: dashboardRouter,

    // Sub-router de relatórios (PDF)
    reports: reportRouter,

    // Sub-router de acesso remoto
    remote: remoteRouter,

    // Sub-router de configurações
    settings: settingsRouter,

    // Sub-router de busca
    search: searchRouter,

    // Sub-router de descoberta de rede
    discovery: discoveryRouter,

    // Sub-router de base de conhecimento
    knowledge: knowledgeRouter,

    // Sub-router de gestão de manutenção
    maintenance: maintenanceRouter,

    // Sub-router de notificações multi-canal
    notifications: notificationRouter,

    // Sub-router de sistema (Retenção, Logs, Configs)
    system: systemRouter,

    // Sub-router de Catálogo de Serviços
    serviceTypes: serviceTypeRouter,

    // Sub-router de Syslog (Auditoria em Tempo Real)
    syslog: syslogRouter,

    // Sub-router de Mail Collector (ITSM)
    mailCollector: mailCollectorRouter,

    // Sub-router de IPAM (IP Address Management)
    ipam: ipamRouter,

    // Sub-router de Mapas Personalizados
    customMaps: customMapRouter,

    // Sub-router de Gerenciamento de Cron/Agendamentos
    cron: cronRouter,
    
    // Sub-router para Gestão de Dashboards Grafana
    grafana: grafanaRouter,

    // Rota de exemplo para health check
    health: publicProcedure.query(() => {
        return { status: 'ok', uptime: process.uptime() };
    }),

    // Exemplo de rota com validação de input
    hello: publicProcedure
        .input(z.object({ name: z.string().optional() }))
        .query(({ input }) => {
            return {
                greeting: `Hello ${input.name ?? 'World'} from IronGrid!`,
            };
        }),
});

// Exporta o tipo do router para uso no frontend
export type AppRouter = typeof appRouter;
