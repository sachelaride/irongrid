import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Play, Loader2, CheckCircle2, XCircle, Network as NetworkIcon, Search, PlusCircle, Globe, Cpu, Server } from 'lucide-react';

/**
 * Componente NetworkDiscovery - Centro de Descoberta de Rede
 * 
 * Este componente permite aos administradores localizar ativos na rede automaticamente.
 * 
 * Funcionalidades:
 * - Escaneamento rápido de sub-redes (CIDR).
 * - Escaneamento baseado em faixas de IP pré-configuradas.
 * - Escolha de intensidade (Rápida, Profunda, Stealth).
 * - Acompanhamento do progresso e resultados em tempo real via tRPC.
 * - Integração com o motor Nmap no backend.
 * 
 * @module components/NetworkDiscovery
 */
export function NetworkDiscovery({ onNavigate }: { onNavigate?: (tab: any, subTab?: string) => void }) {
    // Estados locais para configuração da varredura
    const [intensity, setIntensity] = useState<'quick' | 'deep'>('deep');
    const [selectedRangeId, setSelectedRangeId] = useState('');
    const [subnet, setSubnet] = useState('');
    const [snmpCommunity, setSnmpCommunity] = useState('irongrid');
    const [activeScanId, setActiveScanId] = useState<string | null>(null);
    const [hoveredScanInfo, setHoveredScanInfo] = useState<{ title: string; desc: string; details: string[] } | null>(null);

    const utils = trpc.useContext();

    // Busca as faixas de rede pré-configuradas no sistema
    const { data: ranges = [] } = (trpc as any).snmp.listRanges.useQuery(undefined, {
        staleTime: 30000
    });

    /**
     * Consulta os resultados da varredura ativa.
     * Atualiza automaticamente a cada 2 segundos enquanto o status for 'running'.
     */
    const { data: scanStatus } = (trpc as any).discovery.getScanResults.useQuery(
        { scanId: activeScanId || '' },
        {
            enabled: !!activeScanId,
            refetchInterval: (data: any) => {
                if (data?.status === 'completed' || data?.status === 'failed') return false;
                return 2000;
            }
        }
    );

    // Mutação para iniciar escaneamento baseado em faixas salvas
    const rangeScanMutation = (trpc as any).discovery.scanRange.useMutation({
        onSuccess: (data: any) => {
            setActiveScanId(data.scanId);
        }
    });

    // Mutação para iniciar escaneamento rápido/manual de uma sub-rede
    const quickScanMutation = (trpc as any).discovery.quickScan.useMutation({
        onSuccess: (data: any) => {
            setActiveScanId(data.scanId);
            // Invalida o cache de dispositivos após o scan para mostrar as novidades
            setTimeout(() => {
                utils.scan.getDevices.invalidate();
                utils.inventory.getSoftwareInventoryFull.invalidate();
            }, 500);
        }
    });

    // Configurações de informações para o Hover
    const scanInfo = {
        quick: {
            title: "Varredura Rápida",
            desc: "Foco em velocidade e mapeamento básico de ativos.",
            details: [
                "Ping ICMP para detecção de hosts ativos.",
                "Scan das 100 portas mais comuns (TCP).",
                "Detecção básica de nome e IP."
            ]
        },
        deep: {
            title: "Varredura Profunda",
            desc: "Investigação completa do dispositivo e serviços.",
            details: [
                "Deep Port Scanning (mais de 1000 portas).",
                "OS Fingerprinting para identificar Sistemas Operacionais.",
                "Discovery SNMP para inventário de hardware e software."
            ]
        },
        scheduled: {
            title: "Varredura Agendada",
            desc: "Processamento otimizado para faixas de rede persistentes.",
            details: [
                "Varredura completa de toda a sub-rede CIDR.",
                "Sincronização automática com inventário IPAM.",
                "Respeita intervalos de agendamento para evitar sobrecarga."
            ]
        }
    };


    /**
     * Retorna o ícone visual correspondente ao estado atual da varredura.
     */
    const getScanStatusIcon = () => {
        if (!scanStatus) return null;

        switch (scanStatus.status) {
            case 'running':
                return <Loader2 className="w-5 h-5 text-accent animate-spin" />;
            case 'completed':
                return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Seção Principal de Configuração */}
            <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20 shadow-inner">
                            <NetworkIcon className="w-8 h-8 text-accent" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-main italic">Centro de Descoberta</h2>
                            <p className="text-secondary text-xs font-bold uppercase tracking-widest mt-1">Localização Automática de Ativos</p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-card/60 border border-border rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border shadow-inner">
                        {/* Formulário de Escaneamento Rápido */}
                        <div className="flex-1 p-8 space-y-4 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Globe className="w-12 h-12 text-accent" />
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-[12px] font-black text-main uppercase tracking-widest flex items-center gap-2">
                                    <Search className="w-4 h-4 text-accent" /> Varredura Rápida
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest ml-1">Sub-rede (CIDR)</label>
                                    <input
                                        value={subnet}
                                        onChange={e => setSubnet(e.target.value)}
                                        placeholder="Ex: 192.168.1.0/24"
                                        className="w-full bg-card border border-border rounded-xl p-3 text-sm text-main font-mono outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all shadow-inner"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest ml-1">Comunidade SNMP</label>
                                    <input
                                        value={snmpCommunity}
                                        onChange={e => setSnmpCommunity(e.target.value)}
                                        placeholder="irongrid"
                                        className="w-full bg-card border border-border rounded-xl p-3 text-sm text-main font-mono outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="pt-1">
                                <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest ml-1 block mb-2">Intensidade</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setIntensity('quick')}
                                        onMouseEnter={() => setHoveredScanInfo(scanInfo.quick)}
                                        onMouseLeave={() => setHoveredScanInfo(null)}
                                        className={`p-3 rounded-lg border transition-all text-left flex flex-col gap-0.5 ${intensity === 'quick' ? 'bg-accent/10 border-accent/50' : 'bg-card border-border hover:border-accent/30'}`}
                                    >
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${intensity === 'quick' ? 'text-accent' : 'text-secondary'}`}>RÁPIDA</span>
                                        <span className="text-[8px] text-secondary font-bold leading-tight line-clamp-1">Comum</span>
                                    </button>
                                    <button
                                        onClick={() => setIntensity('deep')}
                                        onMouseEnter={() => setHoveredScanInfo(scanInfo.deep)}
                                        onMouseLeave={() => setHoveredScanInfo(null)}
                                        className={`p-3 rounded-lg border transition-all text-left flex flex-col gap-0.5 ${intensity === 'deep' ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/50' : 'bg-card border-border hover:border-[#8b5cf6]/30'}`}
                                    >
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${intensity === 'deep' ? 'text-[#8b5cf6]' : 'text-secondary'}`}>PROFUNDA</span>
                                        <span className="text-[8px] text-secondary font-bold leading-tight line-clamp-1">Completa</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (!subnet) return;
                                    quickScanMutation.mutate({ subnet, intensity, snmpCommunity });
                                }}
                                onMouseEnter={() => setHoveredScanInfo(intensity === 'quick' ? scanInfo.quick : scanInfo.deep)}
                                onMouseLeave={() => setHoveredScanInfo(null)}
                                disabled={!subnet || quickScanMutation.isLoading || rangeScanMutation.isLoading}
                                className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-black py-3 rounded-xl shadow-lg shadow-accent/10 transition-all active:scale-[0.98] uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 border border-accent/20"
                            >
                                {quickScanMutation.isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                Iniciar Rapida
                            </button>
                            <button 
                                onClick={() => onNavigate?.('networkMgmt', 'communities')}
                                className="w-full text-[9px] font-black text-accent uppercase tracking-[0.2em] hover:opacity-80 flex items-center justify-center gap-2 bg-accent/5 hover:bg-accent/10 py-3 rounded-xl border border-accent/10 transition-all active:scale-95"
                            >
                                <Cpu className="w-3.5 h-3.5" /> GESTÃO DE COMUNIDADES
                            </button>
                        </div>

                        {/* Seleção de Faixas de Agendamento */}
                        <div className="flex-1 p-8 space-y-4 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <PlusCircle className="w-12 h-12 text-[#10b981]" />
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-[12px] font-black text-main uppercase tracking-widest flex items-center gap-2">
                                    <PlusCircle className="w-4 h-4 text-[#10b981]" /> Varredura Agendada
                                </h3>
                            </div>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest ml-1">Selecione uma faixa</label>
                                    <select
                                        value={selectedRangeId}
                                        onChange={e => setSelectedRangeId(e.target.value)}
                                        className="w-full bg-card border border-border rounded-xl p-3 text-sm text-main outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-bold appearance-none shadow-sm"
                                    >
                                        <option value="">Escolha uma faixa...</option>
                                        {(ranges as any[])?.filter((r: any) => r.enabled).map((r: any) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name} ({r.subnet})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {selectedRangeId && (
                                    <div className="p-3 bg-accent/5 rounded-xl border border-accent/10 space-y-1">
                                        <div className="flex justify-between items-center text-[8px] uppercase font-black tracking-widest text-secondary">
                                            <span>Última Varredura</span>
                                            <span className="text-main italic">
                                                {(() => {
                                                    const range = ranges.find((r: any) => r.id === selectedRangeId);
                                                    return range?.lastScanAt 
                                                        ? new Date(range.lastScanAt).toLocaleString() 
                                                        : 'Nunca';
                                                })()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[8px] uppercase font-black tracking-widest text-secondary">
                                            <span>Frequência Agendada</span>
                                            <span className="text-accent italic">
                                                {(() => {
                                                    const range = ranges.find((r: any) => r.id === selectedRangeId);
                                                    return `A cada ${range?.scanIntervalDays || 7} dias às ${range?.scanHour || 3}h`;
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    if (!selectedRangeId) return;
                                    rangeScanMutation.mutate({ rangeId: selectedRangeId });
                                }}
                                onMouseEnter={() => setHoveredScanInfo(scanInfo.scheduled)}
                                onMouseLeave={() => setHoveredScanInfo(null)}
                                disabled={!selectedRangeId || quickScanMutation.isLoading || rangeScanMutation.isLoading}
                                className="w-full bg-[#10b981] hover:opacity-90 disabled:opacity-50 text-white font-black py-3 rounded-xl shadow-lg shadow-[#10b981]/10 transition-all active:scale-[0.98] uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 border border-[#10b981]/20"
                            >
                                {rangeScanMutation.isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                Executar Agendada
                            </button>
                            <button 
                                onClick={() => onNavigate?.('networkMgmt', 'ranges')}
                                className="w-full text-[9px] font-black text-[#10b981] uppercase tracking-[0.2em] hover:opacity-80 flex items-center justify-center gap-2 bg-[#10b981]/5 hover:bg-[#10b981]/10 py-3 rounded-xl border border-[#10b981]/10 transition-all active:scale-95"
                            >
                                <PlusCircle className="w-3.5 h-3.5" /> GESTÃO DE FAIXAS IP
                            </button>
                        </div>
                    </div>

                    {/* Feedback Visual do Progresso e Resultados */}
                    <div className="bg-card/40 border border-border rounded-[1.5rem] p-6 min-h-[350px] flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-inner">
                        {!activeScanId ? (
                            <div className="space-y-4 animate-in fade-in zoom-in duration-700">
                                <Globe className="w-16 h-16 text-secondary/30 mx-auto group-hover:text-accent/40 transition-colors" />
                                <p className="text-secondary font-bold text-sm uppercase tracking-widest">Aguardando Início do Scan</p>
                            </div>
                        ) : (
                            <div className="w-full space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between mb-6 text-left">
                                    <div>
                                        <h3 className="text-xl font-black text-main italic">Status da Operação</h3>
                                        <p className="text-[10px] text-secondary font-bold uppercase tracking-widest truncate max-w-[200px]">{activeScanId}</p>
                                    </div>
                                    {getScanStatusIcon()}
                                </div>

                                {/* Barra de Progresso Circular/Linear */}
                                <div className="space-y-4">
                                    <div className="flex justify-between text-xs items-end">
                                        <span className="text-secondary font-black uppercase tracking-tighter">Progresso do Motor</span>
                                        <span className="text-3xl font-black text-main italic">{scanStatus?.progress || 0}%</span>
                                    </div>
                                    <div className="w-full bg-card rounded-full h-5 overflow-hidden border border-border p-1 shadow-inner">
                                        <div
                                            className="bg-accent h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(var(--accent),0.4)]"
                                            style={{ width: `${scanStatus?.progress || 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Cards de Dados em Tempo Real */}
                                <div className="grid grid-cols-2 gap-6 pt-10">
                                    <div className="bg-card border border-border p-6 rounded-[2rem] shadow-sm">
                                        <p className="text-[10px] font-black text-secondary/70 uppercase tracking-widest mb-1 text-center">Status</p>
                                        <p className={`text-sm font-black italic uppercase text-center text-accent`}>{scanStatus?.status || 'Calculando...'}</p>
                                    </div>
                                    <div className="bg-card border border-border p-6 rounded-[2rem] shadow-sm">
                                        <p className="text-[10px] font-black text-secondary/70 uppercase tracking-widest mb-1 text-center">Encontrados</p>
                                        <p className="text-4xl font-black text-[#10b981] italic text-center leading-none">{scanStatus?.found || 0}</p>
                                    </div>
                                </div>

                                {/* Lista de Dispositivos Encontrados (Pós-conclusão) */}
                                {scanStatus?.status === 'completed' && (
                                    <div className="pt-8 border-t border-border w-full overflow-hidden">
                                        <p className="text-[#10b981] text-[11px] font-black uppercase italic mb-6 flex items-center justify-center gap-3">
                                            ✓ Redes mapeadas e inventário atualizado
                                        </p>

                                        <div className="space-y-4 max-h-[450px] overflow-y-auto pr-3 custom-scrollbar">
                                            {(scanStatus as any).results?.map((device: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between p-5 bg-card/80 border border-border rounded-[1.5rem] hover:border-accent/30 transition-all group/item shadow-sm">
                                                    <div className="flex items-center gap-4 text-left">
                                                        <div className="w-12 h-12 bg-card/60 rounded-2xl flex items-center justify-center border border-border shadow-inner">
                                                            <Server className="w-6 h-6 text-secondary group-hover/item:text-accent transition-colors" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-sm font-black text-main italic truncate max-w-[180px]">{device.hostname || 'Desconhecido'}</h4>
                                                            <p className="text-[11px] font-mono text-secondary font-bold">{device.ip}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        {device.agentId && (
                                                            <span className="px-3 py-1 bg-accent/10 text-accent border border-accent/20 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm">
                                                                AGENT
                                                            </span>
                                                        )}
                                                        {device.snmpAvailable && (
                                                            <span className="px-3 py-1 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm">
                                                                SNMP
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Glossário */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DiscoveryInfoCard
                    number="01"
                    title="Mapeamento"
                    desc="ICMP Echo Request para identificar máquinas ligadas à rede física."
                    icon={Globe}
                    color="text-accent"
                />
                <DiscoveryInfoCard
                    number="02"
                    title="Heurística"
                    desc="Detecção de portas abertas (HTTP, SNMP, SSH) para classificar o tipo do ativo."
                    icon={Cpu}
                    color="text-[#8b5cf6]"
                />
                <DiscoveryInfoCard
                    number="03"
                    title="Auto-Populate"
                    desc="Inclusão direta no Inventário Central com atualização automática de 'Last Seen'."
                    icon={Server}
                    color="text-[#10b981]"
                />
            </div>
            {/* Rodapé de Informações (Hover) */}
            <div className={`h-24 bg-card border border-border rounded-[1.5rem] p-6 flex items-center shadow-2xl transition-all duration-300 mt-6 ${hoveredScanInfo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                {hoveredScanInfo && (
                    <div className="flex items-center gap-8 w-full animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-4 border-r border-border pr-8">
                            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                                <Search className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-accent uppercase tracking-widest italic">{hoveredScanInfo.title}</p>
                                <p className="text-[12px] font-bold text-main tracking-tight">{hoveredScanInfo.desc}</p>
                            </div>
                        </div>
                        <div className="flex gap-6 flex-1">
                            {hoveredScanInfo.details.map((detail, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(var(--accent),0.5)]" />
                                    <span className="text-[10px] font-bold text-secondary uppercase tracking-wide">{detail}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * DiscoveryInfoCard - Card informativo sobre as etapas da descoberta
 * @private
 */
function DiscoveryInfoCard({ number, title, desc, icon: Icon, color }: any) {
    return (
        <div className="bg-card/60 border border-border p-8 rounded-[2.5rem] shadow-xl hover:border-accent/20 transition-all group">
            <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 bg-card/80 rounded-2xl flex items-center justify-center ${color} border border-border shadow-inner group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7" />
                </div>
                <span className="text-3xl font-black text-secondary/20 italic group-hover:text-accent/30 transition-colors">{number}</span>
            </div>
            <h4 className="text-xl font-black text-main italic mb-2 tracking-tight">{title}</h4>
            <p className="text-secondary text-xs font-bold leading-relaxed uppercase tracking-wider opacity-80">{desc}</p>
        </div>
    );
}
