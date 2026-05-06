import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, Info, ExternalLink, 
    Plus, Trash2, Save, Loader2, Server, Network,
    RefreshCcw, CheckCircle2, Search, ChevronDown, ChevronUp,
    Key, ShieldCheck, Zap, Trash, Lightbulb, ListChecks,
    AlertCircle, Copy, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../utils/trpc';
import { toast } from 'sonner';

interface DeviceConfig {
    name: string;
    ip: string;
    interfaces: string[];
}

interface GrafanaManagerProps {
    initialView?: 'gen' | 'list' | 'tips';
}

export function GrafanaManager({ initialView = 'gen' }: GrafanaManagerProps) {
    const [view, setView] = useState(initialView);
    const [devices, setDevices] = useState<DeviceConfig[]>([]);
    const [dashboardName, setDashboardName] = useState('IronGrid NOC Dashboard');
    const [isGenerating, setIsGenerating] = useState(false);
    const [expandedIps, setExpandedIps] = useState<string[]>([]);
    const [grafanaToken, setGrafanaToken] = useState(() => localStorage.getItem('grafana_token') || '');
    const [autoImport, setAutoImport] = useState(true);

    // Sincroniza a view se a prop mudar
    useEffect(() => {
        setView(initialView);
    }, [initialView]);

    // Queries do tRPC
    const { data: config, isLoading: isLoadingConfig } = trpc.grafana.getConfig.useQuery();
    const { data: discoveryData, isLoading: isLoadingDiscovery, refetch: refetchDiscovery } = trpc.grafana.getDiscoveryData.useQuery();
    const { data: remoteDashboards, refetch: refetchDashboards, isLoading: isLoadingDashboards } = trpc.grafana.listDashboards.useQuery(
        { grafanaToken },
        { enabled: !!grafanaToken }
    );
    
    const generateMutation = trpc.grafana.generate.useMutation({
        onSuccess: (data) => {
            toast.success(data.message);
            setIsGenerating(false);
            setDevices([]); // Limpa a lista de switches selecionados
            setDashboardName('IronGrid NOC Dashboard'); // Reseta o nome padrão
            if (autoImport) refetchDashboards();
        },
        onError: (error) => {
            toast.error(error.message);
            setIsGenerating(false);
        }
    });

    const deleteMutation = trpc.grafana.deleteDashboard.useMutation({
        onSuccess: (data) => {
            toast.success(data.message);
            refetchDashboards();
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });

    useEffect(() => {
        if (config?.devices) {
            setDevices(config.devices);
        }
    }, [config]);

    const saveToken = (token: string) => {
        setGrafanaToken(token);
        localStorage.setItem('grafana_token', token);
    };

    const addDevice = () => {
        setDevices([...devices, { name: '', ip: '', interfaces: [] }]);
    };

    const removeDevice = (index: number) => {
        setDevices(devices.filter((_, i) => i !== index));
    };

    const updateDevice = (index: number, field: keyof DeviceConfig, value: any) => {
        const newDevices = [...devices];
        if (field === 'interfaces') {
            newDevices[index][field] = value.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
        } else {
            (newDevices[index] as any)[field] = value;
        }
        setDevices(newDevices);
    };

    const handleGenerate = () => {
        if (devices.length === 0) {
            toast.warning("Adicione pelo menos um dispositivo!");
            return;
        }
        if (autoImport && !grafanaToken) {
            toast.error("Insira o Token do Grafana para usar o Auto-Import!");
            return;
        }
        setIsGenerating(true);
        generateMutation.mutate({ devices, dashboardName, autoImport, grafanaToken });
    };

    const handleDeleteDashboard = (uid: string) => {
        if (window.confirm('Tem certeza que deseja deletar este dashboard do Grafana?')) {
            deleteMutation.mutate({ uid, grafanaToken });
        }
    };

    const isInterfaceSelected = (ip: string, iface: string) => {
        const dev = devices.find(d => d.ip === ip);
        return dev?.interfaces.includes(iface);
    };

    const handleInterfaceClick = (ip: string, name: string, iface: string) => {
        const existingDeviceIdx = devices.findIndex(d => d.ip === ip);
        
        if (existingDeviceIdx > -1) {
            const newDevices = [...devices];
            const ifaceIdx = newDevices[existingDeviceIdx].interfaces.indexOf(iface);
            
            if (ifaceIdx === -1) {
                // Adiciona
                newDevices[existingDeviceIdx].interfaces.push(iface);
                setDevices(newDevices);
                toast.success(`Porta ${iface} adicionada`);
            } else {
                // Remove (Toggle)
                newDevices[existingDeviceIdx].interfaces.splice(ifaceIdx, 1);
                // Se o dispositivo ficou sem interfaces, removemos ele também? 
                // Por segurança, vamos apenas limpar a interface.
                setDevices(newDevices);
                toast.info(`Porta ${iface} removida`);
            }
        } else {
            setDevices([...devices, { 
                name: name, 
                ip: ip, 
                interfaces: [iface] 
            }]);
            toast.success(`${name} adicionado`);
        }
    };

    const toggleIpExpansion = (ip: string) => {
        if (expandedIps.includes(ip)) {
            setExpandedIps(expandedIps.filter(i => i !== ip));
        } else {
            setExpandedIps([...expandedIps, ip]);
        }
    };

    if (isLoadingConfig) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* CABEÇALHO DINÂMICO */}
            <header className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-main italic tracking-tight uppercase">
                            {view === 'gen' && 'Gerador NOC Automático'}
                            {view === 'list' && 'Gestão de Dashboards'}
                            {view === 'tips' && 'Configurações e Dicas'}
                        </h1>
                        <p className="text-secondary text-sm">
                            {view === 'gen' && 'Configure e importe visões de tráfego em segundos'}
                            {view === 'list' && 'Gerencie dashboards existentes no seu servidor Grafana'}
                            {view === 'tips' && 'Gestão de tokens e boas práticas de monitoramento'}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <a 
                            href="http://localhost:3000" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-6 py-3 bg-card border border-border text-main rounded-2xl font-bold hover:bg-page transition-all"
                        >
                            <ExternalLink size={18} />
                            Ver Grafana
                        </a>
                        {view === 'gen' && (
                            <button 
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                                {autoImport ? 'Gerar & Importar' : 'Gerar JSON'}
                            </button>
                        )}
                    </div>
                </div>

                {view === 'gen' && (
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-primary/5 p-4 rounded-[2rem] border border-primary/10">
                        <div className="flex-1 space-y-1 w-full">
                            <label className="text-[10px] font-black uppercase text-primary ml-1">Nome do Dashboard</label>
                            <input 
                                type="text" 
                                value={dashboardName} 
                                onChange={(e) => setDashboardName(e.target.value)}
                                placeholder="Ex: Monitoramento NOC - Backbone"
                                className="w-full bg-page/80 border border-primary/20 rounded-xl py-2 px-4 text-sm outline-none focus:border-primary transition-all"
                            />
                        </div>
                        <div className="flex-[2] flex items-start gap-3 p-3 bg-amber-500/10 rounded-[1.5rem] border border-amber-500/20">
                            <Lightbulb size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-200/80 leading-tight italic">
                                <b>Dica Rápida:</b> Para que as interfaces apareçam na Descoberta Ativa, habilite-as em <b>Monitoramento &gt; Seleção de Gráficos</b>.
                            </p>
                        </div>
                    </div>
                )}
            </header>

            {/* CONTEÚDO PRINCIPAL BASEADO NA VIEW */}
            <AnimatePresence mode="wait">
                {view === 'gen' && (
                    <motion.div 
                        key="gen"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="space-y-6"
                    >
                        {/* CONFIGURAÇÃO DE API RAPIDA */}
                        {!grafanaToken && (
                            <div className="glass p-4 rounded-3xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="text-amber-500" size={20} />
                                    <span className="text-xs font-bold text-secondary">Token do Grafana ausente. O Auto-Import não funcionará.</span>
                                </div>
                                <button onClick={() => setView('tips')} className="text-[10px] font-black uppercase text-amber-500 hover:underline">Configurar Agora</button>
                            </div>
                        )}

                        {/* EDITOR */}
                        <div className="space-y-4">
                            {devices.map((dev, idx) => (
                                <div key={idx} className="glass p-5 rounded-[2rem] border border-border/50 relative group">
                                    <button onClick={() => removeDevice(idx)} className="absolute top-4 right-4 p-2 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 size={16} />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-secondary ml-1">Switch</label>
                                            <input type="text" value={dev.name} onChange={(e) => updateDevice(idx, 'name', e.target.value)} className="w-full bg-page/50 border border-border/50 rounded-xl py-2 px-4 text-sm outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-secondary ml-1">IP</label>
                                            <input type="text" value={dev.ip} onChange={(e) => updateDevice(idx, 'ip', e.target.value)} className="w-full bg-page/50 border border-border/50 rounded-xl py-2 px-4 text-sm outline-none" />
                                        </div>
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-[10px] font-black uppercase text-secondary ml-1">Interfaces</label>
                                            <textarea value={dev.interfaces.join(', ')} onChange={(e) => updateDevice(idx, 'interfaces', e.target.value)} className="w-full bg-page/50 border border-border/50 rounded-xl py-2 px-4 text-sm outline-none min-h-[60px]" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button onClick={addDevice} className="w-full py-4 border-2 border-dashed border-border/50 rounded-[2rem] text-secondary hover:text-primary hover:border-primary/50 transition-all flex items-center justify-center gap-2 font-bold text-sm">
                                <Plus size={18} /> Adicionar Switch Manualmente
                            </button>
                        </div>

                        {/* DESCOBERTA */}
                        <div className="glass p-6 rounded-[2.5rem] border border-border/50 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-emerald-500">
                                    <Search size={22} />
                                    <h2 className="text-xl font-bold italic uppercase">Dispositivos Detectados (24h)</h2>
                                </div>
                                <button onClick={() => refetchDiscovery()} className="p-2 text-secondary hover:text-emerald-500 transition-all">
                                    <RefreshCcw size={18} />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {isLoadingDiscovery ? (
                                    <div className="col-span-full flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-emerald-500/50" /></div>
                                ) : discoveryData && Object.keys(discoveryData).length > 0 ? (
                                    Object.entries(discoveryData as any).map(([ip, data]: any) => (
                                        <div key={ip} className="bg-page/40 border border-border/40 rounded-[1.5rem] overflow-hidden">
                                            <button onClick={() => toggleIpExpansion(ip)} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all text-left">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                                    <span className="text-sm font-black italic text-main">{data.name} <span className="text-[10px] text-secondary font-mono ml-2">({ip})</span></span>
                                                </div>
                                                {expandedIps.includes(ip) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                            <AnimatePresence>
                                                {expandedIps.includes(ip) && (
                                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="px-4 pb-4 overflow-hidden">
                                                        <div className="flex flex-wrap gap-1.5 pt-2">
                                                            {data.interfaces.map((iface: string) => (
                                                                <span 
                                                                    key={iface} 
                                                                    onClick={() => handleInterfaceClick(ip, data.name, iface)} 
                                                                    className={`px-3 py-1 rounded-xl text-[10px] font-bold cursor-pointer active:scale-95 transition-all border ${
                                                                        isInterfaceSelected(ip, iface) 
                                                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' 
                                                                        : 'bg-white/5 border-white/10 text-secondary hover:text-emerald-400'
                                                                    }`}
                                                                >
                                                                    {iface}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))
                                ) : null}
                            </div>
                        </div>
                    </motion.div>
                )}

                {view === 'list' && (
                    <motion.div 
                        key="list"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="glass p-8 rounded-[3rem] border border-border/50 space-y-6"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <TrendingUp size={24} className="text-primary" />
                                <h2 className="text-xl font-bold italic uppercase">Dashboards no Servidor</h2>
                            </div>
                            <button onClick={() => refetchDashboards()} className="p-2 text-secondary hover:text-primary transition-all">
                                <RefreshCcw size={18} />
                            </button>
                        </div>

                        {!grafanaToken ? (
                            <div className="py-20 text-center space-y-4">
                                <Key className="mx-auto text-secondary/30" size={48} />
                                <p className="text-secondary text-sm italic">Insira seu Token na aba Gerador ou Dicas para ver a lista.</p>
                            </div>
                        ) : isLoadingDashboards ? (
                            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {remoteDashboards?.length > 0 ? (
                                    remoteDashboards.map((dash: any) => (
                                        <div key={dash.uid} className="bg-page/40 border border-border/30 p-5 rounded-[2rem] group hover:border-primary/30 transition-all flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h3 className="text-sm font-black italic text-main">{dash.title}</h3>
                                                <p className="text-[10px] text-secondary font-mono">{dash.uid}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteDashboard(dash.uid)}
                                                className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-20 text-center text-secondary italic">Nenhum dashboard encontrado com a tag IronGrid.</div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}

                {view === 'tips' && (
                    <motion.div 
                        key="tips"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="space-y-6"
                    >
                        {/* CARD PASSO A PASSO TOKEN */}
                        <div className="glass p-8 rounded-[3rem] border border-primary/20 bg-primary/5 space-y-6">
                            <div className="flex items-center gap-4 text-primary">
                                <ShieldCheck size={32} />
                                <h2 className="text-2xl font-black italic uppercase">Como Gerar o Token no Grafana</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-3">
                                    <div className="w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-primary/20">1</div>
                                    <h4 className="font-bold text-sm text-main uppercase">Acesse a Administração</h4>
                                    <p className="text-xs text-secondary leading-relaxed">No menu lateral do Grafana, vá em <b>Administration &gt; Users and access &gt; Service accounts</b>.</p>
                                </div>
                                <div className="space-y-3">
                                    <div className="w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-primary/20">2</div>
                                    <h4 className="font-bold text-sm text-main uppercase">Crie a Conta</h4>
                                    <p className="text-xs text-secondary leading-relaxed">Clique em <b>Add service account</b>, dê o nome de "IronGrid" e selecione o Role <b>Admin</b> ou <b>Editor</b>.</p>
                                </div>
                                <div className="space-y-3">
                                    <div className="w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-primary/20">3</div>
                                    <h4 className="font-bold text-sm text-main uppercase">Gere o Token</h4>
                                    <p className="text-xs text-secondary leading-relaxed">Na conta criada, clique em <b>Add token</b>, copie o código e cole no campo de configuração aqui no IronGrid.</p>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-primary/10 space-y-4">
                                <div className="flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Zap className="text-primary" size={20} />
                                        <span className="text-sm font-bold text-main uppercase italic">Auto-Importar Dashboards</span>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={autoImport}
                                        onChange={(e) => setAutoImport(e.target.checked)}
                                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary bg-page"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-primary mb-2 block">Seu Token Salvo:</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="password" 
                                            value={grafanaToken}
                                            onChange={(e) => saveToken(e.target.value)}
                                            className="flex-1 bg-page/80 border border-primary/20 rounded-2xl p-4 text-sm outline-none focus:border-primary transition-all"
                                            placeholder="Token aparecerá aqui..."
                                        />
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(grafanaToken);
                                                toast.success("Token copiado para a área de transferência!");
                                            }}
                                            className="p-4 bg-primary text-white rounded-2xl hover:scale-105 transition-all"
                                        >
                                            <Copy size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CARD REGRAS DE MONITORAMENTO */}
                        <div className="glass p-8 rounded-[3rem] border border-amber-500/20 bg-amber-500/5 space-y-6">
                            <div className="flex items-center gap-4 text-amber-500">
                                <ListChecks size={32} />
                                <h2 className="text-2xl font-black italic uppercase">Regras de Monitoramento</h2>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex gap-4 p-5 bg-black/20 rounded-[2rem] border border-white/5">
                                    <Zap className="text-amber-500 flex-shrink-0" size={24} />
                                    <div>
                                        <h5 className="font-bold text-main mb-1 uppercase text-sm italic">Habilite na Seleção de Gráficos</h5>
                                        <p className="text-xs text-secondary leading-relaxed">
                                            O InfluxDB só armazena dados de interfaces que estão marcadas no menu <b>Monitoramento &gt; Seleção de Gráficos</b>. 
                                            Se você não habilitar lá, as portas não aparecerão na <b>Descoberta Ativa</b> para o Grafana.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4 p-5 bg-black/20 rounded-[2rem] border border-white/5">
                                    <Network className="text-blue-500 flex-shrink-0" size={24} />
                                    <div>
                                        <h5 className="font-bold text-main mb-1 uppercase text-sm italic">Intervalo de Polling</h5>
                                        <p className="text-xs text-secondary leading-relaxed">
                                            O IronGrid coleta dados a cada 60 segundos por padrão. Novos dados podem levar até 2 minutos para aparecerem como "recentes" na descoberta.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
