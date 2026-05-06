import React, { useState, useEffect } from 'react';
import { 
    Share2, Activity, Shield, Server, Box, Menu, X, MessageSquare, Bell, LogOut,
    User as UserIcon, Terminal, Book, Wrench, TrendingUp,
    MapPin, FileText, Settings as SettingsIcon, ChevronDown, List as ListIcon,
    PieChart, Layers, Eye, Database, Sun, Moon, Monitor as MonitorIcon,
    Star, Globe, Mail, Network, Clock, Zap, Trash2, Info, Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalSearch } from './GlobalSearch';
import { useTheme } from '../context/ThemeContext';
import { MobileNav } from './MobileNav';
import { Logo } from './Logo';
import { ThemeDesigner } from './ThemeDesigner';

export type Tab = 'dashboard' | 'devices' | 'topology' | 'customMaps' | 'monitoring' | 'inventory' | 'tickets' | 'alerts' | 'reports' | 'settings' | 'users' | 'networkMgmt' | 'discovery' | 'audit' | 'knowledge' | 'maintenance' | 'bi' | 'config' | 'pdf_reports' | 'system_maintenance' | 'graficos' | 'tools' | 'sla_dashboard' | 'ipam' | 'alert_settings' | 'cron' | 'agentes' | 'grafana_gen' | 'grafana_list' | 'grafana_tips';

interface LayoutProps {
    children: React.ReactNode;
    currentTab: Tab;
    onNavigate: (tab: Tab) => void;
    user: { name: string; role: string };
    onLogout: () => void;
}

