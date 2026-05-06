import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { influxDB } from '../services/influxdb';
import { prisma } from '../utils/prisma';

import { tmpdir } from 'os';
const execPromise = promisify(exec);
const CONFIG_PATH = path.join(tmpdir(), 'irongrid_gen_config.json');
const DASHBOARD_PATH = path.join(tmpdir(), 'irongrid_gen_dashboard.json');
const GENERATOR_PATH = path.join(process.cwd(), '../../tools/gen_dashboard.js');

const DeviceSchema = z.object({
    name: z.string(),
    ip: z.string(),
    interfaces: z.array(z.string())
});

export const grafanaRouter = router({
    // Busca a configuração atual
    getConfig: publicProcedure.query(async () => {
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Erro ao ler config do Grafana:', e);
        }
        return { devices: [] };
    }),

    // Retorna dispositivos e interfaces que estão ATIVOS na Seleção de Gráficos
    getDiscoveryData: publicProcedure.query(async () => {
        try {
            // 1. Busca todos os dispositivos no monitoramento ativo
            const monitoredEntries = await prisma.monitoredDevice.findMany();
            const result: Record<string, { name: string; interfaces: string[] }> = {};

            for (const entry of monitoredEntries) {
                // 2. Para cada um, busca o dispositivo correspondente no inventário
                const device = await prisma.device.findFirst({
                    where: {
                        OR: [
                            { id: entry.deviceId || undefined },
                            { ipAddress: entry.ip }
                        ]
                    },
                    include: {
                        networkInterfaces: true
                    }
                });

                if (!device) continue;

                // 3. Filtra interfaces que:
                // - Estão na lista de monitoramento (entry.interfaces)
                // - E estão marcadas como habilitadas (ni.enabled === true)
                const enabledInterfaces = device.networkInterfaces
                    .filter(ni => entry.interfaces.includes(ni.index) && ni.enabled === true)
                    .map(ni => ni.name || ni.description || `Interface #${ni.index}`);

                if (enabledInterfaces.length > 0) {
                    result[entry.ip] = {
                        name: device.deviceName || device.name || entry.ip,
                        interfaces: enabledInterfaces
                    };
                }
            }

            return result;
        } catch (error) {
            console.error('Erro na descoberta para Grafana:', error);
            return {};
        }
    }),

    // Atualiza a configuração e gera o Dashboard
    generate: publicProcedure
        .input(z.object({
            devices: z.array(DeviceSchema),
            dashboardName: z.string().optional(),
            autoImport: z.boolean().optional(),
            grafanaToken: z.string().optional()
        }))
        .mutation(async ({ input }) => {
            try {
                // 1. Salva o arquivo de configuração JSON com o nome incluído
                fs.writeFileSync(CONFIG_PATH, JSON.stringify({
                    title: input.dashboardName || 'IronGrid NOC Dashboard',
                    devices: input.devices
                }, null, 2));

                // 2. Executa o script gerador para criar o arquivo irongrid_grafana_dashboard.json
                const { stdout } = await execPromise(`node "${GENERATOR_PATH}"`);

                let importMessage = '';

                // 3. Se autoImport estiver ativo, envia para a API do Grafana
                if (input.autoImport && input.grafanaToken) {
                    if (fs.existsSync(DASHBOARD_PATH)) {
                        let dashboardJson = JSON.parse(fs.readFileSync(DASHBOARD_PATH, 'utf-8'));

                        // Garante que o título do JSON seja o que o usuário escolheu
                        if (input.dashboardName) {
                            dashboardJson.title = input.dashboardName;
                        }

                        const response = await fetch('http://localhost:3000/api/dashboards/db', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${input.grafanaToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                dashboard: dashboardJson,
                                overwrite: true
                            })
                        });

                        if (response.ok) {
                            importMessage = ` e importado como "${input.dashboardName}"!`;
                            // 4. Limpa o arquivo de configuração após o sucesso total
                            fs.writeFileSync(CONFIG_PATH, JSON.stringify({ devices: [] }, null, 2));
                        } else {
                            const errData = await response.json();
                            importMessage = ` (Erro no Auto-Import: ${errData.message})`;
                        }
                    }
                } else {
                    // Se não houver auto-import, mas gerou o JSON, também limpamos
                    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ devices: [] }, null, 2));
                }

                return {
                    success: true,
                    message: `Dashboard gerado${importMessage}`,
                    output: stdout
                };
            } catch (error: any) {
                console.error('Erro ao gerar dashboard:', error);
                throw new Error('Falha ao gerar dashboard: ' + error.message);
            }
        }),

    // Deleta um dashboard do Grafana via UID
    deleteDashboard: publicProcedure
        .input(z.object({
            uid: z.string(),
            grafanaToken: z.string()
        }))
        .mutation(async ({ input }) => {
            try {
                const response = await fetch(`http://localhost:3000/api/dashboards/uid/${input.uid}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${input.grafanaToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    return { success: true, message: 'Dashboard removido com sucesso do Grafana!' };
                } else {
                    const errData = await response.json();
                    throw new Error(errData.message || 'Erro ao deletar no Grafana');
                }
            } catch (error: any) {
                throw new Error('Erro ao deletar dashboard: ' + error.message);
            }
        }),

    // Lista dashboards do Grafana para gerenciar
    listDashboards: publicProcedure
        .input(z.object({ grafanaToken: z.string() }))
        .query(async ({ input }) => {
            try {
                const response = await fetch('http://localhost:3000/api/search?tag=IronGrid&type=dash-db', {
                    headers: {
                        'Authorization': `Bearer ${input.grafanaToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    return await response.json();
                }
                return [];
            } catch (error) {
                return [];
            }
        })
});
