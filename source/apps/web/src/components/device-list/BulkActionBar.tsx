import { useState } from 'react';
import { Loader2, Activity, Trash2 } from 'lucide-react';
import { trpc } from '../../utils/trpc';

interface BulkActionBarProps {
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
    devices: any[];
    departments: any[];
    communities: any[];
    setTestResults: (results: any) => void;
    setShowTestResults: (show: boolean) => void;
}

export function BulkActionBar({ 
    selectedIds, 
    setSelectedIds, 
    devices, 
    departments, 
    communities, 
    setTestResults, 
    setShowTestResults 
}: BulkActionBarProps) {
    const [bulkDept, setBulkDept] = useState('');
    const [bulkType, setBulkType] = useState('');
    const [bulkParentId, setBulkParentId] = useState('');
    const [bulkPort, setBulkPort] = useState('');
    const [bulkPortSpeed, setBulkPortSpeed] = useState('');
    const [bulkSnmpId, setBulkSnmpId] = useState('');
    const [isBulkLoading, setIsBulkLoading] = useState(false);

    const utils = trpc.useContext();

    const bulkUpdateMutation = trpc.scan.bulkUpdateDevices.useMutation({
        onSuccess: () => {
            utils.scan.getDevices.invalidate();
            setSelectedIds([]);
            setBulkDept('');
            setBulkType('');
            setBulkParentId('');
            setBulkPort('');
            setBulkPortSpeed('');
            setBulkSnmpId('');
            setIsBulkLoading(false);
        }
    });

    const bulkPingMutation = trpc.scan.bulkPingTest.useMutation({
        onSuccess: (data: any) => {
            setTestResults({ type: 'ping', results: data.results });
            setShowTestResults(true);
        }
    });

    const bulkSnmpMutation = trpc.scan.bulkSnmpTest.useMutation({
        onSuccess: (data: any) => {
            setTestResults({ type: 'snmp', results: data.results });
            setShowTestResults(true);
            utils.scan.getDevices.invalidate();
        }
    });

    const bulkDeleteMutation = (trpc.scan as any).bulkDeleteDevices.useMutation({
        onSuccess: () => {
            utils.scan.getDevices.invalidate();
            (utils.scan as any).getDevicesPaginated?.invalidate();
            setSelectedIds([]);
        }
    });

    const handleBulkSave = async () => {
        setIsBulkLoading(true);
        const data: any = { ids: selectedIds };
        if (bulkDept) data.department = bulkDept;
        if (bulkType) data.type = bulkType;
        if (bulkParentId) {
            data.parentId = bulkParentId === 'null' ? null : bulkParentId;
        }
        if (bulkPort) data.parentPort = bulkPort;
        if (bulkPortSpeed) data.portSpeed = bulkPortSpeed;
        if (bulkSnmpId) data.snmpCommunityId = bulkSnmpId;

        await (bulkUpdateMutation as any).mutateAsync(data);
    };

    const handleBulkDelete = async () => {
        if (confirm(`Are you sure you want to delete ${selectedIds.length} devices?`)) {
            await bulkDeleteMutation.mutateAsync({ ids: selectedIds });
        }
    };

    if (selectedIds.length === 0) return null;

    return (
        <div className="bg-primary/5 border-y border-primary/30 p-4 mb-6 animate-in slide-in-from-top duration-300">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex flex-col">
                    <span className="text-main font-bold text-lg">{selectedIds.length}</span>
                    <span className="text-secondary text-xs uppercase tracking-wider font-medium">Dispositivos Selecionados</span>
                </div>

                <div className="flex flex-wrap items-stretch gap-3 flex-1">
                    {/* Grupo: Departamento */}
                    <div className="flex flex-col gap-2 min-w-[140px]">
                        <select
                            value={bulkDept}
                            onChange={(e) => setBulkDept(e.target.value)}
                            className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary cursor-pointer transition-colors"
                        >
                            <option value="" className="bg-card">Depto...</option>
                            {departments
                                .sort((a: any, b: any) => a.name.localeCompare(b.name))
                                .map((dept: any) => (
                                    <option key={dept.id} value={dept.name} className="bg-card">{dept.name}</option>
                                ))}
                        </select>
                    </div>

                    <div className="w-px bg-border hidden lg:block"></div>

                    {/* Grupo: Tipo */}
                    <div className="flex flex-col gap-2 min-w-[130px]">
                        <select
                            value={bulkType}
                            onChange={(e) => setBulkType(e.target.value)}
                            className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary cursor-pointer transition-colors"
                        >
                            <option value="" className="bg-card">Tipo de Ativo...</option>
                            <option value="SERVER" className="bg-card">Servidor</option>
                            <option value="ROUTER" className="bg-card">Roteador</option>
                            <option value="SWITCH" className="bg-card">Switch</option>
                            <option value="FIREWALL" className="bg-card">Firewall</option>
                            <option value="DATABASE" className="bg-card">Banco de Dados</option>
                            <option value="VOIP" className="bg-card">VoIP</option>
                            <option value="NAS" className="bg-card">NAS / Storage</option>
                            <option value="CAMERA" className="bg-card">Câmera</option>
                            <option value="ACCESS_POINT" className="bg-card">Access Point</option>
                            <option value="PRINTER" className="bg-card">Impressora</option>
                            <option value="WORKSTATION" className="bg-card">Computador</option>
                            <option value="INTERNET" className="bg-card">Internet</option>
                            <option value="OTHER" className="bg-card">Outros</option>
                        </select>
                    </div>

                    <div className="w-px bg-border hidden lg:block"></div>

                    {/* Grupo: Conexão */}
                    <div className="flex flex-col gap-2 min-w-[220px]">
                        <div className="flex gap-2">
                            <select
                                value={bulkParentId}
                                onChange={(e) => setBulkParentId(e.target.value)}
                                className="flex-1 bg-page border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary cursor-pointer transition-colors"
                            >
                                <option value="" className="bg-card text-main">Conec. ao Pai...</option>
                                <option value="null" className="bg-card text-main italic">Nenhum (Raiz)</option>
                                {devices
                                    .filter((d: any) => ['switch', 'router', 'firewall'].includes(d.type?.toLowerCase()) && !selectedIds.includes(d.id))
                                    .sort((a: any, b: any) => (a.name || a.ip).localeCompare(b.name || b.ip))
                                    .map((sw: any) => (
                                        <option key={sw.id} value={sw.id} className="bg-card text-main">{sw.name || sw.ip}</option>
                                    ))
                                }
                            </select>
                            <input
                                type="text"
                                placeholder="Porta..."
                                value={bulkPort}
                                onChange={(e) => setBulkPort(e.target.value)}
                                className="w-20 bg-page border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary transition-colors placeholder:text-secondary"
                            />
                        </div>
                    </div>

                    <div className="w-px bg-border hidden lg:block"></div>

                    {/* Grupo: Velocidade */}
                    <div className="flex flex-col gap-2 min-w-[100px]">
                        <select
                            value={bulkPortSpeed}
                            onChange={(e) => setBulkPortSpeed(e.target.value)}
                            className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary cursor-pointer transition-colors"
                        >
                            <option value="" className="bg-card">Velocidade...</option>
                            <option value="40G" className="bg-card text-emerald-500 font-bold">40G</option>
                            <option value="10G" className="bg-card text-main font-bold">10G</option>
                            <option value="1G" className="bg-card text-amber-500 font-bold">1G</option>
                            <option value="100M" className="bg-card text-orange-500 font-bold">100M</option>
                            <option value="Wireless" className="bg-card text-purple-500 font-bold">Wireless</option>
                        </select>
                    </div>

                    {/* Grupo: Testes */}
                    <div className="flex flex-col gap-2 min-w-[180px]">
                        <div className="flex gap-2">
                            <select
                                value={bulkSnmpId}
                                onChange={(e) => setBulkSnmpId(e.target.value)}
                                className="flex-1 bg-page border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary cursor-pointer transition-colors"
                            >
                                <option value="" className="bg-card text-main">Comunidade SNMP...</option>
                                {communities
                                    .sort((a: any, b: any) => a.name.localeCompare(b.name))
                                    .map((comm: any) => (
                                        <option key={comm.id} value={comm.id} className="bg-card text-main">{comm.name}</option>
                                    ))}
                            </select>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => {
                                        const ips = devices
                                            .filter((d: any) => selectedIds.includes(d.id))
                                            .map((d: any) => d.ip)
                                            .filter((ip: string) => ip != null);
                                        bulkPingMutation.mutate({ ips });
                                    }}
                                    disabled={bulkPingMutation.isPending || isBulkLoading}
                                    className="bg-emerald-100 dark:bg-emerald-600/20 hover:bg-emerald-200 dark:hover:bg-emerald-600/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all"
                                >
                                    Ping
                                </button>
                                <button
                                    onClick={() => {
                                        const ips = devices
                                            .filter((d: any) => selectedIds.includes(d.id))
                                            .map((d: any) => d.ip)
                                            .filter((ip: string) => ip != null);
                                        const selectedComm = communities.find((c: any) => c.id === bulkSnmpId);
                                        bulkSnmpMutation.mutate({ ips, community: selectedComm?.community || 'public' });
                                    }}
                                    disabled={bulkSnmpMutation.isPending || !bulkSnmpId || isBulkLoading}
                                    className="bg-purple-100 dark:bg-purple-600/20 hover:bg-purple-200 dark:hover:bg-purple-600/40 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all"
                                >
                                    SNMP
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="w-px bg-border hidden lg:block"></div>

                    {/* Botão Unificado de Salvar */}
                    <div className="flex items-center">
                        <button
                            onClick={handleBulkSave}
                            disabled={isBulkLoading || (!bulkDept && !bulkType && !bulkParentId && !bulkPort && !bulkSnmpId && !bulkPortSpeed)}
                            className="bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg flex items-center gap-2"
                        >
                            {isBulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                            Aplicar Alterações
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={handleBulkDelete}
                        className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/20 group"
                        title="Deletar Selecionados"
                    >
                        <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                        onClick={() => setSelectedIds([])}
                        className="text-secondary hover:text-main text-[10px] font-bold uppercase tracking-widest px-4 py-2 border border-border rounded-xl hover:bg-page transition-all shadow-sm"
                    >
                        Limpar
                    </button>
                </div>
            </div>
        </div>
    );
}
