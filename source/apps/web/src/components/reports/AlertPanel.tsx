import { AlertCircle, Clock, MapPin, Globe } from 'lucide-react';
import { StatusBadge } from '../ui/DesignSystem';

interface Alert {
    id: string;
    type: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    createdAt: Date | string;
    device: {
        name: string;
        ipAddress: string;
    };
}

interface AlertPanelProps {
    alerts: Alert[];
}

export function AlertPanel({ alerts }: AlertPanelProps) {
    if (alerts.length === 0) {
        return (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl p-12 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-400 italic">SISTEMA LIMPO</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-500 font-medium">Nenhum alerta estratégico ativo no momento.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-sm font-black text-secondary uppercase tracking-widest italic">Alertas Estratégicos Ativos</h3>
                <StatusBadge label={`${alerts.length} ALBERTAS`} variant="danger" />
            </div>

            {alerts.map((alert) => (
                <div key={alert.id} className="bg-card border border-border rounded-2xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl shrink-0 ${alert.severity === 'CRITICAL' ? 'bg-rose-600/10 text-rose-600' :
                            alert.severity === 'WARNING' ? 'bg-amber-500/10 text-amber-500' :
                                'bg-accent/10 text-accent'
                            }`}>
                            <AlertCircle className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <h4 className="font-black text-main italic truncate">{alert.device.name}</h4>
                                <div className="flex items-center gap-1 text-[10px] text-secondary/70 font-medium italic shrink-0">
                                    <Clock className="w-3 h-3" />
                                    {new Date(alert.createdAt).toLocaleString()}
                                </div>
                            </div>

                            <p className="text-xs text-secondary font-medium line-clamp-2 mb-3">{alert.message}</p>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-secondary/70 uppercase tracking-tighter italic">
                                    <MapPin className="w-3 h-3" />
                                    {alert.device.ipAddress}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-accent uppercase tracking-tighter italic">
                                    {alert.type}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