export function Layout({ children, currentTab, onNavigate, user, onLogout }: LayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
    const [isThemeDesignerOpen, setIsThemeDesignerOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['monitoramento']);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev =>
            prev.includes(cat) ? [] : [cat]
        );
    };

    const handleNavigate = (tab: Tab) => {
        onNavigate(tab);
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
    };

    return (
        <div className="flex h-screen bg-tron-grid text-main overflow-hidden font-sans transition-colors duration-300">
            {/* TRON GRID SYSTEM - SUBTLE OVERLAY */}
            <div className="tron-grid-floor opacity-[0.08] pointer-events-none" />
            
            {/* Mesh Background Orbs */}
            <div className="bg-mesh pointer-events-none">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
                <div className="orb orb-3" />
            </div>

            {/* MOBILE NAV BAR (Bottom) */}
            <MobileNav 
                currentTab={currentTab} 
                onNavigate={onNavigate} 
                onQuickAction={() => setIsSidebarOpen(true)} 
            />

            {/* SIDEBAR overlay for mobile */}
            {isSidebarOpen && window.innerWidth < 1024 && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[105] lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* SIDEBAR */}
            {currentTab !== 'topology' && (
                <motion.aside 
                    initial={false}
                    animate={{ 
                        x: isSidebarOpen ? 0 : -320,
                        opacity: isSidebarOpen ? 1 : 0
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 35 }}
                    className={`
                        fixed lg:relative z-[110] h-full glass transition-all duration-300 flex flex-col
                        ${isSidebarOpen ? 'w-80 translate-x-0 shadow-2xl' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0 lg:static'}
                    `}
                >
                    {/* ... (Sidebar remains largely same but reacts to isSidebarOpen better) */}
                    {/* SIDEBAR HEADER: LOGO */}
                    <div className="flex items-center p-8 shrink-0 h-24 overflow-hidden">
                        <Logo className={isSidebarOpen ? '' : 'justify-center w-full'} hideText={!isSidebarOpen} size={isSidebarOpen ? 42 : 32} />
                    </div>

                    {/* SIDEBAR SEARCH */}
                    <div className={`p-4 ${!isSidebarOpen && 'hidden lg:block'}`}>
                        {isSidebarOpen ? (
                            <GlobalSearch />
                        ) : (
                            <div className="flex justify-center text-secondary bg-page/30 p-2 rounded-xl border border-border/50">
                                <Menu size={18} />
                            </div>
                        )}
                    </div>

                    {/* SIDEBAR MENU */}
                    <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                        {/* MONITORAMENTO */}
                        <SidebarCategory
                            label="Monitoramento"
                            icon={<Eye size={20} />}
                            isOpen={expandedCategories.includes('monitoramento')}
                            onToggle={() => toggleCategory('monitoramento')}
                            isSidebarOpen={isSidebarOpen}
                        >
                            <SidebarItem
                                label="Painel Geral"
                                icon={<Activity size={18} />}
                                active={currentTab === 'dashboard'}
                                onClick={() => handleNavigate('dashboard')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Alertas"
                                icon={<Bell size={18} />}
                                active={currentTab === 'alerts'}
                                onClick={() => handleNavigate('alerts')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Gráficos"
                                icon={<TrendingUp size={18} />}
                                active={currentTab === 'graficos'}
                                onClick={() => handleNavigate('graficos')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Seleção de Gráficos"
                                icon={<Activity size={18} />}
                                active={currentTab === 'monitoring'}
                                onClick={() => handleNavigate('monitoring')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Syslog"
                                icon={<Terminal size={18} />}
                                active={currentTab === 'audit'}
                                onClick={() => handleNavigate('audit')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            {user.role !== 'USER' && (
                                <SidebarItem
                                    label="Alertas Email"
                                    icon={<Mail size={18} />}
                                    active={currentTab === 'alert_settings'}
                                    onClick={() => handleNavigate('alert_settings')}
                                    isSidebarOpen={isSidebarOpen}
                                />
                            )}
                        </SidebarCategory>

                        <SidebarCategory
                            label="Dashboards & Grafana"
                            icon={<TrendingUp size={20} />}
                            isOpen={currentTab?.startsWith('grafana')}
                            onToggle={() => handleNavigate('grafana_gen')}
                            isSidebarOpen={isSidebarOpen}
                        >
                            <SidebarItem
                                label="Gerador Automático"
                                icon={<Zap size={16} />}
                                active={currentTab === 'grafana_gen'}
                                onClick={() => handleNavigate('grafana_gen')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Gestão de Dashboards"
                                icon={<Trash2 size={16} />}
                                active={currentTab === 'grafana_list'}
                                onClick={() => handleNavigate('grafana_list')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Configurações e Dicas"
                                icon={<Info size={16} />}
                                active={currentTab === 'grafana_tips'}
                                onClick={() => handleNavigate('grafana_tips')}
                                isSidebarOpen={isSidebarOpen}
                            />
                        </SidebarCategory>

                        {/* INVENTÁRIO */}
                        <SidebarCategory
                            label="Inventário"
                            icon={<ListIcon size={20} />}
                            isOpen={expandedCategories.includes('inventario')}
                            onToggle={() => toggleCategory('inventario')}
                            isSidebarOpen={isSidebarOpen}
                        >
                            <SidebarItem
                                label="Dispositivos"
                                icon={<Server size={18} />}
                                active={currentTab === 'devices'}
                                onClick={() => handleNavigate('devices')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Gestão Inventário"
                                icon={<Box size={18} />}
                                active={currentTab === 'inventory'}
                                onClick={() => handleNavigate('inventory')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Mapa Topologia"
                                icon={<Share2 size={18} />}
                                active={(currentTab as string) === 'topology'}
                                onClick={() => handleNavigate('topology')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Mapas Customizados"
                                icon={<MapPin size={18} />}
                                active={(currentTab as string) === 'customMaps'}
                                onClick={() => handleNavigate('customMaps')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="IPAM & Redes"
                                icon={<Globe size={18} />}
                                active={currentTab === 'ipam'}
                                onClick={() => handleNavigate('ipam')}
                                isSidebarOpen={isSidebarOpen}
                            />
                        </SidebarCategory>

                        {/* CHAMADOS */}
                        <SidebarCategory
                            label="Chamados"
                            icon={<Layers size={20} />}
                            isOpen={expandedCategories.includes('operacoes')}
                            onToggle={() => toggleCategory('operacoes')}
                            isSidebarOpen={isSidebarOpen}
                        >
                            <SidebarItem
                                label={user.role === 'USER' ? 'Abrir Chamado' : 'Central Tickets'}
                                icon={<MessageSquare size={18} />}
                                active={currentTab === 'tickets'}
                                onClick={() => handleNavigate('tickets')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            {user.role !== 'USER' && (
                                <SidebarItem
                                    label="SLA Dashboard"
                                    icon={<TrendingUp size={18} />}
                                    active={currentTab === 'sla_dashboard'}
                                    onClick={() => handleNavigate('sla_dashboard')}
                                    isSidebarOpen={isSidebarOpen}
                                />
                            )}
                            <SidebarItem
                                label="Base Conhecimento"
                                icon={<Book size={18} />}
                                active={currentTab === 'knowledge'}
                                onClick={() => handleNavigate('knowledge')}
                                isSidebarOpen={isSidebarOpen}
                            />
                            <SidebarItem
                                label="Manutenções Programadas"
                                icon={<Wrench size={18} />}
                                active={currentTab === 'maintenance'}
                                onClick={() => handleNavigate('maintenance')}
                                isSidebarOpen={isSidebarOpen}
                            />
                        </SidebarCategory>

                        {/* RELATÓRIOS */}
                        {user.role !== 'USER' && (
                            <SidebarCategory
                                label="Relatórios"
                                icon={<PieChart size={20} />}
                                isOpen={expandedCategories.includes('relatorios')}
                                onToggle={() => toggleCategory('relatorios')}
                                isSidebarOpen={isSidebarOpen}
                            >
                                <SidebarItem
                                    label="Painéis de BI"
                                    icon={<TrendingUp size={18} />}
                                    active={currentTab === 'bi'}
                                    onClick={() => handleNavigate('bi')}
                                    isSidebarOpen={isSidebarOpen}
                                />
                                <SidebarItem
                                    label="Relatório Inventário"
                                    icon={<Database size={18} />}
                                    active={currentTab === 'reports'}
                                    onClick={() => handleNavigate('reports')}
                                    isSidebarOpen={isSidebarOpen}
                                />
                                <SidebarItem
                                    label="Relatórios PDF"
                                    icon={<FileText size={18} />}
                                    active={currentTab === 'pdf_reports'}
                                    onClick={() => handleNavigate('pdf_reports')}
                                    isSidebarOpen={isSidebarOpen}
                                />
                            </SidebarCategory>
                        )}

                        {/* FERRAMENTAS */}
                        {user.role !== 'USER' && (
                            <SidebarCategory
                                label="Ferramentas"
                                icon={<SettingsIcon size={20} />}
                                isOpen={expandedCategories.includes('ferramentas')}
                                onToggle={() => toggleCategory('ferramentas')}
                                isSidebarOpen={isSidebarOpen}
                            >
                                <SidebarItem
                                    label="Cadastro & Ativações"
                                    icon={<SettingsIcon size={18} />}
                                    active={currentTab === 'tools'}
                                    onClick={() => handleNavigate('tools')}
                                    isSidebarOpen={isSidebarOpen}
                                />

                                <SidebarItem
                                    label="Central de Descoberta"
                                    icon={<MapPin size={18} />}
                                    active={currentTab === 'discovery'}
                                    onClick={() => handleNavigate('discovery')}
                                    isSidebarOpen={isSidebarOpen}
                                />

                                <SidebarItem
                                    label="Gestão de Redes"
                                    icon={<Network size={18} />}
                                    active={currentTab === 'networkMgmt'}
                                    onClick={() => handleNavigate('networkMgmt')}
                                    isSidebarOpen={isSidebarOpen}
                                />

                                <SidebarItem
                                    label="Manutenção Sistema"
                                    icon={<Database size={18} />}
                                    active={currentTab === 'system_maintenance'}
                                    onClick={() => handleNavigate('system_maintenance')}
                                    isSidebarOpen={isSidebarOpen}
                                />
                                <SidebarItem
                                    label="Agendador de Tarefas"
                                    icon={<Clock size={18} />}
                                    active={currentTab === 'cron'}
                                    onClick={() => handleNavigate('cron')}
                                    isSidebarOpen={isSidebarOpen}
                                />
                                <SidebarItem
                                    label="Agentes & Downloads"
                                    icon={<Terminal size={18} />}
                                    active={currentTab === 'agentes'}
                                    onClick={() => handleNavigate('agentes')}
                                    isSidebarOpen={isSidebarOpen}
                                />
                            </SidebarCategory>
                        )}
                    </nav>

                    {/* FIXED THEME SELECTOR ABOVE USER */}
                    {isSidebarOpen && (
                        <div className="px-4 py-3 border-t border-border/10 bg-page/20">
                            <div className="flex justify-between items-center mb-3 px-1">
                                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Tema Visual</p>
                                <button 
                                    onClick={() => setIsThemeDesignerOpen(true)}
                                    className="p-1.5 hover:bg-accent/10 rounded-lg transition-colors group"
                                    title="Customizar Cores"
                                >
                                    <Palette size={14} className="text-secondary group-hover:text-accent" />
                                </button>
                            </div>
                            <div className="flex bg-card/60 p-1 rounded-2xl border border-border/50 gap-1 shadow-inner">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`flex-1 flex items-center justify-center py-2.5 rounded-xl transition-all ${theme === 'light' ? 'bg-primary text-white shadow-lg scale-105 z-10' : 'text-secondary hover:text-main hover:bg-page/50'}`}
                                    title="Claro"
                                >
                                    <Sun size={16} />
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`flex-1 flex items-center justify-center py-2.5 rounded-xl transition-all ${theme === 'dark' ? 'bg-primary text-white shadow-lg scale-105 z-10' : 'text-secondary hover:text-main hover:bg-page/50'}`}
                                    title="Escuro"
                                >
                                    <Moon size={16} />
                                </button>
                                <button
                                    onClick={() => setTheme('calendar')}
                                    className={`flex-1 flex items-center justify-center py-2.5 rounded-xl transition-all ${theme === 'calendar' ? 'bg-amber-500 text-white shadow-lg scale-105 z-10' : 'text-secondary hover:text-main hover:bg-page/50'}`}
                                    title="Calendário"
                                >
                                    <Star size={16} />
                                </button>
                                <button
                                    onClick={() => setTheme('emerald')}
                                    className={`flex-1 flex items-center justify-center py-2.5 rounded-xl transition-all ${theme === 'emerald' ? 'bg-emerald-500 text-white shadow-lg scale-105 z-10' : 'text-secondary hover:text-main hover:bg-page/50'}`}
                                    title="Esmeralda"
                                >
                                    <Shield size={16} />
                                </button>
                                <button
                                    onClick={() => setTheme('system')}
                                    className={`flex-1 flex items-center justify-center py-2.5 rounded-xl transition-all ${theme === 'system' ? 'bg-page/80 text-main shadow-sm ring-1 ring-border' : 'text-secondary hover:text-main hover:bg-page/50'}`}
                                    title="Sistema"
                                >
                                    <MonitorIcon size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    <ThemeDesigner isOpen={isThemeDesignerOpen} onClose={() => setIsThemeDesignerOpen(false)} />

                    {/* SIDEBAR FOOTER: USER */}
                    <div className="p-4 border-t border-border/10 bg-page/10 shrink-0 overflow-hidden">
                        <div className="flex items-center gap-3 group">
                            <div className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:border-primary/50 transition-all">
                                <UserIcon size={18} className="text-main" />
                            </div>
                            {isSidebarOpen && (
                                <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2">
                                    <p className="text-sm font-black text-main italic truncate tracking-tight">{user.name}</p>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest opacity-80">{user.role}</p>
                                </div>
                            )}
                            {isSidebarOpen && (
                                <button
                                    onClick={onLogout}
                                    className="p-2 hover:bg-red-500/10 hover:text-red-500 text-secondary rounded-xl transition-all active:scale-90"
                                    title="Sair"
                                >
                                    <LogOut size={18} />
                                </button>
                            )}
                        </div>
                        {!isSidebarOpen && (
                            <button
                                onClick={onLogout}
                                className="w-10 h-10 mt-3 hover:bg-red-500/10 hover:text-red-500 text-secondary rounded-xl flex items-center justify-center transition-all lg:flex hidden mx-auto"
                                title="Sair"
                            >
                                <LogOut size={18} />
                            </button>
                        )}
                    </div>
                </motion.aside>
            )}

            {/* MAIN CONTENT */}
            <main className={`flex-1 overflow-auto relative z-10 custom-scrollbar flex flex-col h-full bg-page/30 backdrop-blur-[2px] ${currentTab === 'topology' ? 'p-0' : ''}`}>
                <div className={`${currentTab === 'topology' ? 'p-0 h-full' : 'p-4 lg:p-6'} flex-1`}>
                    <div className={`${currentTab === 'topology' ? 'max-w-none h-full' : 'max-w-[1700px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-700 pb-10'}`}>
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

// SIDEBAR COMPONENTS
function SidebarCategory({ label, icon, children, isOpen, onToggle, isSidebarOpen }: any) {
    if (!isSidebarOpen) {
        return (
            <div className="group relative flex justify-center py-2">
                <div className="p-3 text-secondary hover:text-main hover:bg-primary/10 rounded-2xl transition-all cursor-pointer shadow-sm hover:shadow-primary/5">
                    {icon}
                </div>
                {/* Tooltip on closed sidebar */}
                <div className="absolute left-full ml-4 px-4 py-2 bg-card text-main text-xs font-black uppercase tracking-widest rounded-xl opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none z-[100] border border-border shadow-2xl translate-x-[-10px] group-hover:translate-x-0">
                    {label}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-1 my-1">
            <button
                onClick={onToggle}
                className={`
                    w-full flex items-center justify-between p-4 rounded-[1.5rem] transition-all group border border-transparent
                    ${isOpen ? 'text-main bg-accent/5 border-accent/10 whitespace-nowrap' : 'text-secondary hover:text-main hover:bg-page/40'}
                `}
            >
                <div className="flex items-center gap-3">
                    <span className={`${isOpen ? 'text-accent' : 'text-secondary'} group-hover:text-accent transition-colors`}>
                        {icon}
                    </span>
                    <span className="text-xs font-bold tracking-tight">{label}</span>
                </div>
                <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent' : 'text-border group-hover:text-secondary'}`} />
            </button>
            {isOpen && (
                <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </div>
    );
}

function SidebarItem({ label, icon, active, onClick, isSidebarOpen, className = "" }: any) {
    if (!isSidebarOpen) return null;

    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 p-3.5 rounded-[1.2rem] transition-all group relative border border-transparent
                ${active
                    ? 'text-accent font-bold bg-white/60 dark:bg-accent/20 shadow-lg shadow-accent/5 z-10'
                    : 'text-secondary hover:text-accent hover:bg-accent/5'}
                ${className}
            `}
        >
            {active && (
                <motion.div 
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-white dark:bg-white/5 rounded-[1.2rem] border border-white/20 dark:border-white/10 -z-10 shadow-xl"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}
            <span className={`${active ? 'text-accent scale-110' : 'opacity-60 group-hover:opacity-100'} transition-all`}>
                {icon}
            </span>
            <span className="text-xs font-medium whitespace-nowrap active:scale-95 transition-transform tracking-tight">{label}</span>
        </button>
    );
}
