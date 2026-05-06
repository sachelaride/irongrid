/**
 * Componente AlertCenter - Central de Monitoramento de Alertas
 * 
 * Este componente fornece uma interface para visualização e gerenciamento de 
 * alertas gerados pelo sistema. Permite filtrar alertas por status e gravidade, 
 * além de oferecer ações para reconhecimento (acknowledge) e resolução.
 * 
 * Funcionalidades:
 * - Listagem em tempo real de alertas (Ativos, Reconhecidos, Resolvidos).
 * - Identificação visual por severidade (Crítico, Aviso, Informativo).
 * - Integração com dispositivos e tickets (vínculo automático).
 * - Ações rápidas de reconhecimento e limpeza de alertas.
 * 
 * @module components/AlertCenter
 */

import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { AlertCircle, Bell, CheckCircle, ShieldAlert, Clock, Trash2, MessageSquare } from 'lucide-react';

export function AlertCenter() {
    const [filter, setFilter] = useState<string>('ACTIVE');

    // Consulta tRPC para listar alertas baseado no filtro selecionado
    const { data: alerts = [], isLoading, refetch } = trpc.alerts.list.useQuery({
        status: filter === 'ALL' ? undefined : (filter as any)
    });

    /** Mutação para marcar alerta como reconhecido */
    const acknowledge = trpc.alerts.acknowledge.useMutation({ onSuccess: () => refetch() });

    /** Mutação para marcar alerta como resolvido */
    const resolve = trpc.alerts.resolve.useMutation({ onSuccess: () => refetch() });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header e Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-main italic tracking-tight flex items-center gap-4 uppercase">
                        <div className="p-3 bg-orange-500/10 rounded-2xl shadow-inner">
                            <Bell className="w-8 h-8 text-orange-500" />
                        </div>
                        Central de Alertas
                    </h1>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-2 ml-16">Monitoramento em Tempo Real</p>
                </div>
                <div className="flex bg-page/50 p-1.5 rounded-[1.5rem] border border-border shadow-xl backdrop-blur-md">
                    {['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'].map(s => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === s ? 'bg-card text-main shadow-lg' : 'text-secondary hover:text-main'}`}
                        >
                            {s === 'ACTIVE' ? 'Ativos' : s === 'ACKNOWLEDGED' ? 'Reconhecidos' : s === 'RESOLVED' ? 'Resolvidos' : 'Todos'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Listagem de Alertas */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-20 text-secondary italic bg-card/30 border border-dashed border-border rounded-[3rem]">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                    <p className="font-medium">Sincronizando alertas...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {alerts.map((alert: any) => (
                        <div
                            key={alert.id}
                            className={`
                                bg-card border border-border p-6 rounded-[2rem] transition-all hover:bg-page/50 relative group shadow-sm hover:shadow-xl
                                border-l-[6px] ${alert.severity === 'CRITICAL' ? 'border-l-rose-500' : alert.severity === 'WARNING' ? 'border-l-amber-500' : 'border-l-primary'}
                            `}
                        >
                            <div className="flex justify-between items-start gap-6">
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <SeverityIcon severity={alert.severity} />
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${alert.severity === 'CRITICAL' ? 'text-rose-500' : 'text-secondary'}`}>
                                            {alert.severity}
                                        </span>
                                        <div className="w-1 h-1 rounded-full bg-border" />
                                        <span className="text-[10px] text-secondary/70 flex items-center gap-1.5 font-bold uppercase tracking-tight">
                                            <Clock className="w-3.5 h-3.5" /> {new Date(alert.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black text-main italic tracking-tight uppercase">{alert.title}</h3>
                                    <p className="text-sm text-secondary font-medium whitespace-pre-wrap leading-relaxed">{alert.message}</p>

                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {alert.device && (
                                            <div className="flex flex-wrap gap-2">
                                                <div className="flex items-center gap-2 text-[10px] text-main bg-primary/5 px-3 py-1.5 rounded-full border border-primary/20 font-black uppercase tracking-widest">
                                                    <ShieldAlert className="w-3.5 h-3.5" />
                                                    <span>Origem: {alert.device.name} ({alert.device.ipAddress})</span>
                                                </div>
                                                {alert.device.status === 'OFFLINE' && alert.device.offlineSince && (
                                                    <div className="flex items-center gap-2 text-[10px] text-rose-600 dark:text-rose-400 bg-rose-500/5 px-3 py-1.5 rounded-full border border-rose-500/20 font-black uppercase tracking-widest animate-pulse">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>Fora do ar há: {Math.floor((new Date().getTime() - new Date(alert.device.offlineSince).getTime()) / 60000)} min</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {alert.tickets && alert.tickets.length > 0 && (
                                            <div className="flex gap-2">
                                                {alert.tickets.map((t: any) => (
                                                    <div key={t.id} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] px-3 py-1.5 rounded-full flex items-center gap-1.5 font-black uppercase tracking-widest">
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                        Chamado #{t.ticketNumber} ({t.status})
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {alert.status === 'ACTIVE' && (
                                        <button
                                            onClick={() => acknowledge.mutate({ id: alert.id })}
                                            className="p-3 bg-page/10 hover:bg-card text-secondary rounded-2xl transition-all shadow-inner border border-transparent hover:border-border"
                                            title="Reconhecer"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                    )}
                                    {alert.status !== 'RESOLVED' && (
                                        <button
                                            onClick={() => resolve.mutate({ id: alert.id })}
                                            className="p-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded-2xl transition-all shadow-inner border border-transparent"
                                            title="Resolver Alerta"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {alerts.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-20 text-secondary italic bg-card/30 border border-dashed border-border rounded-[3rem]">
                            <div className="p-8 bg-page/10 rounded-[2.5rem] mb-6 shadow-inner">
                                <Bell className="w-16 h-16 text-secondary/30 opacity-50" />
                            </div>
                            <h3 className="text-xl font-black text-secondary/50 italic tracking-tight uppercase">Todo limpo por aqui!</h3>
                            <p className="text-sm font-medium mt-2">Nenhum alerta detectado no sistema.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Retorna o ícone correspondente à severidade do alerta
 * @private
 */
function SeverityIcon({ severity }: { severity: string }) {
    switch (severity) {
        case 'CRITICAL': return <AlertCircle className="w-4 h-4 text-rose-500" />;
        case 'WARNING': return <AlertCircle className="w-4 h-4 text-amber-500" />;
        default: return <AlertCircle className="w-4 h-4 text-main" />;
    }
}
