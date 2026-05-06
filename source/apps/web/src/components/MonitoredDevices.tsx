import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Activity, Trash2, ChevronDown, ChevronRight, BarChart3, Cloud, HardDrive, Zap, Filter } from 'lucide-react';
import { StatusBadge } from './ui/DesignSystem';
import { InterfaceTrafficModal } from './InterfaceTrafficModal';
import { DeviceMetricsModal } from './DeviceMetricsModal';

const Sparkline = ({ data, color }: { data: any[], color: string }) => {
    if (!data || data.length < 2) return <div className="h-6 w-24 bg-card border border-border rounded flex items-center justify-center text-[8px] text-main/40 uppercase font-black">Coletando...</div>;

    const min = Math.min(...data.map(d => d.value));
    const max = Math.max(...data.map(d => d.value)) || 1;
    const range = max - min || 1;
    const width = 100;
    const height = 24;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.value - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                style={{ filter: `drop-shadow(0 0 4px ${color}44)` }}
            />
        </svg>
    );
};

export function MonitoredDevices() {
    const utils = trpc.useContext();
    const { data: monitoredDevices = [], isLoading } = trpc.snmp.listMonitoredDevices.useQuery();
    console.log('[Frontend Debug] monitoredDevices:', monitoredDevices);
    const [expandedDeviceIp, setExpandedDeviceIp] = useState<string | null>(null);
    const [selectedInterface, setSelectedInterface] = useState<{ device: any, index: number, description?: string } | null>(null);
    const [fullMetricsDevice, setFullMetricsDevice] = useState<any>(null);
    const [activeLevelTab, setActiveLevelTab] = useState<number | 'all'>('all');

    const setLevelMutation = trpc.monitoring.setDeviceMonitoringLevel.useMutation({
        onSuccess: () => {
            utils.snmp.listMonitoredDevices.invalidate();
        }
    });

    const stopMutation = (trpc.snmp as any).removeMonitoredDevice.useMutation({
        onSuccess: () => {
            utils.snmp.listMonitoredDevices.invalidate();
        }
    });

    const bulkToggleMutation = (trpc.snmp as any).bulkToggleInterfaces.useMutation({
        onSuccess: () => {
            (utils.snmp as any).listMonitoredDevices.invalidate();
        }
    });

    const toggleMutation = (trpc.snmp as any).toggleInterface.useMutation({
        onSuccess: () => {
            (utils.snmp as any).listMonitoredDevices.invalidate();
        }
    });

    const handleStop = async (ip: string) => {
        if (confirm('Parar o monitoramento deste dispositivo?')) {
            await stopMutation.mutateAsync({ ip });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-main/40 flex flex-col items-center gap-3">
                    <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span>Carregando dispositivos monitorados...</span>
                </div>
            </div>
        );
    }

    if (!monitoredDevices || monitoredDevices.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <Activity className="h-16 w-16 text-main/20 mb-4" />
                <h3 className="text-xl font-semibold text-main/60 mb-2">Nenhum Dispositivo Sendo Monitorado</h3>
                <p className="text-main/40 max-w-md">
                    Comece a monitorar dispositivos indo na aba "Dispositivos" e clicando em "Gerenciar" em qualquer dispositivo descoberto.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-main flex items-center gap-3 italic uppercase tracking-tighter">
                        <Activity className="h-8 w-8 text-main" />
                        Seleção de Gráficos
                    </h2>
                    <p className="text-[11px] text-main/80 font-black uppercase tracking-widest mt-1 mb-2">
                        Selecione as interfaces que serão geradas nos gráficos
                    </p>
                    <p className="text-[10px] text-main/50 font-bold uppercase tracking-widest mt-1">
                        {monitoredDevices.length} dispositivo{monitoredDevices.length !== 1 ? 's' : ''} sob monitoramento ativo
                    </p>
                </div>

                {/* Tabs de Níveis */}
                <div className="flex bg-card/50 p-1.5 rounded-2xl border border-border self-start">
                    {['all', 1, 2, 3].map((l) => (
                        <button
                            key={l}
                            onClick={() => setActiveLevelTab(l as any)}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                                ${activeLevelTab === l
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'text-main/50 hover:text-main hover:bg-card'}`}
                        >
                            {l === 'all' ? 'Todos' : `Nível ${l}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filtro de Nível Ativo */}
            {activeLevelTab !== 'all' && (
                <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 p-4 rounded-2xl animate-in zoom-in-95 duration-300">
                    <Filter className="w-4 h-4 text-main" />
                    <span className="text-xs text-main font-bold uppercase tracking-wider">
                        Filtrando por Nível {activeLevelTab}
                    </span>
                    <button
                        onClick={() => setActiveLevelTab('all')}
                        className="ml-auto text-[10px] font-black uppercase text-main/40 hover:text-main"
                    >
                        Limpar Filtro
                    </button>
                </div>
            )}

            <div className="grid gap-4">
                {monitoredDevices
                    .filter((device: any) => activeLevelTab === 'all' || (device.monitoringLevel || 0) === activeLevelTab)
                    .map((device: any) => (
                        <div key={device.ip} className="bg-card border border-border rounded-xl overflow-hidden transition-all duration-300">
                            {/* Device Header Row */}
                            <div
                                className="flex items-center justify-between p-6 cursor-pointer hover:bg-page/50 transition-all group"
                            >
                                <div className="flex items-center gap-5 flex-1 min-w-0" onClick={() => setExpandedDeviceIp(expandedDeviceIp === device.ip ? null : device.ip)}>
                                    {expandedDeviceIp === device.ip ? <ChevronDown className="h-5 w-5 text-main/40" /> : <ChevronRight className="h-5 w-5 text-main/40" />}
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-inner 
                                    ${device.status === 'up' ? 'bg-primary/10 text-main border border-primary/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}
                                    >
                                        <Cloud className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-black text-main italic uppercase tracking-tighter text-lg leading-tight truncate">
                                            {device.deviceName || device.name}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <div className="text-[11px] font-bold text-main/40 font-mono tracking-[0.2em]">{device.ip}</div>
                                            {device.monitoringLevel > 0 && (
                                                <StatusBadge
                                                    label={`Nível ${device.monitoringLevel}`}
                                                    variant={device.monitoringLevel === 1 ? 'primary' : device.monitoringLevel === 2 ? 'warning' : 'danger'}
                                                    size="sm"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 px-4 overflow-x-auto no-scrollbar">
                                    {/* Seletor de Nível */}
                                    <div className="flex items-center bg-card/50 rounded-xl border border-border p-1" onClick={(e) => e.stopPropagation()}>
                                        {[0, 1, 2, 3].map((l) => (
                                            <button
                                                key={l}
                                                disabled={setLevelMutation.isLoading}
                                                onClick={() => setLevelMutation.mutate({ deviceId: device.deviceId, level: l })}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all
                                                ${(device.monitoringLevel || 0) === l
                                                        ? 'bg-primary text-white border border-primary/20 shadow-lg'
                                                        : 'text-main/40 hover:text-main hover:bg-card/80'}`}
                                                title={l === 0 ? 'Sem Nível (Instantâneo)' : `Nível ${l}`}
                                            >
                                                {l === 0 ? 'OFF' : `L${l}`}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="hidden md:flex items-center gap-8 border-x border-border/50 px-10 mx-6">
                                        <div className="flex flex-col items-end gap-2 min-w-[130px]">
                                            <div className="flex items-center justify-between w-full gap-6">
                                                <span className="text-[10px] text-main font-black uppercase tracking-[0.2em] opacity-80">Monitoradas</span>
                                                <span className="text-[16px] text-main font-black italic leading-none min-w-[32px] text-right">
                                                    {(device.interfaceDetails || []).filter((i: any) => i.enabled).length}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between w-full gap-6">
                                                <span className="text-[10px] text-red-500 font-black uppercase tracking-[0.2em] opacity-80 whitespace-nowrap">Não Monit.</span>
                                                <span className="text-[16px] text-red-500 font-black italic leading-none min-w-[32px] text-right">
                                                    {((device.interfaceDetails || device.interfaces).length || 0) - (device.interfaceDetails || []).filter((i: any) => i.enabled).length}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setFullMetricsDevice(device); }}
                                            className="p-3 hover:bg-primary/10 rounded-2xl text-main/40 hover:text-main transition-all hover:scale-110 active:scale-90"
                                            title="Indicadores"
                                        >
                                            <BarChart3 className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStop(device.ip); }}
                                            className="p-3 hover:bg-red-600/10 rounded-2xl text-main/40 hover:text-red-500 transition-all hover:scale-110 active:scale-90"
                                            title="Remover"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Resources List (Expanded) */}
                            {expandedDeviceIp === device.ip && (
                                <div className="border-t border-border bg-card/20 p-6 animate-in slide-in-from-top-2 duration-200">
                                    {device.hasAgent && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-border/50">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-main/50 font-black uppercase tracking-widest">Processamento (Agente)</span>
                                                        <span className="text-xl font-black italic text-main">{device.latest?.cpu?.toFixed(1) || '0.0'}%</span>
                                                    </div>
                                                    <Sparkline data={device.history?.cpu || []} color="var(--primary)" />
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-main/50 font-black uppercase tracking-widest">Memória (Agente)</span>
                                                        <span className="text-xl font-black italic text-main">{device.latest?.ram?.toFixed(1) || '0.0'}%</span>
                                                    </div>
                                                    <Sparkline data={device.history?.ram || []} color="var(--accent)" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-8">
                                        {/* Disks Section */}
                                        {device.hasAgent && (
                                            <div>
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-main/40 mb-4 flex items-center gap-2">
                                                    <HardDrive className="w-3 h-3" /> Armazenamento Local
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {device.latest?.disks && Object.entries(device.latest.disks).length > 0 ? (
                                                        Object.entries(device.latest.disks).map(([mount, data]: [string, any], idx: number) => {
                                                            const usedGB = (data.used / 1024 / 1024 / 1024).toFixed(1);
                                                            const totalGB = (data.total / 1024 / 1024 / 1024).toFixed(0);
                                                            const percent = ((data.used / (data.total || 1)) * 100).toFixed(0);

                                                            return (
                                                                <div key={`disk-${idx}`} className="bg-card border border-border p-4 rounded-xl shadow-lg border-l-4 border-l-amber-500/50">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-black italic text-main leading-tight">Disco {mount}</span>
                                                                            <span className="text-[10px] text-main/50 font-bold uppercase tracking-tighter">Unidade Operacional</span>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="text-lg font-mono text-amber-500 font-black italic">{percent}%</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="h-1 bg-page rounded-full overflow-hidden mb-3">
                                                                        <div className="h-full bg-amber-500 rounded-full transition-all duration-1000" style={{ width: `${percent}%` }} />
                                                                    </div>
                                                                    <div className="text-[10px] text-main/40 flex items-center justify-between font-bold uppercase">
                                                                        <span>{usedGB} GB USADOS</span>
                                                                        <span>{totalGB} GB TOTAL</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="col-span-full p-4 bg-page border border-dashed border-border rounded-xl text-center text-main/30 font-bold text-xs italic">
                                                            Aguardando sincronização de discos do agente...
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Network Section */}
                                        <div>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-2 border-b border-border/50">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-main/40 flex items-center gap-2">
                                                    <Zap className="w-3 h-3 text-main" /> Interfaces de Rede (SNMP & Agente)
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                <div className="flex bg-card border border-border rounded-lg p-0.5">
                                                        <button
                                                            onClick={() => bulkToggleMutation.mutate({ deviceId: device.deviceId, type: 'all', enabled: true })}
                                                            className="px-2 py-1 text-[8px] font-black uppercase tracking-tighter text-main/40 hover:text-main hover:bg-primary/10 rounded-md transition-all"
                                                        >
                                                            Ativar Tudo
                                                        </button>
                                                        <div className="w-px bg-border self-stretch my-1 mx-0.5" />
                                                        <button
                                                            onClick={() => bulkToggleMutation.mutate({ deviceId: device.deviceId, type: 'all', enabled: false })}
                                                            className="px-2 py-1 text-[8px] font-black uppercase tracking-tighter text-main/40 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                                                        >
                                                            Parar Tudo
                                                        </button>
                                                    </div>
                                                    <div className="flex bg-card border border-border rounded-lg p-0.5">
                                                        <button
                                                            onClick={() => bulkToggleMutation.mutate({ deviceId: device.deviceId, type: 'lag', enabled: true })}
                                                            className="px-2 py-1 text-[8px] font-black uppercase tracking-tighter text-main/40 hover:text-main hover:bg-primary/10 rounded-md transition-all whitespace-nowrap"
                                                        >
                                                            Selecionar LAK/LAG
                                                        </button>
                                                        <div className="w-px bg-border self-stretch my-1 mx-0.5" />
                                                        <button
                                                            onClick={() => bulkToggleMutation.mutate({ deviceId: device.deviceId, type: 'lag', enabled: false })}
                                                            className="px-2 py-1 text-[8px] font-black uppercase tracking-tighter text-main/40 hover:text-secondary hover:bg-secondary/10 rounded-md transition-all whitespace-nowrap"
                                                        >
                                                            Desmarcar LAK
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {[...(device.interfaceDetails || device.interfaces)]
                                                    .sort((a: any, b: any) => {
                                                        const nameA = (typeof a === 'object' ? (a.alias || a.name || '') : `Interface #${a.index || a}`).toLowerCase();
                                                        const nameB = (typeof b === 'object' ? (b.alias || b.name || '') : `Interface #${b.index || b}`).toLowerCase();
                                                        
                                                        const isLagA = nameA.includes('link aggregate') || nameA.includes('lag') || nameA.includes('lak');
                                                        const isLagB = nameB.includes('link aggregate') || nameB.includes('lag') || nameB.includes('lak');
                                                        
                                                        const isEnabledA = a.enabled === true;
                                                        const isEnabledB = b.enabled === true;

                                                        // 1. Link Aggregate sempre por último
                                                        if (isLagA && !isLagB) return 1;
                                                        if (!isLagA && isLagB) return -1;
                                                        
                                                        // 2. Ativos primeiro
                                                        if (isEnabledA && !isEnabledB) return -1;
                                                        if (!isEnabledA && isEnabledB) return 1;
                                                        
                                                        // 3. Ordem Alfabética
                                                        return nameA.localeCompare(nameB);
                                                    })
                                                    .map((iface: any) => {
                                                        const ifIndex = typeof iface === 'number' ? iface : iface.index;
                                                        const displayName = typeof iface === 'object' ? (iface.alias || iface.name) : `Interface #${ifIndex}`;
                                                        const stats = typeof iface === 'object' ? iface.latest : null;
                                                        const throughput = stats ? ((stats.in + stats.out) * 8 / 1000 / 1000).toFixed(2) : '0.00';

                                                        return (
                                                            <div
                                                                key={`net-${device.ip}-${ifIndex}`}
                                                                onClick={() => setSelectedInterface({ device, index: ifIndex, description: displayName })}
                                                                className={`bg-card border p-4 rounded-xl transition-all cursor-pointer group relative overflow-hidden
                                                                ${(iface.enabled === true) ? 'border-border hover:border-primary/50 hover:bg-card/80' : 'border-border/50 bg-card/40 opacity-60 hover:opacity-100'}
                                                            `}
                                                            >
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-black italic text-main leading-tight group-hover:text-main transition-colors" title={displayName}>
                                                                            {displayName.length > 25 ? displayName.substring(0, 25) + '...' : displayName}
                                                                        </span>
                                                                        <span className="text-[10px] text-main/50 font-bold uppercase tracking-tighter">
                                                                            IDX: {ifIndex} {iface.speed ? `| ${(Number(iface.speed) / 1000 / 1000).toFixed(0)} Mbps` : ''}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-right z-10" onClick={(e) => e.stopPropagation()}>
                                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="sr-only peer"
                                                                                checked={iface.enabled === true}
                                                                                onChange={(e) => {
                                                                                    const newVal = e.target.checked;
                                                                                    toggleMutation.mutate({
                                                                                        deviceId: device.deviceId,
                                                                                        index: ifIndex,
                                                                                        enabled: newVal
                                                                                    });
                                                                                }}
                                                                            />
                                                                            <div className="w-9 h-5 bg-page border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right mb-2">
                                                                    <div className="text-xs font-mono text-main font-bold">{throughput} Mbps</div>
                                                                </div>
                                                                <div className="text-[10px] text-main/40 flex items-center justify-between font-bold uppercase pt-2 border-t border-border/50">
                                                                    <span className="flex items-center gap-1">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                                                            iface.status === 'up' ? 'bg-emerald-500' :
                                                                            iface.status === 'down' ? 'bg-red-500' :
                                                                            'bg-page/20'
                                                                        }`} />
                                                                        {iface.status ? iface.status.toUpperCase() : 'N/D'}
                                                                    </span>
                                                                    {(iface.enabled === true) && <span className="text-main group-hover:underline">VER TRÁFEGO →</span>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>

                                            {selectedInterface && (
                                                <InterfaceTrafficModal
                                                    device={selectedInterface.device}
                                                    interfaceIndex={selectedInterface.index}
                                                    interfaceDescription={selectedInterface.description}
                                                    onClose={() => setSelectedInterface(null)}
                                                />
                                            )}

                                            {fullMetricsDevice && (
                                                <DeviceMetricsModal
                                                    device={{
                                                        ...fullMetricsDevice,
                                                        id: fullMetricsDevice.id || fullMetricsDevice.ip, // Ensure ID is present for TRPC
                                                        name: fullMetricsDevice.deviceName || fullMetricsDevice.ip
                                                    }}
                                                    onClose={() => setFullMetricsDevice(null)}
                                                />
                                            )}

                                            <div className="bg-card/50 border border-border rounded-xl p-6 text-center">
                                                <p className="text-main/50 text-sm">
                                                    Monitored data is collected via SNMP v2c and persisted in the local database.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
            </div>
        </div>
    );
}

