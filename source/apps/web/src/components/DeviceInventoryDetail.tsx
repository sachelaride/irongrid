import { useState } from 'react';
import { trpc } from '../utils/trpc';
import {
    Cpu, HardDrive, Layout, Package, Shield, MapPin, Building, User,
    DollarSign, TrendingUp, Usb, ShieldCheck, ShieldAlert, ShieldOff,
    BarChart3, Clock, AlertTriangle, CheckCircle2, XCircle, Lock, Unlock
} from 'lucide-react';

interface DeviceInventoryDetailProps {
    deviceId: string;
    onClose: () => void;
}

export function DeviceInventoryDetail({ deviceId, onClose }: DeviceInventoryDetailProps) {
    const { data: device, isLoading } = (trpc as any).inventory.getDeviceInventory.useQuery({ deviceId });
    const { data: appUsage } = (trpc as any).reports.getAppUsageReport.useQuery({ deviceId, days: 7 });
    const usbControl = (trpc as any).action.usbControl.useMutation();

    const [usbFeedback, setUsbFeedback] = useState<{ type: 'success' | 'error' | 'pending'; msg: string } | null>(null);

    if (isLoading) return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-accent font-bold animate-pulse">Carregando inventário...</p>
            </div>
        </div>
    );
    if (!device) return (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center">
            <div className="text-red-400 font-bold">Ativo não encontrado.</div>
        </div>
    );

    const hw = device.hardware;
    const security = device.security;
    const agentConnected = device.status === 'ONLINE' && device.agentId;

    const handleUsb = async (command: 'block' | 'unblock') => {
        setUsbFeedback({ type: 'pending', msg: command === 'block' ? 'Bloqueando portas USB...' : 'Desbloqueando portas USB...' });
        try {
            await usbControl.mutateAsync({ deviceId, command });
            setUsbFeedback({ type: 'success', msg: command === 'block' ? 'Portas USB bloqueadas com sucesso!' : 'Portas USB desbloqueadas com sucesso!' });
        } catch (e: any) {
            setUsbFeedback({ type: 'error', msg: e.message || 'Erro ao executar comando.' });
        }
        setTimeout(() => setUsbFeedback(null), 4000);
    };

    const avStatusColor = () => {
        const s = security?.avStatus?.toLowerCase() || '';
        if (s.includes('desatualizado')) return 'text-amber-400';
        if (s.includes('inativo') || s.includes('erro')) return 'text-red-400';
        if (s.includes('ativo')) return 'text-emerald-400';
        return 'text-secondary/70';
    };

    const AvIcon = () => {
        const s = security?.avStatus?.toLowerCase() || '';
        if (s.includes('desatualizado')) return <ShieldAlert className="w-5 h-5 text-amber-400" />;
        if (s.includes('inativo') || s.includes('erro')) return <ShieldOff className="w-5 h-5 text-red-400" />;
        if (s.includes('ativo')) return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
        return <Shield className="w-5 h-5 text-secondary/70" />;
    };

    const maxUsage = appUsage?.[0]?.totalMinutes || 1;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:p-12 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

                {/* Header */}
                <div className="p-8 border-b border-slate-800 flex justify-between items-start bg-gradient-to-r from-accent/10 to-transparent flex-shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-white shadow-xl shadow-accent/20">
                            <Cpu className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{device.name || device.hostname}</h2>
                            <div className="flex items-center gap-4 text-secondary/70 text-sm mt-1">
                                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-accent">{device.ipAddress}</span>
                                <span>•</span>
                                <span className="uppercase font-bold">{device.type}</span>
                                <span>•</span>
                                <span className={`font-bold ${device.status === 'ONLINE' ? 'text-emerald-500' : 'text-red-400'}`}>{device.status}</span>
                                {agentConnected && (
                                    <>
                                        <span>•</span>
                                        <span className="text-xs bg-accent/20 text-accent border border-accent/40 rounded-full px-2 py-0.5 font-bold">AGENTE ONLINE</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button id="close-inventory-detail" onClick={onClose} className="p-4 text-secondary hover:text-white transition-colors rounded-xl hover:bg-slate-800">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* --- SIDEBAR --- */}
                    <div className="lg:col-span-4 space-y-5">

                        {/* Hardware */}
                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 space-y-4">
                            <h3 className="text-[10px] font-black text-accent uppercase tracking-widest italic border-b border-slate-800 pb-2">Hardware Summary</h3>
                            <SpecItem icon={Cpu} label="Processador" value={hw?.cpuModel || 'Desconhecido'} />
                            <SpecItem icon={Layout} label="Memória RAM" value={hw?.totalMemory ? `${(Number(hw.totalMemory) / (1024 ** 3)).toFixed(1)} GB` : 'N/A'} />
                            <SpecItem icon={HardDrive} label="Armazenamento" value={hw?.totalDisk ? `${(Number(hw.totalDisk) / (1024 ** 3)).toFixed(1)} GB` : 'N/A'} />
                            <SpecItem icon={Cpu} label="Placa de Vídeo" value={hw?.gpuModel || 'Integrada'} />
                            <SpecItem icon={Shield} label="Placa-mãe" value={hw?.motherboard || 'N/A'} subValue={`S/N: ${hw?.serialNumber || '-'}`} />
                        </div>

                        {/* Security Panel */}
                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-emerald-500/20 space-y-4">
                            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic border-b border-white/5 pb-2 flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3" /> Segurança
                            </h3>

                            {/* Antivírus */}
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Antivírus</p>
                                <div className="flex items-center gap-2">
                                    <AvIcon />
                                    <div>
                                        <p className="text-xs text-white font-bold">{security?.av || 'Desconhecido'}</p>
                                        <p className={`text-[10px] font-bold ${avStatusColor()}`}>{security?.avStatus || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* USB Control */}
                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                                    <Usb className="w-3 h-3" /> Controle de USB
                                </p>
                                <div className="flex items-center gap-2">
                                    {security?.usbBlocked ? (
                                        <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
                                            <Lock className="w-3 h-3" /> Bloqueado
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                                            <Unlock className="w-3 h-3" /> Liberado
                                        </span>
                                    )}
                                </div>

                                {agentConnected && (
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            id="btn-usb-block"
                                            onClick={() => handleUsb('block')}
                                            disabled={usbControl.isLoading}
                                            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-black py-1.5 px-3 rounded-xl bg-red-600/20 text-red-400 border border-red-600/40 hover:bg-red-600/40 transition-all disabled:opacity-50"
                                        >
                                            <Lock className="w-3 h-3" /> Bloquear
                                        </button>
                                        <button
                                            id="btn-usb-unblock"
                                            onClick={() => handleUsb('unblock')}
                                            disabled={usbControl.isLoading}
                                            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-black py-1.5 px-3 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 hover:bg-emerald-600/40 transition-all disabled:opacity-50"
                                        >
                                            <Unlock className="w-3 h-3" /> Liberar
                                        </button>
                                    </div>
                                )}

                                {usbFeedback && (
                                    <div className={`flex items-center gap-1.5 text-[10px] font-bold rounded-xl px-3 py-2 ${
                                        usbFeedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                        usbFeedback.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                                        'bg-accent/10 text-accent border border-accent/30'
                                    }`}>
                                        {usbFeedback.type === 'success' && <CheckCircle2 className="w-3 h-3" />}
                                        {usbFeedback.type === 'error' && <AlertTriangle className="w-3 h-3" />}
                                        {usbFeedback.type === 'pending' && <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
                                        {usbFeedback.msg}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Organizacional */}
                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 space-y-4">
                            <h3 className="text-[10px] font-black text-secondary/70 uppercase tracking-widest italic border-b border-slate-800 pb-2">Organizacional</h3>
                            <SpecItem icon={MapPin} label="Localização" value={device.location?.name || 'Geral'} />
                            <SpecItem icon={Building} label="Departamento" value={device.departmentRef?.name || device.department || 'Não Atribuído'} />
                            <SpecItem icon={User} label="Responsável" value={device.assignedUser?.name || 'Não Atribuído'} />
                        </div>

                        {/* Financeiro */}
                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-accent/20 space-y-4">
                            <h3 className="text-[10px] font-black text-accent uppercase tracking-widest italic border-b border-white/5 pb-2">Resumo Financeiro</h3>
                            <SpecItem
                                icon={DollarSign}
                                label="Valor de Aquisição"
                                value={device.purchaseValue ? device.purchaseValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                            />
                            <SpecItem
                                icon={TrendingUp}
                                label="Total Manutenção"
                                value={device.maintenanceRecords?.reduce((acc: number, r: any) => acc + (r.cost || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                                subValue={`${device.maintenanceRecords?.length || 0} intervenções`}
                            />
                        </div>
                    </div>

                    {/* --- MAIN CONTENT --- */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* Top 10 Apps */}
                        {appUsage && appUsage.length > 0 && (
                            <section>
                                <div className="flex items-center gap-3 mb-4">
                                    <BarChart3 className="w-5 h-5 text-purple-400" />
                                    <h3 className="text-lg font-black text-white italic">Top Apps (Últimos 7 dias)</h3>
                                </div>
                                <div className="bg-slate-950/50 rounded-3xl border border-purple-500/20 p-5 space-y-3">
                                    {appUsage.map((app: any, i: number) => (
                                        <div key={app.appName} className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-purple-500 w-5">{i + 1}.</span>
                                                    <span className="text-xs text-slate-200 font-bold truncate max-w-[280px]">{app.appName}</span>
                                                </div>
                                                <span className="text-[10px] text-secondary/70 flex items-center gap-1 ml-2 flex-shrink-0">
                                                    <Clock className="w-3 h-3" />{app.totalMinutes}min
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-700"
                                                    style={{
                                                        width: `${Math.min((app.totalMinutes / maxUsage) * 100, 100)}%`,
                                                        background: `hsl(${270 - i * 15}, 70%, 55%)`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Software List */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Package className="w-5 h-5 text-accent" />
                                    <h3 className="text-lg font-black text-white italic">
                                        Softwares Instalados
                                        <span className="ml-2 text-sm text-secondary font-normal">({device.software?.length || 0})</span>
                                    </h3>
                                </div>
                            </div>
                            <div className="bg-slate-950/50 rounded-3xl border border-slate-800 overflow-hidden">
                                <div className="max-h-80 overflow-y-auto">
                                    <table className="w-full text-left text-[10px]">
                                        <thead className="bg-slate-800/50 text-secondary uppercase font-black sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3">Nome</th>
                                                <th className="px-4 py-3">Versão</th>
                                                <th className="px-4 py-3">Publicador</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {device.software?.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-600 italic">
                                                        Nenhum software detectado. Aguardando próximo inventário do agente.
                                                    </td>
                                                </tr>
                                            )}
                                            {device.software?.map((sw: any) => (
                                                <tr key={sw.id} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-4 py-2 text-slate-200 font-bold">{sw.name}</td>
                                                    <td className="px-4 py-2 text-secondary/70">{sw.version}</td>
                                                    <td className="px-4 py-2 text-secondary italic">{sw.publisher}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>

                        {/* Periféricos & Interfaces */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <section className="space-y-3">
                                <h3 className="text-sm font-black text-white italic flex items-center gap-2">
                                    <Usb className="w-4 h-4 text-secondary/70" /> Periféricos
                                </h3>
                                <div className="space-y-2">
                                    {device.peripherals?.map((p: any) => (
                                        <div key={p.id} className="p-3 bg-slate-800/30 border border-slate-800 rounded-xl flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-300">{p.type} • {p.model}</span>
                                            <span className="text-[8px] text-slate-600 font-mono">{p.serialNumber}</span>
                                        </div>
                                    ))}
                                    {device.peripherals?.length === 0 && <p className="text-slate-600 italic text-xs">Nenhum periférico detectado.</p>}
                                </div>
                            </section>

                            <section className="space-y-3">
                                <h3 className="text-sm font-black text-white italic">Interfaces de Rede</h3>
                                <div className="space-y-2">
                                    {device.networkInterfaces?.map((i: any) => (
                                        <div key={i.id} className="p-3 bg-slate-800/30 border border-slate-800 rounded-xl">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black text-accent uppercase">{i.name}</span>
                                                <span className={`text-[8px] font-bold ${i.status === 'up' ? 'text-emerald-500' : 'text-secondary'}`}>{i.status}</span>
                                            </div>
                                            <p className="text-[8px] font-mono text-slate-600">{i.macAddress} • {(Number(i.speed) / 10 ** 6).toFixed(0)} Mbps</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

function SpecItem({ icon: Icon, label, value, subValue }: any) {
    return (
        <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-slate-600 flex-shrink-0">
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-xs text-white font-bold tracking-tight">{value}</p>
                {subValue && <p className="text-[9px] text-secondary font-mono italic mt-0.5">{subValue}</p>}
            </div>
        </div>
    );
}
