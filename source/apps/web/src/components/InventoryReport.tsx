import { useState } from 'react';
import { trpc } from '../utils/trpc';
// Importação de ícones para a interface
import {
    Download, FileText, Search, Database, Package, Cpu, Building2, MapPin,
    ChevronRight, Activity, HardDrive, Shield, DollarSign, Zap,
    AlertTriangle, HeartPulse
} from 'lucide-react';
// Importação de componentes de gráfico para visualização de métricas
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MetricChart } from './MetricChart';
import { HealthIndicatorCard } from './reports/HealthIndicatorCard';
import { RiskMatrix } from './reports/RiskMatrix';
import { FinancialChart } from './reports/FinancialChart';
import { AlertPanel } from './reports/AlertPanel';

/**
 * Componente principal de Relatórios de Inventário
 * Reúne informações de hardware, software, rede e desempenho.
 */
export function InventoryReport() {
    // Estado para controlar qual aba/visão está ativa
    // Estado para controlar qual aba/visão está ativa
    const [view, setView] = useState<'devices' | 'software' | 'hardware' | 'org' | 'performance' | 'explorer' | 'health' | 'risk' | 'financial' | 'alerts' | 'helpdesk'>('devices');
    // Estado do dispositivo selecionado para análise detalhada de performance
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
    // Estados para filtros de busca (software e geral)
    const [softSearch, setSoftSearch] = useState('');
    const [search, setSearch] = useState('');
    // Estado para filtro por departamento
    const [selectedDept, setSelectedDept] = useState<string>('');

    // Filtros específicos para o Explorador Avançado de Ativos
    const [filterRamMin, setFilterRamMin] = useState<number | undefined>(undefined);
    const [filterRamMax, setFilterRamMax] = useState<number | undefined>(undefined);
    const [filterType, setFilterType] = useState<string>('');
    const [filterPeripheral, setFilterPeripheral] = useState<string>('');

    // Buscas de dados via tRPC
    // Lista geral de dispositivos
    const { data: devicesData = [], isLoading: loadingDevices } = trpc.scan.getDevices.useQuery({});
    const devices = Array.isArray(devicesData) ? devicesData : (devicesData as any)?.devices ?? [];
    // Inventário organizacional (unidades e departamentos)
    const { data: orgInventory = [], isLoading: loadingOrg } = (trpc as any).inventory.getOrganizationalInventory.useQuery(undefined);

    // Mutação para geração de relatório em PDF no backend
    const generatePDFMutation = (trpc as any).reports.generateInventoryPDF.useMutation();

    // Consultas de Inventário de Software
    // Ranking de softwares mais instalados (carregado apenas na aba software sem busca ativa)
    const { data: softRanking = [], isLoading: loadingSoft } = (trpc as any).inventory.getSoftwareInventoryFull.useQuery(
        { departmentId: selectedDept },
        { enabled: view === 'software' && !softSearch }
    );
    // Resultados de busca por nome de software
    const { data: softSearchResults = [] } = (trpc as any).inventory.getSoftwareInventoryFull.useQuery(
        { softwareName: softSearch, departmentId: selectedDept },
        { enabled: view === 'software' && !!softSearch }
    );

    // Consultas de Performance (Métricas de Sistema e Disco)
    // Métricas de CPU/RAM das últimas 24h para o dispositivo selecionado
    const { data: performanceMetrics = [] } = (trpc as any).metrics.getSystemMetrics.useQuery(
        { deviceId: selectedDeviceId || '', timeRange: '24h' },
        { enabled: view === 'performance' && !!selectedDeviceId }
    );
    // Métricas de uso de disco
    const { data: diskMetrics = [] } = (trpc as any).metrics.getDiskMetrics.useQuery(
        { deviceId: selectedDeviceId || '', timeRange: '24h' },
        { enabled: view === 'performance' && !!selectedDeviceId }
    );
    // Lista de softwares instalados especificamente no dispositivo selecionado
    const { data: deviceInventory = [] } = (trpc as any).inventory.getDeviceInventory.useQuery(
        { deviceId: selectedDeviceId || '' },
        { enabled: view === 'performance' && !!selectedDeviceId }
    );

    // Encontra o objeto do dispositivo selecionado na lista geral
    const selectedDevice = devices.find((d: any) => d.id === selectedDeviceId);

    // Consultas para Painel de Hardware (BI)
    const { data: hwAdvanced, isLoading: loadingHw } = (trpc as any).inventory.getAdvancedHardwareReport.useQuery(undefined, { enabled: view === 'hardware' });
    const { data: hwSpecs } = (trpc as any).inventory.getHardwareSpecsSummary.useQuery(undefined, { enabled: view === 'hardware' });
    const { data: peripherals = [] } = (trpc as any).inventory.getPeripheralInventory.useQuery(undefined, { enabled: view === 'hardware' });

    // Consulta para o Explorador Avançado com múltiplos filtros técnicos
    const { data: advancedDevices = [], isLoading: loadingExplorer } = (trpc as any).inventory.getAdvancedInventoryReport.useQuery({
        ramMin: filterRamMin,
        ramMax: filterRamMax,
        departmentId: selectedDept || undefined,
        deviceType: filterType || undefined,
        peripheralType: filterPeripheral || undefined
    }, { enabled: view === 'explorer' });

    // Consultas de Relatórios Estratégicos
    const { data: healthData, isLoading: loadingHealth } = (trpc as any).reports.getHealthIndicators.useQuery(undefined, { enabled: view === 'health' });
    const { data: riskData, isLoading: loadingRisk } = (trpc as any).reports.getRiskAssessment.useQuery(undefined, { enabled: view === 'risk' });
    const { data: financialData, isLoading: loadingFinancial } = (trpc as any).reports.getFinancialReport.useQuery(undefined, { enabled: view === 'financial' });
    const { data: alertsData = [], isLoading: loadingAlerts } = (trpc as any).reports.getActiveAlerts.useQuery(undefined, { enabled: view === 'alerts' });
    const { data: helpdeskData, isLoading: loadingHelpdesk } = (trpc as any).reports.getHelpdeskIntegration.useQuery(undefined, { enabled: view === 'helpdesk' });

    // Filtra localmente a lista de dispositivos baseada na busca por nome/IP
    const filteredDevices = devices.filter((d: any) =>
        d.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.ip?.toLowerCase().includes(search.toLowerCase()) ||
        d.hostname?.toLowerCase().includes(search.toLowerCase())
    );

    /**
     * Exporta os dados da visão atual para um arquivo CSV
     */
    const exportToCSV = () => {
        const headers = ['Nome', 'IP', 'Tipo', 'Unidade', 'Departamento', 'Memoria', 'Disco', 'Ultimo Visto'];
        const dataToExport = view === 'explorer' ? advancedDevices : filteredDevices;

        // Constrói a string CSV linha por linha
        const csv = [
            headers.join(','),
            ...(dataToExport as any[]).map((d: any) => [
                d.name || d.hostname,
                d.ip || d.ipAddress,
                d.type,
                d.location?.name,
                d.departmentRef?.name,
                d.hardware?.totalMemory ? `${Math.round(Number(d.hardware.totalMemory) / (1024 ** 3))}GB` : 'N/A',
                d.hardware?.totalDisk ? `${(Number(d.hardware.totalDisk) / (1024 ** 3)).toFixed(0)}GB` : 'N/A',
                d.lastSeen
            ].map(v => `"${v || ''}"`).join(','))
        ].join('\n');

        // Cria o blob e dispara o download do arquivo
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `irongrid_report_${view}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    /**
     * Solicita ao servidor a geração de um relatório PDF baseado nos filtros atuais
     */
    const generatePDF = async () => {
        try {
            const result = await generatePDFMutation.mutateAsync({
                type: view === 'org' ? 'hardware' : (view === 'devices' ? 'hardware' : view as any),
                filters: {
                    softwareName: softSearch,
                    departmentId: selectedDept,
                    ramMin: filterRamMin,
                    ramMax: filterRamMax,
                    deviceType: filterType,
                    peripheralType: filterPeripheral
                }
            });

            // Se o servidor retornar o base64, converte e inicia o download
            if (result.base64) {
                const byteCharacters = atob(result.base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `irongrid_report_${view}_${new Date().toISOString().split('T')[0]}.pdf`;
                a.click();
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Erro ao gerar PDF. Verifique os logs.');
        }
    };

    // Exibe tela de carregamento animada durante a busca inicial de dados
    if (loadingDevices || (view === 'software' && loadingSoft) || (view === 'hardware' && loadingHw) ||
        (view === 'org' && loadingOrg) || (view === 'explorer' && loadingExplorer) ||
        (view === 'health' && loadingHealth) || (view === 'risk' && loadingRisk) ||
        (view === 'financial' && loadingFinancial) ||
        (view === 'alerts' && loadingAlerts) || (view === 'helpdesk' && loadingHelpdesk)) {
        return <div className="p-12 text-center text-secondary font-bold italic animate-pulse tracking-widest">GERANDO INTELIGÊNCIA DE ATIVOS...</div>;
    }

    return (

        <div className="space-y-8 pb-32">
            {/* Cabeçalho Unificado e Compacto: Título | Busca | Ações */}
            <div className="bg-[#0f172a] bg-card border border-slate-800 p-5 rounded-[2.5rem] shadow-2xl">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
                    {/* Lado Esquerdo: Identidade */}
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="p-3.5 bg-accent/10 rounded-2xl text-accent border border-accent/10 shadow-lg shadow-accent/5">
                            <FileText className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Central de Relatórios</h2>
                            <p className="text-[10px] text-secondary/70 font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Inteligência Unificada de Monitoramento</p>
                        </div>
                    </div>

                    {/* Centro: Campo de Busca Global */}
                    <div className="flex-1 w-full xl:max-w-xl">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary group-focus-within:text-accent transition-colors" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Filtrar por nome, IP ou hostname..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-6 text-[11px] text-white focus:border-accent outline-none transition-all shadow-inner font-bold placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    {/* Lado Direito: Ações de Exportação */}
                    <div className="flex items-center gap-3 shrink-0">
                        <button onClick={exportToCSV} title="Exportar para CSV" className="bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-slate-700 active:scale-95 group">
                            <Download className="w-4 h-4 group-hover:animate-bounce" /> CSV
                        </button>
                        <button
                            onClick={generatePDF}
                            disabled={generatePDFMutation.isPending}
                            className="bg-accent hover:bg-accent disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-accent/20 active:scale-95"
                        >
                            {generatePDFMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileText className="w-4 h-4" />}
                            Relatório PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Abas de Navegação Estilizadas */}
            <nav className="sticky top-6 z-50">
                <div className="bg-white/5 backdrop-blur-xl border border-white/5 p-1.5 rounded-[2rem] shadow-xl">
                    <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar scroll-smooth p-0.5">
                        <TabItem active={view === 'devices'} onClick={() => setView('devices')} label="Ativos" icon={Database} />
                        <TabItem active={view === 'explorer'} onClick={() => setView('explorer')} label="Explorador" icon={Search} />
                        <TabItem active={view === 'performance'} onClick={() => setView('performance')} label="Monitoramento" icon={Activity} />
                        <TabItem active={view === 'software'} onClick={() => setView('software')} label="Software" icon={Package} />
                        <TabItem active={view === 'hardware'} onClick={() => setView('hardware')} label="Hardware BI" icon={Cpu} />
                        <TabItem active={view === 'org'} onClick={() => setView('org')} label="Estrutura" icon={Building2} />
                        <div className="w-px h-6 bg-border mx-3 opacity-50 shrink-0" />
                        <TabItem active={view === 'health'} onClick={() => setView('health')} label="Saúde" icon={HeartPulse} />
                        <TabItem active={view === 'risk'} onClick={() => setView('risk')} label="Risco" icon={Shield} />
                        <TabItem active={view === 'financial'} onClick={() => setView('financial')} label="Financeiro" icon={DollarSign} />
                        <TabItem active={view === 'alerts'} onClick={() => setView('alerts')} label="Alertas" icon={AlertTriangle} />
                        <TabItem active={view === 'helpdesk'} onClick={() => setView('helpdesk')} label="Suporte" icon={Activity} />
                    </div>
                </div>
            </nav>

            {/* Visão de Performance/Monitoramento individual */}
            {view === 'performance' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Barra Lateral: Seleção de Dispositivo */}
                    <div className="lg:col-span-1 border-r border-border pr-4">
                        <div className="mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/70" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Filtrar dispositivos..."
                                    className="w-full bg-page/50 border border-border rounded-[1.5rem] py-4 pl-10 pr-4 text-xs text-main outline-none focus:border-accent/50 transition-all shadow-inner"
                                />
                            </div>
                        </div>
                        <div className="space-y-3 max-h-[700px] overflow-y-auto custom-scrollbar pr-3">
                            {filteredDevices
                                .filter((d: any) => !['SWITCH', 'FIREWALL', 'GATEWAY'].includes(d.type?.toUpperCase()))
                                .map((d: any) => (
                                    <button
                                        key={d.id}
                                        onClick={() => setSelectedDeviceId(d.id)}
                                        // Destaque se estiver selecionado
                                        className={`w-full text-left p-5 rounded-[1.5rem] border transition-all ${selectedDeviceId === d.id
                                            ? 'bg-accent/10 border-accent shadow-xl shadow-accent/10'
                                            : 'bg-card border-border hover:border-accent/30 shadow-sm'
                                            }`}
                                    >
                                        <div className="font-black italic text-sm text-main truncate">{d.name || d.hostname}</div>
                                        <div className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">{d.ip}</div>
                                    </button>
                                ))}
                        </div>
                    </div>

                    <div className="lg:col-span-3 space-y-8">
                        {!selectedDevice ? (
                            // Estado vazio quando nada foi selecionado
                            <div className="flex flex-col items-center justify-center p-20 text-secondary dark:text-slate-600 italic bg-card border border-dashed border-border rounded-[3rem]">
                                <Activity className="w-16 h-16 mb-6 opacity-20" />
                                <p className="font-bold text-lg">Selecione um dispositivo para analisar métricas</p>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                                {/* Cabeçalho do Ativo Monitorado */}
                                <div className="bg-card border border-border p-10 rounded-[3rem] items-center flex justify-between shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -mr-20 -mt-20" />
                                    <div className="relative z-10">
                                        <h3 className="text-3xl font-black text-main italic tracking-tight uppercase leading-none">{selectedDevice.name || selectedDevice.hostname}</h3>
                                        <div className="flex flex-wrap gap-4 mt-4">
                                            <span className="text-[11px] font-black text-accent bg-accent/10 dark:bg-accent/10 px-3 py-1 rounded-full border border-blue-200 dark:border-accent/50 font-mono">{selectedDevice.ip}</span>
                                            <span className="text-[11px] font-black text-secondary bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest">{selectedDevice.type}</span>
                                            {/* Indicador de Status Online/Offline */}
                                            <span className={`text-[11px] font-black px-3 py-1 rounded-full border ${selectedDevice.status?.toUpperCase() === 'ONLINE' ? 'bg-emerald-600/10 text-emerald-600 border-emerald-200 dark:border-emerald-800/50' : 'bg-rose-600/10 text-rose-600 border-rose-200 dark:border-rose-800/50'}`}>
                                                ● {selectedDevice.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="relative z-10 text-right">
                                        <div className="text-[11px] font-black text-secondary/70 uppercase tracking-widest mb-1">Localização</div>
                                        <div className="text-xl font-black text-main italic">{selectedDevice.location?.name || 'Unidade Geral'}</div>
                                    </div>
                                </div>

                                {/* Gráficos de Performance em Tempo Real (Últimas 24h) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-card border border-border p-8 rounded-[2.5rem] h-[350px] shadow-xl">
                                        <MetricChart
                                            title="Uso de CPU (Últimas 24h)"
                                            data={performanceMetrics.map((m: any) => ({ time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: m.cpu }))}
                                            color="#3b82f6"
                                            unit="%"
                                        />
                                    </div>
                                    <div className="bg-card border border-border p-8 rounded-[2.5rem] h-[350px] shadow-xl">
                                        <MetricChart
                                            title="Uso de RAM (Últimas 24h)"
                                            data={performanceMetrics.map((m: any) => ({ time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: m.memory }))}
                                            color="#8b5cf6"
                                            unit="%"
                                        />
                                    </div>
                                </div>

                                {/* Seção Inferior: Software Instalado no Dispositivo e Discos */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="md:col-span-2 bg-card border border-border p-8 rounded-[2.5rem] shadow-xl">
                                        <h3 className="text-lg font-black text-main italic mb-6 flex items-center gap-3">
                                            <Package className="w-5 h-5 text-amber-500" /> Software Instalado
                                        </h3>
                                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-3">
                                            <table className="w-full text-xs">
                                                <thead className="text-[10px] font-black text-secondary/70 uppercase border-b border-border">
                                                    <tr>
                                                        <th className="text-left py-4">Nome</th>
                                                        <th className="text-left py-4">Versão</th>
                                                        <th className="text-left py-4 px-4">Vendor</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                                    {(deviceInventory?.software || []).map((s: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-card/30 dark:hover:bg-slate-800/30 transition-colors group">
                                                            <td className="py-4 font-black italic text-slate-800 dark:text-slate-200">{s.name}</td>
                                                            <td className="py-4 text-secondary font-mono font-bold uppercase text-[9px]">{s.version || '-'}</td>
                                                            <td className="py-4 px-4 text-secondary/70 font-bold uppercase text-[9px]">{s.vendor || '-'}</td>
                                                        </tr>
                                                    ))}
                                                    {(!deviceInventory?.software || deviceInventory.software.length === 0) && (
                                                        <tr><td colSpan={3} className="py-20 text-center text-secondary/70 italic">Nenhum software inventariado.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl">
                                        <h3 className="text-lg font-black text-main italic mb-8 flex items-center gap-3">
                                            <HardDrive className="w-5 h-5 text-emerald-500" /> Discos
                                        </h3>
                                        <div className="space-y-4">
                                            {diskMetrics.length > 0 ? (
                                                Object.entries((diskMetrics[diskMetrics.length - 1] as any).disks || {}).map(([mount, data]: [string, any]) => (
                                                    <div key={mount} className="space-y-1">
                                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                                            <span className="text-secondary/70">{mount}</span>
                                                            <span className="text-white">{((data.used / data.total) * 100).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-emerald-500 rounded-full"
                                                                style={{ width: `${(data.used / data.total) * 100}%` }}
                                                            />
                                                        </div>
                                                        <div className="text-[9px] text-secondary text-right">
                                                            {(data.used / (1024 ** 3)).toFixed(1)}GB / {(data.total / (1024 ** 3)).toFixed(1)}GB
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-10 text-slate-700 italic text-xs">Sem dados de disco disponíveis.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Visão de Ativos: Tabela Global */}
            {view === 'devices' && (
                <div className="space-y-6">
                    {/* Tabela de Dispositivos */}
                    <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-page/50 text-secondary font-black uppercase tracking-widest border-b border-border">
                                    <th className="px-8 py-6">Equipamento</th>
                                    <th className="px-8 py-6">Rede</th>
                                    <th className="px-8 py-6">Localização (Unidade / Depto)</th>
                                    <th className="px-8 py-6 text-right">Status / Offline</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {filteredDevices.map((d: any) => {
                                    // Lógica para destacar dispositivos offline há mais de 30 dias
                                    const isLongOffline = d.status === 'OFFLINE' && d.offlineSince &&
                                        ((new Date().getTime() - new Date(d.offlineSince).getTime()) / (1000 * 60 * 60 * 24)) > 30;

                                    return (
                                        <tr key={d.id} className={`hover:bg-card/30 dark:hover:bg-slate-800/30 transition-colors group ${isLongOffline ? 'bg-rose-500/5' : ''}`}>
                                            <td className="px-8 py-5">
                                                <div className="font-black italic text-main dark:text-slate-200">{d.name || d.hostname}</div>
                                                <div className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-0.5">{d.type}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="font-mono font-bold text-accent">{d.ip}</div>
                                                <div className="text-[9px] text-secondary/70 font-medium">ID: {d.id.slice(0, 8)}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="text-slate-700 dark:text-slate-300 font-black italic">{d.location?.name || 'Não atribuído'}</div>
                                                <div className="text-[10px] text-secondary font-bold uppercase tracking-widest">{d.departmentRef?.name || 'Geral'}</div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`px-4 py-2 rounded-xl font-black uppercase text-[9px] border transition-all ${d.status?.toUpperCase() === 'ONLINE' ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]' : 'bg-rose-500/5 text-rose-500 border-rose-500/20'}`}>
                                                        {d.status}
                                                    </span>
                                                    {/* Data de início do estado Offline */}
                                                    {d.status?.toUpperCase() === 'OFFLINE' && d.offlineSince && (
                                                        <span className={`text-[9px] font-bold uppercase tracking-tight ${isLongOffline ? 'text-rose-500' : 'text-secondary/70'}`}>
                                                            Desde {new Date(d.offlineSince).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Visão de Software: Ranking e Pesquisa por Aplicativos */}
            {view === 'software' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Filtros de Software na Barra Lateral */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl">
                            <h3 className="text-lg font-black text-main italic mb-8 flex items-center gap-3">
                                <Search className="w-5 h-5 text-accent" /> Filtros
                            </h3>

                            <div className="space-y-6">
                                {/* Busca por Nome de Software */}
                                <div>
                                    <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest px-2 block mb-3">Pelo Nome</label>
                                    <input
                                        value={softSearch}
                                        onChange={e => setSoftSearch(e.target.value)}
                                        placeholder="Ex: Office, Chrome, Java..."
                                        className="w-full bg-page/50 border border-border rounded-2xl p-4 text-xs text-main outline-none focus:border-accent/50 transition-all shadow-inner"
                                    />
                                </div>

                                {/* Filtro por Departamento */}
                                <div>
                                    <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest px-2 block mb-3">Departamento</label>
                                    <div className="relative">
                                        <select
                                            value={selectedDept}
                                            onChange={e => setSelectedDept(e.target.value)}
                                            className="w-full bg-page/50 border border-border rounded-2xl p-4 text-xs text-main outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all shadow-inner"
                                        >
                                            <option value="">Todos os Departamentos</option>
                                            {orgInventory.map((loc: any) => (
                                                <optgroup key={loc.id} label={loc.name} className="bg-card font-black italic">
                                                    {loc.departments?.map((dept: any) => (
                                                        <option key={dept.id} value={dept.id} className="bg-card text-main">{dept.name}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Resultados Instantâneos da Pesquisa de Software */}
                            {softSearch && (
                                <div className="mt-10 space-y-4">
                                    <div className="flex justify-between items-center px-2">
                                        <p className="text-[10px] font-black text-secondary/70 uppercase tracking-widest">Resultados ({softSearchResults.length})</p>
                                        <button onClick={() => setSoftSearch('')} className="text-[10px] font-black text-accent uppercase hover:underline">Limpar</button>
                                    </div>
                                    <div className="max-h-[500px] overflow-y-auto space-y-3 custom-scrollbar pr-2">
                                        {softSearchResults.map((s: any, idx: number) => (
                                            <div key={idx} className="p-4 bg-page/50 border border-border rounded-2xl group hover:border-accent/30 transition-all shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-black italic text-main dark:text-slate-200 text-xs">{s.device?.name || s.device?.hostname}</div>
                                                        <div className="text-[9px] text-accent font-bold uppercase tracking-widest mt-1">{s.device?.ipAddress}</div>
                                                    </div>
                                                    <span className="text-emerald-600 dark:text-emerald-500 font-black text-[9px] bg-emerald-600/10 dark:bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50">v{s.version}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                                                    <Building2 className="w-3 h-3 text-secondary/70" />
                                                    <span className="text-[9px] text-secondary font-black uppercase tracking-widest truncate">
                                                        {s.device?.departmentRef?.name || 'Geral'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ranking Global de Software (Gráfico de Barras Horizontal customizado) */}
                    <div className="lg:col-span-3 bg-card border border-border p-10 rounded-[3rem] shadow-2xl">
                        <div className="flex items-center gap-3 mb-10">
                            <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                                <Package className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-black text-main italic tracking-tight">Ranking Global de Instalações</h3>
                        </div>
                        <div className="space-y-6">
                            {softRanking.slice(0, 15).map((s: any, idx: number) => (
                                <div key={idx} className="space-y-2 group">
                                    <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest px-2 transition-transform group-hover:translate-x-1">
                                        <span className="text-secondary">{s.name}</span>
                                        <span className="text-accent">{s.count} máquinas</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-white/5 bg-page rounded-full overflow-hidden border border-border shadow-inner">
                                        <div
                                            className="h-full bg-gradient-to-r from-accent via-accent to-cyan-400 transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                            style={{ width: `${(s.count / (softRanking[0]?.count || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Visão de Hardware BI: Dashboards de especificações técnicas */}
            {view === 'hardware' && (
                <div className="space-y-10">
                    {/* Cabeçalho de Totais Acumulados */}
                    {hwSpecs && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <StatCard
                                title="Ativos Inventariados"
                                value={hwSpecs.totals.devices}
                                icon={Database}
                                color="text-accent"
                            />
                            <StatCard
                                title="Capacidade Total RAM"
                                value={`${(Number(hwSpecs.totals.ram) / (1024 ** 3)).toFixed(0)} GB`}
                                icon={Cpu}
                                color="text-emerald-600 dark:text-emerald-400"
                            />
                            <StatCard
                                title="Armazenamento Total"
                                value={`${(Number(hwSpecs.totals.disk) / (1024 ** 4)).toFixed(1)} TB`}
                                icon={Database}
                                color="text-cyan-600 dark:text-cyan-400"
                            />
                        </div>
                    )}

                    {/* Gráficos de Distribuição de Hardware (CPU e RAM) */}
                    {hwSpecs && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <HardwareDistributionCard
                                title="Distribuição de CPUs"
                                data={hwSpecs.cpuDistribution}
                                color="#3b82f6"
                            />
                            <HardwareDistributionCard
                                title="Distribuição de RAM"
                                data={hwSpecs.ramDistribution}
                                color="#10b981"
                            />
                        </div>
                    )}

                    {/* Peripherals Section */}
                    <div className="bg-card border border-border p-10 rounded-[3rem] shadow-2xl">
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-2xl font-black text-main italic tracking-tight flex items-center gap-4">
                                <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                                    <Package className="w-7 h-7" />
                                </div>
                                Explorador de Hardware
                            </h3>
                            <div className="text-[10px] font-black text-secondary uppercase tracking-widest bg-page/50 px-5 py-3 rounded-2xl border border-border shadow-inner">
                                {peripherals.length} Periféricos Encontrados
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {peripherals.map((p: any, idx: number) => (
                                <div key={idx} className="bg-page/50 border border-border p-6 rounded-[2rem] hover:border-accent/30 transition-all group shadow-sm">
                                    <div className="flex justify-between items-start mb-5">
                                        <div className={`p-3 rounded-2xl bg-card border border-border shadow-sm ${p.type.toLowerCase().includes('print') ? 'text-emerald-600 dark:text-emerald-400' : 'text-secondary/70'}`}>
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-black text-secondary/70 dark:text-slate-600 uppercase tracking-widest bg-card px-3 py-1 rounded-lg border border-border">{p.type}</span>
                                    </div>
                                    <h4 className="font-black italic text-main dark:text-slate-200 text-base mb-1 truncate">{p.model || 'Modelo Genérico'}</h4>
                                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mb-6">{p.manufacturer || 'Fabricante OEM'}</p>

                                    <div className="space-y-3 pt-6 border-t border-border/50">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-secondary/70 font-black uppercase tracking-widest">Ativo</span>
                                            <span className="text-accent font-black italic">{p.device?.name || p.device?.hostname}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-secondary/70 font-black uppercase tracking-widest">Depto</span>
                                            <span className="text-secondary font-bold truncate max-w-[120px]">{p.device?.departmentRef?.name || 'Geral'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Original Performance Ranks */}
                    {hwAdvanced && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-800/50">
                            <HardwareRankCard title="Ativos com Maior Memória RAM" data={hwAdvanced.topMemory} unit="GB" divisor={1024 ** 3} color="#3b82f6" />
                            <HardwareRankCard title="Ativos com Maior Armazenamento" data={hwAdvanced.topDisk} unit="GB" divisor={1024 ** 3} color="#10b981" />
                        </div>
                    )}
                </div>
            )}

            {/* Visão Organizacional: Hierarquia de Unidades e Departamentos */}
            {view === 'org' && (
                <div className="bg-card border border-border p-10 rounded-[3rem] shadow-2xl space-y-12">
                    <div className="flex items-center gap-4 mb-10 border-b border-border pb-8">
                        <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-main italic tracking-tight">Estrutura Organizacional</h3>
                            <p className="text-[10px] text-secondary font-black uppercase tracking-widest mt-1">Hierarquia de Ativos por Unidade e Departamento</p>
                        </div>
                    </div>

                    {/* Mapeamento de Unidades (Locations) */}
                    <div className="grid grid-cols-1 gap-12">
                        {orgInventory.map((loc: any) => (
                            <div key={loc.id} className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-accent border border-white/10 shadow-md">
                                        <MapPin className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-black text-main uppercase italic tracking-tighter">{loc.name}</h4>
                                        <div className="flex gap-4 mt-1">
                                            <span className="text-[10px] text-secondary font-black uppercase tracking-widest">{loc.devices.length} Ativos Diretos</span>
                                            <span className="text-[10px] text-accent font-black uppercase tracking-widest">{loc.departments?.length || 0} Departamentos</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Listagem de Departamentos dentro da Unidade */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pl-2 lg:pl-16 relative">
                                    <div className="absolute left-1 md:left-8 top-0 bottom-0 w-px bg-border" />
                                    {loc.departments?.map((dept: any) => (
                                        <div key={dept.id} className="bg-page/50 border border-border p-6 rounded-[2rem] group hover:border-accent/30 transition-all shadow-sm">
                                            <h5 className="text-sm font-black text-main dark:text-slate-200 uppercase mb-4 flex items-center gap-3 group-hover:text-accent dark:group-hover:text-accent transition-colors">
                                                <ChevronRight className="w-4 h-4" /> {dept.name}
                                            </h5>
                                            <div className="flex justify-between items-center bg-card px-5 py-3 rounded-2xl text-[10px] border border-border/50">
                                                <span className="text-secondary/70 font-black uppercase tracking-widest">Dispositivos</span>
                                                <span className="text-main font-black italic text-sm">{dept.devices?.length || 0}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!loc.departments || loc.departments.length === 0) && (
                                        <div className="text-secondary/70 italic text-xs py-10 px-6 bg-page/50 rounded-[2rem] border border-dashed border-border">Nenhum departamento vinculado.</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Visão Explorer: Filtros técnicos avançados de hardware e rede */}
            {view === 'explorer' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Barra Lateral: Filtros Avançados */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl">
                            <h3 className="text-lg font-black text-main italic mb-8 flex items-center gap-3 font-mono">
                                <Search className="w-5 h-5 text-accent" /> FILTROS AVANÇADOS
                            </h3>

                            <div className="space-y-6">
                                {/* Filtro de Memória RAM */}
                                <div>
                                    <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest px-2 block mb-3">Memória RAM (GB)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="Min"
                                            value={filterRamMin === undefined ? '' : filterRamMin}
                                            onChange={e => setFilterRamMin(e.target.value === '' ? undefined : Number(e.target.value))}
                                            className="w-1/2 bg-page/50 border border-border rounded-2xl p-4 text-xs text-main outline-none focus:border-accent/50 transition-all font-bold"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Max"
                                            value={filterRamMax === undefined ? '' : filterRamMax}
                                            onChange={e => setFilterRamMax(e.target.value === '' ? undefined : Number(e.target.value))}
                                            className="w-1/2 bg-page/50 border border-border rounded-2xl p-4 text-xs text-main outline-none focus:border-accent/50 transition-all font-bold"
                                        />
                                    </div>
                                </div>

                                {/* Filtro por Departamento */}
                                <div>
                                    <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest px-2 block mb-3">Departamento</label>
                                    <select
                                        value={selectedDept}
                                        onChange={e => setSelectedDept(e.target.value)}
                                        className="w-full bg-page/50 border border-border rounded-2xl p-4 text-xs text-main outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all"
                                    >
                                        <option value="">Todos</option>
                                        {orgInventory.map((loc: any) => (
                                            <optgroup key={loc.id} label={loc.name}>
                                                {loc.departments?.map((dept: any) => (
                                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>

                                {/* Filtro por Tipo de Ativo */}
                                <div>
                                    <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest px-2 block mb-3">Tipo de Ativo</label>
                                    <select
                                        value={filterType}
                                        onChange={e => setFilterType(e.target.value)}
                                        className="w-full bg-page/50 border border-border rounded-2xl p-4 text-xs text-main outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all"
                                    >
                                        <option value="">Todos</option>
                                        <option value="Servidor">Servidor</option>
                                        <option value="Workstation">Workstation</option>
                                        <option value="Switch">Switch</option>
                                        <option value="Router">Router</option>
                                        <option value="Access Point">Access Point</option>
                                    </select>
                                </div>

                                {/* Filtro por Periférico presente */}
                                <div>
                                    <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest px-2 block mb-3">Possui Periférico</label>
                                    <input
                                        value={filterPeripheral}
                                        onChange={e => setFilterPeripheral(e.target.value)}
                                        placeholder="Ex: Impressora, Monitor..."
                                        className="w-full bg-page/50 border border-border rounded-2xl p-4 text-xs text-main outline-none focus:border-accent/50 transition-all font-bold"
                                    />
                                </div>

                                {/* Botão para Reset de filtros */}
                                <button
                                    onClick={() => {
                                        setFilterRamMin(undefined);
                                        setFilterRamMax(undefined);
                                        setSelectedDept('');
                                        setFilterType('');
                                        setFilterPeripheral('');
                                    }}
                                    className="w-full py-4 text-[10px] font-black text-accent uppercase tracking-widest hover:bg-accent/5 rounded-2xl transition-all"
                                >
                                    Limpar Filtros
                                </button>

                                {/* Presets Rápidos de Conformidade */}
                                <div className="pt-6 border-t border-border space-y-3">
                                    <p className="text-[9px] font-black text-secondary/70 uppercase tracking-widest px-2">Presets de Conformidade</p>
                                    <button
                                        onClick={() => { setFilterRamMax(7); setFilterRamMin(undefined); setFilterType(''); setFilterPeripheral(''); }}
                                        className="w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold text-rose-500 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-all flex items-center justify-between group"
                                    >
                                        <span>{`Upgrade RAM (< 8GB)`}</span>
                                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                                    </button>
                                    <button
                                        onClick={() => { setFilterRamMin(32); setFilterRamMax(undefined); setFilterType('Servidor'); setFilterPeripheral(''); }}
                                        className="w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold text-emerald-500 bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all flex items-center justify-between group"
                                    >
                                        <span>{`Servidores Críticos (>32GB)`}</span>
                                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                                    </button>
                                    <button
                                        onClick={() => { setFilterPeripheral('Impressora'); setFilterRamMin(undefined); setFilterRamMax(undefined); setFilterType(''); }}
                                        className="w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold text-accent bg-accent/5 border border-accent/10 hover:bg-accent/10 transition-all flex items-center justify-between group"
                                    >
                                        <span>Inventário de Impressoras</span>
                                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 space-y-6">
                        {/* Cabeçalho de Resultados e Ações */}
                        <div className="bg-card border border-border p-6 rounded-[2rem] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-accent/10 rounded-xl text-accent">
                                    <Search className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-main italic uppercase tracking-widest">Resultado da Busca</h3>
                                    <p className="text-[10px] text-secondary font-bold uppercase tracking-wide">{advancedDevices.length} ativos encontrados</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button
                                    onClick={exportToCSV}
                                    className="flex-1 md:flex-none py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-main dark:hover:text-white hover:bg-card/30 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="w-3 h-3" /> CSV
                                </button>
                                <button
                                    onClick={generatePDF}
                                    disabled={generatePDFMutation.isPending}
                                    className="flex-1 md:flex-none py-2.5 px-6 rounded-xl bg-accent hover:bg-accent text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {generatePDFMutation.isPending ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileText className="w-3 h-3" />}
                                    Exportar PDF
                                </button>
                            </div>
                        </div>

                        {/* Tabela de Resultados */}
                        <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl min-h-[400px]">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-page/50 text-secondary font-black uppercase tracking-widest border-b border-border">
                                        <th className="px-8 py-6">Equipamento</th>
                                        <th className="px-8 py-6">Rede</th>
                                        <th className="px-8 py-6">Especificações Técnicas</th>
                                        <th className="px-8 py-6 text-right">Localização</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {advancedDevices.map((d: any) => (
                                        <tr key={d.id} className="hover:bg-card/30 dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="font-black italic text-main dark:text-slate-200">{d.name || d.hostname}</div>
                                                <div className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-0.5">{d.type}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="font-mono font-bold text-accent">{d.ipAddress}</div>
                                                <div className="text-[9px] text-secondary/70 font-medium">SCAN ID: {d.id.slice(0, 8)}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex gap-4">
                                                    <div>
                                                        <div className="text-[10px] font-black text-secondary/70 uppercase">CPU</div>
                                                        <div className="text-xs font-black italic text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{d.hardware?.cpuModel || 'N/A'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-black text-secondary/70 uppercase">RAM</div>
                                                        <div className="text-xs font-black italic text-slate-700 dark:text-slate-300">{d.hardware?.totalMemory ? `${Math.round(Number(d.hardware.totalMemory) / (1024 ** 3))}GB` : 'N/A'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="text-slate-700 dark:text-slate-300 font-black italic">{d.location?.name || 'Geral'}</div>
                                                <div className="text-[10px] text-secondary font-bold uppercase tracking-widest">{d.departmentRef?.name || 'TI'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {advancedDevices.length === 0 && (
                                        <tr>
                                            <td colSpan={4}>
                                                <div className="flex flex-col items-center justify-center py-20 text-secondary/70 dark:text-slate-600">
                                                    <div className="w-16 h-16 bg-page/50 rounded-full flex items-center justify-center mb-4">
                                                        <Search className="w-8 h-8 opacity-20" />
                                                    </div>
                                                    <p className="text-sm font-black italic mb-2">Nenhum resultado encontrado</p>
                                                    <p className="text-[10px] uppercase tracking-widest text-secondary">Tente ajustar os filtros ao lado</p>
                                                    <button
                                                        onClick={() => {
                                                            setFilterRamMin(undefined);
                                                            setFilterRamMax(undefined);
                                                            setSelectedDept('');
                                                            setFilterType('');
                                                            setFilterPeripheral('');
                                                        }}
                                                        className="mt-6 text-[10px] font-black text-accent uppercase tracking-widest hover:underline"
                                                    >
                                                        Limpar Filtros
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Visão de Saúde: KPIs de Conformidade */}
            {view === 'health' && healthData && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <HealthIndicatorCard
                            title="Memória RAM"
                            value={healthData.ramCompliance}
                            icon={Cpu}
                            color="text-purple-600"
                            description="GTE 8GB"
                        />
                        <HealthIndicatorCard
                            title="Backup"
                            value={healthData.backupCompliance}
                            icon={Database}
                            color="text-accent"
                            description="Protegido"
                        />
                        <HealthIndicatorCard
                            title="UPS / No-break"
                            value={healthData.upsCompliance}
                            icon={Zap}
                            color="text-amber-500"
                            description="Segurança Elétrica"
                        />
                        <HealthIndicatorCard
                            title="Disponibilidade"
                            value={healthData.onlineRate}
                            icon={Activity}
                            color="text-emerald-500"
                            description="Status Online"
                        />
                    </div>
                </div>
            )}

            {/* Visão de Risco: Matriz de Vulnerabilidade */}
            {view === 'risk' && riskData && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <RiskMatrix data={riskData.matrix} />
                    <div className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl">
                        <h3 className="text-lg font-black text-main italic mb-8 flex items-center gap-3">
                            <Shield className="w-6 h-6 text-rose-600" /> Dispositivos com Maior Risco
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="text-secondary font-black uppercase tracking-widest border-b border-border">
                                        <th className="px-6 py-4">Equipamento</th>
                                        <th className="px-6 py-4">Fatores de Risco</th>
                                        <th className="px-6 py-4 text-right">Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {(riskData.criticalDevices as any[]).map((d: any) => (
                                        <tr key={d.id} className="hover:bg-card/30 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-black italic text-main dark:text-slate-200">{d.name}</div>
                                                <div className="text-[10px] text-secondary/70 font-mono italic">{d.ipAddress}</div>
                                            </td>
                                            <td className="px-6 py-4 flex gap-2">
                                                {d.status === 'OFFLINE' && <span className="bg-rose-500/10 text-rose-500 text-[8px] px-1.5 py-0.5 rounded font-black border border-rose-500/20 uppercase">Offline</span>}
                                                {!d.hasBackup && <span className="bg-amber-500/10 text-amber-500 text-[8px] px-1.5 py-0.5 rounded font-black border border-amber-500/20 uppercase">Sem Backup</span>}
                                                {!d.hasUPS && d.criticality === 'CRITICAL' && <span className="bg-orange-500/10 text-orange-500 text-[8px] px-1.5 py-0.5 rounded font-black border border-orange-500/20 uppercase">Sem UPS</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-base font-black italic ${d.riskScore > 70 ? 'text-rose-600' : 'text-orange-500'}`}>{d.riskScore}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Visão Financeira: Gestão de Ativos e ROI */}
            {view === 'financial' && financialData && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <FinancialChart
                        totalInvested={financialData.totalInvested}
                        currentValue={financialData.currentValue}
                        maintenanceCost={financialData.maintenanceCost}
                        roi={financialData.roi}
                    />
                </div>
            )}


            {/* Visão de Alertas: Notificações Estratégicas */}
            {view === 'alerts' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <AlertPanel alerts={alertsData} />
                </div>
            )}

            {/* Visão Helpdesk: Manutenção e Tickets */}
            {view === 'helpdesk' && helpdeskData && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                                <Activity className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-main italic uppercase tracking-tighter">Integração Helpdesk</h3>
                                <p className="text-sm text-secondary font-medium">Relatórios de manutenção e custo por ativo</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                            <div className="bg-page/50 p-6 rounded-2xl border border-border shadow-inner">
                                <p className="text-[10px] font-black text-secondary/70 uppercase tracking-widest italic mb-2">Total Gasto Manutenção</p>
                                <p className="text-3xl font-black text-rose-600 italic">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(helpdeskData.totalCosts || 0)}
                                </p>
                            </div>
                            <div className="bg-page/50 p-6 rounded-2xl border border-border shadow-inner">
                                <p className="text-[10px] font-black text-secondary/70 uppercase tracking-widest italic mb-2">Ativos com Mais Chamados</p>
                                <p className="text-3xl font-black text-amber-500 italic">{(helpdeskData.ranking || []).length} CRÍTICOS</p>
                            </div>
                            <div className="bg-page/50 p-6 rounded-2xl border border-border shadow-inner">
                                <p className="text-[10px] font-black text-secondary/70 uppercase tracking-widest italic mb-2">Eficiência Atendimento</p>
                                <p className="text-3xl font-black text-emerald-500 italic">ALTA</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-sm font-black text-secondary/70 uppercase tracking-widest italic px-2">Top 10 Ativos Custo-Efetivos</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-page/50 text-secondary font-black uppercase tracking-widest border-b border-border">
                                            <th className="px-8 py-5">Ativo</th>
                                            <th className="px-8 py-5 text-center">Chamados</th>
                                            <th className="px-8 py-5 text-right">Custo Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {(helpdeskData.ranking || []).map((h: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-card/30 dark:hover:bg-slate-800/30 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <div className="font-black italic text-main dark:text-slate-200">{h.name}</div>
                                                    <div className="text-[10px] text-secondary/70 italic font-mono uppercase tracking-tighter">{h.ipAddress}</div>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className={`text-sm font-black italic ${h.ticketCount > 5 ? 'text-rose-600' : h.ticketCount > 2 ? 'text-amber-500' : 'text-secondary/70'}`}>
                                                        {h.ticketCount}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right font-black italic text-slate-700 dark:text-slate-300">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(h.totalCost)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Sub-componente para cards de estatísticas rápidas
 */
function StatCard({ title, value, icon: Icon, color }: any) {
    return (
        <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl flex items-center gap-6 group hover:border-accent/20 transition-all">
            <div className={`w-16 h-16 rounded-[1.5rem] bg-page/50 flex items-center justify-center border border-border ${color} group-hover:scale-110 transition-transform shadow-inner`}>
                <Icon className="w-8 h-8" />
            </div>
            <div>
                <p className="text-[10px] text-secondary/70 font-black uppercase tracking-widest mb-1">{title}</p>
                <h4 className="text-2xl font-black text-main italic tracking-tight">{value}</h4>
            </div>
        </div>
    );
}

/**
 * Sub-componente para gráficos de distribuição (Barras Horizontais)
 */
function HardwareDistributionCard({ title, data, color }: any) {
    return (
        <div className="bg-card border border-border p-10 rounded-[3rem] shadow-2xl h-[450px] flex flex-col group hover:border-accent/10 transition-all">
            <h3 className="text-lg font-black text-main italic mb-10 flex items-center gap-3 tracking-tight">
                <div className="w-1.5 h-8 rounded-full bg-accent" /> {title}
            </h3>
            <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 60, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.1} horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            stroke="#94a3b8"
                            fontSize={10}
                            fontWeight="800"
                            width={100}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: '#3b82f6', opacity: 0.05 }}
                            contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1.5rem', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#0f172a', fontSize: '11px', fontWeight: 'bold' }}
                            wrapperClassName="dark:!bg-slate-900 dark:!border-slate-800"
                        />
                        <Bar dataKey="count" fill={color} radius={[0, 8, 8, 0]} barSize={28} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

/**
 * Sub-componente para cards de ranking (Top 10 etc)
 */
function HardwareRankCard({ title, data, unit, divisor = 1, color }: any) {
    return (
        <div className="bg-card border border-border p-10 rounded-[3rem] shadow-2xl h-[500px] flex flex-col group hover:border-accent/10 transition-all">
            <h3 className="text-lg font-black text-main italic mb-10 uppercase tracking-tight px-4 border-l-4 border-accent dark:border-accent">{title}</h3>
            <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 40, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.1} horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            stroke="#94a3b8"
                            fontSize={10}
                            fontWeight="800"
                            width={100}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: '#3b82f6', opacity: 0.05 }}
                            contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1.5rem', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#0f172a', fontSize: '11px', fontWeight: 'bold' }}
                            wrapperClassName="dark:!bg-slate-900 dark:!border-slate-800"
                            formatter={(value: any) => [`${(Number(value) / divisor).toFixed(1)} ${unit}`, 'Capacidade']}
                        />
                        <Bar dataKey="value" fill={color} radius={[0, 8, 8, 0]} barSize={24} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

/**
 * Sub-componente para Abas de Navegação
 */
function TabItem({ active, onClick, label, icon: Icon }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-accent/20 text-accent shadow-xl shadow-accent/20 active:scale-[0.98] border border-accent/30' : 'text-secondary hover:text-white hover:bg-white/5'}`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}
