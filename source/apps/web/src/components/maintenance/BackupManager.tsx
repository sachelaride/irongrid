
import { trpc } from '../../utils/trpc';
import { Archive, Database, Activity, RefreshCw, X, Download } from 'lucide-react';

export function BackupManager() {
    const utils = trpc.useContext();
    const { data: backups, isLoading: isLoadingBackups } = (trpc as any).system.listBackups.useQuery();
    
    const { data: backupStatus } = (trpc as any).system.getSyslogBackupStatus.useQuery(undefined, {
        refetchInterval: (data: any) => data?.isBackingUp ? 3000 : false
    });

    const createBackupMutation = (trpc as any).system.createBackup.useMutation();
    const deleteBackupMutation = (trpc as any).system.deleteBackup.useMutation();
    const restoreBackupMutation = (trpc as any).system.restoreBackup.useMutation();

    const exportSystemDataMutation = (trpc as any).system.exportSystemData.useMutation();
    const importSystemDataMutation = (trpc as any).system.importSystemData.useMutation();

    const handleCreateBackup = async () => {
        await (createBackupMutation as any).mutateAsync();
        (utils as any).system.listBackups.invalidate();
    };

    const handleRestoreBackup = async (filename: string) => {
        if (confirm(`Deseja restaurar o backup ${filename}? Isso substituirá os dados atuais.`)) {
            await (restoreBackupMutation as any).mutateAsync({ filename });
            window.location.reload();
        }
    };

    const handleDeleteBackup = async (filename: string) => {
        if (confirm(`Deseja excluir permanentemente o backup ${filename}?`)) {
            await (deleteBackupMutation as any).mutateAsync({ filename });
            (utils as any).system.listBackups.invalidate();
        }
    };

    const handleExportSystem = async () => {
        try {
            const result = await (exportSystemDataMutation as any).mutateAsync();
            const dataStr = JSON.stringify(result, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `irongrid_full_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Erro ao exportar backup do sistema');
        }
    };

    const handleImportSystem = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event: any) => {
                try {
                    const json = JSON.parse(event.target.result);
                    if (confirm('ATENÇÃO: Importar este arquivo substituirá TODOS os dados atuais do sistema (Ativos, Chamados, Configurações). Deseja continuar?')) {
                        await (importSystemDataMutation as any).mutateAsync(json);
                        alert('Dados importados com sucesso! A página será reiniciada.');
                        window.location.reload();
                    }
                } catch (err) {
                    alert('Erro ao processar arquivo de backup: ' + (err as any).message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl h-fit">
                <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Archive className="w-5 h-5 text-secondary/70" />
                        Backups do Sistema
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportSystem}
                            disabled={exportSystemDataMutation.isLoading}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-2 transition-colors border border-slate-600"
                            title="Baixar backup completo (JSON) contendo ativos, chamados e configurações"
                        >
                            {exportSystemDataMutation.isLoading ? <Activity className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            Exportar Ativos/Config
                        </button>
                        <button
                            onClick={handleImportSystem}
                            disabled={importSystemDataMutation.isLoading}
                            className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-2 transition-colors"
                            title="Restaurar dados de um arquivo JSON"
                        >
                            {importSystemDataMutation.isLoading ? <Activity className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Importar Snapshot
                        </button>
                        <button
                            onClick={handleCreateBackup}
                            disabled={createBackupMutation.isLoading}
                            className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-2 transition-colors"
                            title="Criar backup SQL no servidor"
                        >
                            {createBackupMutation.isLoading ? <Activity className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                            Backup Servidor
                        </button>
                        <button
                            onClick={async () => {
                                if (confirm('Deseja iniciar o backup do Syslog agora?')) {
                                    try {
                                        await (trpc as any).system.triggerSyslogBackup.mutateAsync();
                                        alert('Backup do Syslog iniciado em background. Você será notificado quando terminar.');
                                    } catch (e) {
                                        alert('Erro ao iniciar backup do Syslog');
                                    }
                                }
                            }}
                            disabled={backupStatus?.isBackingUp}
                            className={`text-xs text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-2 transition-colors ${backupStatus?.isBackingUp ? 'bg-slate-700 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500'}`}
                        >
                            {backupStatus?.isBackingUp ? <Activity className="w-3 h-3 animate-spin" /> : null}
                            {backupStatus?.isBackingUp ? 'Backup em Andamento' : 'Backup Syslog'}
                        </button>
                    </div>
                </div>

                {backupStatus?.isBackingUp && (
                    <div className="mb-6 p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-lg flex items-center justify-between animate-pulse">
                        <div className="flex items-center gap-3">
                            <Database className="w-5 h-5 text-cyan-400 animate-bounce" />
                            <div>
                                <p className="text-sm font-bold text-cyan-100">Backup do Syslog em execução...</p>
                                <p className="text-xs text-cyan-400/70">O processo está rodando no servidor. Você pode continuar usando o sistema.</p>
                            </div>
                        </div>
                    </div>
                )}

                {backupStatus?.lastStatus === 'success' && !backupStatus.isBackingUp && (
                    <div className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <Archive className="w-5 h-5 text-green-400" />
                            <div>
                                <p className="text-sm font-bold text-green-100">Backup concluído com sucesso!</p>
                                <p className="text-xs text-green-400/70">O novo arquivo já deve aparecer na lista abaixo.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => (utils as any).system.listBackups.invalidate()}
                            className="text-[10px] uppercase font-black tracking-widest text-green-400 hover:text-green-300"
                        >
                            Atualizar Lista
                        </button>
                    </div>
                )}

                {backupStatus?.lastStatus === 'failed' && !backupStatus.isBackingUp && (
                    <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3">
                        <X className="w-5 h-5 text-red-400" />
                        <div>
                            <p className="text-sm font-bold text-red-100">Falha no último backup do Syslog</p>
                            <p className="text-xs text-red-400/70">{backupStatus.lastError}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                    {isLoadingBackups ? (
                        <div className="text-center py-8 text-secondary">Carregando backups...</div>
                    ) : backups?.length === 0 ? (
                        <div className="text-center py-8 text-secondary bg-slate-950/50 rounded-lg border border-slate-800 border-dashed">
                            Nenhum backup encontrado.
                        </div>
                    ) : (
                        backups?.map((backup: any) => (
                            <div key={backup.filename} className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition-colors">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {backup.type === 'syslog' ? (
                                            <span className="px-1.5 py-0.5 bg-cyan-900/30 text-cyan-400 text-[8px] font-black uppercase rounded border border-cyan-500/20">Syslog</span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 bg-purple-900/30 text-purple-400 text-[8px] font-black uppercase rounded border border-purple-500/20">Sistema</span>
                                        )}
                                        <span className="font-mono text-[11px] text-slate-200 truncate max-w-[210px]" title={backup.filename}>{backup.filename}</span>
                                    </div>
                                    <div className="text-[10px] text-secondary flex gap-3">
                                        <span>{(backup.size / 1024 / 1024).toFixed(2)} MB</span>
                                        <span>•</span>
                                        <span>{new Date(backup.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    {backup.type !== 'syslog' && (
                                        <button
                                            onClick={() => handleRestoreBackup(backup.filename)}
                                            disabled={restoreBackupMutation.isLoading}
                                            title="Restaurar este backup"
                                            className="p-1.5 hover:bg-amber-500/10 text-secondary/70 hover:text-amber-400 rounded-lg transition-colors"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteBackup(backup.filename)}
                                        disabled={deleteBackupMutation.isLoading}
                                        title="Excluir backup"
                                        className="p-1.5 hover:bg-red-500/10 text-secondary/70 hover:text-red-400 rounded-lg transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
