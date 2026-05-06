import { useState, useEffect } from 'react';
import { trpc } from '../../utils/trpc';
import { Terminal, Trash2, ShieldCheck, Settings, Save, Database, FolderOpen } from 'lucide-react';

export function SyslogManager() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300 font-sans">
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-main mb-4 flex items-center gap-2 border-b border-border pb-4 uppercase tracking-wider">
                    <Terminal className="w-4 h-4" />
                    Gestão de Fontes Syslog
                </h3>

                <div className="space-y-4">
                    <p className="text-sm font-medium text-main/80 leading-relaxed">
                        Selecione os dispositivos que devem ter seus logs gravados no banco de dados.
                        Se nenhum for selecionado, o servidor gravará logs de <strong className="text-main italic">qualquer origem</strong>.
                    </p>

                    <SyslogSourceList />

                    <div className="mt-4 pt-4 border-t border-border">
                        <ActiveMonitoringList />
                    </div>
                </div>
            </div>

            <SyslogSettings />
        </div>
    );
}

function ActiveMonitoringList() {
    const utils = (trpc as any).useContext();
    const { data: monitored = [], isLoading } = (trpc as any).syslog.getMonitoredDevices.useQuery();

    const removeMutation = (trpc as any).syslog.removeMonitoredDevice.useMutation({
        onSuccess: () => {
            utils.syslog.getMonitoredDevices.invalidate();
            utils.syslog.getStatus.invalidate();
        }
    });

    if (isLoading) return <div className="text-[10px] text-secondary italic animate-pulse">Carregando lista ativa...</div>;

    return (
        <div>
            <h4 className="text-xs font-bold text-main mb-3 flex items-center gap-2 uppercase tracking-widest opacity-70">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                Dispositivos com Gravação Ativa
            </h4>

            {monitored.length === 0 ? (
                <div className="bg-page/50 border border-dashed border-border rounded-xl p-6 text-center shadow-inner">
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest opacity-60">
                        Todos os logs recebidos estão sendo gravados (Modo Aberto).
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {monitored.map((device: any) => (
                        <div key={device.id} className="flex items-center justify-between gap-4 p-3 bg-card border border-border rounded-xl group hover:border-primary/40 hover:shadow-md transition-all">
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-black text-main uppercase tracking-tight truncate">{device.name}</div>
                                <div className="text-[9px] text-secondary font-mono font-bold tracking-tight truncate">{device.ipAddress}</div>
                            </div>
                            <button
                                onClick={() => removeMutation.mutate({ deviceId: device.id })}
                                disabled={removeMutation.isLoading}
                                className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20 opacity-0 group-hover:opacity-100 shadow-sm whitespace-nowrap"
                                title="Parar gravação"
                            >
                                <Trash2 size={12} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Remover</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-[9px] text-secondary mt-4 italic font-medium opacity-60">
                Logs desativados aqui continuarão visíveis em tempo real, mas não serão salvos no histórico permanente.
            </p>
        </div>
    );
}

function SyslogSourceList() {
    const utils = (trpc as any).useContext();
    const { data: devices = [], isLoading: loadingDevices } = (trpc as any).scan.getDevices.useQuery({});
    const { data: status, isLoading: loadingStatus } = (trpc as any).syslog.getStatus.useQuery();

    const setMonitoredMutation = (trpc as any).syslog.setMonitoredDevices.useMutation({
        onSuccess: () => {
            utils.syslog.getStatus.invalidate();
            alert('Lista de gravação atualizada com sucesso!');
        }
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (status?.monitoredDevices) {
            const monitoredSet = new Set(status.monitoredDevices);
            const ids = devices
                .filter((d: any) => monitoredSet.has(d.ip) || monitoredSet.has(d.hostname))
                .map((d: any) => d.id);
            setSelectedIds(ids);
        }
    }, [status, devices]);

    const handleToggle = (deviceId: string) => {
        setSelectedIds(prev => {
            if (prev.includes(deviceId)) {
                return prev.filter(id => id !== deviceId);
            } else {
                return [...prev, deviceId];
            }
        });
    };

    const handleSave = () => {
        setMonitoredMutation.mutate({ deviceIds: selectedIds });
    };

    const filteredDevices = devices.filter((d: any) =>
        (d.name && d.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.ip && d.ip.includes(searchTerm))
    );

    if (loadingDevices || loadingStatus) return <div className="text-xs text-secondary italic py-4">Carregando dispositivos...</div>;

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1 group">
                    <input
                        type="text"
                        placeholder="Filtrar por nome ou IP..."
                        className="w-full bg-page border border-border rounded-xl px-4 py-2.5 text-xs text-main outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold placeholder:text-secondary/50"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={handleSave}
                    disabled={setMonitoredMutation.isLoading}
                    className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95"
                >
                    {setMonitoredMutation.isLoading ? 'Salvando...' : 'Salvar Filtro'}
                </button>
            </div>

            <div className="border border-border rounded-2xl max-h-[250px] overflow-y-auto bg-page/30 shadow-inner scrollbar-thin">
                {filteredDevices.map((device: any) => (
                    <div
                        key={device.id}
                        onClick={() => handleToggle(device.id)}
                        className={`flex items-center gap-4 p-3 border-b border-border/50 cursor-pointer hover:bg-primary/5 transition-all ${selectedIds.includes(device.id) ? 'bg-primary/10' : ''}`}
                    >
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.includes(device.id) ? 'bg-primary border-primary scale-110' : 'border-border bg-card'}`}>
                            {selectedIds.includes(device.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-black text-main uppercase tracking-tight">{device.name}</div>
                            <div className="text-[9px] text-secondary font-mono font-bold">{device.ip}</div>
                        </div>
                        {selectedIds.includes(device.id) && (
                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                                Gravação Ativa
                            </span>
                        )}
                    </div>
                ))}
            </div>
            <div className="text-[10px] text-secondary text-right font-black uppercase tracking-widest opacity-60">
                {selectedIds.length} selecionados
            </div>
        </div>
    );
}

function SyslogSettings() {
    const utils = (trpc as any).useContext();
    const { data: config, isLoading: loadingConfig } = (trpc as any).system.getSystemCustomization.useQuery();
    const { data: dbInfo } = (trpc as any).syslog.getDbInfo.useQuery(undefined, {
        refetchInterval: 30000 
    });

    const updateMutation = (trpc as any).system.updateSystemCustomization.useMutation({
        onSuccess: () => {
            utils.system.getSystemCustomization.invalidate();
            utils.syslog.getStatus.invalidate();
            alert('Configurações de Syslog atualizadas!');
        }
    });

    const [formData, setFormData] = useState({
        syslogRecordingEnabled: true,
        companyName: '',
        workingHours: '',
        ticketAutoCloseDays: 15,
        ticketDefaultRating: 4,
        dashSlaGoal: 98,
        dashStorageCritical: 90,
        dashStorageWarning: 80
    });

    useEffect(() => {
        if (config) {
            setFormData({
                ...config,
            });
        }
    }, [config]);

    const handleSave = () => {
        updateMutation.mutate(formData);
    };

    if (loadingConfig) return null;

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-xl space-y-6">
            <h3 className="text-sm font-bold text-amber-500 mb-4 flex items-center gap-2 border-b border-border pb-4 uppercase tracking-wider">
                <Settings className="w-4 h-4" />
                Configurações Globais e Rotação
            </h3>

            <div className="grid grid-cols-1 gap-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 bg-page/50 border border-border rounded-2xl shadow-inner">
                        <div>
                            <p className="text-[11px] font-black text-main uppercase tracking-widest">Gravação de Syslog no Banco</p>
                            <p className="text-[10px] text-secondary font-medium tracking-tight mt-1 opacity-70">Ativa/Desativa o armazenamento permanente dos eventos no PostgreSQL.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, syslogRecordingEnabled: !formData.syslogRecordingEnabled })}
                            className={`w-14 h-7 rounded-full transition-all relative p-1 ${formData.syslogRecordingEnabled ? 'bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]' : 'bg-secondary/20'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${formData.syslogRecordingEnabled ? 'right-1' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 bg-card border border-border rounded-2xl flex items-center gap-4 hover:border-primary/30 transition-all hover:shadow-lg">
                            <div className="p-3 bg-primary/10 rounded-xl">
                                <Database className="w-6 h-6 text-main" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-secondary uppercase tracking-[0.2em]">Tamanho Total</p>
                                <p className="text-lg font-mono font-black text-main tracking-tighter">{dbInfo?.size || '...'}</p>
                            </div>
                        </div>

                        <div className="p-5 bg-card border border-border rounded-2xl flex items-center gap-4 hover:border-secondary/30 transition-all hover:shadow-lg overflow-hidden">
                            <div className="p-3 bg-secondary/10 rounded-xl">
                                <FolderOpen className="w-6 h-6 text-secondary" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black text-secondary uppercase tracking-[0.2em]">Data Storage</p>
                                <p className="text-[10px] font-mono font-bold text-secondary/70 truncate" title={dbInfo?.dataDirectory}>
                                    {dbInfo?.dataDirectory || 'Local Storage'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
                <button
                    onClick={handleSave}
                    disabled={updateMutation.isLoading}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.1em] transition-all shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50"
                >
                    <Save size={14} />
                    {updateMutation.isLoading ? 'Processando...' : 'Salvar Alterações'}
                </button>
            </div>
        </div>
    );
}
