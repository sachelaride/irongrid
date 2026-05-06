import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Play, Terminal, Settings2, Power, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RemoteActionsComponentProps {
    device: any;
}

export function RemoteActionsComponent({ device }: RemoteActionsComponentProps) {
    const triggerAction = trpc.actions.triggerAction.useMutation();
    const listLogs = trpc.actions.listLogs.useQuery({ deviceId: device.id }, { refetchInterval: 3000 });

    const [script, setScript] = useState('');
    const [serviceName, setServiceName] = useState('');
    const [serviceAction, setServiceAction] = useState<'start' | 'stop' | 'restart' | 'status'>('status');

    const handleRunScript = () => {
        if (!script) return;
        triggerAction.mutate({
            deviceId: device.id,
            action: 'executeScript',
            parameters: { script }
        });
        setScript('');
    };

    const handleServiceAction = () => {
        if (!serviceName) return;
        triggerAction.mutate({
            deviceId: device.id,
            action: 'manageService',
            parameters: { serviceName, action: serviceAction }
        });
    };

    const handleSystemControl = (action: 'reboot' | 'shutdown') => {
        if (!confirm(`Tem certeza que deseja ${action === 'reboot' ? 'reiniciar' : 'desligar'} o dispositivo?`)) return;
        triggerAction.mutate({
            deviceId: device.id,
            action: 'systemControl',
            parameters: { action }
        });
    };

    return (
        <div className="space-y-6 text-slate-100">
            {!device.agentId && (
                <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-lg text-amber-200 text-sm flex gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    Este dispositivo não possui o Agente IronGrid instalado. Ações remotas não estão disponíveis.
                </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!device.agentId ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Script Execution */}
                <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-accent" />
                        Executar Script / Comando
                    </h4>
                    <textarea
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono h-24 focus:ring-1 focus:ring-accent outline-none"
                        placeholder="Ex: dir, ls -la, uptime..."
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                    />
                    <button
                        onClick={handleRunScript}
                        disabled={triggerAction.isLoading}
                        className="w-full bg-accent hover:bg-accent py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {triggerAction.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Executar no Agente
                    </button>
                </div>

                {/* Service/System Management */}
                <div className="space-y-6">
                    <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                            <Settings2 className="w-4 h-4 text-emerald-400" />
                            Gestão de Serviços
                        </h4>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none"
                                placeholder="Nome do Serviço"
                                value={serviceName}
                                onChange={(e) => setServiceName(e.target.value)}
                            />
                            <select
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs outline-none"
                                value={serviceAction}
                                onChange={(e) => setServiceAction(e.target.value as any)}
                            >
                                <option value="status">Status</option>
                                <option value="start">Iniciar</option>
                                <option value="stop">Parar</option>
                                <option value="restart">Reiniciar</option>
                            </select>
                        </div>
                        <button
                            onClick={handleServiceAction}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Aplicar Ação
                        </button>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex justify-around">
                        <button
                            onClick={() => handleSystemControl('reboot')}
                            className="flex flex-col items-center gap-1 text-secondary/70 hover:text-orange-400 transition-colors"
                        >
                            <Power className="w-6 h-6" />
                            <span className="text-[10px]">Reiniciar</span>
                        </button>
                        <button
                            onClick={() => handleSystemControl('shutdown')}
                            className="flex flex-col items-center gap-1 text-secondary/70 hover:text-red-400 transition-colors"
                        >
                            <Power className="w-6 h-6" />
                            <span className="text-[10px]">Desligar</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-secondary/70 hover:text-accent transition-colors">
                            <Download className="w-6 h-6" />
                            <span className="text-[10px]">Deploy SW</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent Logs */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="p-3 border-b border-slate-800 bg-slate-800/30 font-semibold flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Histórico de Ações Recentes
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/50 text-secondary uppercase">
                            <tr>
                                <th className="px-4 py-2">Data</th>
                                <th className="px-4 py-2">Ação</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2">Resultado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {(listLogs.data as any[])?.map(log => (
                                <tr key={log.id} className="hover:bg-slate-800/30">
                                    <td className="px-4 py-3 text-secondary/70">
                                        {new Date(log.startedAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 font-medium">
                                        {log.action}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            {log.status === 'SUCCESS' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                            {log.status === 'FAILED' && <AlertCircle className="w-3 h-3 text-red-500" />}
                                            {log.status === 'PENDING' && <Loader2 className="w-3 h-3 text-accent animate-spin" />}
                                            <span className={
                                                log.status === 'SUCCESS' ? 'text-green-500' :
                                                    log.status === 'FAILED' ? 'text-red-500' : 'text-accent'
                                            }>
                                                {log.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.output && (
                                            <div className="bg-black/40 p-1 rounded font-mono text-[10px] max-w-[200px] truncate" title={log.output}>
                                                {log.output}
                                            </div>
                                        )}
                                        {log.error && <span className="text-red-400 text-[10px]">{log.error}</span>}
                                    </td>
                                </tr>
                            ))}
                            {(!listLogs.data || listLogs.data.length === 0) && (
                                <tr><td colSpan={4} className="p-8 text-center text-secondary">Nenhuma ação registrada</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
