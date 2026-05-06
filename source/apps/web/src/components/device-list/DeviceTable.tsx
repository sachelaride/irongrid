import { useState } from 'react';
import {
    ChevronUp,
    ChevronDown,
    Activity,
    MonitorSmartphone,
    Trash2,
    Database,
    Loader2,
    Camera,
    RotateCcw,
    Copy,
    Phone,
    Server, Laptop, Printer, Wifi, Shield, Globe, HardDrive, Radio
} from 'lucide-react';
import { NetAccessModal } from './NetAccessModal';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

const TypeIcon = ({ type }: { type: string }) => {
    switch (type?.toLowerCase()) {
        case 'server': return <Server className="h-4 w-4" />;
        case 'workstation':
        case 'pc':
        case 'computer': return <Laptop className="h-4 w-4" />;
        case 'printer': return <Printer className="h-4 w-4" />;
        case 'switch': return <Wifi className="h-4 w-4" />;
        case 'firewall': return <Shield className="h-4 w-4" />;
        case 'router': return <Globe className="h-4 w-4" />;
        case 'database': return <Database className="h-4 w-4" />;
        case 'voip': return <Phone className="h-4 w-4" />;
        case 'nas': return <HardDrive className="h-4 w-4" />;
        case 'camera': return <Camera className="h-4 w-4" />;
        case 'access_point': return <Radio className="h-4 w-4" />;
        default: return <Server className="h-4 w-4" />;
    }
};

interface DeviceTableProps {
    devices: any[];
    selectedIds: string[];
    visibleColumns: string[];
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    toggleSelect: (id: string) => void;
    handleSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
    toggleSort: (field: string) => void;
    toggleMonitoring: any;
    setRequestAgentId: (id: string) => void;
    setManagingDevice: (device: any) => void;
    setMetricsDevice: (device: any) => void;
    setEditingDevice: (device: any) => void;
    handleDelete: (device: any) => void;
    onOpenInventory?: (id: string) => void;
}

