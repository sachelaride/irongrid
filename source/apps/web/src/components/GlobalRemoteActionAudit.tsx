import { trpc } from '../utils/trpc';
import { Terminal, CheckCircle2, AlertCircle, Loader2, Calendar, User, Laptop } from 'lucide-react';

export function GlobalRemoteActionAudit() {
    const listLogs = (trpc as any).actions.listLogs.useQuery({ limit: 100 }, { refetchInterval: 5000 });

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                        <Terminal className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white italic">Auditoria de Ações Remotas</h2>
                        <p className="text-secondary/70 text-sm">Registro centralizado de todos os comandos enviados aos agentes</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800/50 text-secondary uppercase text-[10px] font-black tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4">Responsável</th>
                                <th className="px-6 py-4">Dispositivo</th>
                                <th className="px-6 py-4">Ação</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Resultado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {(listLogs.data as any[])?.map(log => (
                                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 text-secondary/70 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(log.startedAt).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-200">
                                            <User className="w-3.5 h-3.5 text-accent" />
                                            {log.userId || 'Sistema'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold italic flex items-center gap-2">
                                                <Laptop className="w-3.5 h-3.5" />
                                                {log.device?.name}
                                            </span>
                                            <span className="text-[10px] text-secondary font-mono">{log.device?.ipAddress}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-slate-800 rounded text-[10px] font-bold text-accent border border-accent/20">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {log.status === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                            {log.status === 'FAILED' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                            {log.status === 'PENDING' && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
                                            <span className={`font-black italic text-xs ${log.status === 'SUCCESS' ? 'text-emerald-500' :
                                                    log.status === 'FAILED' ? 'text-red-500' : 'text-accent'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        {log.output ? (
                                            <div className="bg-black/40 p-2 rounded font-mono text-[10px] truncate" title={log.output}>
                                                {log.output}
                                            </div>
                                        ) : log.error ? (
                                            <p className="text-red-400 text-[10px] italic">{log.error}</p>
                                        ) : (
                                            <span className="text-slate-600 italic text-[10px]">Sem retorno</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {(!listLogs.data || listLogs.data.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-secondary italic">
                                        Nenhuma ação remota auditada até o momento.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
