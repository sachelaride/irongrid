import { useState, useEffect } from 'react';
import { trpc } from '../utils/trpc';
import { Activity, Zap, CheckCircle, Save, Clock, Mail, Bell, Shield, Server, ArrowRightLeft, Search } from 'lucide-react';
import { LoadingState, StatusBadge } from './ui/DesignSystem';

/**
 * Alertas Email - Configuração de Níveis de Monitoramento
 * Sistema de 3 níveis com thresholds customizáveis e alocação de dispositivos.
 */
export function AlertSettings() {
    const utils = trpc.useContext();
    const { data: configs, isLoading: isConfigsLoading } = trpc.monitoring.getMonitoringConfigs.useQuery();
    const { data: devices = [], isLoading: isDevicesLoading } = trpc.monitoring.getDevicesWithLevels.useQuery();

    const updateConfig = trpc.monitoring.updateMonitoringConfig.useMutation({
        onSuccess: () => {
            utils.monitoring.getMonitoringConfigs.invalidate();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }
    });

    const setLevelMutation = trpc.monitoring.setDeviceMonitoringLevel.useMutation({
        onSuccess: () => {
            utils.monitoring.getDevicesWithLevels.invalidate();
        }
    });

    // Estados locais
    const [localConfigs, setLocalConfigs] = useState<any[]>([]);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 0 | 1 | 2 | 3>(0);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (configs) {
            setLocalConfigs(configs);
        }
    }, [configs]);

    const handleUpdateLocal = (level: number, field: string, value: any) => {
        setLocalConfigs(prev => prev.map(c =>
            c.level === level ? { ...c, [field]: value } : c
        ));
    };

    const handleSave = (level: number) => {
        const config = localConfigs.find(c => c.level === level);
        if (config) {
            updateConfig.mutate({
                level: config.level,
                downtimeThreshold: Number(config.downtimeThreshold),
                uptimeThreshold: Number(config.uptimeThreshold),
                latencyThreshold: Number(config.latencyThreshold),
                email: config.email,
                enabled: config.enabled
            });
        }
    };

    if (isConfigsLoading) return <LoadingState message="Carregando configurações de alerta..." />;

    // Filtrar dispositivos pela aba atual e busca
    const filteredDevices = activeTab === 'config'
        ? []
        : devices.filter((d: any) => {
            const matchesLevel = (d.monitoringLevel || 0) === activeTab;
            const matchesSearch = d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.ipAddress?.includes(searchQuery);
            return matchesLevel && matchesSearch;
        });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
            {/* Header com feedback visual */}
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-card p-8 rounded-[2.5rem] border border-border shadow-xl backdrop-blur-sm">
                <div>
                    <h3 className="text-3xl font-black text-main italic tracking-tighter uppercase leading-none">Alertas email</h3>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-3 flex items-center gap-2">
                        <Shield className="w-3 h-3 text-accent" />
                        Gerencie as regras de alerta e os dispositivos atribuídos a cada nível
                    </p>
                </div>
                {saved && (
                    <div className="flex items-center gap-2 text-emerald-500 font-black uppercase tracking-widest text-[10px] bg-emerald-500/10 px-6 py-3 rounded-full border border-emerald-500/20 animate-bounce shadow-lg shadow-emerald-500/10 transition-all">
                        <CheckCircle size={16} /> Configurações Atualizadas
                    </div>
                )}
            </div>

            {/* Abas de Navegação */}
            <div className="flex flex-wrap bg-card/40 p-1.5 rounded-2xl border border-border shadow-xl backdrop-blur-md gap-2">
                {[1, 2, 3, 0].map((level) => (
                    <button
                        key={level}
                        onClick={() => { setActiveTab(level as any); setSearchQuery(''); }}
                        className={`flex-1 min-w-[150px] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                            ${activeTab === level
                                ? 'bg-card/80 text-accent shadow-lg border border-border'
                                : 'text-secondary font-bold hover:text-main hover:bg-card/40'}`}
                    >
                        {level === 0 ? 'Sem Alerta (L0)' : `Nível ${level} (L${level})`}
                    </button>
                ))}
                <button
                    onClick={() => { setActiveTab('config'); setSearchQuery(''); }}
                    className={`flex-1 min-w-[150px] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                        ${activeTab === 'config'
                            ? 'bg-card/80 text-accent shadow-lg border border-border'
                            : 'text-secondary font-bold hover:text-main hover:bg-card/40'}`}
                >
                    Regras Globais
                </button>
            </div>

            {/* Conteúdo: Configurações Globais */}
            {activeTab === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                    {localConfigs.map((config) => (
                        <div key={config.level}
                            className={`relative group transition-all duration-500 ${!config.enabled ? 'opacity-50 grayscale' : ''}`}
                        >
                            {/* Glow effect based on level */}
                            <div className={`absolute inset-0 blur-3xl opacity-0 group-hover:opacity-10 transition-opacity rounded-[2.5rem] 
                                ${config.level === 1 ? 'bg-accent' : config.level === 2 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            />

                            <div className="relative bg-card border border-border rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col h-full border-t-4 transition-transform hover:scale-[1.02]"
                                style={{ borderTopColor: config.level === 1 ? '#10b981' : config.level === 2 ? '#f59e0b' : '#f43f5e' }}
                            >
                                <div className="p-8 space-y-6 flex-1">
                                    <div className="flex justify-between items-start">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner 
                                            ${config.level === 1 ? 'bg-emerald-500/10 text-emerald-500' : config.level === 2 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}
                                        >
                                            <Bell className="w-7 h-7" />
                                        </div>
                                        <div className="text-right">
                                            <h4 className="text-xl font-black text-main italic uppercase tracking-tighter">Nível {config.level}</h4>
                                            <StatusBadge
                                                label={config.level === 1 ? 'Padrão' : config.level === 2 ? 'Crítico' : 'Urgente'}
                                                variant={config.level === 1 ? 'primary' : config.level === 2 ? 'warning' : 'danger'}
                                            />
                                        </div>
                                    </div>

                                    {/* Tempo Offline */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                                            <Clock className="w-3 h-3" /> Tolerância Offline (minutos)
                                        </label>
                                        <input
                                            type="number"
                                            value={config.downtimeThreshold}
                                            onChange={(e) => handleUpdateLocal(config.level, 'downtimeThreshold', e.target.value)}
                                            className="w-full bg-card/40 border border-border rounded-2xl p-4 text-lg font-black text-main focus:ring-2 focus:ring-accent/20 outline-none transition-all shadow-inner"
                                        />
                                    </div>

                                    {/* Latência */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                                            <Zap className="w-3 h-3" /> Latência Máxima (ms)
                                        </label>
                                        <input
                                            type="number"
                                            value={config.latencyThreshold}
                                            onChange={(e) => handleUpdateLocal(config.level, 'latencyThreshold', e.target.value)}
                                            className="w-full bg-card/40 border border-border rounded-2xl p-4 text-lg font-black text-main focus:ring-2 focus:ring-accent/20 outline-none transition-all shadow-inner"
                                        />
                                    </div>

                                    {/* Tempo Online */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> Recuperação Online (minutos)
                                        </label>
                                        <input
                                            type="number"
                                            value={config.uptimeThreshold}
                                            onChange={(e) => handleUpdateLocal(config.level, 'uptimeThreshold', e.target.value)}
                                            className="w-full bg-card/40 border border-border rounded-2xl p-4 text-lg font-black text-main focus:ring-2 focus:ring-accent/20 outline-none transition-all shadow-inner"
                                        />
                                    </div>

                                    {/* Email Destinatário */}
                                    <div className="space-y-3 text-emerald-500">
                                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                                            <Mail className="w-3 h-3" /> Destinatários Email (separar por vírgula)
                                        </label>
                                        <textarea
                                            value={config.email || ''}
                                            onChange={(e) => handleUpdateLocal(config.level, 'email', e.target.value)}
                                            placeholder="ex@irongrid.com, admin@irongrid.com"
                                            rows={2}
                                            className="w-full bg-card/40 border border-border rounded-2xl p-4 text-xs font-bold text-main focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner min-h-[80px]"
                                        />
                                    </div>
                                </div>

                                <div className="p-6 bg-card/30 border-t border-border/50 flex gap-3">
                                    <button
                                        onClick={() => handleUpdateLocal(config.level, 'enabled', !config.enabled)}
                                        className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all 
                                            ${config.enabled
                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                                : 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20'}`}
                                    >
                                        {config.enabled ? 'Ativado' : 'Desativado'}
                                    </button>
                                    <button
                                        onClick={() => handleSave(config.level)}
                                        disabled={updateConfig.isLoading}
                                        className="flex-[2] py-3 px-4 bg-accent hover:opacity-80 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-3 h-3" /> Salvar Nível {config.level}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* Footer Informativo */}
                    <div className="col-span-1 lg:col-span-3 bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 p-8 rounded-[2.5rem] flex items-center gap-6">
                        <div className="w-16 h-16 bg-accent text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-accent/40 shrink-0">
                            <Shield className="w-8 h-8" />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-main italic tracking-tighter uppercase leading-none">Regra de Exclusividade</h4>
                            <p className="text-xs text-secondary mt-2 font-medium">
                                Ao associar um dispositivo a um nível (ex: Nível 2), ele é automaticamente removido de níveis anteriores.
                                Dispositivos sem nível (Nível 0) geram alertas instantâneos no sistema sem envio direto de email por esta regra.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Conteúdo: Lista de Dispositivos por Nível */}
            {activeTab !== 'config' && (
                <div className="bg-card border border-border rounded-[2.5rem] shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-8 border-b border-border flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <h4 className="text-xl font-black text-main italic uppercase tracking-tighter">
                                Dispositivos Atribuídos - {activeTab === 0 ? 'Sem Alerta (L0)' : `Nível ${activeTab} (L${activeTab})`}
                            </h4>
                            <p className="text-xs text-secondary mt-1 font-medium">
                                {filteredDevices.length} dispositivo(s) encontrado(s) nesta busca/categoria.
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Barra de Busca */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/70" />
                                <input
                                    type="text"
                                    placeholder="Buscar dispositivo ou IP..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-11 pr-4 py-3 bg-card/50 border border-border rounded-xl text-sm font-bold w-[250px] focus:w-[300px] transition-all outline-none text-main focus:ring-2 focus:ring-accent/20 shadow-inner"
                                />
                            </div>

                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0
                                ${activeTab === 0 ? 'bg-secondary/10 text-secondary' : activeTab === 1 ? 'bg-emerald-500/10 text-emerald-500' : activeTab === 2 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}
                            >
                                <Server className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {isDevicesLoading ? (
                            <div className="p-12 flex justify-center">
                                <LoadingState message="Buscando dispositivos..." />
                            </div>
                        ) : filteredDevices.length === 0 ? (
                            <div className="p-16 text-center text-secondary">
                                <Server className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="font-bold text-sm uppercase tracking-widest">Nenhum dispositivo neste nível</p>
                                <p className="mt-2 text-xs">Vá para outras abas para reatribuir dispositivos para cá.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-card/40 border-b border-border">
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-secondary w-1/3">Dispositivo</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-secondary w-1/4">IP do Host</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-secondary w-1/6">Status</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-secondary text-right pr-6">Mover Para</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDevices.map((device: any) => (
                                        <tr key={device.id} className="border-b border-border/50 hover:bg-card/40 transition-colors group">
                                            <td className="p-4 font-bold text-main text-sm">
                                                {device.name}
                                            </td>
                                            <td className="p-4 font-mono text-xs text-secondary/70">
                                                {device.ipAddress}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${device.status === 'ONLINE' ? 'bg-emerald-500' : device.status === 'OFFLINE' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                    <span className="text-xs font-bold text-secondary uppercase">{device.status}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <div className="inline-flex items-center bg-card/60 backdrop-blur-md rounded-xl p-1 border border-border opacity-70 group-hover:opacity-100 transition-opacity shadow-sm">
                                                    <ArrowRightLeft className="w-3 h-3 text-secondary ml-2 mr-3" />
                                                    {[0, 1, 2, 3].map((levelOption) => (
                                                        levelOption !== activeTab && (
                                                            <button
                                                                key={levelOption}
                                                                onClick={() => setLevelMutation.mutate({ deviceId: device.id, level: levelOption })}
                                                                disabled={setLevelMutation.isLoading}
                                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all hover:bg-card text-secondary hover:text-main`}
                                                                title={`Mover para Nível ${levelOption}`}
                                                            >
                                                                L{levelOption}
                                                            </button>
                                                        )
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
