import { useState, useEffect } from 'react';
import { Search, Filter, Download, Activity, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../utils/trpc';
import { RemoteViewer } from './RemoteViewer';
import { RemoteAccessRequestModal } from './RemoteAccessRequestModal';
import { ManageDeviceModal } from './ManageDeviceModal';
import { DeviceMetricsModal } from './DeviceMetricsModal';
import { EditDeviceModal } from './EditDeviceModal';
import { TestResultsModal } from './TestResultsModal';
import { BulkActionBar } from './device-list/BulkActionBar';
import { DeviceTable } from './device-list/DeviceTable';

interface DeviceListProps {
    onOpenInventory?: (id: string) => void;
}

/**
 * Componente DeviceList - Listagem e Gerenciamento de Ativos de Rede
 * 
 * Este componente é a visão principal de inventário do IronGrid. Ele permite:
 * - Visualizar todos os ativos descobertos na rede.
 * - Filtrar por tipo, departamento e busca textual.
 * - Realizar ações em lote (Ping, SNMP, atualização de departamento, etc.).
 * - Acessar ferramentas remotas (Remote Desktop, Métricas, Inventário Profundo).
 * - Exportar a listagem atual para formato CSV.
 * 
 * @module components/DeviceList
 * @param {DeviceListProps} props - Propriedades do componente
 */
export function DeviceList({ onOpenInventory }: DeviceListProps) {
    const [typeFilter, setTypeFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [managingDevice, setManagingDevice] = useState<any>(null);
    const [metricsDevice, setMetricsDevice] = useState<any>(null);
    const [editingDevice, setEditingDevice] = useState<any>(null);
    const [requestAgentId, setRequestAgentId] = useState<string | null>(null);
    const [remoteAgentId, setRemoteAgentId] = useState<string | null>(null);
    const [remoteMode, setRemoteMode] = useState<'viewer' | 'administrator'>('viewer');
    const [remoteConnectionId, setRemoteConnectionId] = useState<string | undefined>(undefined);

    // Debounced search
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [testResults, setTestResults] = useState<any>(null);
    const [showTestResults, setShowTestResults] = useState(false);
    
    // Pagination State
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    
    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState<string[]>(['graphs', 'ipamStatus', 'name', 'ip', 'type']);
    const [showColumnToggle, setShowColumnToggle] = useState(false);

    const COLUMNS = [
        { id: 'graphs', label: 'Gráficos', icon: <Activity className="w-3 h-3" /> },
        { id: 'ipamStatus', label: 'Status', icon: <Activity className="w-3 h-3" /> },
        { id: 'name', label: 'Nome' },
        { id: 'ip', label: 'IP Address' },
        { id: 'hostname', label: 'Hostname' },
        { id: 'assetNumber', label: 'Patrimônio' },
        { id: 'macAddress', label: 'MAC Address' },
        { id: 'type', label: 'Tipo / Modelo' },
        { id: 'department', label: 'Departamento' },
        { id: 'location', label: 'Localização' },
        { id: 'connectedTo', label: 'Conectado em' },
    ];

    // Fetch devices from backend with filters and sorting
    const utils = trpc.useContext();
    const { data, isLoading } = (trpc.scan as any).getDevicesPaginated.useQuery({
        search: debouncedSearch,
        type: typeFilter,
        department: deptFilter,
        sortBy,
        sortOrder,
        page,
        limit
    }, {
        keepPreviousData: true
    });

    const devices = (data as any)?.devices ?? [];
    const total = (data as any)?.total ?? 0;


    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, typeFilter, deptFilter]);


    const { data: departments = [] } = trpc.organization.listDepartments.useQuery();
    const { data: communities = [] } = trpc.snmp.listCommunities.useQuery();

    const toggleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };


    const deleteMutation = trpc.scan.deleteDevice.useMutation({
        onSuccess: () => {
            utils.scan.getDevices.invalidate();
            (utils.scan as any).getDevicesPaginated.invalidate();
        }
    });

    const toggleMonitoring = (trpc as any).snmp.toggleMonitoring.useMutation({
        onSuccess: () => {
            utils.scan.getDevices.invalidate();
            (utils.scan as any).getDevicesPaginated.invalidate();
        }
    });



    const handleDelete = async (device: any) => {
        if (confirm(`Are you sure you want to delete ${device.name || device.ip}?`)) {
            await deleteMutation.mutateAsync({ id: device.id });
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(devices.map((d: any) => d.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };



    const exportToCSV = () => {
        const headers = ['Name', 'IP Address', 'Hostname', 'MAC Address', 'Type', 'Status', 'Department', 'User', 'Last Seen'];
        const rows = devices.map((d: any) => [
            d.name,
            d.ip,
            d.hostname,
            d.mac,
            d.type,
            d.status,
            d.department,
            d.user,
            d.lastSeen
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((r: any) => r.map((cell: any) => `"${cell || ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `irongrid_assets_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return <div className="p-8 text-center text-secondary">Carregando dispositivos...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black text-main tracking-tighter font-header">Inventário de Ativos</h2>
                    <div className="flex gap-3">
                        <div className="relative">
                                <button
                                onClick={() => setShowColumnToggle(!showColumnToggle)}
                                className="bg-card border border-border text-main px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                            >
                                <Filter className="h-3.5 w-3.5" />
                                Colunas
                            </button>
                            
                            {showColumnToggle && (
                                <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-2xl z-50 p-4 space-y-2">
                                    <h3 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Visibilidade das Colunas</h3>
                                    <div className="grid grid-cols-1 gap-1 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                                        {COLUMNS.map(col => (
                                            <label key={col.id} className="flex items-center gap-3 p-2 hover:bg-page/10 rounded-lg cursor-pointer transition-colors group">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleColumns.includes(col.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setVisibleColumns([...visibleColumns, col.id]);
                                                        } else {
                                                            setVisibleColumns(visibleColumns.filter(c => c !== col.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-border bg-page text-main focus:ring-primary"
                                                />
                                                <span className="text-xs text-secondary font-bold flex items-center gap-2">
                                                    {col.icon}
                                                    {col.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="pt-2 border-t border-border">
                                        <button 
                                            onClick={() => setVisibleColumns(['graphs', 'ipamStatus', 'name', 'ip', 'type'])}
                                            className="text-[9px] text-main font-black uppercase hover:opacity-80"
                                        >
                                            Resetar Padrão
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={exportToCSV}
                            className="bg-card border border-border text-main px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Exportar CSV
                        </button>
                    </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary/40" />
                        <input
                            type="text"
                            placeholder="Buscar dispositivo..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="bg-card border border-border rounded-full pl-11 pr-6 py-3 w-full text-xs focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/5 transition-all text-main font-medium shadow-sm"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary/40 pointer-events-none" />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-card border border-border rounded-full pl-11 pr-8 py-3 text-xs w-full appearance-none focus:outline-none focus:border-accent transition-all cursor-pointer text-main font-medium shadow-sm"
                        >
                            <option value="all">Tipos: Todos</option>
                            <option value="SERVER">Servidor</option>
                            <option value="ROUTER">Roteador</option>
                            <option value="SWITCH">Switch</option>
                            <option value="FIREWALL">Firewall</option>
                            <option value="DATABASE">Banco de Dados</option>
                            <option value="VOIP">VoIP</option>
                            <option value="NAS">NAS / Storage</option>
                            <option value="CAMERA">Câmera</option>
                            <option value="ACCESS_POINT">Access Point</option>
                            <option value="PRINTER">Impressora</option>
                            <option value="WORKSTATION">Computador</option>
                            <option value="INTERNET">Internet</option>
                            <option value="OTHER">Outros</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary/40 pointer-events-none" />
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="bg-card border border-border rounded-full pl-11 pr-8 py-3 w-full text-xs appearance-none focus:outline-none focus:border-accent transition-all cursor-pointer text-main font-medium shadow-sm"
                        >
                            <option value="">Departamentos: Todos</option>
                            {departments.map((dept: any) => (
                                <option key={dept.id} value={dept.name}>{dept.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-3 bg-accent rounded-full px-6 py-3 shadow-lg shadow-accent/20">
                        <span className="text-[10px] text-white uppercase font-bold tracking-widest opacity-80">Total</span>
                        <span className="text-sm text-white font-black font-header tracking-tighter">{total} ativos</span>
                    </div>
                </div>
        </div>
            </div>

            {/* Bulk Action Bar */}
            <BulkActionBar
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                devices={devices}
                departments={departments}
                communities={communities}
                setTestResults={setTestResults}
                setShowTestResults={setShowTestResults}
            />

            {/* Animated Hints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-left duration-700">
                <div className="bg-card border border-border p-6 rounded-[2rem] flex items-center gap-5 shadow-sm hover:shadow-md transition-all group">
                    <div className="bg-emerald-500 rounded-2xl p-4 shadow-xl shadow-emerald-500/20">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Performance Insight</span>
                        <p className="text-xs text-secondary font-medium tracking-tight">
                            Ative o monitoramento de recursos para obter visibilidade total de CPU e RAM.
                        </p>
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-[2rem] flex items-center gap-5 shadow-sm hover:shadow-md transition-all group">
                    <div className="bg-accent rounded-2xl p-4 shadow-xl shadow-accent/20">
                        <Globe className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Status Legend</span>
                        <p className="text-xs text-secondary font-medium tracking-tight">
                             Legenda IPAM: <span className="text-red-500 font-bold mx-1">O (Ocupado)</span> | <span className="text-accent font-bold mx-1">R (Reservado)</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* DeviceTable */}
            <DeviceTable
                devices={devices}
                selectedIds={selectedIds}
                visibleColumns={visibleColumns}
                sortBy={sortBy}
                sortOrder={sortOrder}
                toggleSelect={toggleSelect}
                handleSelectAll={handleSelectAll}
                toggleSort={toggleSort}
                toggleMonitoring={toggleMonitoring}
                setRequestAgentId={setRequestAgentId}
                setManagingDevice={setManagingDevice}
                setMetricsDevice={setMetricsDevice}
                setEditingDevice={setEditingDevice}
                handleDelete={handleDelete}
                onOpenInventory={onOpenInventory}
            />

            {devices.length === 0 && !isLoading && (
                <div className="px-6 py-20 text-center bg-card border border-border rounded-xl mt-4">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="p-4 bg-page rounded-full border border-border">
                            <Activity className="h-8 w-8 text-secondary animate-pulse" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-secondary font-bold text-lg">Nenhum ativo encontrado</span>
                            <span className="text-secondary text-sm">Tente ajustar seus filtros ou realizar uma nova varredura.</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination Controls */}
            {total > 0 && (
                <div className="bg-card border border-border rounded-xl px-6 py-4 flex items-center justify-between shadow-sm mt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-secondary uppercase tracking-widest bg-page px-2 py-1 rounded">
                            Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
                        </span>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                            className="bg-page border border-border rounded px-2 py-1 text-[10px] text-main focus:outline-none focus:border-primary font-bold transition-all"
                        >
                            <option value={10}>10 / pág</option>
                            <option value={25}>25 / pág</option>
                            <option value={50}>50 / pág</option>
                            <option value={100}>100 / pág</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 text-secondary hover:text-main disabled:opacity-30 transition-colors border border-border rounded-lg bg-page"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, Math.ceil(total / limit)) }, (_, i) => {
                                const p = i + 1;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                            page === p
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                            : 'text-secondary hover:bg-page hover:text-main border border-border'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                            disabled={page >= Math.ceil(total / limit)}
                            className="p-2 text-secondary hover:text-main disabled:opacity-30 transition-colors border border-border rounded-lg bg-page"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {editingDevice && (
                <EditDeviceModal
                    device={editingDevice}
                    onClose={() => setEditingDevice(null)}
                />
            )}
            {managingDevice && (
                <ManageDeviceModal
                    device={managingDevice}
                    onClose={() => setManagingDevice(null)}
                />
            )}
            {metricsDevice && (
                <DeviceMetricsModal
                    device={metricsDevice}
                    onClose={() => setMetricsDevice(null)}
                />
            )}
            {requestAgentId && (
                <RemoteAccessRequestModal
                    agentId={requestAgentId}
                    onGranted={(mode: 'viewer' | 'administrator', connectionId?: string) => {
                        setRemoteMode(mode);
                        setRemoteAgentId(requestAgentId);
                        setRemoteConnectionId(connectionId);
                        setRequestAgentId(null);
                    }}
                    onClose={() => setRequestAgentId(null)}
                />
            )}
            {remoteAgentId && (
                <RemoteViewer
                    agentId={remoteAgentId}
                    mode={remoteMode}
                    connectionId={remoteConnectionId}
                    serverUrl={window.location.origin.replace('3000', '3001')}
                    onClose={() => {
                        setRemoteAgentId(null);
                        setRemoteConnectionId(undefined);
                    }}
                />
            )}
            {showTestResults && testResults && (
                <TestResultsModal
                    results={testResults}
                    onClose={() => setShowTestResults(false)}
                />
            )}
        </div>
    );
}
