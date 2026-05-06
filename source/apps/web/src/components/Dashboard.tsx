import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../utils/trpc';
import { StatusWidget } from './StatusWidget';
import { MetricChart } from './MetricChart';
import {
    Cpu,
    Wifi,
    Database,
    Activity,
    AlertCircle,
    Shield,
    Users,
    MapPin,
    Clock,
    TrendingUp,
    ShieldAlert,
    Terminal,
    HeartPulse,
    ShieldCheck,
    DollarSign,
    Zap,
    Scale
} from 'lucide-react';

/**
 * Formata números grandes com sufixos compactos
 * Exemplos: 1500 -> 1.5K, 412195 -> 412.2K, 2500000 -> 2.5M
 */
function formatNumber(num: number): string {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
}

export function Dashboard() {
    // Estado que controla qual visão (perfil) está ativa no momento
    const [profile, setProfile] = useState<'technical' | 'executive' | 'strategic'>('technical');

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            {/* Cabeçalho do Dashboard - NOC Minimalist */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                    <h2 className="text-5xl font-black text-white tracking-tighter mb-2 italic">Dashboard</h2>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] opacity-70">Monitoramento global em tempo real</span>
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Ativo</span>
                        </div>
                    </div>
                </div>

                {/* Seletor de Perfil (Tabs) - High Contrast Cyber */}
                <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-3xl overflow-x-auto">
                    <ProfileTab active={profile === 'technical'} onClick={() => setProfile('technical')} label="Técnico" icon={Activity} />
                    <ProfileTab active={profile === 'executive'} onClick={() => setProfile('executive')} label="Gestão" icon={Shield} />
                    <ProfileTab active={profile === 'strategic'} onClick={() => setProfile('strategic')} label="Estratégico" icon={TrendingUp} />
                </div>
            </div>

            {/* Renderização condicional das visões baseada no perfil selecionado */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={profile}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                >
                    {profile === 'technical' && <TechnicalView />}
                    {profile === 'executive' && <ExecutiveView />}
                    {profile === 'strategic' && <StrategicView />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

/**
 * Componente de Tab para o seletor de perfil.
 */
function ProfileTab({ active, onClick, label, icon: Icon }: any) {
    return (
        <button
            onClick={onClick}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 relative ${active ? 'text-white' : 'text-secondary hover:text-main hover:bg-white/5'}`}
        >
            {active && (
                <motion.div 
                    layoutId="profile-tab-active"
                    className="absolute inset-0 bg-[#323644] border border-white/10 rounded-xl shadow-lg -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}
            <Icon className={`w-3.5 h-3.5 ${active ? 'text-accent' : 'opacity-70'}`} /> {label}
        </button>
    );
}

// --- VISÃO TÉCNICA (Monitoramento de Infra e Performance) ---
/**
 * Visão Técnica - Focada em métricas de performance e infraestrutura crítica.
 * @private
 */
function TechnicalView() {
    // Queries tRPC com polling para atualização em tempo real
    const { data: serverStats } = trpc.dashboard.getServerStats.useQuery(undefined, { refetchInterval: 3000 });
    const { data: globalStats } = trpc.dashboard.getGlobalStats.useQuery(undefined, { refetchInterval: 10000 });
    const { data: techStats } = (trpc.dashboard as any).getTechnicalStats.useQuery(undefined, { refetchInterval: 3000 });
    const { data: maintenanceStatus } = (trpc as any).system.getMaintenanceStatus.useQuery(undefined, { refetchInterval: 3000 });

    // Estado para armazenar o histórico do gráfico de tráfego em tempo real
    const [realTimeData, setRealTimeData] = useState<any[]>([]);

    // Efeito para alimentar o gráfico de rede conforme os dados chegam do servidor
    useEffect(() => {
        if (serverStats) {
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            // Mantém apenas os últimos 30 pontos de dados no gráfico (em Mbps)
            setRealTimeData(prev => [...prev, {
                time: timeStr,
                value: Number(((serverStats.network.rx_sec + serverStats.network.tx_sec) * 8 / 1000 / 1000).toFixed(1))
            }].slice(-30));
        }
    }, [serverStats]);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-8"
        >
            {/* Row 1: Disponibilidade (Online/Offline) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <motion.div variants={item}><StatusWidget title="PostgreSQL" value="ONLINE" icon={Database} color="green" /></motion.div>
                <motion.div variants={item}><StatusWidget title="InfluxDB" value={maintenanceStatus?.health.influxSize ? "ONLINE" : "OFFLINE"} icon={Activity} color={maintenanceStatus?.health.influxSize ? "green" : "red"} /></motion.div>
                <motion.div variants={item}><StatusWidget title="Syslog Serv" value="ONLINE" icon={Terminal} color="green" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Ativos Online" value={globalStats?.online.toString() || '0'} trend={`${globalStats?.total || 0} total`} trendUp={true} icon={Wifi} color="green" /></motion.div>
            </div>

            {/* Row 2: Tráfego e Incidentes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-card border border-border rounded-[2rem] p-10 shadow-sm group">
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-xl font-black text-main flex items-center gap-3 tracking-tight italic uppercase">
                                <TrendingUp className="w-5 h-5 text-accent" /> Tráfego do Sistema
                            </h3>
                            <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em] opacity-90">Métricas em Mbps</span>
                        </div>
                        <div className="h-[300px]">
                            <MetricChart data={realTimeData} color="#00f2ff" unit=" Mbps" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl">
                    <h3 className="text-xl font-black text-main mb-8 italic tracking-tight uppercase">Incidentes Recentes</h3>
                    <div className="space-y-4">
                        {techStats?.incidentFeed.map((t: any) => (
                            <div key={t.id} className="p-4 bg-page/40 rounded-2xl border border-border/50 hover:border-accent/30 transition-all cursor-default group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-mono font-black text-accent tracking-wider">#{t.ticketNumber}</span>
                                    <span className="text-[9px] uppercase font-black text-secondary tracking-widest">{t.status}</span>
                                </div>
                                <p className="text-[13px] font-bold text-main line-clamp-1 group-hover:text-accent transition-colors uppercase tracking-tight">{t.title}</p>
                            </div>
                        ))}
                        {(!techStats?.incidentFeed || techStats.incidentFeed.length === 0) && (
                            <p className="text-center text-secondary/50 p-12 bg-page/10 rounded-[2rem] border border-dashed border-border italic text-sm font-medium">Sem incidentes abertos.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 3: Métricas de Performance e Saúde */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <motion.div variants={item}><StatusWidget title="CPU Servidor" value={`${serverStats?.cpu.load.toFixed(1) || 0}%`} icon={Cpu} color="blue" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Uptime" value={serverStats ? `${Math.floor(serverStats.uptime / 3600)}h ${Math.floor((serverStats.uptime % 3600) / 60)}m` : '0h'} icon={Clock} color="blue" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Alertas Críticos" value={techStats?.criticalAlertsCount.toString() || '0'} icon={AlertCircle} color="red" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Auditoria" value={maintenanceStatus?.health.auditConfigs || '0'} icon={ShieldAlert} color="blue" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Notificações" value={maintenanceStatus?.health.notifications || '0'} icon={Activity} color="yellow" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Ações Remotas" value={maintenanceStatus?.health.remoteLogs || '0'} icon={Database} color="red" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Tam (PG)" value={maintenanceStatus?.health.dbSize || '...'} icon={Database} color="blue" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Tam (Influx)" value={maintenanceStatus?.health.influxSize || '...'} icon={Activity} color="yellow" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Syslog Count" value={formatNumber(maintenanceStatus?.health.syslogCount || 0)} icon={Terminal} color="blue" /></motion.div>
                <motion.div variants={item}><StatusWidget title="Tam (Syslog)" value={maintenanceStatus?.health.syslogSize || '...'} icon={Database} color="blue" /></motion.div>
            </div>
        </motion.div>
    );
}

// --- VISÃO DE GESTÃO (KPIs, Ativos e Saúde do Negócio) ---
/**
 * Visão de Gestão - Combina KPIs administrativos e executivos para uma visão consolidada.
 * @private
 */
function ExecutiveView() {
    const { data: execStats } = (trpc.dashboard as any).getExecutiveStats.useQuery();
    const { data: adminStats } = (trpc.dashboard as any).getAdministrativeStats.useQuery();
    const { data: config } = (trpc.system as any).getSystemCustomization.useQuery();
    const slaGoal = config?.dashSlaGoal || 98.0;

    return (
        <div className="space-y-6">
            {/* KPIs de Alto Nível */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Uptime Global */}
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-900/40 dark:to-teal-900/40 p-10 rounded-3xl shadow-xl shadow-emerald-500/10 text-white relative overflow-hidden border border-emerald-500/20 group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-150 transition-transform duration-1000">
                        <Activity className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <h4 className="text-xs font-black uppercase opacity-60 mb-2 tracking-widest text-emerald-100">Uptime Global</h4>
                        <p className="text-6xl font-black tracking-tighter italic">{execStats?.systemUptime.toFixed(1) || 100}%</p>
                    </div>
                </div>

                {/* Conformidade SLA */}
                <div className="bg-card border border-border p-10 rounded-[2.5rem] text-main shadow-xl group">
                    <div className="flex justify-between items-start mb-4">
                        <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest">Conformidade SLA</h4>
                        <span className="text-[9px] font-bold text-secondary bg-page/50 px-2 py-1 rounded-lg">Meta: {slaGoal}%</span>
                    </div>
                    <p className={`text-6xl font-black italic tracking-tighter ${(execStats?.slaCompliance || 0) >= slaGoal ? 'text-emerald-500' : 'text-amber-500'}`}>{execStats?.slaCompliance.toFixed(1) || 0}%</p>
                </div>

                {/* Ativos Gerenciados */}
                <div className="bg-card border border-border p-10 rounded-[2.5rem] text-main shadow-xl group hover:border-accent/20 transition-all">
                    <h4 className="text-[10px] font-black text-secondary uppercase mb-4 tracking-widest">Ativos</h4>
                    <p className="text-6xl font-black italic tracking-tighter">{execStats?.totalAssets || 0}</p>
                    <p className="text-[10px] text-accent mt-4 font-black uppercase tracking-wider italic">Inventário Completo</p>
                </div>

                {/* Softwares/Inventário */}
                <div className="bg-card border border-border p-10 rounded-[2.5rem] text-main shadow-xl group hover:border-amber-500/20 transition-all">
                    <h4 className="text-[10px] font-black text-secondary uppercase mb-4 tracking-widest">Softwares</h4>
                    <p className="text-6xl font-black italic tracking-tighter">{adminStats?.inventorySize || 0}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-4 font-black uppercase tracking-wider italic">Catálogo de Ativos</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Organização (Departamentos e Localizações) */}
                <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl space-y-6">
                    <h3 className="text-xl font-black text-main italic tracking-tight mb-4 uppercase">Estrutura Organizacional</h3>
                    <div className="flex items-center gap-6 p-4 bg-accent/5 rounded-2xl border border-accent/10 transition-all">
                        <div className="p-4 bg-accent/10 rounded-2xl text-accent"><Users className="w-6 h-6" /></div>
                        <div>
                            <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Departamentos</h4>
                            <p className="text-2xl font-black text-main italic tracking-tight">{adminStats?.orgCounts.depts || 0}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 p-4 bg-purple-600/5 rounded-2xl border border-purple-600/10 transition-all">
                        <div className="p-4 bg-purple-600/10 rounded-2xl text-purple-600 dark:text-purple-400"><MapPin className="w-6 h-6" /></div>
                        <div>
                            <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Localizações</h4>
                            <p className="text-2xl font-black text-main italic tracking-tight">{adminStats?.orgCounts.locations || 0}</p>
                        </div>
                    </div>
                </div>

                {/* Distribuição de Chamados */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl lg:col-span-2">
                    <h3 className="text-xl font-black text-main mb-8 italic tracking-tight uppercase">Status de Chamados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        {adminStats?.ticketDistribution.map((d: any) => (
                            <div key={d.status} className="flex items-center justify-between group">
                                <span className="text-[10px] text-secondary font-black uppercase tracking-widest w-24">{d.status}</span>
                                <div className="flex-1 mx-4 h-2 bg-page/50 rounded-full overflow-hidden shadow-inner border border-border/10">
                                    <div className="h-full bg-accent rounded-full transition-all duration-1000 group-hover:scale-y-125" style={{ width: `${(d.count / (adminStats.ticketDistribution.reduce((acc: any, curr: any) => acc + curr.count, 0) || 1)) * 100}%` }} />
                                </div>
                                <span className="text-sm font-black text-main italic w-8 text-right">{d.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Saúde de Infraestrutura consolidada */}
            <div className="bg-card border border-border p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-2xl font-black text-main mb-2 italic tracking-tight uppercase">Saúde da Infraestrutura</h3>
                    <p className="text-secondary text-sm mb-10 font-medium">Tendência consolidada de disponibilidade (30 dias)</p>
                </div>
                <div className="h-[200px] flex items-end gap-3 px-10 relative z-10">
                    {[65, 72, 80, 75, 85, 90, 88, 92, 95, 98, 97, 99].map((val, i) => (
                        <div key={i} className="flex-1 bg-emerald-100 dark:bg-emerald-500/10 border-t-2 border-emerald-500/50 rounded-t-2xl transition-all hover:bg-emerald-500 group relative">
                            <div className="h-full w-full opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-500 rounded-t-2xl shadow-lg shadow-emerald-500/20" />
                            <div className="absolute bottom-0 left-0 w-full bg-emerald-500/20 rounded-t-2xl transition-all" style={{ height: `${val}%` }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}



// --- VISÃO ESTRATÉGICA (Gestão de Alto Nível e Conformidade) ---
/**
 * Visão Estratégica - Consolida indicadores de saúde, risco e financeiro.
 * @private
 */
function StrategicView() {
    const { data: healthData } = (trpc as any).reports.getHealthIndicators.useQuery();
    const { data: riskData } = (trpc as any).reports.getRiskAssessment.useQuery();
    const { data: financialData } = (trpc as any).reports.getFinancialReport.useQuery();
    const { data: energyData } = (trpc as any).reports.getEnergyReport.useQuery();

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
            {/* Grid de KPIs Estratégicos Baseados em Ativos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StrategicCard
                    title="Conformidade Backup"
                    value={`${healthData?.backupCompliance || 0}%`}
                    icon={Database}
                    color="blue"
                    desc="Máquinas com backup configurado"
                />
                <StrategicCard
                    title="Score de Risco"
                    value={riskData?.matrix.critical > 0 ? "ALTO" : "BAIXO"}
                    icon={ShieldCheck}
                    color={riskData?.matrix.critical > 0 ? "red" : "green"}
                    desc={`${riskData?.matrix.critical || 0} ativos em estado crítico`}
                />
                <StrategicCard
                    title="Custo Patrimonial"
                    value={`R$ ${(financialData?.currentAssetValue || 0).toLocaleString()}`}
                    icon={DollarSign}
                    color="emerald"
                    desc="Valor depreciado do parque"
                />
                <StrategicCard
                    title="Consumo Energético"
                    value={`${(energyData?.totalWatts || 0).toLocaleString()}W`}
                    icon={Zap}
                    color="yellow"
                    desc={`Est. R$ ${(energyData?.estimatedMonthlyCost || 0).toFixed(2)} /mês`}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Saúde do Parque (Compliance) */}
                <div className="bg-card border border-border rounded-[3rem] p-10 shadow-2xl backdrop-blur-sm">
                    <h3 className="text-2xl font-black text-main mb-8 italic tracking-tight flex items-center gap-3 uppercase">
                        <HeartPulse className="w-8 h-8 text-rose-500" /> Saúde & Conformidade
                    </h3>
                    <div className="space-y-8">
                        <ProgressBar label="Atualização de Hardware (RAM >= 8GB)" value={healthData?.ramCompliance || 0} color="#3b82f6" />
                        <ProgressBar label="Disponibilidade Online (SLA)" value={healthData?.onlineRate || 0} color="#10b981" />
                        <ProgressBar label="Conformidade Elétrica (UPS)" value={healthData?.upsCompliance || 0} color="#f59e0b" />
                    </div>
                </div>

                {/* Resumo Financeiro e ROI */}
                <div className="bg-card border border-border rounded-[3rem] p-10 shadow-2xl backdrop-blur-sm">
                    <h3 className="text-2xl font-black text-main mb-8 italic tracking-tight flex items-center gap-3 uppercase">
                        <Scale className="w-8 h-8 text-accent" /> Eficiência Financeira
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-page/10 rounded-[2rem] border border-border/10">
                            <span className="text-[10px] font-black text-secondary/70 uppercase tracking-widest block mb-2">Total Investido</span>
                            <span className="text-2xl font-bold text-main italic">R$ {(financialData?.totalInvested || 0).toLocaleString()}</span>
                        </div>
                        <div className="p-6 bg-page/10 rounded-[2rem] border border-border/10">
                            <span className="text-[10px] font-black text-secondary/70 uppercase tracking-widest block mb-2">Manutenção Total</span>
                            <span className="text-2xl font-bold text-rose-500 italic">R$ {(financialData?.totalMaintenance || 0).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="mt-8 p-8 bg-primary/5 rounded-[2.5rem] border border-primary/20">
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-[10px] font-black text-main uppercase tracking-widest block mb-1 font-mono">Retorno Residual (ROI)</span>
                                <span className="text-5xl font-black text-main italic">{(financialData?.roi || 0).toFixed(1)}%</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-secondary block">Vida Útil Estimada</span>
                                <span className="text-lg font-black text-main">{(financialData?.roi || 0) > 50 ? 'EXCELENTE' : 'EM ALERTA'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StrategicCard({ title, value, icon: Icon, color, desc }: any) {
    const colors: any = {
        blue: 'text-accent bg-accent/10',
        green: 'text-success bg-success/10',
        red: 'text-error bg-error/10',
        yellow: 'text-warning bg-warning/10',
        emerald: 'text-success bg-success/10',
    };

    return (
        <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl group hover:-translate-y-1 transition-all">
            <div className={`p-4 rounded-2xl w-fit mb-6 ${colors[color] || colors.blue}`}>
                <Icon className="w-6 h-6" />
            </div>
            <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">{title}</h4>
            <p className="text-3xl font-black text-main italic tracking-tight mb-2 lowercase">{value}</p>
            <p className="text-[10px] font-bold text-secondary uppercase">{desc}</p>
        </div>
    );
}

function ProgressBar({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-secondary uppercase tracking-widest font-mono">{label}</span>
                <span className="text-sm font-black italic tracking-tighter" style={{ color }}>{value.toFixed(1)}%</span>
            </div>
            <div className="h-4 bg-page/50 rounded-full overflow-hidden shadow-inner border border-border/10">
                <div
                    className="h-full rounded-full transition-all duration-1000 shadow-lg"
                    style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 20px ${color}44` }}
                />
            </div>
        </div>
    );
}

