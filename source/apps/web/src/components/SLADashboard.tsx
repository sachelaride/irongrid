import { trpc } from '../utils/trpc';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend
} from 'recharts';
import {
    Activity,
    CheckCircle2,
    AlertCircle,
    Clock,
    BarChart3,
    PieChart as PieChartIcon,
    ArrowUpRight,
    Target,
    Calendar,
    Users as UsersIcon,
    Building2,
    History
} from 'lucide-react';
import { useState } from 'react';

export function SLADashboard() {
    const [period, setPeriod] = useState({
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const { data: metrics, isLoading } = trpc.tickets.getSLADashboard.useQuery({
        startDate: period.startDate,
        endDate: period.endDate
    });

    if (isLoading) {
        return (
            <div className="h-96 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (!metrics) return null;

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4'];
    const STATUS_COLORS: any = {
        'No Prazo': '#10b981',
        'Atrasado': '#ef4444'
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            {/* Filtros de Período */}
            <div className="flex flex-col sm:flex-row justify-between items-end gap-6 bg-card p-6 rounded-[2rem] border border-border shadow-xl">
                <div className="flex-1 space-y-4">
                    <h3 className="text-[10px] font-black text-secondary/70 uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" /> Filtrar Período de Atendimento
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest ml-1">Início</label>
                            <input
                                type="date"
                                value={period.startDate}
                                onChange={(e) => setPeriod({ ...period, startDate: e.target.value })}
                                className="w-full bg-card/30 border border-border rounded-xl px-4 py-2.5 text-xs text-main outline-none focus:border-accent/50 transition-all font-bold"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest ml-1">Fim</label>
                            <input
                                type="date"
                                value={period.endDate}
                                onChange={(e) => setPeriod({ ...period, endDate: e.target.value })}
                                className="w-full bg-card/30 border border-border rounded-xl px-4 py-2.5 text-xs text-main outline-none focus:border-accent/50 transition-all font-bold"
                            />
                        </div>
                    </div>
                </div>
                <div className="hidden lg:block text-right">
                    <div className="text-[10px] text-secondary font-bold uppercase tracking-widest mb-1 italic">Status do Filtro</div>
                    <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-3 py-1.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                        Período Personalizado Ativo
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Conformidade SLA"
                    value={`${metrics.complianceRate}%`}
                    subtitle={`${metrics.onTime} chamados no prazo`}
                    icon={<Target className="text-emerald-500 w-6 h-6" />}
                    trend="+2.5%"
                    color="emerald"
                />
                <MetricCard
                    title="Volume Total"
                    value={metrics.totalResolved + metrics.totalOpen}
                    subtitle="Histórico + Ativos"
                    icon={<Activity className="text-accent w-6 h-6" />}
                    color="blue"
                />
                <MetricCard
                    title="Atrasados (Abertos)"
                    value={metrics.openSLAStatus.find(s => s.name === 'Atrasado')?.value || 0}
                    subtitle="Ação imediata necessária"
                    icon={<AlertCircle className="text-red-500 w-6 h-6" />}
                    trend="Atenção"
                    color="red"
                />
                <MetricCard
                    title="Concluídos"
                    value={metrics.totalResolved}
                    subtitle="Resolvidos / Fechados"
                    icon={<CheckCircle2 className="text-cyan-500 w-6 h-6" />}
                    color="cyan"
                />
                <MetricCard
                    title="Atraso Médio"
                    value={`${metrics.avgDelayHours}h`}
                    subtitle="Tempo pós-expiração"
                    icon={<History className="text-amber-500 w-6 h-6" />}
                    color="amber"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Distribuição por Torre */}
                <div className="bg-card border border-border p-8 rounded-[3rem] shadow-2xl flex flex-col h-[450px]">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xl font-black text-main italic flex items-center gap-3 tracking-tight uppercase">
                                <PieChartIcon className="w-6 h-6 text-accent" /> Chamados por Torre
                            </h3>
                            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Distribuição de volume por grupo de serviço</p>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={metrics.volumeByGroup}
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {metrics.volumeByGroup.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '1.5rem', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)' }}
                                    itemStyle={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '12px' }}
                                />
                                <Legend
                                    verticalAlign="middle"
                                    align="right"
                                    layout="vertical"
                                    formatter={(value) => <span className="text-[10px] font-black uppercase text-secondary tracking-widest ml-2">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* MTTR por Prioridade */}
                <div className="bg-card border border-border p-8 rounded-[3rem] shadow-2xl flex flex-col h-[450px]">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xl font-black text-main italic flex items-center gap-3 tracking-tight uppercase">
                                <BarChart3 className="w-6 h-6 text-cyan-600 dark:text-cyan-500" /> MTTR por Prioridade
                            </h3>
                            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Tempo médio de resolução em horas</p>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.mttrByPriority}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                                <XAxis
                                    dataKey="priority"
                                    stroke="#64748b"
                                    fontSize={10}
                                    fontWeight="900"
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                    tickFormatter={(val) => val.toUpperCase()}
                                />
                                <YAxis stroke="#64748b" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)', radius: 10 }}
                                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '1.5rem', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)' }}
                                    itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="hours" name="Horas" fill="url(#colorMttr)" radius={[10, 10, 0, 0]} />
                                <defs>
                                    <linearGradient id="colorMttr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Conformidade por Departamento */}
                <div className="bg-card border border-border p-8 rounded-[3rem] shadow-2xl flex flex-col h-[450px]">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xl font-black text-main italic flex items-center gap-3 tracking-tight uppercase">
                                <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-500" /> SLA por Unidade/Dept
                            </h3>
                            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Percentual de conformidade por setor</p>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.complianceByDept} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                <XAxis type="number" domain={[0, 100]} hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#64748b"
                                    fontSize={9}
                                    fontWeight="900"
                                    width={100}
                                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 12) + '...' : val}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '1rem' }}
                                    formatter={(value) => [`${value}%`, 'Conformidade']}
                                />
                                <Bar dataKey="rate" radius={[0, 10, 10, 0]}>
                                    {metrics.complianceByDept.map((entry: any, index: number) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.rate >= 90 ? '#10b981' : entry.rate >= 70 ? '#f59e0b' : '#ef4444'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Performance por Atendente */}
                <div className="bg-card border border-border p-8 rounded-[3rem] shadow-2xl flex flex-col h-[450px]">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xl font-black text-main italic flex items-center gap-3 tracking-tight uppercase">
                                <UsersIcon className="w-6 h-6 text-accent" /> Metas por Atendente
                            </h3>
                            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Conformidade individual de entrega</p>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.complianceByAttendant}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#64748b"
                                    fontSize={9}
                                    fontWeight="900"
                                    tickFormatter={(val) => val.split(' ')[0]}
                                />
                                <YAxis stroke="#64748b" fontSize={9} fontWeight="900" domain={[0, 100]} />
                                <Tooltip
                                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '1rem' }}
                                    formatter={(value) => [`${value}%`, 'Eficiência']}
                                />
                                <Bar dataKey="rate" fill="#6366f1" radius={[10, 10, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status SLA - Chamados Abertos */}
                <div className="bg-card border border-border p-8 rounded-[3rem] shadow-2xl flex flex-col h-[450px] lg:col-span-2">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xl font-black text-main italic flex items-center gap-3 tracking-tight uppercase">
                                <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-500" /> Saúde do SLA (Abertos)
                            </h3>
                            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Status atual dos chamados em atendimento</p>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.openSLAStatus} layout="vertical" margin={{ left: 40, right: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} opacity={0.3} />
                                <XAxis type="number" stroke="#64748b" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#64748b"
                                    fontSize={10}
                                    fontWeight="900"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(16, 185, 129, 0.1)', radius: 10 }}
                                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '1.5rem' }}
                                />
                                <Bar dataKey="value" name="Volume" radius={[0, 10, 10, 0]}>
                                    {metrics.openSLAStatus.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#64748b'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, value, subtitle, icon, trend, color }: any) {
    return (
        <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl hover:border-accent/20 transition-all group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-5 group-hover:opacity-10 transition-opacity bg-${color}-500`} />

            <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-page/50 border border-border rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                {trend && (
                    <span className={`text-[9px] font-black italic px-2 py-1 rounded-lg border flex items-center gap-1 ${trend.startsWith('+') ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-600 bg-amber-500/10 border-amber-500/20'}`}>
                        {trend.startsWith('+') && <ArrowUpRight className="w-3 h-3" />} {trend}
                    </span>
                )}
            </div>

            <h4 className="text-[10px] font-black text-secondary/70 uppercase tracking-[0.2em] mb-2">{title}</h4>
            <div className="text-4xl font-black text-main italic tracking-tighter mb-1">{value}</div>
            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">{subtitle}</p>
        </div>
    );
}
