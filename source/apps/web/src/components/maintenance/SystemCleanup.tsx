
import { useState } from 'react';
import { trpc } from '../../utils/trpc';
import { Trash2, AlertTriangle, Activity, Settings2 } from 'lucide-react';

interface SystemCleanupProps {
    status: any; // Not used directly but kept for consistency
}

export function SystemCleanup({ status: _status }: SystemCleanupProps) {
    const utils = trpc.useContext();
    const cleanupMutation = (trpc as any).system.triggerCleanup.useMutation();
    const clearInfluxMutation = (trpc as any).system.clearAllInfluxData.useMutation();
    const resetParamsMutation = (trpc as any).settings.resetAllParameters.useMutation();
    const syslogCleanupMutation = (trpc as any).system.cleanupSyslogDb.useMutation();
    const clearAllSyslogMutation = (trpc as any).system.clearAllSyslog.useMutation();
    const reclaimSyslogSpaceMutation = (trpc as any).system.reclaimSyslogSpace.useMutation();

    const cleanupStatus = (trpc as any).system.getSyslogCleanupStatus.useQuery(undefined, {
        refetchInterval: (data: any) => data?.isCleaning ? 2000 : false,
        enabled: true
    });

    const [syslogDays, setSyslogDays] = useState(30);

    // Alvos para a limpeza manual seletiva
    const [targets, setTargets] = useState({
        audit: true,
        notification: true,
        remote: true,
        metrics: false
    });

    const handleCleanup = async () => {
        const selectedTargets = (Object.keys(targets) as (keyof typeof targets)[])
            .filter(key => targets[key]);

        if (selectedTargets.length === 0) {
            alert('Selecione pelo menos um módulo para limpeza.');
            return;
        }

        if (confirm('Deseja realmente executar a limpeza nos módulos selecionados?')) {
            const result = await (cleanupMutation as any).mutateAsync({ targets: selectedTargets });
            (utils as any).system.getMaintenanceStatus.invalidate();
            const deleted = result?.result?.logsDeleted ?? 0;
            if (deleted === 0) {
                alert(`Limpeza executada. Nenhum registro foi deletado — todos os dados estão dentro do período de retenção (90 dias padrão).`);
            } else {
                alert(`Limpeza executada com sucesso. ${deleted} registros removidos.`);
            }
        }
    };

    const handleSyslogCleanup = async () => {
        if (!confirm(`⚠️ Isso irá deletar TODOS os logs do Syslog com mais de ${syslogDays} dias. Esta ação é irreversível. Confirmar?`)) return;
        try {
            const result = await syslogCleanupMutation.mutateAsync({ daysOld: syslogDays });
            (utils as any).system.getSyslogCleanupStatus.invalidate();
            alert(result.message || 'Limpeza iniciada em background.');
        } catch (e: any) {
            alert('Erro ao limpar Syslog: ' + (e.message || e));
        }
    };

    const handleClearAllSyslog = async () => {
        if (!confirm('🚨 ATENÇÃO: Isso irá apagar ABSOLUTAMENTE TODOS os logs do Syslog imediatamente para liberar os 357GB. Deseja continuar?')) return;

        const confirmText = prompt('Para confirmar a exclusão TOTAL, digite "LIMPAR TUDO":');
        if (confirmText !== 'LIMPAR TUDO') return;

        try {
            await clearAllSyslogMutation.mutateAsync();
            alert('Banco de Syslog resetado com sucesso! O espaço foi liberado.');
            (utils as any).system.getMaintenanceStatus.invalidate();
        } catch (e: any) {
            alert('Erro ao resetar Syslog: ' + (e.message || e));
        }
    };

    const handleReclaimSyslogSpace = async () => {
        if (!confirm('Deseja compactar o banco de Syslog? Isso NÃO apaga dados, mas pode demorar alguns minutos e bofquear novas gravações. Continuar?')) return;

        try {
            await reclaimSyslogSpaceMutation.mutateAsync();
            alert('Compactação concluída com sucesso!');
            (utils as any).system.getMaintenanceStatus.invalidate();
        } catch (e: any) {
            alert('Erro ao compactar Syslog: ' + (e.message || e));
        }
    };


    const handleClearInflux = async () => {
        if (!confirm('⚠️ ATENÇÃO: Esta ação irá deletar TODOS os dados de métricas do InfluxDB permanentemente. Isso NÃO pode ser desfeito. Tem certeza?')) return;

        const confirmText = prompt('Para confirmar, digite "DELETAR TUDO" na caixa abaixo:');
        if (confirmText !== 'DELETAR TUDO') return;

        try {
            await clearInfluxMutation.mutateAsync();
            alert('Todos os dados do InfluxDB foram deletados com sucesso!');
            (utils as any).system.getMaintenanceStatus.invalidate();
        } catch (e: any) {
            alert('Erro ao limpar InfluxDB: ' + (e.message || e));
        }
    };

    const handleResetParams = async () => {
        if (!confirm('⚠️ ATENÇÃO: Deseja resetar todas as configurações do sistema para o padrão de fábrica? Isso não afetará usuários ou dispositivos, apenas parâmetros globais.')) return;

        try {
            await resetParamsMutation.mutateAsync();
            alert('Parâmetros resetados com sucesso.');
            (utils as any).settings.getParameters.invalidate();
        } catch (e: any) {
            alert('Erro ao resetar parâmetros: ' + (e.message || e));
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                <h4 className="text-sm font-bold text-red-400 mb-4 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Limpeza Manual Seletiva
                </h4>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <Checkbox label="Logs de Auditoria" checked={targets.audit} onChange={(c) => setTargets(t => ({ ...t, audit: c }))} />
                    <Checkbox label="Logs de Notificação" checked={targets.notification} onChange={(c) => setTargets(t => ({ ...t, notification: c }))} />
                    <Checkbox label="Logs Acesso Remoto" checked={targets.remote} onChange={(c) => setTargets(t => ({ ...t, remote: c }))} />
                    <Checkbox label="Métricas (InfluxDB)" checked={targets.metrics} onChange={(c) => setTargets(t => ({ ...t, metrics: c }))} warning />
                </div>

                <button
                    onClick={handleCleanup}
                    disabled={cleanupMutation.isLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all font-medium"
                >
                    {cleanupMutation.isLoading ? <Activity className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Executar Limpeza nos Selecionados
                </button>

                {/* Zona de Perigo */}
                <div className="mt-8 pt-6 border-t border-red-900/30">
                    <h4 className="text-sm font-bold text-red-500 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Zona de Perigo
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-red-950/20 p-4 rounded-lg border border-red-900/30">
                            <h5 className="text-xs font-bold text-red-300 mb-1">Resetar Configurações</h5>
                            <p className="text-xs text-red-400/70 mb-3">
                                Restaura parâmetros do sistema. Mantém usuários e dados.
                            </p>
                            <button
                                onClick={handleResetParams}
                                disabled={resetParamsMutation.isLoading}
                                className="w-full py-1.5 rounded bg-red-900/30 hover:bg-red-900/50 text-red-300 text-xs font-bold border border-red-800/50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Settings2 className="w-3 h-3" />
                                Resetar Parâmetros
                            </button>
                        </div>

                        <div className="bg-red-950/20 p-4 rounded-lg border border-red-900/30">
                            <h5 className="text-xs font-bold text-red-300 mb-1">Limpar Syslog (356 GB)</h5>
                            <p className="text-xs text-red-400/70 mb-2">
                                Remove logs do banco Syslog mais antigos que N dias. Irreversível.
                            </p>

                            {cleanupStatus.data?.isCleaning ? (
                                <div className="mb-3 p-2 bg-accent/10 border border-accent/20 rounded-lg animate-pulse">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-accent uppercase">Limpando em background...</span>
                                        <Activity className="w-3 h-3 text-accent animate-spin" />
                                    </div>
                                    <div className="text-[10px] text-blue-300/70">
                                        Total removido: <span className="text-white font-mono">{cleanupStatus.data.totalDeleted.toLocaleString()}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mb-3">
                                    <label className="text-xs text-secondary/70 shrink-0">Manter últimos:</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={syslogDays}
                                        onChange={e => setSyslogDays(Number(e.target.value))}
                                        className="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-white text-xs"
                                    />
                                    <span className="text-xs text-secondary/70">dias</span>
                                </div>
                            )}

                            <button
                                onClick={handleSyslogCleanup}
                                disabled={syslogCleanupMutation.isLoading || cleanupStatus.data?.isCleaning}
                                className={`w-full py-1.5 rounded text-red-300 text-xs font-bold border mb-2 transition-colors flex items-center justify-center gap-2 ${cleanupStatus.data?.isCleaning
                                    ? 'bg-slate-800 border-slate-700 cursor-not-allowed opacity-50'
                                    : 'bg-red-600/10 hover:bg-red-600/20 border-red-600/40'
                                    }`}
                            >
                                {syslogCleanupMutation.isLoading ? <Activity className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                {cleanupStatus.data?.isCleaning ? 'Limpeza em Andamento' : 'Limpar por Período'}
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleReclaimSyslogSpace}
                                    disabled={reclaimSyslogSpaceMutation.isLoading}
                                    className="py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[10px] font-bold border border-emerald-600/40 transition-colors flex items-center justify-center gap-1"
                                >
                                    <Activity className={`w-3 h-3 ${reclaimSyslogSpaceMutation.isLoading ? 'animate-spin' : ''}`} />
                                    Compactar
                                </button>
                                <button
                                    onClick={handleClearAllSyslog}
                                    disabled={clearAllSyslogMutation.isLoading}
                                    className="py-1.5 rounded bg-red-600/30 hover:bg-red-600/50 text-white text-[10px] font-bold border border-red-600/50 transition-colors flex items-center justify-center gap-1"
                                >
                                    <Trash2 className={`w-3 h-3 ${clearAllSyslogMutation.isLoading ? 'animate-pulse' : ''}`} />
                                    ZERAR TUDO
                                </button>
                            </div>
                        </div>

                        <div className="bg-red-950/20 p-4 rounded-lg border border-red-900/30">
                            <h5 className="text-xs font-bold text-red-300 mb-1">Limpar Dados InfluxDB</h5>
                            <p className="text-xs text-red-400/70 mb-3">
                                Remove TODO o histórico de métricas. Irreversível.
                            </p>
                            <button
                                onClick={handleClearInflux}
                                disabled={clearInfluxMutation.isLoading}
                                className="w-full py-1.5 rounded bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-bold border border-red-600/40 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-3 h-3" />
                                Deletar Métricas
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Checkbox({ label, checked, onChange, warning }: { label: string, checked: boolean, onChange: (v: boolean) => void, warning?: boolean }) {
    return (
        <div
            onClick={() => onChange(!checked)}
            className={`
                flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none transition-all
                ${checked
                    ? (warning ? 'bg-red-900/20 border-red-500/30' : 'bg-blue-900/20 border-accent/30')
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'}
            `}
        >
            <div className={`
                w-4 h-4 rounded border flex items-center justify-center transition-colors
                ${checked
                    ? (warning ? 'bg-red-500 border-red-500' : 'bg-accent border-accent')
                    : 'border-slate-600'}
            `}>
                {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
            </div>
            <span className={`text-sm font-medium ${checked ? 'text-white' : 'text-secondary/70'}`}>{label}</span>
        </div>
    )
}
