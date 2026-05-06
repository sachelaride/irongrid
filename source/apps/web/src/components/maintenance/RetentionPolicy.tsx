
import { useState, useEffect } from 'react';
import { trpc } from '../../utils/trpc';
import { Database, Activity, Terminal, Save } from 'lucide-react';

interface RetentionPolicyProps {
    status: any;
}

export function RetentionPolicy({ status }: RetentionPolicyProps) {
    const utils = trpc.useContext();
    const saveMutation = (trpc as any).system.updateRetentionSettings.useMutation();

    const [logsDays, setLogsDays] = useState(90);
    const [metricsDays, setMetricsDays] = useState(30);
    const [syslogDays, setSyslogDays] = useState(3);

    useEffect(() => {
        if (status?.settings) {
            setLogsDays(status.settings.retentionLogsDays);
            setMetricsDays(status.settings.retentionMetricsDays);
            setSyslogDays(status.settings.syslogRetentionDays || 3);
        }
    }, [status]);

    const handleSave = async () => {
        try {
            await (saveMutation as any).mutateAsync({
                logsDays: logsDays,
                metricsDays: metricsDays,
                syslogDays: syslogDays
            });
            (utils as any).system.getMaintenanceStatus.invalidate();
            alert('Configurações de retenção salvas com sucesso!');
        } catch (e) {
            alert('Erro ao salvar configurações');
        }
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                    <Database className="w-5 h-5 text-secondary/70" />
                    Políticas de Retenção de Dados
                </h3>

                <div className="space-y-6 mb-8">
                    {/* Configuração PostgreSQL */}
                    <div>
                        <label className="text-sm font-bold text-accent flex items-center gap-2 mb-2">
                            <Database className="w-4 h-4" />
                            Banco de Dados Relacional (PostgreSQL)
                        </label>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                            <label className="text-sm font-medium text-slate-300 block mb-1">Logs do Sistema (Dias)</label>
                            <p className="text-xs text-secondary mb-3">Auditoria, Notificações, Histórico de Acesso Remoto</p>
                            <input
                                type="number"
                                value={logsDays}
                                onChange={(e) => setLogsDays(parseInt(e.target.value))}
                                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 w-full focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Configuração InfluxDB */}
                    <div>
                        <label className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-2">
                            <Activity className="w-4 h-4" />
                            Banco de Dados Temporal (InfluxDB)
                        </label>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                            <label className="text-sm font-medium text-slate-300 block mb-1">Métricas de Monitoramento (Dias)</label>
                            <p className="text-xs text-secondary mb-3">Histórico de CPU, RAM, Tráfego</p>
                            <input
                                type="number"
                                value={metricsDays}
                                onChange={(e) => setMetricsDays(parseInt(e.target.value))}
                                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 w-full focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Configuração Syslog */}
                    <div>
                        <label className="text-sm font-bold text-cyan-400 flex items-center gap-2 mb-2">
                            <Terminal className="w-4 h-4" />
                            Logs Remotos (Syslog)
                        </label>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                            <label className="text-sm font-medium text-slate-300 block mb-1">Rotação de Logs (Dias)</label>
                            <p className="text-xs text-secondary mb-3">Tempo de permanência dos logs no banco de dados antes da limpeza automática</p>
                            <input
                                type="number"
                                value={syslogDays}
                                onChange={(e) => setSyslogDays(parseInt(e.target.value))}
                                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 w-full focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saveMutation.isLoading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-all font-bold border border-slate-700"
                    >
                        {saveMutation.isLoading ? <Activity className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Configurações
                    </button>
                </div>
            </div>
        </div>
    );
}
