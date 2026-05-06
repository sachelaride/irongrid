import { useState, useEffect } from 'react';
import { trpc } from '../utils/trpc';
import {
    Activity, TrendingUp, ChevronRight, Cloud, Zap,
    Search, Cpu, HardDrive, BarChart3
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { InterfaceTrafficModal } from './InterfaceTrafficModal';
import { DeviceMetricsModal } from './DeviceMetricsModal';

const TrafficChart = ({ inData = [], outData = [] }: { inData: any[], outData: any[] }) => {
    // Merge data for Recharts
    const data = inData.map((d, i) => ({
        timestamp: d.time,
        bytesIn: d.value,
        bytesOut: outData[i]?.value || 0
    }));

    const formatTraffic = (bytesPerSec: number) => {
        const bitsPerSec = bytesPerSec * 8;
        if (bitsPerSec === 0) return '0 bps';
        const k = 1000;
        const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
        const i = Math.floor(Math.log(bitsPerSec) / Math.log(k));
        const val = bitsPerSec / Math.pow(k, i);
        return parseFloat(val.toFixed(1)) + ' ' + sizes[i];
    };

    if (data.length < 2) return (
        <div className="h-full w-full flex items-center justify-center bg-card border border-dashed border-border rounded-2xl">
            <span className="text-[10px] font-black text-main/40 uppercase italic">Coletando dados...</span>
        </div>
    );

    return (
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorInMain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorOutMain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} className="dark:hidden" />
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} className="hidden dark:block" />
                    <XAxis
                        dataKey="timestamp"
                        hide
                    />
                    <YAxis
                        stroke="rgb(var(--text-secondary))"
                        fontSize={8}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatTraffic}
                        width={45}
                    />
                    <Tooltip
                        content={({ active, payload }: any) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-card border border-border p-2 rounded-lg shadow-xl text-[10px]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                            <span className="text-main/70">Entrada: {formatTraffic(payload[0].value)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                            <span className="text-main/70">Saída: {formatTraffic(payload[1].value)}</span>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="bytesIn"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorInMain)"
                        animationDuration={0}
                    />
                    <Area
                        type="monotone"
                        dataKey="bytesOut"
                        stroke="#a855f7"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorOutMain)"
                        animationDuration={0}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export function MonitoringGraphs() {
    const { data: monitoredDevices = [] } = trpc.snmp.listMonitoredDevices.useQuery(undefined, { refetchInterval: 10000 });
    const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
    const [selectedInterface, setSelectedInterface] = useState<{ device: any, index: number, description?: string } | null>(null);
    const [viewFullMetrics, setViewFullMetrics] = useState<any | null>(null);

    // Auto-select first device if none selected
    useEffect(() => {
        if (!selectedDevice && monitoredDevices.length > 0) {
            setSelectedDevice(monitoredDevices[0]);
        } else if (selectedDevice) {
            // Keep selection updated with fresh data
            const updated = monitoredDevices.find((d: any) => d.ip === selectedDevice.ip);
            if (updated) setSelectedDevice(updated);
        }
    }, [monitoredDevices, selectedDevice]);



    const hasAgentData = selectedDevice?.hasAgent === true;

    return (
        <div className="flex flex-col gap-6 h-full min-h-[700px] w-full">
            {/* Header: Device Selector & Info */}
            <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 text-main">
                    <Cloud className="w-32 h-32" />
                </div>

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full lg:w-auto">
                        {/* Custom Dropdown/Combobox */}
                        <div className="relative w-full md:w-80 group/dropdown">
                            <div className="absolute -top-6 left-0 flex items-center gap-2">
                                <span className="text-[10px] font-black text-main/40 uppercase tracking-widest italic">Monitoramento de:</span>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-main z-20" />
                                <select
                                    value={selectedDevice?.ip || ''}
                                    onChange={(e) => {
                                        const dev = monitoredDevices.find((d: any) => d.ip === e.target.value);
                                        if (dev) setSelectedDevice(dev);
                                    }}
                                    className="w-full pl-12 pr-10 py-4 bg-card/50 border border-border rounded-2xl text-base font-black italic text-main appearance-none focus:outline-none focus:border-primary/50 transition-all cursor-pointer shadow-inner uppercase tracking-tighter"
                                >
                                    {monitoredDevices.map((device: any) => (
                                        <option key={device.ip} value={device.ip} className="bg-card text-main">
                                            {device.name || device.deviceName} ({device.ip})
                                        </option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/70 rotate-90 pointer-events-none" />
                            </div>
                        </div>

                        {selectedDevice && (
                            <div className="flex items-center gap-4 border-l border-border pl-6">
                                <div className={`w-3 h-3 rounded-full animate-pulse ${selectedDevice.status === 'up' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'}`} />
                                <div className="flex flex-col">
                                    <span className="text-xl font-black text-main italic uppercase tracking-tighter leading-none">
                                        {selectedDevice.status === 'up' ? 'Conectado' : 'Desconectado'}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-main/40 mt-1 uppercase tracking-widest">
                                        Resposta: {selectedDevice.status === 'up' ? 'Online' : 'Visto por último: Recentemente'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 w-full lg:w-auto mt-4 lg:mt-0">
                        {hasAgentData && (
                            <button
                                onClick={() => setViewFullMetrics(selectedDevice)}
                                className="w-full lg:w-auto px-8 py-5 bg-accent hover:bg-accent text-white rounded-2xl font-black uppercase tracking-[0.15em] text-xs flex items-center justify-center gap-3 shadow-2xl shadow-accent/20 transition-all active:scale-95 group"
                            >
                                <BarChart3 className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Gráficos de Hardware (Agente)
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content: Graphs & Details */}
            <main className="flex-1 space-y-6">
                {selectedDevice ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        {/* Metrics Grid - Only shown if agent data is available */}
                        {hasAgentData && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* CPU Card */}
                                <MetricCard
                                    label="Processamento (CPU)"
                                    value={selectedDevice.latest?.cpu ? `${selectedDevice.latest.cpu.toFixed(1)}%` : '0.0%'}
                                    icon={<Cpu size={20} />}
                                    color="primary"
                                />
                                {/* RAM Card */}
                                <MetricCard
                                    label="Memoria (RAM)"
                                    value={selectedDevice.latest?.ram ? `${selectedDevice.latest.ram.toFixed(1)}%` : '0.0%'}
                                    icon={<Activity size={20} />}
                                    color="accent"
                                />
                                {/* Disc Card */}
                                <MetricCard
                                    label="Armazenamento"
                                    value={selectedDevice.latest?.disks ? `${Object.keys(selectedDevice.latest.disks).length} Unidades` : '0 Unidades'}
                                    icon={<HardDrive size={20} />}
                                    color="secondary"
                                />
                            </div>
                        )}

                        {/* Interfaces Section */}
                        <div className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl">
                            <h3 className="text-xl font-black text-main mb-8 flex items-center gap-3 italic tracking-tight">
                                <Zap className="w-6 h-6 text-accent" /> Tráfego de Interfaces (SNMP)
                            </h3>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {selectedDevice.interfaceDetails?.filter((i: any) => i.enabled === true).map((iface: any) => (
                                    <div
                                        key={iface.index}
                                        onClick={() => setSelectedInterface({ device: selectedDevice, index: iface.index, description: iface.alias || iface.name })}
                                        className="bg-card/50 border border-border p-6 rounded-[2rem] hover:border-primary/40 hover:bg-card transition-all cursor-pointer group flex flex-col gap-6"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-black text-main italic text-base uppercase group-hover:text-main transition-colors truncate">
                                                    {iface.alias || iface.name}
                                                </span>
                                                {iface.alias && iface.alias !== iface.name && (
                                                    <span className="text-[10px] text-main font-black uppercase truncate mt-0.5 opacity-80 decoration-primary/30 underline-offset-2">
                                                        {iface.name}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-main/40 font-bold uppercase tracking-widest mt-1">
                                                    IDX: {iface.index} {iface.speed ? `| ${(Number(iface.speed) / 1000 / 1000).toFixed(0)} Mbps` : ''}
                                                </span>
                                            </div>
                                            <div className={`p-2.5 rounded-xl ${iface.status === 'up' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                <Activity className={`w-4 h-4 ${iface.status === 'up' ? 'animate-pulse' : ''}`} />
                                            </div>
                                        </div>

                                        <div className="h-48 relative">
                                            <TrafficChart
                                                inData={iface.latest?.historyIn || []}
                                                outData={iface.latest?.historyOut || []}
                                            />
                                        </div>

                                        <div className="flex justify-between items-center pt-4 border-t border-border mt-auto">
                                            <div className="flex gap-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-main/30 uppercase tracking-widest mb-1">Entrada (Rx)</span>
                                                    <span className="text-xl font-mono font-black text-main italic">
                                                        {((iface.latest?.in || 0) * 8 / 1000 / 1000).toFixed(2)} <span className="text-[10px]">Mbps</span>
                                                    </span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-main/30 uppercase tracking-widest mb-1">Saída (Tx)</span>
                                                    <span className="text-xl font-mono font-black text-accent italic">
                                                        {((iface.latest?.out || 0) * 8 / 1000 / 1000).toFixed(2)} <span className="text-[10px]">Mbps</span>
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${iface.status === 'up' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-red-500 text-white'}`}>
                                                    {iface.status?.toUpperCase()}
                                                </span>
                                                <span className="text-[9px] font-black text-main group-hover:translate-x-1 transition-transform uppercase italic flex items-center gap-1">
                                                    Analisar Detalhadamente <ChevronRight size={12} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {(!selectedDevice.interfaceDetails || selectedDevice.interfaceDetails.filter((i: any) => i.enabled === true).length === 0) && (
                                    <div className="col-span-full py-16 px-10 bg-card/50 border border-dashed border-border rounded-[2rem] text-center space-y-4">
                                        <TrendingUp className="w-12 h-12 text-main/20 mx-auto opacity-20" />
                                        <div>
                                            <p className="text-main/40 font-bold italic uppercase tracking-widest">Sem tráfego SNMP registrado</p>
                                            <p className="text-xs text-main/30 max-w-xs mx-auto mt-2 italic font-medium">Habilite o monitoramento de interfaces na aba "Devices" para habilitar estes gráficos.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 bg-card border border-border rounded-[3rem] shadow-xl space-y-6 text-center">
                        <div className="p-8 bg-card/50 rounded-[2.5rem] text-main/40">
                            <TrendingUp className="w-20 h-20" />
                        </div>
                        <div className="max-w-md">
                            <h3 className="text-2xl font-black text-main italic tracking-tighter uppercase mb-4">Escolha um Dispositivo</h3>
                            <p className="text-main/40 text-sm italic font-medium">
                                Selecione um dispositivo monitorado na lista lateral para visualizar suas métricas de desempenho e gráficos de tráfego em tempo real.
                            </p>
                        </div>
                    </div>
                )}
            </main>

            {/* Modals Integration */}
            {selectedInterface && (
                <InterfaceTrafficModal
                    device={selectedInterface.device}
                    interfaceIndex={selectedInterface.index}
                    interfaceDescription={selectedInterface.description}
                    onClose={() => setSelectedInterface(null)}
                />
            )}

            {viewFullMetrics && (
                <DeviceMetricsModal
                    device={{
                        ...viewFullMetrics,
                        id: viewFullMetrics.id || viewFullMetrics.ip,
                        name: viewFullMetrics.deviceName || viewFullMetrics.name
                    }}
                    onClose={() => setViewFullMetrics(null)}
                />
            )}
        </div>
    );
}

function MetricCard({ label, value, icon, color }: any) {
    const colorClasses: any = {
        primary: 'text-main bg-primary/10 border-primary/20',
        accent: 'text-accent bg-accent/10 border-accent/20',
        secondary: 'text-secondary bg-secondary/10 border-secondary/20',
    };

    return (
        <div className="bg-card border border-border p-8 rounded-[2rem] shadow-lg group hover:border-primary/30 transition-all">
            <div className="flex items-center gap-4 mb-3">
                <div className={`p-3 rounded-2xl ${colorClasses[color]} group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                <span className="text-[10px] font-black text-main/40 uppercase tracking-widest">{label}</span>
            </div>
            <div className="text-3xl font-black text-main italic tracking-tighter">{value}</div>
        </div>
    );
}
