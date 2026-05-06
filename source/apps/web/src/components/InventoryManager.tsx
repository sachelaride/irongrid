import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Server, Loader2, Database, Search, Activity, Plus, FileText, ChevronUp, ChevronDown, Save, Check, Shield, Globe, Printer, Monitor, Network, Router, Laptop, DollarSign, Wrench, Phone, HardDrive, Camera, Radio, Cloud } from 'lucide-react';
import { DeviceInventoryDetail } from './DeviceInventoryDetail';
import { AddDeviceModal } from './AddDeviceModal';

/**
 * Componente InventoryManager - Gestão e Atribuição de Ativos
 * 
 * Este componente permite aos administradores vincular dispositivos a unidades (localizações),
 * departamentos e usuários específicos. Também facilita a ativação rápida
 * do monitoramento de performance.
 * 
 * @module components/InventoryManager
 */
export function InventoryManager() {
    const utils = (trpc as any).useContext();
    const { data: devicesData = [], isLoading } = (trpc as any).scan.getDevices.useQuery({});
    const devices = Array.isArray(devicesData) ? devicesData : (devicesData as any)?.devices ?? [];
    const { data: depts = [] } = (trpc as any).organization.listDepartments.useQuery();
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();

    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Record<string, { departmentId?: string; locationId?: string; type?: string }>>({});

    const assignDevice = (trpc as any).organization.assignDevice.useMutation({
        onSuccess: () => (utils.scan.getDevices as any).invalidate()
    });

    const toggleMonitoring = (trpc as any).snmp.toggleMonitoring.useMutation({
        onSuccess: () => (utils.scan.getDevices as any).invalidate()
    });

    const filtered = devices.filter((d: any) =>
        d.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.ip?.toLowerCase().includes(search.toLowerCase())
    ).sort((a: any, b: any) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        let aValue = a[key];
        let bValue = b[key];

        // Handle nested properties for location/department
        if (key === 'location') aValue = a.location?.name;
        if (key === 'location') bValue = b.location?.name;
        if (key === 'department') aValue = a.departmentRef?.name;
        if (key === 'department') bValue = b.departmentRef?.name;

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleAssignmentChange = (deviceId: string, data: any) => {
        const device = devices.find((d: any) => d.id === deviceId);
        if (!device) return;

        const original = {
            departmentId: device.departmentId || '',
            locationId: device.locationId || '',
            type: device.type || ''
        };

        const current = { ...(pendingChanges[deviceId] || original), ...data };

        // Check if back to original
        const isOriginal = current.departmentId === original.departmentId &&
            current.locationId === original.locationId &&
            current.type === original.type;

        setPendingChanges(prev => {
            const next = { ...prev };
            if (isOriginal) {
                delete next[deviceId];
            } else {
                next[deviceId] = current;
            }
            return next;
        });
    };

    const handleBatchSave = async () => {
        const updates = Object.entries(pendingChanges);
        for (const [deviceId, data] of updates) {
            await assignDevice.mutateAsync({ deviceId, ...data });
        }
        setPendingChanges({});
        await (utils.scan.getDevices as any).invalidate();
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig?.key !== column) return <ChevronUp className="w-3 h-3 opacity-20" />;
        return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-accent" /> : <ChevronDown className="w-3 h-3 text-accent" />;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border p-5 rounded-3xl shadow-lg">
                <div className="flex items-center gap-8">
                    <div>
                        <h2 className="text-xl font-black text-main italic flex items-center gap-3">
                            <Database className="w-5 h-5 text-main" /> Gestão Inventário
                        </h2>
                        <p className="text-xs text-secondary font-medium ml-8">Vincule ativos às estruturas organizacionais</p>
                    </div>
                    <div className="hidden lg:flex gap-8 border-l border-border pl-8">
                        <div className="flex flex-col">
                            <span className="text-lg font-black text-emerald-500 italic">
                                {devices.reduce((acc: number, d: any) => acc + (d.purchaseValue || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className="text-[9px] font-black text-secondary uppercase tracking-widest">Total Aquisição</span>
                        </div>
                        <div className="flex flex-col border-l border-border pl-8">
                            <span className="text-lg font-black text-amber-500 italic">
                                {devices.reduce((acc: number, d: any) => acc + (d.maintenanceRecords?.reduce((sum: number, r: any) => sum + (r.cost || 0), 0) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className="text-[9px] font-black text-secondary uppercase tracking-widest">Total Manutenção</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {Object.keys(pendingChanges).length > 0 && (
                        <button
                            onClick={handleBatchSave}
                            disabled={assignDevice.isPending}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2 animate-in zoom-in"
                        >
                            {assignDevice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Salvar Alterações ({Object.keys(pendingChanges).length})
                        </button>
                    )}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-accent hover:bg-accent text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/20 active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Novo Ativo
                    </button>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar ativo por nome ou IP..."
                            className="bg-page border border-border rounded-xl py-2 pl-12 pr-6 text-xs text-main focus:border-primary/50 outline-none w-full lg:w-80 transition-all placeholder:text-secondary"
                        />
                    </div>
                </div>
            </div>

            {/* Compact integrated Hint Bar - ENLARGED as requested */}
            <div className="bg-primary/5 border border-primary/10 p-4 rounded-3xl flex items-center justify-center gap-12 animate-in fade-in slide-in-from-top duration-700 hover:bg-primary/10 transition-all group cursor-default">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-main uppercase tracking-widest hidden md:block">Dicas de Acesso:</span>
                    <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 rounded-xl">
                        <Activity className="w-4 h-4 text-main" />
                        <span className="text-xs text-secondary font-bold uppercase tracking-tight">1. Iniciar Monitoramento</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 rounded-xl">
                    <Database className="w-4 h-4 text-main" />
                    <span className="text-xs text-secondary font-bold uppercase tracking-tight">2. Detalhes de Inventário</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 rounded-xl">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-secondary font-bold uppercase tracking-tight">3. Gerar PDF de Ativo</span>
                </div>
            </div>

            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-page/50 text-secondary font-black uppercase tracking-widest border-b border-border">
                                <th className="px-8 py-5 text-center w-48">Ações</th>
                                <th className="px-8 py-5 cursor-pointer hover:text-main transition-colors" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-2">Dispositivo <SortIcon column="name" /></div>
                                </th>
                                <th className="px-6 py-5 cursor-pointer hover:text-main transition-colors" onClick={() => handleSort('location')}>
                                    <div className="flex items-center gap-2">Unidade <SortIcon column="location" /></div>
                                </th>
                                <th className="px-6 py-5 cursor-pointer hover:text-main transition-colors" onClick={() => handleSort('department')}>
                                    <div className="flex items-center gap-2">Departamento <SortIcon column="department" /></div>
                                </th>
                                <th className="px-6 py-5">Tipo de Ativo</th>
                                <th className="px-6 py-5">Valor Patrimonial</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-12 text-center text-secondary font-bold italic">Sincronizando ativos...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="p-12 text-center text-secondary font-bold italic">Nenhum ativo encontrado para os filtros atuais.</td></tr>
                            ) : filtered.map((device: any) => (
                                <DeviceRow
                                    key={device.id}
                                    device={device}
                                    depts={depts}
                                    locations={locations}
                                    isSaving={assignDevice.isPending && assignDevice.variables?.deviceId === device.id}
                                    pendingAssignments={pendingChanges[device.id]}
                                    onViewDetail={() => setSelectedDeviceId(device.id)}
                                    onFieldChange={(data: any) => handleAssignmentChange(device.id, data)}
                                    onSaveRow={() => {
                                        const data = pendingChanges[device.id];
                                        if (data) {
                                            assignDevice.mutate({ deviceId: device.id, ...data }, {
                                                onSuccess: () => {
                                                    setPendingChanges(prev => {
                                                        const next = { ...prev };
                                                        delete next[device.id];
                                                        return next;
                                                    });
                                                }
                                            });
                                        }
                                    }}
                                    onToggleMonitoring={(enabled: boolean) => toggleMonitoring.mutate({ ip: device.ip, enabled })}
                                    isMonitoringPending={toggleMonitoring.isPending && toggleMonitoring.variables?.ip === device.ip}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedDeviceId && (
                <DeviceInventoryDetail
                    deviceId={selectedDeviceId}
                    onClose={() => setSelectedDeviceId(null)}
                />
            )}

            {showAddModal && (
                <AddDeviceModal onClose={() => setShowAddModal(false)} />
            )}
        </div>
    );
}

/**
 * Linha de Dispositivo - Representa
 * @private
 */
function DeviceRow({ device, depts, locations, onFieldChange, onSaveRow, onViewDetail, onToggleMonitoring, isSaving, isMonitoringPending, pendingAssignments }: any) {
    const isMonitored = !!device.isMonitored;
    const assignments = pendingAssignments || {
        departmentId: device.departmentId || '',
        locationId: device.locationId || '',
        type: device.type || ''
    };

    const hasChanged = !!pendingAssignments;

    const getDeviceIcon = (type: string) => {
        switch (type?.toUpperCase()) {
            case 'SERVER': return <Server className="w-5 h-5 text-accent" />;
            case 'SWITCH': return <Network className="w-5 h-5 text-accent" />;
            case 'ROUTER': return <Router className="w-5 h-5 text-emerald-500" />;
            case 'FIREWALL': return <Shield className="w-5 h-5 text-rose-500" />;
            case 'GATEWAY': return <Globe className="w-5 h-5 text-amber-500" />;
            case 'INTERNET': return <Cloud className="w-5 h-5 text-emerald-400" />;
            case 'DATABASE': return <Database className="w-5 h-5 text-purple-500" />;
            case 'VOIP': return <Phone className="w-5 h-5 text-accent" />;
            case 'NAS': return <HardDrive className="w-5 h-5 text-secondary/70" />;
            case 'CAMERA': return <Camera className="w-5 h-5 text-red-500" />;
            case 'ACCESS_POINT': return <Radio className="w-5 h-5 text-accent" />;
            case 'PRINTER': return <Printer className="w-5 h-5 text-secondary" />;
            case 'WORKSTATION': return <Monitor className="w-5 h-5 text-cyan-500" />;
            default: return <Laptop className="w-5 h-5 text-secondary/70" />;
        }
    };

    return (
        <tr className="transition-colors group hover:bg-page border-b border-border/50">
            <td className="px-8 py-5 text-center flex items-center justify-center gap-2">
                {/* Monitoring Toggle (Gravar) */}
                <button
                    onClick={() => onToggleMonitoring(!isMonitored)}
                    disabled={isMonitoringPending}
                    title={isMonitored ? "Clique para DESATIVAR gravação e monitoramento" : "Clique para ATIVAR gravação e monitoramento"}
                    className={`
                        p-3 rounded-xl transition-all border
                        ${isMonitored
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500 shadow-lg shadow-emerald-500/10'
                            : 'bg-white/5 border-border text-secondary/70 hover:border-accent'}
                    `}
                >
                    {isMonitoringPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Activity className="w-4 h-4" />
                    )}
                </button>

                {/* Deep Inventory (Ver Inventário Profundo) */}
                <button
                    onClick={onViewDetail}
                    className="p-3 rounded-xl bg-page text-secondary hover:bg-card hover:text-main transition-all shadow-sm border border-border"
                    title="Ver Inventário Profundo"
                >
                    <Database className="w-4 h-4" />
                </button>

                {hasChanged && !isSaving && (
                    <button
                        onClick={onSaveRow}
                        className="p-3 rounded-xl transition-all shadow-sm text-accent bg-blue-100 dark:bg-accent/10 hover:bg-accent hover:text-white active:scale-95 border border-accent/20 animate-pulse"
                        title="Salvar Vínculos deste Ativo"
                    >
                        <Save className="w-4 h-4" />
                    </button>
                )}
                {!hasChanged && (device.departmentId || device.locationId || device.type) && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <Check className="w-4 h-4" />
                    </div>
                )}
                {isSaving && <Loader2 className="w-4 h-4 animate-spin text-accent" />}

                {/* PDF Report (Imprimir inventário PDF) */}
                <button
                    onClick={async () => {
                        try {
                            const result = await (trpc as any).reports.generateInventoryPDF.mutateAsync({
                                type: 'hardware',
                                filters: { deviceId: device.id }
                            });
                            if (result.base64) {
                                const link = document.createElement('a');
                                link.href = `data:application/pdf;base64,${result.base64}`;
                                link.download = `inventario_${device.name || device.hostname || 'ativo'}.pdf`;
                                link.click();
                            }
                        } catch (err) {
                            console.error('Erro ao gerar PDF:', err);
                            alert('Erro ao gerar PDF do dispositivo');
                        }
                    }}
                    className="p-3 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all border border-amber-500/20 shadow-sm"
                    title="Imprimir Inventário PDF"
                >
                    <FileText className="w-4 h-4" />
                </button>
            </td>
            <td className="px-8 py-5">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-page rounded-xl flex items-center justify-center border border-border group-hover:scale-110 transition-transform shadow-sm">
                        {getDeviceIcon(assignments.type)}
                    </div>
                    <div>
                        <div className="font-black text-main tracking-tight italic">{device.name || device.hostname}</div>
                        <div className="text-[10px] font-mono text-secondary tracking-wider uppercase opacity-80">{device.ip}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-5">
                <select
                    value={assignments.locationId}
                    onChange={(e) => onFieldChange({ locationId: e.target.value })}
                    className={`bg-page border text-[10px] font-bold rounded-lg px-3 py-2 w-full outline-none transition-all appearance-none uppercase tracking-tighter ${hasChanged ? 'border-primary ring-1 ring-primary/20' : 'border-border text-secondary focus:border-primary'}`}
                >
                    <option value="" className="bg-card">Geral</option>
                    {locations.map((l: any) => <option key={l.id} value={l.id} className="bg-card">{l.name}</option>)}
                </select>
            </td>

            <td className="px-6 py-5">
                <select
                    value={assignments.departmentId}
                    onChange={(e) => onFieldChange({ departmentId: e.target.value })}
                    className={`bg-page/50 border text-[10px] font-bold rounded-lg px-3 py-2 w-full outline-none transition-all appearance-none uppercase tracking-tighter ${hasChanged ? 'border-accent ring-1 ring-accent/20' : 'border-border text-secondary focus:border-accent'}`}
                >
                    <option value="" className="bg-card">Geral</option>
                    {depts.map((d: any) => <option key={d.id} value={d.id} className="bg-card">{d.name}</option>)}
                </select>
            </td>
            <td className="px-6 py-5">
                <select
                    value={assignments.type}
                    onChange={(e) => onFieldChange({ type: e.target.value })}
                    className={`bg-page border text-[10px] font-bold rounded-lg px-3 py-2 w-full outline-none transition-all appearance-none uppercase tracking-tighter ${hasChanged ? 'border-primary ring-1 ring-primary/20' : 'border-border text-secondary focus:border-primary'}`}
                >
                    <option value="" className="bg-card">Tipo de Ativo</option>
                    <option value="SERVER" className="bg-card">Servidor</option>
                    <option value="SWITCH" className="bg-card">Switch</option>
                    <option value="ROUTER" className="bg-card">Router</option>
                    <option value="FIREWALL" className="bg-card">Firewall</option>
                    <option value="INTERNET" className="bg-card">Internet / Nuvem</option>
                    <option value="DATABASE" className="bg-card">Banco de Dados</option>
                    <option value="VOIP" className="bg-card">VoIP</option>
                    <option value="NAS" className="bg-card">NAS / Storage</option>
                    <option value="CAMERA" className="bg-card">Câmera</option>
                    <option value="ACCESS_POINT" className="bg-card">Access Point</option>
                    <option value="PRINTER" className="bg-card">Impressora</option>
                    <option value="WORKSTATION" className="bg-card">Workstation</option>
                    <option value="OTHER" className="bg-card">Outros</option>
                </select>
            </td>
            <td className="px-6 py-5">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[11px] font-black text-main font-mono" title="Valor de Aquisição">
                            {device.purchaseValue ? device.purchaseValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 opacity-70">
                        <Wrench className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[10px] font-bold text-secondary font-mono" title="Custo de Manutenção Acumulado">
                            {device.maintenanceRecords?.reduce((acc: number, r: any) => acc + (r.cost || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                        </span>
                    </div>
                </div>
            </td>
        </tr>
    );
}