export function DeviceTable({
    devices,
    selectedIds,
    visibleColumns,
    sortBy,
    sortOrder,
    toggleSelect,
    handleSelectAll,
    toggleSort,
    toggleMonitoring,
    setRequestAgentId,
    setManagingDevice,
    setMetricsDevice,
    setEditingDevice,
    handleDelete,
    onOpenInventory,
}: DeviceTableProps) {

    const [netAccessDevice, setNetAccessDevice] = useState<any>(null);
    const [netAccessRect, setNetAccessRect] = useState<DOMRect | null>(null);

    const NETWORK_TYPES = ['switch', 'firewall', 'router', 'access_point'];

    const SortIcon = ({ field }: { field: string }) => {
        if (sortBy !== field) return <div className="w-4 h-4 opacity-0 group-hover:opacity-30"><ChevronUp className="h-4 w-4" /></div>;
        return sortOrder === 'asc'
            ? <ChevronUp className="h-4 w-4 text-accent" />
            : <ChevronDown className="h-4 w-4 text-accent" />;
    };

    const getMissingFields = (device: any) => {
        const missing: string[] = [];
        if (!device.name) missing.push('Nome');
        if (!device.department) missing.push('Departamento');
        if (!device.type || device.type.toLowerCase() === 'other') missing.push('Tipo');
        if (device.parentId && !device.parentPort) missing.push('Porta do Switch');
        if (!device.snmpCommunityId && !device.isMonitored) missing.push('Comunidade SNMP');
        return missing;
    };

    const isDeviceComplete = (device: any) => getMissingFields(device).length === 0;

    return (
        <>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl mt-4">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-page/80 text-secondary font-medium border-b border-border">
                            <tr>
                                {/* Checkbox */}
                                <th className="px-2 py-4 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === devices.length && devices.length > 0}
                                        onChange={handleSelectAll}
                                        className="h-4 w-4 rounded border-border bg-page text-main focus:ring-primary mx-auto block"
                                    />
                                </th>
                                {/* Graphs / monitoring toggle */}
                                {visibleColumns.includes('graphs') && (
                                    <th className="px-2 py-4 w-10 text-center" title="Ative para visualizar CPU, RAM e Rede">
                                        <div className="flex items-center justify-center gap-1">
                                            <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
                                        </div>
                                    </th>
                                )}
                                {/* IPAM Status */}
                                {visibleColumns.includes('ipamStatus') && (
                                    <th className="px-2 py-4 w-10 text-center">
                                        <div className="text-main font-black uppercase tracking-widest text-[10px] opacity-90">Status</div>
                                    </th>
                                )}
                                {/* Name */}
                                {visibleColumns.includes('name') && (
                                    <th onClick={() => toggleSort('name')} className="px-6 py-4 cursor-pointer hover:text-main transition-colors group">
                                        <div className="flex items-center gap-2 text-main font-black uppercase tracking-widest text-[10px] opacity-90">Nome <SortIcon field="name" /></div>
                                    </th>
                                )}
                                {/* IP */}
                                {visibleColumns.includes('ip') && (
                                    <th onClick={() => toggleSort('ip')} className="px-6 py-4 cursor-pointer hover:text-main transition-colors group">
                                        <div className="flex items-center gap-2 text-main font-black uppercase tracking-widest text-[10px] opacity-90">IP Address <SortIcon field="ip" /></div>
                                    </th>
                                )}
                                {/* Hostname */}
                                {visibleColumns.includes('hostname') && (
                                    <th onClick={() => toggleSort('hostname')} className="px-6 py-4 cursor-pointer hover:text-main transition-colors group">
                                        <div className="flex items-center gap-2 text-main font-black uppercase tracking-widest text-[10px] opacity-90">Hostname <SortIcon field="hostname" /></div>
                                    </th>
                                )}
                                {/* Asset Number */}
                                {visibleColumns.includes('assetNumber') && (
                                    <th onClick={() => toggleSort('assetNumber')} className="px-6 py-4 cursor-pointer hover:text-main transition-colors group">
                                        <div className="flex items-center gap-2 text-main font-black uppercase tracking-widest text-[10px] opacity-90">Patrimônio <SortIcon field="assetNumber" /></div>
                                    </th>
                                )}
                                {/* MAC */}
                                {visibleColumns.includes('macAddress') && (
                                    <th onClick={() => toggleSort('macAddress')} className="px-6 py-4 cursor-pointer hover:text-main transition-colors group">
                                        <div className="flex items-center gap-2 text-main font-black uppercase tracking-widest text-[10px] opacity-90">MAC Address <SortIcon field="macAddress" /></div>
                                    </th>
                                )}
                                {/* Type */}
                                {visibleColumns.includes('type') && (
                                    <th onClick={() => toggleSort('tipo')} className="px-6 py-4 cursor-pointer hover:text-main transition-colors group">
                                        <div className="flex items-center gap-2 text-main font-black uppercase tracking-widest text-[10px] opacity-90">Tipo / Modelo <SortIcon field="tipo" /></div>
                                    </th>
                                )}
                                {/* Department */}
                                {visibleColumns.includes('department') && (
                                    <th onClick={() => toggleSort('departamento')} className="px-6 py-4 cursor-pointer hover:text-main transition-colors group">
                                        <div className="flex items-center gap-2 text-main font-black uppercase tracking-widest text-[10px] opacity-90">Departamento <SortIcon field="departamento" /></div>
                                    </th>
                                )}
                                {/* Location */}
                                {visibleColumns.includes('location') && (
                                    <th onClick={() => toggleSort('location')} className="px-6 py-4 cursor-pointer hover:text-main transition-colors group">
                                        <div className="flex items-center gap-2 text-main font-black uppercase tracking-widest text-[10px] opacity-90">Localização <SortIcon field="location" /></div>
                                    </th>
                                )}
                                {/* Connected To */}
                                {visibleColumns.includes('connectedTo') && (
                                    <th className="px-6 py-4 text-main font-black uppercase tracking-widest text-[10px] opacity-90">Conectado em</th>
                                )}
                                {/* Actions */}
                                <th className="px-6 py-4 text-right text-main font-black uppercase tracking-widest text-[10px] opacity-90">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {devices.map((device: any) => (
                                <tr
                                    key={device.id}
                                    className={`group hover:bg-page/50 transition-colors ${selectedIds.includes(device.id) ? 'bg-primary/5' : ''}`}
                                >
                                    {/* Checkbox */}
                                    <td className="px-2 py-3 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(device.id)}
                                            onChange={() => toggleSelect(device.id)}
                                            className="h-4 w-4 rounded border-border bg-page text-main focus:ring-primary mx-auto block"
                                        />
                                    </td>

                                    {/* Monitoring toggle */}
                                    {visibleColumns.includes('graphs') && (
                                        <td className="px-2 py-3 w-10 text-center">
                                            <button
                                                onClick={() => toggleMonitoring.mutate({ ip: device.ip, enabled: !device.isMonitored })}
                                                disabled={toggleMonitoring.isPending && toggleMonitoring.variables?.ip === device.ip}
                                                title={device.isMonitored
                                                    ? 'Monitoramento ATIVO - Clique para desativar'
                                                    : 'Clique para ATIVAR monitoramento (CPU, RAM, Rede)'}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer mx-auto ${device.isMonitored
                                                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500'
                                                    : 'bg-red-500/20 hover:bg-red-500/30 border border-red-500'}`}
                                            >
                                                {toggleMonitoring.isPending && toggleMonitoring.variables?.ip === device.ip
                                                    ? <Loader2 className="w-4 h-4 animate-spin text-secondary/70" />
                                                    : <Activity className={`w-4 h-4 ${device.isMonitored ? 'text-emerald-400' : 'text-red-400'}`} />
                                                }
                                            </button>
                                        </td>
                                    )}

                                    {/* IPAM Status */}
                                    {visibleColumns.includes('ipamStatus') && (
                                        <td className="px-2 py-3 w-10 text-center">
                                            {device.ipamStatus === 'USED' && (
                                                <div title="IP Ocupado no IPAM" className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/20 border border-red-500 text-red-400 font-black text-xs mx-auto">O</div>
                                            )}
                                            {device.ipamStatus === 'RESERVED' && (
                                                <div title="IP Reservado no IPAM" className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/20 border border-accent text-accent font-black text-xs mx-auto">R</div>
                                            )}
                                            {device.ipamStatus === 'AVAILABLE' && (
                                                <div title="IP Livre no IPAM" className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/20 border border-emerald-500 text-emerald-400 font-black text-xs mx-auto">L</div>
                                            )}
                                        </td>
                                    )}

                                    {/* Name */}
                                    {visibleColumns.includes('name') && (
                                        <td className="px-6 py-3 min-w-[220px]">
                                            <div className="flex items-center gap-2">
                                                {/* Online/offline status badge */}
                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${device.status === 'online'
                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                                    {device.status}
                                                </div>

                                                {/* Remote access (agent) - Only for non-network devices */}
                                                {device.agentId && !NETWORK_TYPES.includes(device.type?.toLowerCase()) && (
                                                    <button
                                                        onClick={() => setRequestAgentId(device.agentId)}
                                                        className="p-1 text-main hover:bg-primary/10 rounded-lg transition-colors relative group/btn shrink-0"
                                                        title="Remote Control (Agente)"
                                                    >
                                                        <MonitorSmartphone className="h-3.5 w-3.5" />
                                                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card text-main text-[9px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity border border-border whitespace-nowrap shadow-xl z-50">Remote Control</span>
                                                    </button>
                                                )}

                                                {/* Network access (HTTP / Telnet) for switches, firewalls, etc. */}
                                                {NETWORK_TYPES.includes(device.type?.toLowerCase()) && (
                                                    <button
                                                        onClick={(e) => {
                                                            setNetAccessDevice(device);
                                                            setNetAccessRect(e.currentTarget.getBoundingClientRect());
                                                        }}
                                                        className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors relative group/net shrink-0"
                                                        title="Abrir via HTTP / HTTPS / Telnet"
                                                    >
                                                        <Globe className="h-3.5 w-3.5" />
                                                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card text-main text-[9px] px-2 py-1 rounded opacity-0 group-hover/net:opacity-100 transition-opacity border border-border whitespace-nowrap shadow-xl z-50">Web / Telnet</span>
                                                    </button>
                                                )}

                                                {/* Name + meta */}
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span
                                                            title={`${device.name || device.ip}${!isDeviceComplete(device) ? ` (Pendente: ${getMissingFields(device).join(', ')})` : ''}`}
                                                            className={`font-bold cursor-help truncate ${isDeviceComplete(device) ? 'text-emerald-500 dark:text-emerald-400' : 'text-main'}`}
                                                        >
                                                            {(device.name || device.ip).length > 15 
                                                                ? (device.name || device.ip).substring(0, 15) + '...' 
                                                                : (device.name || device.ip)}
                                                        </span>
                                                        {device.hasWebcam && <span title="Webcam"><Camera className="w-3 h-3 text-emerald-400 shrink-0" /></span>}
                                                        {device.voipExtension && (
                                                            <span title={`Ramal: ${device.voipExtension}`} className="flex items-center gap-0.5 bg-accent/10 px-1.5 py-0.5 rounded text-[9px] text-accent font-bold border border-accent/20 shrink-0">
                                                                <Phone className="w-2.5 h-2.5" />{device.voipExtension}
                                                            </span>
                                                        )}
                                                        {device.status === 'offline' && device.offlineSince && (
                                                            <span className="text-[9px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded border border-red-500/20 font-black shrink-0">
                                                                {Math.max(1, Math.floor((Date.now() - new Date(device.offlineSince).getTime()) / 86400000))}d
                                                            </span>
                                                        )}
                                                    </div>
                                                    {device.hostname && device.hostname !== (device.name || '').toLowerCase() && (
                                                        <span className="text-[10px] text-secondary font-mono truncate">{device.hostname}</span>
                                                    )}
                                                    {device.lastBoot && (
                                                        <div className="flex items-center gap-1 text-[9px] text-secondary">
                                                            <RotateCcw className="w-2.5 h-2.5" />
                                                            <span>{formatDistanceToNow(new Date(device.lastBoot), { addSuffix: true, locale: ptBR })}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    )}

                                    {/* IP */}
                                    {visibleColumns.includes('ip') && (
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1 px-2 bg-page border border-border rounded text-xs font-mono text-main group-hover:border-primary/50 transition-colors">
                                                    {device.ip}
                                                </span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(device.ip)}
                                                    className="p-1 text-secondary hover:text-main transition-colors"
                                                    title="Copiar IP"
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </td>
                                    )}

                                    {/* Hostname */}
                                    {visibleColumns.includes('hostname') && (
                                        <td className="px-6 py-3 text-xs text-secondary font-mono">{device.hostname || '-'}</td>
                                    )}

                                    {/* Asset Number */}
                                    {visibleColumns.includes('assetNumber') && (
                                        <td className="px-6 py-3">
                                            <span className="text-xs text-secondary font-bold bg-page border border-border px-2 py-1 rounded">
                                                {device.assetNumber || '-'}
                                            </span>
                                        </td>
                                    )}

                                    {/* MAC */}
                                    {visibleColumns.includes('macAddress') && (
                                        <td className="px-6 py-3 text-xs text-secondary font-mono uppercase tracking-wider">
                                            {device.macAddress || device.mac || '-'}
                                        </td>
                                    )}

                                    {/* Type */}
                                    {visibleColumns.includes('type') && (
                                        <td className="px-6 py-3 min-w-[140px]">
                                            <div className="flex items-center gap-2 text-secondary">
                                                <TypeIcon type={device.type} />
                                                <div className="flex flex-col text-[12px]">
                                                    <span className="capitalize font-bold">{device.type}</span>
                                                    {device.model && (
                                                        <span 
                                                            className="text-[10px] text-secondary italic cursor-help"
                                                            title={device.model}
                                                        >
                                                            {device.model.length > 15 ? device.model.substring(0, 15) + '...' : device.model}
                                                        </span>
                                                    )}
                                                    {device.hardware && (
                                                        <span className="text-[9px] text-secondary/70 font-medium leading-tight">
                                                            {device.hardware.cpuModel && <>{device.hardware.cpuModel.split(' ')[0]} | </>}
                                                            {device.hardware.totalMemory && <>{Math.round(Number(device.hardware.totalMemory) / (1024 ** 3))}GB RAM | </>}
                                                            {device.hardware.totalDisk && <>{Math.round(Number(device.hardware.totalDisk) / (1024 ** 3))}GB Disk</>}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    )}

                                    {/* Department */}
                                    {visibleColumns.includes('department') && (
                                        <td className="px-6 py-3">
                                            <span className="text-xs text-secondary font-medium">{device.department || '-'}</span>
                                        </td>
                                    )}

                                    {/* Location */}
                                    {visibleColumns.includes('location') && (
                                        <td className="px-6 py-3 text-secondary font-bold text-[11px] uppercase tracking-tight">
                                            {typeof device.location === 'string' ? device.location : (device.location?.name || 'Geral')}
                                        </td>
                                    )}

                                    {/* Connected To */}
                                    {visibleColumns.includes('connectedTo') && (
                                        <td className="px-6 py-3">
                                            {device.parentId ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-main">{device.parentName || device.parentDevice?.name}</span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[9px] text-secondary font-mono bg-page border border-border px-1.5 rounded">{device.parentIp || device.parentDevice?.ipAddress}</span>
                                                        <span className="text-[9px] text-main font-black">P: {device.parentPort || device.connectedPort || '-'}</span>
                                                        {device.portSpeed && <span className="text-[10px] font-bold text-emerald-500">{device.portSpeed}</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-secondary font-bold uppercase tracking-tighter italic">Gateway</span>
                                            )}
                                        </td>
                                    )}

                                    {/* Actions */}
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex gap-1.5 justify-end">
                                            <button
                                                onClick={() => onOpenInventory?.(device.id)}
                                                className="p-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 transition-all border border-emerald-100 dark:border-emerald-500/20"
                                                title="Ver Inventário"
                                            >
                                                <Database className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setEditingDevice(device)}
                                                className="bg-accent/10 hover:bg-accent hover:text-white text-accent px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-accent/20 shadow-sm"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => setManagingDevice(device)}
                                                className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20 shadow-sm"
                                            >
                                                Manage
                                            </button>
                                            <button
                                                onClick={() => setMetricsDevice(device)}
                                                className="bg-purple-500/10 hover:bg-purple-500 hover:text-white text-purple-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-purple-500/20 shadow-sm"
                                            >
                                                Metrics
                                            </button>
                                            <button
                                                onClick={() => handleDelete(device)}
                                                className="p-2 hover:bg-red-500/20 rounded-lg text-secondary/70 hover:text-red-400 transition-colors"
                                                title="Deletar"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Network access modal */}
            {netAccessDevice && (
                <NetAccessModal 
                    device={netAccessDevice} 
                    onClose={() => {
                        setNetAccessDevice(null);
                        setNetAccessRect(null);
                    }}
                    triggerRect={netAccessRect}
                />
            )}
        </>
    );
}
