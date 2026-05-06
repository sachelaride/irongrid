import { trpc } from '../utils/trpc';
import { Bell, CheckCircle2, XCircle, Clock, Info, RefreshCw } from 'lucide-react';

export function NotificationLogsViewer({ channelId }: { channelId?: string }) {
    const { data: logs = [], isLoading, refetch, isFetching } = (trpc as any).notification.getLogs.useQuery({ channelId });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800">
                <div>
                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase flex items-center gap-3">
                        <Bell className="w-6 h-6 text-emerald-500" />
                        Logs de Notificação
                    </h3>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Histórico de disparos multi-canal</p>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-secondary/70 hover:text-white rounded-xl transition-all active:scale-95"
                >
                    <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-[2rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/50 border-b border-slate-800">
                                <th className="px-6 py-4 text-[10px] font-black text-secondary uppercase tracking-widest">Canal</th>
                                <th className="px-6 py-4 text-[10px] font-black text-secondary uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-secondary uppercase tracking-widest text-center">Data/Hora</th>
                                <th className="px-6 py-4 text-[10px] font-black text-secondary uppercase tracking-widest">Mensagem</th>
                                <th className="px-6 py-4 text-[10px] font-black text-secondary uppercase tracking-widest text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-secondary italic">Pesquisando logs...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-secondary italic">Nenhum log encontrado.</td>
                                </tr>
                            ) : (
                                logs.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white">{log.channel?.name}</span>
                                                <span className="text-[10px] text-secondary font-black uppercase tracking-tighter">{log.channel?.type}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={log.status} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-300">{new Date(log.sentAt).toLocaleDateString()}</span>
                                                <span className="text-[10px] text-secondary font-black tracking-widest">{new Date(log.sentAt).toLocaleTimeString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs xl:max-w-md">
                                            <div className="text-xs text-secondary/70 font-medium truncate italic" title={log.message}>
                                                {log.message}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => console.log('Log details:', log)}
                                                className="p-2 text-secondary hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Info className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'sent':
            return (
                <span className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                    <CheckCircle2 className="w-3 h-3" /> Enviado
                </span>
            );
        case 'failed':
            return (
                <span className="flex items-center gap-1.5 text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-500/20">
                    <XCircle className="w-3 h-3" /> Falhou
                </span>
            );
        case 'pending':
            return (
                <span className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                    <Clock className="w-3 h-3" /> Pendente
                </span>
            );
        default:
            return (
                <span className="text-secondary bg-white/5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                    {status}
                </span>
            );
    }
}
