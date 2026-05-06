import { trpc } from '../utils/trpc';
import { DollarSign, ShieldAlert, PieChart, BarChart3, Users, Building } from 'lucide-react';
import { ResponsiveContainer, PieChart as RePie, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export function BIDashboard() {
    const { data: stats } = (trpc as any).dashboard.getStats.useQuery();
    const { data: maintRecords = [] } = (trpc as any).maintenance.listRecords.useQuery();
    const { data: devicesData = [] } = trpc.scan.getDevices.useQuery({});
    const devices = Array.isArray(devicesData) ? devicesData : (devicesData as any)?.devices ?? [];

    // Cálculos de BI
    const totalMaintCost = maintRecords.reduce((sum: number, r: any) => sum + (r.cost || 0), 0);

    // Distribuição por Tipo de Ativo
    const deviceTypeStats = devices.reduce((acc: any, d: any) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
    }, {});

    const pieData = Object.entries(deviceTypeStats).map(([name, value]) => ({ name, value }));

    // Manutenções por Mês (simplificado p/ demonstração)
    const maintByStatus = maintRecords.reduce((acc: any, r: any) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    const barData = Object.entries(maintByStatus).map(([name, value]) => ({ name, value }));

    const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

    return (
        <div className="space-y-8 pb-12">
            {/* Executive Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <BICard
                    title="Custo Total Manutenção"
                    value={totalMaintCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    icon={<DollarSign className="text-emerald-500" />}
                    trend="+12%"
                />
                <BICard
                    title="Ativos Gerenciados"
                    value={devices.length.toString()}
                    icon={<Building className="text-accent" />}
                />
                <BICard
                    title="Alertas Críticos (mês)"
                    value={stats?.totalAlerts || '0'}
                    icon={<ShieldAlert className="text-red-500" />}
                    trend="-5%"
                />
                <BICard
                    title="Horas de Suporte"
                    value="142h"
                    icon={<Users className="text-cyan-500" />}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Distribuição de Ativos */}
                <div className="bg-card border border-border p-8 rounded-[3rem] shadow-2xl h-[450px] flex flex-col">
                    <h3 className="text-xl font-black text-main italic mb-8 flex items-center gap-3 tracking-tight uppercase">
                        <PieChart className="w-6 h-6 text-accent" /> Composição do Inventário
                    </h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePie>
                                <Pie
                                    data={pieData}
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '1rem' }}
                                    itemStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px', color: '#94a3b8' }} />
                            </RePie>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status de Manutenções */}
                <div className="bg-card border border-border p-8 rounded-[3rem] shadow-2xl h-[450px] flex flex-col">
                    <h3 className="text-xl font-black text-main italic mb-8 flex items-center gap-3 tracking-tight uppercase">
                        <BarChart3 className="w-6 h-6 text-cyan-600 dark:text-cyan-500" /> Fluxo de Manutenções
                    </h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#64748b" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'var(--bg-page)', opacity: 0.4 }}
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1.5rem', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BICard({ title, value, icon, trend }: any) {
    return (
        <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl hover:border-accent/20 transition-all group">
            <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-page/50 border border-border rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                {trend && (
                    <span className={`text-[10px] font-black italic px-3 py-1 rounded-lg border ${trend.startsWith('+') ? 'text-red-600 bg-red-500/10 border-red-500/20' : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'}`}>
                        {trend}
                    </span>
                )}
            </div>
            <h4 className="text-[10px] font-black text-secondary/70 uppercase tracking-[0.2em] mb-2">{title}</h4>
            <div className="text-3xl font-black text-main italic tracking-tight">{value}</div>
        </div>
    );
}
