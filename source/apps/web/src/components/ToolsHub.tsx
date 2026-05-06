import { useState } from 'react';
import {
    Settings, Clock, Bell,
    Shield, ChevronRight, LayoutGrid, Terminal, Sliders
} from 'lucide-react';
import { SLAManager } from './SLAManager';
// import { MaintenanceManager } from './MaintenanceManager';
import { OrganizationHub } from './OrganizationHub';
import { ServiceManagement } from './ServiceManagement';
import { NotificationChannelManager } from './NotificationChannelManager';
import { SyslogManager } from './maintenance/SyslogManager';
import { AlertSettings } from './AlertSettings';
import { SystemCustomization } from './SystemCustomization';

type ToolTab = 'registration' | 'sla' | 'syslog' | 'notifications' | 'services' | 'monitoring' | 'customization';

export function ToolsHub({ initialTab }: { initialTab?: ToolTab }) {
    const [activeTab, setActiveTab] = useState<ToolTab>(initialTab || 'registration');

    const menuItems = [
        { id: 'registration', label: 'Cadastros', icon: Settings, desc: 'Gestão de Usuários e Estrutura' },
        { id: 'sla', label: 'Níveis de Serviço', icon: Clock, desc: 'Gestão de SLA e Prazos' },
        { id: 'syslog', label: 'Gravar Syslog', icon: Terminal, desc: 'Configuração de Fontes e Ativação' },
        { id: 'notifications', label: 'Configuração Email', icon: Bell, desc: 'Canais e Alertas' },
        { id: 'monitoring', label: 'Alertas email', icon: Bell, desc: 'Níveis de criticidade e notificações' },
        { id: 'services', label: 'Cadastro de Serviços', icon: LayoutGrid, desc: 'Grupos e Serviços' },
        { id: 'customization', label: 'Customizações', icon: Sliders, desc: 'Parâmetros Gerais do Sistema' },
    ];

    return (
        <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Sidebar de Navegação Interna */}
            <div className="lg:w-80 shrink-0 space-y-4">
                <div className="bg-card border border-border p-6 rounded-[2.5rem] shadow-xl">
                    <h2 className="text-xl font-black text-main italic mb-6 tracking-tight uppercase px-2">Cadastro & Ativações</h2>
                    <div className="space-y-2">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as ToolTab)}
                                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group relative overflow-hidden ${activeTab === item.id
                                    ? 'bg-accent text-white shadow-lg shadow-accent/20 active:scale-95'
                                    : 'text-secondary hover:bg-card/30 dark:hover:bg-white/5 active:scale-98'
                                    }`}
                            >
                                <div className={`p-2.5 rounded-xl transition-colors ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-white/5 dark:bg-black/20 text-secondary/70 group-hover:text-accent'
                                    }`}>
                                    <item.icon size={20} />
                                </div>
                                <div className="text-left flex-1">
                                    <p className="text-[13px] font-black uppercase tracking-tight leading-none">{item.label}</p>
                                    <p className={`text-[9px] mt-1 font-bold uppercase tracking-widest opacity-60 ${activeTab === item.id ? 'text-white' : ''}`}>{item.desc}</p>
                                </div>
                                {activeTab === item.id && <ChevronRight size={16} className="text-white/50" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status da Central */}
                <div className="bg-gradient-to-br from-accent to-accent p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/20 transition-all duration-700"></div>
                    <Shield className="w-10 h-10 mb-4 opacity-50" />
                    <h3 className="text-lg font-black italic tracking-tight uppercase leading-none">Ambiente Seguro</h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2 opacity-80">Acesso Restrito a Administradores e Operadores</p>
                </div>
            </div>

            {/* Área de Conteúdo Dinâmica */}
            <div className="flex-1 min-w-0">
                {activeTab === 'registration' && (
                    <div className="animate-in fade-in duration-500">
                        <OrganizationHub />
                    </div>
                )}

                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    {activeTab === 'sla' && <SLAManager />}
                    {activeTab === 'notifications' && <NotificationChannelManager />}
                    {activeTab === 'services' && <ServiceManagement />}
                    {activeTab === 'syslog' && <SyslogManager />}
                    {activeTab === 'monitoring' && <AlertSettings />}
                    {activeTab === 'customization' && <SystemCustomization />}
                </div>
            </div>
        </div>
    );
}
