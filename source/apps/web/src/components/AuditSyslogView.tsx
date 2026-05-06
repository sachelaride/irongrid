import { useState, useEffect, useRef } from 'react';
import { trpc } from '../utils/trpc';
import {
    Terminal, Search, Trash2, Play, Square,
    Info, RefreshCw, Clock
} from 'lucide-react';
import { format } from 'date-fns';

export function AuditSyslogView({ onNavigateSubTab }: { onNavigateSubTab?: (sub: string) => void }) {
    const [isLive, setIsLive] = useState(true);
    const [search, setSearch] = useState('');
    const [minSeverity, setMinSeverity] = useState<number>(7);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');
    const [logs, setLogs] = useState<any[]>([]);
    const [customPort, setCustomPort] = useState<number>(1514);
    const [isEditingPort, setIsEditingPort] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Get devices for filter
    const { data: devicesData = [] } = (trpc as any).scan.getDevices.useQuery({});
    const devices = Array.isArray(devicesData) ? devicesData : (devicesData as any)?.devices ?? [];

    // Get initial logs and poll for updates every 3 seconds
    const recentLogsQuery = (trpc as any).syslog.getRecentMessages.useQuery(
        { limit: 100 },
        {
            enabled: isLive,
            refetchInterval: isLive ? 3000 : false,
            refetchOnWindowFocus: false
        }
    );

    const statusQuery = (trpc as any).syslog.getStatus.useQuery(undefined, {
        refetchInterval: 5000,
        onSuccess: (data: any) => {
            if (!isEditingPort) setCustomPort(data.port);
        }
    });
    const startMutation = (trpc as any).syslog.start.useMutation({ onSuccess: () => statusQuery.refetch() });
    const stopMutation = (trpc as any).syslog.stop.useMutation({ onSuccess: () => statusQuery.refetch() });
    const updateConfigMutation = (trpc as any).syslog.updateConfig.useMutation({
        onSuccess: () => {
            statusQuery.refetch();
            setIsEditingPort(false);
            setIsLive(true); // Automatically enable monitoring view
        }
    });

    const triggerCleanup = (trpc as any).syslog.triggerCleanup.useMutation({
        onSuccess: () => {
            alert('Limpeza iniciada em background. O banco será otimizado gradualmente.');
            cleanupStatusQuery.refetch();
        }
    });

    const cleanupStatusQuery = (trpc as any).syslog.getCleanupStatus.useQuery(undefined, {
        enabled: true,
        refetchInterval: (data: any) => data?.isCleaning ? 2000 : false
    });

    const clearAllMutation = (trpc as any).syslog.clearAll.useMutation({
        onSuccess: () => {
            alert('Banco resetado com sucesso! O espaço de 357GB foi liberado.');
            setLogs([]);
            statusQuery.refetch();
        }
    });

    const reclaimSpaceMutation = (trpc as any).syslog.reclaimSpace.useMutation({
        onSuccess: () => {
            alert('Compactação concluída! Verifique o Dashboard.');
            statusQuery.refetch();
        }
    });

    useEffect(() => {
        if (recentLogsQuery.data) {
            // Decoupled polling from subscription - replace buffer with latest 100 logs
            setLogs(recentLogsQuery.data.slice().reverse());
        }
    }, [recentLogsQuery.data]);

    const getSeverityColor = (sev: number) => {
        switch (sev) {
            case 0: // Emergency
            case 1: // Alert
            case 2: // Critical
                return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 3: // Error
                return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 4: // Warning
                return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            default:
                return 'text-main bg-primary/10 border-primary/20';
        }
    };

    const getSeverityLabel = (sev: number) => {
        const labels = ['EMERG', 'ALERT', 'CRIT', 'ERROR', 'WARN', 'NOTICE', 'INFO', 'DEBUG'];
        return labels[sev] || 'UNKNOWN';
    };

    // Stop monitoring when device changes - wait for manual start
    useEffect(() => {
        setLogs([]); // Clear for fresh view
        if (statusQuery.data?.isRunning) {
            stopMutation.mutate();
        }
        setIsLive(false);
    }, [selectedDeviceId]);

    const filteredLogs = logs.filter(log => {
        const matchSearch = !search ||
            log.message.toLowerCase().includes(search.toLowerCase()) ||
            log.hostname.toLowerCase().includes(search.toLowerCase()) ||
            log.tag.toLowerCase().includes(search.toLowerCase());
        const matchSeverity = log.severity <= minSeverity;

        // Improved device matching: by ID, by IP, or by name/hostname overlap
        const device = devices.find((d: any) => d.id === selectedDeviceId);
        const matchDevice = selectedDeviceId === 'all' ||
            log.deviceId === selectedDeviceId ||
            (device && (
                log.hostname === device.ipAddress ||
                log.hostname === device.hostname ||
                log.hostname === device.name ||
                log.hostname.startsWith(device.name || '') ||
                log.hostname.startsWith(device.hostname || '')
            ));

        return matchSearch && matchSeverity && matchDevice;
    });

    // For debugging: count filtered results vs total
    const totalCount = logs.length;

    return (
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl flex flex-col h-[750px]">
            {/* Header / Toolbar - Redesigned for visual priority */}
            <div className="p-4 border-b border-border bg-page/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                            <Terminal size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black italic tracking-tight uppercase leading-none text-main">Auditoria de Logs Remotos</h2>
                            <div className="flex flex-col gap-1 mt-2">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${statusQuery.data?.isRunning ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${statusQuery.data?.isRunning ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {statusQuery.data?.isRunning ? `Servidor Ativo (Porta ${statusQuery.data?.port})` : 'Servidor Offline'}
                                    </span>
                                </div>
                                {statusQuery.data?.lastError && (
                                    <span className="text-[9px] text-red-400 font-bold animate-pulse uppercase max-w-xs">{statusQuery.data.lastError}</span>
                                )}
                            </div>
                        </div>
                        {onNavigateSubTab && (
                            <button
                                onClick={() => onNavigateSubTab('syslog')}
                                className="ml-4 flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/10 text-main border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95 group"
                            >
                                <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                                Configurar Gravação
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Port Management - More prominent */}
                        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-2">
                            <span className="text-[10px] text-main uppercase font-black tracking-wider">Definir Porta:</span>
                            {isEditingPort ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={customPort}
                                        onChange={(e) => setCustomPort(Number(e.target.value))}
                                        className="w-20 bg-page border border-border rounded-lg focus:ring-2 focus:ring-primary text-xs py-1 px-2 text-main shadow-sm"
                                    />
                                    <button
                                        onClick={() => updateConfigMutation.mutate({ port: customPort })}
                                        className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-md active:scale-95"
                                    >
                                        <RefreshCw size={12} className={updateConfigMutation.isLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsEditingPort(true)}
                                    className="text-sm font-black text-main hover:scale-105 transition-transform"
                                >
                                    {statusQuery.data?.port || '1514'}
                                </button>
                            )}
                        </div>

                        {/* Device Selector - More prominent */}
                        <div className="flex items-center gap-2 bg-secondary/5 border border-border rounded-2xl px-4 py-2">
                            <span className="text-[10px] text-secondary uppercase font-black tracking-wider">Equipamento:</span>
                            <select
                                value={selectedDeviceId}
                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                                className="bg-transparent border-none text-xs font-bold text-main outline-none focus:ring-0 cursor-pointer p-0"
                            >
                                <option value="all" className="bg-card">Todos Dispositivos</option>
                                {devices.map((d: any) => (
                                    <option key={d.id} value={d.id} className="bg-card">{d.name || d.ipAddress}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-border gap-4">
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-main transition-colors" size={14} />
                            <input
                                type="text"
                                placeholder="Filtrar conteúdo..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-page border border-border rounded-xl py-2 pl-10 pr-4 text-[11px] w-64 focus:ring-2 focus:ring-primary/50 outline-none transition-all text-main"
                            />
                        </div>

                        <select
                            value={minSeverity}
                            onChange={(e) => setMinSeverity(Number(e.target.value))}
                            className="bg-page border border-border rounded-xl py-2 px-4 text-[11px] outline-none focus:ring-2 focus:ring-primary/50 text-main font-medium"
                        >
                            <option value={7} className="bg-card">Todas Severidades</option>
                            <option value={4} className="bg-card">Warning e acima</option>
                            <option value={3} className="bg-card">Error e acima</option>
                            <option value={2} className="bg-card">Critical e acima</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (statusQuery.data?.isRunning) {
                                    stopMutation.mutate();
                                    setIsLive(false);
                                } else {
                                    startMutation.mutate();
                                    setIsLive(true);
                                }
                            }}
                            disabled={startMutation.isLoading || stopMutation.isLoading}
                            className={`px-6 py-2.5 rounded-2xl transition-all shadow-lg flex items-center gap-3 ${statusQuery.data?.isRunning
                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20'}`}
                        >
                            {statusQuery.data?.isRunning ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                            <span className="text-xs font-black uppercase tracking-widest">
                                {statusQuery.data?.isRunning ? 'Parar Monitoramento' : 'Iniciar Monitoramento'}
                            </span>
                            {(startMutation.isLoading || stopMutation.isLoading) && <RefreshCw size={14} className="animate-spin ml-2" />}
                        </button>

                        <div className="h-8 w-px bg-border mx-2"></div>

                        <button
                            onClick={() => setLogs([])}
                            className="p-3 bg-page border border-border hover:bg-red-500/10 rounded-2xl transition-all text-secondary hover:text-red-500 shadow-sm"
                            title="Limpar Tela"
                        >
                            <Trash2 size={16} />
                        </button>

                        <button
                            onClick={() => {
                                if (confirm('Deseja iniciar a limpeza de logs antigos (>7 dias)? Isso ajuda a recuperar o espaço de 357GB.')) {
                                    triggerCleanup.mutate({ daysOld: 7 });
                                }
                            }}
                            disabled={cleanupStatusQuery.data?.isCleaning}
                            className={`p-3 rounded-2xl transition-all flex items-center gap-3 shadow-sm ${cleanupStatusQuery.data?.isCleaning
                                ? 'bg-orange-500 text-white animate-pulse border-orange-500'
                                : 'bg-page border border-border hover:bg-primary/10 hover:text-main'} text-secondary`}
                            title="Limpeza Programada (>7 dias)"
                        >
                            <Info size={16} />
                            {cleanupStatusQuery.data?.isCleaning && (
                                <span className="text-[10px] font-black uppercase">Limpando... ({cleanupStatusQuery.data.totalDeleted})</span>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                if (confirm('Deseja compactar o banco para recuperar espaço? Isso NÃO apaga logs, mas trava a coleta por alguns minutos. Continuar?')) {
                                    reclaimSpaceMutation.mutate();
                                }
                            }}
                            disabled={reclaimSpaceMutation.isLoading}
                            className="p-3 bg-page border border-border hover:bg-emerald-600 hover:text-white rounded-2xl transition-all text-secondary shadow-sm"
                            title="Compactar Banco (Reclama espaço sem apagar)"
                        >
                            <RefreshCw size={16} className={reclaimSpaceMutation.isLoading ? 'animate-spin' : ''} />
                        </button>

                        <button
                            onClick={() => {
                                if (confirm('ATENÇÃO: Isso irá apagar ABSOLUTAMENTE TODOS os logs coletados até agora para liberar os 357GB imediatamente. Deseja continuar?')) {
                                    clearAllMutation.mutate();
                                }
                            }}
                            disabled={clearAllMutation.isLoading}
                            className="p-3 bg-red-500/10 border border-red-500/20 hover:bg-red-600 hover:text-white rounded-2xl transition-all text-red-500 shadow-sm"
                            title="ZERAR TUDO (Libera 357GB imediato)"
                        >
                            <Trash2 size={16} className={clearAllMutation.isLoading ? 'animate-pulse' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs Area */}
            <div className="flex-1 overflow-auto bg-black p-6 font-mono text-[11px] leading-relaxed relative scrollbar-thin scrollbar-thumb-white/10" ref={scrollRef}>
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-4">
                        <Terminal size={64} className="opacity-10" />
                        <div className="text-center">
                            <p className="uppercase tracking-[0.3em] font-black text-[10px] opacity-40 mb-2">Monitorando tráfego Syslog...</p>
                            <p className="text-[9px] font-medium italic opacity-30">
                                {totalCount > 0
                                    ? `${totalCount} logs no buffer, mas nenhum corresponde aos filtros atuais.`
                                    : 'Nenhum evento detectado ainda.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {filteredLogs.map((log, idx) => (
                            <div key={idx} className="group flex gap-4 hover:bg-white/5 p-1 px-2 rounded-lg transition-all whitespace-pre-wrap break-all border border-transparent hover:border-white/5 animate-in fade-in slide-in-from-left-2 duration-300">
                                <span className="text-white/40 shrink-0 select-none font-bold">[{format(new Date(log.timestamp), 'HH:mm:ss')}]</span>
                                <span className="text-main font-bold shrink-0">{log.hostname}</span>
                                <div className={`px-2 py-0.5 border rounded-md text-[8px] font-black shrink-0 flex items-center shadow-sm ${getSeverityColor(log.severity)}`}>
                                    {getSeverityLabel(log.severity)}
                                </div>
                                <span className="text-emerald-500 shrink-0 font-bold tracking-tighter decoration-emerald-500/30 underline-offset-4">{log.tag}:</span>
                                <span className="text-white/80 flex-1 font-medium">{log.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer / Stats */}
            <div className="px-6 py-4 border-t border-border bg-page/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Eventos:</span>
                        <span className="text-[10px] font-black text-main">{logs.length}</span>
                    </div>
                    <div className="flex items-center gap-3 text-main px-4 py-1.5 bg-page border border-border rounded-2xl shadow-inner">
                        <Clock size={12} className="text-secondary" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Último: {logs[0] ? format(new Date(logs[0].timestamp), 'HH:mm:ss') : 'Aguiardando...'}</span>
                    </div>
                </div>

                <div className="hidden lg:flex items-center gap-4 text-[10px] text-secondary font-bold italic opacity-60">
                    <Info size={14} className="text-main" />
                    <span>O armazenamento permanente em banco ocorre apenas para dispositivos cadastrados.</span>
                </div>
            </div>
        </div>
    );
}
