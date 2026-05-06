
import { ShieldAlert, Activity, Database, Terminal } from 'lucide-react';

interface MaintenanceOverviewProps {
    status: any;
}

export function MaintenanceOverview({ status }: MaintenanceOverviewProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Grid de Estatísticas de Saúde */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<ShieldAlert className="text-accent" />} label="Auditoria" value={status?.health.auditConfigs} />
                <StatCard icon={<Activity className="text-amber-400" />} label="Notificações" value={status?.health.notifications} />
                <StatCard icon={<Database className="text-red-400" />} label="Ações Remotas" value={status?.health.remoteLogs} />
                <StatCard icon={<Database className="text-purple-400" />} label="Tam (PG)" value={status?.health.dbSize || '...'} />
                <StatCard icon={<Activity className="text-amber-500" />} label="Tam (Influx)" value={status?.health.influxSize || '...'} />
                <StatCard icon={<Terminal className="text-accent" />} label="Syslog (Entries)" value={status?.health.syslogCount || 0} />
                <StatCard icon={<Database className="text-cyan-500" />} label="Tam (Syslog)" value={status?.health.syslogSize || '...'} />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-6">
                <h4 className="text-sm font-bold text-slate-300 mb-4">Status dos Serviços</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ServiceStatus label="Banco de Dados (PostgreSQL)" status="online" />
                    <ServiceStatus label="Banco Temporal (InfluxDB)" status={status?.health.influxSize ? "online" : "unknown"} />
                    <ServiceStatus label="Servidor Syslog" status="online" />
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: any, label: string, value: any }) {
    return (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-slate-700 transition-colors shadow-sm">
            <div className="p-3 bg-white/5 bg-page rounded-lg border border-border text-secondary">
                {icon}
            </div>
            <div>
                <p className="text-xs text-secondary uppercase font-bold tracking-wider mb-1">{label}</p>
                <p className="text-xl font-black text-main">{value?.toLocaleString() || '0'}</p>
            </div>
        </div>
    );
}

function ServiceStatus({ label, status }: { label: string, status: 'online' | 'offline' | 'unknown' }) {
    const colors = {
        online: 'bg-emerald-500',
        offline: 'bg-red-500',
        unknown: 'bg-white/10'
    };

    return (
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-sm text-slate-300 font-medium">{label}</span>
            <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${colors[status]} animate-pulse`} />
                <span className="text-xs uppercase font-bold text-secondary">{status}</span>
            </div>
        </div>
    );
}
