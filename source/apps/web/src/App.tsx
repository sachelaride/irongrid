import { useState, useEffect } from 'react';
import { trpc } from './utils/trpc';
import { Loader2 } from 'lucide-react';
import { Layout, type Tab } from './components/Layout';
import { DeviceList } from './components/DeviceList';
import { TopologyMap } from './components/TopologyMap';
import { MonitoredDevices } from './components/MonitoredDevices';
import { Dashboard } from './components/Dashboard';
import { InventoryManager } from './components/InventoryManager';
import { TicketManager } from './components/TicketManager';
import { AlertCenter } from './components/AlertCenter';
import { LoginPage } from './components/LoginPage';
import { OrganizationHub } from './components/OrganizationHub';
import { InventoryReport } from './components/InventoryReport';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { UserManager } from './components/UserManager';
import { NetworkManagementHub } from './components/NetworkManagementHub';
import { NetworkDiscovery } from './components/NetworkDiscovery';
import { AuditSyslogView } from './components/AuditSyslogView';
import { GrafanaManager } from './components/GrafanaManager';
import { DeviceInventoryDetail } from './components/DeviceInventoryDetail';
import { KnowledgeBase } from './components/KnowledgeBase';
import { MaintenanceManager } from './components/MaintenanceManager';
import { BIDashboard } from './components/BIDashboard';
import { SystemMaintenance } from './components/SystemMaintenance';
import { MonitoringGraphs } from './components/MonitoringGraphs';
import { ToolsHub } from './components/ToolsHub';
import { SLADashboard } from './components/SLADashboard';
import { IPAMDashboard } from './components/IPAMDashboard';
import { AlertSettings } from './components/AlertSettings';
import { CustomMapsContainer } from './components/custom-maps/CustomMapsContainer';
import { CronManager } from './components/CronManager';
import { AgentManager } from './components/AgentManager';
import { io } from 'socket.io-client';
import { Toaster, toast } from 'sonner';
import { useTheme } from './context/ThemeContext';

import { motion, AnimatePresence } from 'framer-motion';

/**
 * Componente principal da aplicação IronGrid.
 * Gerencia o estado global de autenticação, navegação entre abas e renderização condicional.
 */
function App() {
    const { theme } = useTheme();
    // Estado da aba atual selecionada no menu lateral
    const [currentTab, setCurrentTab] = useState<Tab>('dashboard');
    // Armazena o ID do dispositivo selecionado para visualização detalhada do inventário
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
    // Dados do usuário logado (nome, papel, etc)
    const [user, setUser] = useState<any>(null);
    // Indica se o sistema ainda está validando o token de sessão
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    // Sub-aba para o ToolsHub (Cadastro & Ativações)
    const [toolsSubTab, setToolsSubTab] = useState<string | undefined>(undefined);

    // Consulta tRPC para obter dados do usuário atual baseado no token JWT
    const meQuery = (trpc.auth as any).me.useQuery(undefined, {
        retry: false,
        enabled: !!localStorage.getItem('irongrid_token'),
    });

    // Efeito para sincronizar o estado do usuário com o resultado da consulta de autenticação
    useEffect(() => {
        if (meQuery.data) {
            setUser(meQuery.data);
            setIsCheckingAuth(false);
        } else if (meQuery.isError) {
            setUser(null);
            setIsCheckingAuth(false);
            localStorage.removeItem('irongrid_token');
        } else if (!localStorage.getItem('irongrid_token')) {
            setIsCheckingAuth(false);
        }
    }, [meQuery.data, meQuery.isError]);

    /**
     * Lógica de redirecionamento baseada em perfil.
     * Usuários comuns (USER) são direcionados automaticamente para a aba de chamados.
     */
    useEffect(() => {
        if (user && user.role === 'USER' && currentTab === 'dashboard') {
            setCurrentTab('tickets');
        }
    }, [user, currentTab]);

    /**
     * ESCUTA GLOBAL DE DESCOBERTA (Always Listening)
     * Ativa ouvintes de Socket.io para notificar sobre novos agentes instalados.
     */
    const utils = trpc.useContext();
    useEffect(() => {
        if (!user) return;

        const socket = io(`http://${window.location.hostname}:3001`);

        socket.on('device-discovered', (data: { id: string, name: string, ip: string, type: string }) => {
            console.log('[Socket] Novo dispositivo descoberto:', data);
            
            // Notificação visual premium
            toast.success(`Novo Agente Descoberto!`, {
                description: `${data.name} (${data.ip}) acaba de ser registrado.`,
                duration: 10000,
                action: {
                    label: 'Ver Ativo',
                    onClick: () => {
                        handleNavigate('devices');
                        setSelectedDeviceId(data.id);
                    }
                }
            });

            // Invalida cache para atualizar listas e dashboards automaticamente
            utils.scan.getDevicesPaginated.invalidate();
            // (utils.dashboard as any)?.getStats?.invalidate();
        });

        return () => {
            socket.disconnect();
        };
    }, [user, utils]);

    /**
     * Realiza o logout do usuário, limpando o token e resetando o estado.
     */
    const handleLogout = () => {
        localStorage.removeItem('irongrid_token');
        setUser(null);
    };

    const handleNavigate = (tab: Tab, subTab?: string) => {
        // Fullscreen logic for Topology Map
        if (tab === 'topology') {
            try {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.warn(`Erro ao tentar entrar em tela cheia: ${err.message}`);
                    });
                }
            } catch (err) {
                console.error('Fullscreen API não suportada ou bloqueada', err);
            }
        } else if (document.fullscreenElement) {
            try {
                document.exitFullscreen().catch(err => {
                    console.warn(`Erro ao tentar sair da tela cheia: ${err.message}`);
                });
            } catch (err) {
                console.error('Erro ao sair do fullscreen', err);
            }
        }

        setCurrentTab(tab);
        setToolsSubTab(subTab);
    };

    // Renderiza tela de carregamento enquanto valida a sessão
    if (isCheckingAuth && localStorage.getItem('irongrid_token')) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] ml-1">Sincronizando Autenticação</span>
                </div>
            </div>
        );
    }

    // Se não houver usuário logado, exibe a página de login
    if (!user) {
        return <LoginPage onLoginSuccess={setUser} />;
    }

    // Renderiza o Layout principal com o conteúdo dinâmico baseado na aba selecionada
    return (
        <>
            <Toaster position="top-right" richColors closeButton theme={theme as any} />
            <Layout currentTab={currentTab} onNavigate={handleNavigate} user={user} onLogout={handleLogout}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentTab}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="h-full"
                    >
            {currentTab === 'dashboard' && user.role !== 'USER' && <Dashboard />}

            {currentTab === 'devices' && (
                <DeviceList onOpenInventory={setSelectedDeviceId} />
            )}

            {currentTab === 'topology' && (
                <TopologyMap onBack={() => handleNavigate('dashboard')} />
            )}

            {currentTab === 'customMaps' && (
                <CustomMapsContainer onBack={() => handleNavigate('dashboard')} />
            )}

            {currentTab === 'monitoring' && (
                <MonitoredDevices />
            )}

            {currentTab === 'inventory' && (
                <InventoryManager />
            )}

            {currentTab === 'tickets' && (
                <TicketManager />
            )}

            {currentTab === 'alerts' && (
                <AlertCenter />
            )}

            {currentTab === 'alert_settings' && (
                <AlertSettings />
            )}

            {currentTab === 'graficos' && (
                <MonitoringGraphs />
            )}

            {currentTab === 'reports' && (
                <InventoryReport />
            )}
            {currentTab === 'pdf_reports' && (
                <Reports />
            )}
            {currentTab === 'settings' && (
                <OrganizationHub />
            )}
            {currentTab === 'config' && (
                <Settings />
            )}
            {currentTab === 'users' && (
                <UserManager />
            )}
            {currentTab === 'networkMgmt' && (
                <NetworkManagementHub initialTab={toolsSubTab as any} />
            )}
            {currentTab === 'discovery' && (
                <NetworkDiscovery onNavigate={handleNavigate} />
            )}
            {currentTab === 'audit' && (
                <AuditSyslogView onNavigateSubTab={(sub: string) => handleNavigate('tools', sub)} />
            )}
            {currentTab === 'knowledge' && (
                <KnowledgeBase onBack={() => handleNavigate('dashboard')} />
            )}
            {currentTab === 'maintenance' && (
                <MaintenanceManager />
            )}
            {currentTab === 'bi' && (
                <BIDashboard />
            )}
            {currentTab === 'system_maintenance' && (
                <SystemMaintenance />
            )}
            {currentTab === 'tools' && (
                <ToolsHub initialTab={toolsSubTab as any} />
            )}
            {currentTab === 'sla_dashboard' && (
                <SLADashboard />
            )}
            {currentTab === 'ipam' && (
                <IPAMDashboard />
            )}
            {currentTab === 'cron' && (
                <CronManager />
            )}
            {currentTab === 'agentes' && (
                <AgentManager />
            )}
            {currentTab === 'grafana_gen' && (
                <GrafanaManager initialView="gen" />
            )}
            {currentTab === 'grafana_list' && (
                <GrafanaManager initialView="list" />
            )}
            {currentTab === 'grafana_tips' && (
                <GrafanaManager initialView="tips" />
            )}

            {/* Modal de detalhes do inventário de um dispositivo específico */}
            {selectedDeviceId && (
                <DeviceInventoryDetail
                    deviceId={selectedDeviceId}
                    onClose={() => setSelectedDeviceId(null)}
                />
            )}
                </motion.div>
            </AnimatePresence>
        </Layout>
        </>
    );
}

export default App;
