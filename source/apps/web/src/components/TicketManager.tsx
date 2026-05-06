/**
 * Componente TicketManager - Gestão de Chamados e ITSM
 * 
 * Este componente é o núcleo do sistema de Service Desk (ITSM). Ele permite
 * visualizar, filtrar e gerenciar chamados técnicos.
 * 
 * Funcionalidades:
 * - Listagem de chamados com filtros por status (Aberto, Em Atendimento, etc.).
 * - Visualização resumida em cards com indicadores de prioridade e SLA.
 * - Integração com criação de novos chamados e visualização detalhada.
 * - Suporte a temas (Dark/Light) e animações de entrada.
 * 
 * @module components/TicketManager
 */

import { useState, useEffect } from 'react';
import { trpc } from '../utils/trpc';
import { Plus, MessageSquare, User, X, ChevronRight, MapPin, Star, CheckCircle2, LayoutGrid, Lightbulb, FileSearch } from 'lucide-react';
import { CustomFieldsRenderer } from './CustomFieldsRenderer';

/** Rótulos amigáveis para os status de chamados */
const STATUS_LABELS: any = {
    OPEN: 'Aberto',
    IN_PROGRESS: 'Atendimento',
    PENDING: 'Pendente',
    COMPLETED: 'Concluídos',
    CANCELLED: 'Cancelado',
    ALL: 'Todos'
};

export function TicketManager() {
    const [statusFilter, setStatusFilter] = useState<string>('OPEN');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const [deptFilter, setDeptFilter] = useState<string>('');
    const [techFilter, setTechFilter] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

    trpc.auth.me.useQuery();
    const { data: departments = [] } = (trpc as any).organization.listDepartments.useQuery();
    const { data: users = [] } = (trpc as any).auth.listUsers.useQuery();
    const technicians = users.filter((u: any) => u.role !== 'USER');

    const { data: tickets = [], isLoading, refetch } = (trpc.tickets.list as any).useQuery({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as any),
        departmentId: deptFilter || undefined,
        assignedToId: techFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE
    });

    // Resetar página ao mudar filtros
    useEffect(() => {
        setPage(1);
    }, [statusFilter, deptFilter, techFilter, startDate, endDate]);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500 h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-main italic tracking-tight flex items-center gap-4 uppercase">
                        <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
                            <MessageSquare className="w-8 h-8 text-main" />
                        </div>
                        Gestão de Serviços
                    </h1>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-2 ml-16">ITSM & Suporte Técnico</p>
                </div>
                <div className="flex gap-4">
                    {view !== 'list' && (
                        <button
                            onClick={() => { setView('list'); setSelectedTicketId(null); }}
                            className="bg-white/5 text-secondary px-6 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-white/10 hover:text-main active:scale-95 flex items-center gap-3 border border-white/10"
                        >
                            <X className="w-5 h-5" /> Voltar
                        </button>
                    )}
                    {view === 'list' && (
                        <button
                            onClick={() => setView('create')}
                            className="cyber-button px-8 py-4 rounded-[1.5rem] text-xs uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-3"
                        >
                            <Plus className="w-5 h-5" /> Novo Chamado
                        </button>
                    )}
                </div>
            </div>

            {/* Filtros de Status */}
            {view === 'list' && (
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-wrap gap-2 bg-card/40 p-1.5 rounded-[1.5rem] border border-border/50 shadow-xl backdrop-blur-md w-fit">
                        {['OPEN', 'IN_PROGRESS', 'PENDING', 'COMPLETED', 'ALL'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === status
                                    ? 'bg-accent text-black shadow-lg shadow-accent/20 scale-105'
                                    : 'text-secondary hover:text-main hover:bg-white/5'
                                    }`}
                            >
                                {STATUS_LABELS[status]}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-card/40 p-2 rounded-[1.5rem] border border-border/50 shadow-xl ml-auto">
                        {/* Filtro por Departamento */}
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="bg-transparent border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-accent transition-all"
                        >
                            <option value="" className="bg-slate-900">Todos Departamentos</option>
                            {departments.map((d: any) => (
                                <option key={d.id} value={d.id} className="bg-slate-900">{d.name}</option>
                            ))}
                        </select>

                        <div className="h-6 w-px bg-white/10 mx-1" />

                        {/* Filtro por Técnico */}
                        <select
                            value={techFilter}
                            onChange={(e) => setTechFilter(e.target.value)}
                            className="bg-transparent border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-accent transition-all"
                        >
                            <option value="" className="bg-slate-900">Todos Técnicos</option>
                            {technicians.map((u: any) => (
                                <option key={u.id} value={u.id} className="bg-slate-900">{u.name}</option>
                            ))}
                        </select>

                        <div className="h-6 w-px bg-white/10 mx-1" />

                        {/* Filtro por Período */}
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-accent transition-all"
                            />
                            <span className="text-[10px] font-black text-secondary/70">ATÉ</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-accent transition-all"
                            />
                        </div>
                    </div>
                </div>
            )}
            {view === 'list' && (
                <>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-20 text-secondary italic bg-card border border-dashed border-border rounded-[3rem]">
                            <div className="w-12 h-12 border-4 border-accent/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                            <p className="font-medium">Sincronizando chamados...</p>
                        </div>
                    ) : statusFilter === 'IN_PROGRESS' ? (
                        <div className="space-y-12">
                            {/* Agrupamento por Técnico */}
                            {Object.entries(
                                tickets.reduce((acc: any, t: any) => {
                                    const techName = t.assignedTo?.name || 'Não Atribuído';
                                    if (!acc[techName]) acc[techName] = [];
                                    acc[techName].push(t);
                                    return acc;
                                }, {})
                            ).map(([techName, techTickets]: [string, any]) => (
                                <div key={techName} className="space-y-6">
                                    <div className="flex items-center gap-4 border-b border-border pb-4">
                                        <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
                                            <User className="w-5 h-5 text-accent" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-main uppercase tracking-widest italic">{techName}</h3>
                                            <p className="text-[10px] text-secondary font-bold uppercase tracking-[0.2em]">{techTickets.length} Atendimentos em Curso</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        {techTickets.map((ticket: any) => (
                                            <TicketCard
                                                key={ticket.id}
                                                ticket={ticket}
                                                onClick={() => {
                                                    setSelectedTicketId(ticket.id);
                                                    setView('detail');
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {tickets.length === 0 && <EmptyState />}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {/* Cabeçalho da Lista */}
                            <div className="grid grid-cols-[1fr_1.5fr_0.8fr_0.8fr_0.8fr_1fr] gap-4 px-4 py-2 text-[9px] font-black text-secondary uppercase tracking-[0.2em] border-b border-border bg-page/10 rounded-t-xl mb-1">
                                <div>Departamento</div>
                                <div>Serviço / Título</div>
                                <div className="text-center">Prioridade / Status</div>
                                <div className="text-center">Tempo Aberto</div>
                                <div className="text-center">Em Atendimento</div>
                                <div className="text-right pr-4">Técnico</div>
                            </div>

                            {tickets.map((ticket: any) => (
                                <TicketCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    onClick={() => {
                                        setSelectedTicketId(ticket.id);
                                        setView('detail');
                                    }}
                                />
                            ))}
                            {tickets.length === 0 && <EmptyState />}

                            {/* Paginação */}
                            {tickets.length > 0 && (
                                <div className="flex items-center justify-between mt-8 p-6 bg-card/30 rounded-3xl border border-border">
                                    <span className="text-[10px] font-black text-secondary/70 uppercase tracking-widest">Página {page}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="px-4 py-2 rounded-xl bg-card border border-border text-[10px] font-black text-main uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-accent/10"
                                        >
                                            Anteriores
                                        </button>
                                        <button
                                            onClick={() => setPage(p => p + 1)}
                                            disabled={tickets.length < PAGE_SIZE}
                                            className="px-4 py-2 rounded-xl bg-card border border-border text-[10px] font-black text-main uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-accent/10"
                                        >
                                            Próximos
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {view === 'create' && (
                <CreateTicketModal
                    onClose={() => {
                        setView('list');
                        refetch();
                    }}
                />
            )}

            {view === 'detail' && selectedTicketId && (
                <TicketDetailView
                    ticketId={selectedTicketId}
                    onClose={() => {
                        setSelectedTicketId(null);
                        setView('list');
                        refetch();
                    }}
                />
            )}
        </div>
    );
}

/**
 * Componentes Internos Reutilizáveis
 * @private
 */
function EmptyState() {
    return (
        <div className="col-span-full flex flex-col items-center justify-center p-20 text-secondary italic glass-panel rounded-[3rem]">
            <div className="p-8 bg-white/5 rounded-[2.5rem] mb-6 shadow-inner">
                <MessageSquare className="w-16 h-16 text-main/20" />
            </div>
            <h3 className="text-xl font-black text-main/70 italic tracking-tight uppercase">Tudo em dia!</h3>
            <p className="text-sm font-medium mt-2">Nenhum chamado pendente encontrado.</p>
        </div>
    );
}

function TicketCard({ ticket, onClick }: { ticket: any, onClick: () => void }) {
    const calculateDuration = (start: string | Date, end: string | Date | null = new Date()) => {
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : new Date().getTime();
        const diffMs = endTime - startTime;

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
        return `${hours}h ${minutes}m`;
    };

    const openTime = calculateDuration(ticket.createdAt, ticket.resolvedAt || ticket.closedAt);
    const processingTime = ticket.assignedAt
        ? calculateDuration(ticket.assignedAt, ticket.resolvedAt || ticket.closedAt)
        : '-';

    return (
        <div
            onClick={onClick}
            className={`bg-card border px-4 py-2 rounded-lg hover:border-primary/40 cursor-pointer transition-all hover:shadow-md group relative overflow-hidden shadow-sm grid grid-cols-[1fr_1.5fr_0.8fr_0.8fr_0.8fr_1fr] gap-4 items-center ${ticket.isCritical ? 'border-red-500/50 bg-red-500/5' : 'border-border'}`}
        >
            {ticket.isCritical && (
                <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-500 animate-pulse" />
            )}

            {/* Departamento */}
            <div className="min-w-0">
                <div className="text-[9px] font-black text-accent uppercase tracking-widest truncate">
                    {ticket.device?.departmentRef?.name || 'Geral'}
                </div>
                <div className="text-[8px] text-secondary/70 font-bold uppercase truncate opacity-70">
                    {ticket.device?.name || 'Sem Dispositivo'}
                </div>
            </div>

            {/* Serviço / Título */}
            <div className="min-w-0">
                <div className="text-[8px] font-bold text-secondary uppercase tracking-tight truncate mb-0.5">
                    {ticket.serviceType?.name || 'Suporte'}
                </div>
                <h3 className="text-[11px] font-black text-main uppercase italic tracking-tight truncate group-hover:text-main transition-colors">
                    {ticket.title}
                </h3>
            </div>

            {/* Prioridade / Status */}
            <div className="flex flex-col gap-1 items-center">
                <div className="scale-75 origin-center">
                    <PriorityBadge priority={ticket.priority} />
                </div>
                <div className="scale-75 origin-center -mt-1">
                    <StatusBadge status={ticket.status} />
                </div>
                {ticket.status === 'RESOLVED' && !ticket.rating && (
                    <div className="text-[7px] font-black text-amber-500 bg-amber-500/10 px-1 rounded border border-amber-500/20 uppercase tracking-tighter animate-pulse">
                        Aguardando Avaliação
                    </div>
                )}
                {ticket.status === 'CLOSED' && ticket.rating && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                        {[...Array(5)].map((_, i) => (
                            <Star
                                key={i}
                                className={`w-2 h-2 ${i < ticket.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-700'}`}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Tempo Aberto */}
            <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-main uppercase tracking-tight">
                    {openTime}
                </span>
                <span className="text-[8px] text-secondary font-bold uppercase tracking-widest opacity-60">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                </span>
            </div>

            {/* Tempo Atendimento */}
            <div className="flex flex-col items-center">
                <span className={`text-[10px] font-black uppercase tracking-tight ${ticket.assignedAt ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-300'}`}>
                    {processingTime}
                </span>
                {ticket.assignedAt && (
                    <span className="text-[8px] text-secondary/70 font-bold uppercase tracking-widest opacity-60">
                        {new Date(ticket.assignedAt).toLocaleDateString()}
                    </span>
                )}
            </div>

            {/* Técnico */}
            <div className="flex items-center justify-end gap-2 min-w-0">
                <div className="min-w-0 text-right">
                    <div className="text-[9px] font-black text-main uppercase tracking-widest truncate">
                        @{ticket.assignedTo?.name || 'Pendente'}
                    </div>
                    <div className="text-[8px] text-secondary font-bold uppercase tracking-widest truncate opacity-60">
                        Solicitado p/ @{ticket.requesterId}
                    </div>
                </div>
                <div className="w-6 h-6 rounded-md bg-page/50 flex items-center justify-center border border-border shrink-0">
                    <User className="w-3 h-3 text-secondary" />
                </div>
            </div>
        </div>
    );
}

/**
 * Badge de Status - Exibe o estado atual do chamado com cores temáticas
 * @private
 */
function StatusBadge({ status }: { status: string }) {
    const labels: any = {
        OPEN: 'Aberto',
        IN_PROGRESS: 'Atendimento',
        PENDING: 'Pendente',
        RESOLVED: 'Encerrado',
        CLOSED: 'Fechado'
    };
    const styles: any = {
        OPEN: 'bg-accent/10 text-accent border-accent/20',
        IN_PROGRESS: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        PENDING: 'bg-white/5 text-secondary border-slate-500/20',
        RESOLVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        CLOSED: 'bg-accent/10 text-accent dark:text-accent border-accent/20',
    };
    return (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${styles[status]}`}>
            {labels[status]}
        </span>
    );
}

/**
 * Badge de Prioridade - Exibe a urgência do chamado com estilos visuais
 * @private
 */
function PriorityBadge({ priority }: { priority: string }) {
    const labels: any = {
        LOW: 'Baixa',
        MEDIUM: 'Média',
        HIGH: 'Alta',
        CRITICAL: 'Crítica'
    };
    const styles: any = {
        LOW: 'text-secondary',
        MEDIUM: 'text-accent',
        HIGH: 'text-orange-600 dark:text-orange-400',
        CRITICAL: 'text-rose-600 dark:text-rose-400 animate-pulse',
    };
    return (
        <span className={`font-black uppercase tracking-widest ${styles[priority]}`}>
            {labels[priority]}
        </span>
    );
}

/**
 * Modal de Criação de Chamado - Formulário para abertura de novos tickets
 * 
 * Permite selecionar localização, departamento, ativo/equipamento e tipo de serviço.
 * Realiza o cálculo automático de prioridade inicial baseado no tipo de serviço.
 * 
 * @private
 */
function CreateTicketModal({ onClose }: { onClose: () => void }) {
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();
    const { data: depts = [] } = (trpc as any).organization.listDepartments.useQuery();
    const { data: devices = [] } = trpc.scan.getDevices.useQuery({});
    const { data: serviceGroups = [] } = (trpc as any).serviceTypes.listGroups.useQuery();

    const [locationId, setLocationId] = useState('');
    const [deptId, setDeptId] = useState('');
    const [deviceSearch, setDeviceSearch] = useState('');
    const [isDeviceListOpen, setIsDeviceListOpen] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState<any>(null);

    const [form, setForm] = useState({
        title: '',
        description: '',
        impact: 'MEDIUM',
        urgency: 'MEDIUM',
        category: 'INCIDENT',
        deviceId: '',
        serviceTypeId: '',
    });

    const [customFields, setCustomFields] = useState<any[]>([]);

    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            const searchText = `${form.title} ${form.description}`.trim();
            if (searchText.length > 3) {
                setDebouncedSearch(searchText);
            } else {
                setDebouncedSearch('');
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [form.title, form.description]);

    const { data: suggestedArticles = [] } = (trpc as any).knowledge.listArticles.useQuery(
        { search: debouncedSearch },
        { enabled: debouncedSearch.length > 3 }
    );

    const createTicket = trpc.tickets.create.useMutation({
        onSuccess: () => {
            setForm({
                title: '',
                description: '',
                impact: 'MEDIUM',
                urgency: 'MEDIUM',
                category: 'INCIDENT',
                deviceId: '',
                serviceTypeId: '',
            });
            setCustomFields([]);
            setDeviceSearch('');
            setLocationId('');
            setDeptId('');
            onClose();
        }
    });

    const filteredDepts = depts.filter((d: any) => !locationId || d.locationId === locationId);

    const searchedDevices = devices.filter((d: any) => {
        const matchesTerm = !deviceSearch ||
            d.name?.toLowerCase().includes(deviceSearch.toLowerCase()) ||
            d.ip?.includes(deviceSearch);

        if (!matchesTerm) return false;

        if (deptId) return d.departmentId === deptId;
        if (locationId) return d.locationId === locationId;
        return true;
    });

    const handleSelectDevice = (device: any) => {
        setForm({ ...form, deviceId: device.id });
        setDeviceSearch(device.name || device.ip);
        setIsDeviceListOpen(false);

        if (device.location?.id) setLocationId(device.location.id);
        if (device.departmentRef?.id) setDeptId(device.departmentRef.id);
    };

    return (
        <div className="bg-card border border-border rounded-[2.5rem] w-full shadow-2xl overflow-hidden animate-in fade-in duration-200 flex flex-col flex-1">
            <div className="p-8 border-b border-border/10 flex justify-between items-center bg-page/10">
                <div>
                    <h2 className="text-2xl font-black text-main italic tracking-tight uppercase leading-none">Novo Chamado</h2>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-2">Suporte Técnico Netservice</p>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-page rounded-2xl transition-all"><X className="w-5 h-5 text-secondary" /></button>
            </div>

            <div className="flex flex-col lg:flex-row overflow-hidden min-h-[70vh]">
                {/* Main Form Column */}
                <div className="flex-1 p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar border-r border-border">
                    <div className="bg-card/30 p-6 rounded-[2rem] border border-border space-y-6 shadow-inner">
                        <h3 className="text-[10px] font-black text-accent uppercase tracking-widest italic flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" /> Origem / Localização
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Unidade</label>
                                <select
                                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-sm text-main outline-none focus:border-accent/50 transition-all shadow-sm"
                                    value={locationId}
                                    onChange={(e) => { setLocationId(e.target.value); setDeptId(''); }}
                                >
                                    <option value="">Todas</option>
                                    {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Departamento</label>
                                <select
                                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-sm text-main outline-none focus:border-accent/50 transition-all shadow-sm"
                                    value={deptId}
                                    onChange={(e) => setDeptId(e.target.value)}
                                >
                                    <option value="">Todos</option>
                                    {filteredDepts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card/30 p-6 rounded-[2rem] border border-border space-y-4 shadow-inner">
                        <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic flex items-center gap-2">
                            <LayoutGrid className="w-3.5 h-3.5" /> Classificação de Serviço
                        </h3>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Tipo de Serviço</label>
                            <select
                                className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-sm text-main outline-none focus:border-accent/50 transition-all shadow-sm font-bold"
                                value={form.serviceTypeId}
                                onChange={(e) => {
                                    const serviceId = e.target.value;
                                    const selectedService = serviceGroups.flatMap((g: any) => g.services).find((s: any) => s.id === serviceId);
                                    if (selectedService) {
                                        // Auto-ajusta impacto/urgencia baseado na prioridade do serviço
                                        let impact = 'MEDIUM';
                                        let urgency = 'MEDIUM';

                                        if (selectedService.priority === 'CRITICAL') { impact = 'HIGH'; urgency = 'HIGH'; }
                                        else if (selectedService.priority === 'HIGH') { impact = 'HIGH'; urgency = 'MEDIUM'; }
                                        else if (selectedService.priority === 'LOW') { impact = 'LOW'; urgency = 'LOW'; }

                                        setForm({ ...form, serviceTypeId: serviceId, impact, urgency });
                                    } else {
                                        setForm({ ...form, serviceTypeId: serviceId });
                                    }
                                }}
                            >
                                <option value="">Selecione um serviço...</option>
                                {serviceGroups.map((group: any) => (
                                    <optgroup key={group.id} label={group.name} className="bg-card">
                                        {group.services.map((service: any) => (
                                            <option key={service.id} value={service.id}>
                                                {service.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            <p className="text-[9px] text-secondary font-medium px-1 leading-tight mt-2 italic opacity-60">
                                * O SLA será calculado automaticamente com base no tipo de serviço e prioridade.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-1 relative">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Equipamento / Ativo Afetado</label>
                            <div className="relative">
                                <input
                                    className="w-full bg-page/50 border border-border rounded-lg px-4 py-3 text-sm text-main focus:ring-1 focus:ring-primary outline-none pr-10"
                                    placeholder="Comece a digitar o nome ou IP do ativo..."
                                    value={deviceSearch}
                                    onChange={(e) => {
                                        setDeviceSearch(e.target.value);
                                        setIsDeviceListOpen(true);
                                        if (!e.target.value) setForm({ ...form, deviceId: '' });
                                    }}
                                    onFocus={() => setIsDeviceListOpen(true)}
                                />
                                {form.deviceId && (
                                    <button
                                        onClick={() => { setForm({ ...form, deviceId: '' }); setDeviceSearch(''); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-main"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {isDeviceListOpen && searchedDevices.length > 0 && (
                                <div className="absolute z-[70] left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                    {searchedDevices.map((d: any) => (
                                        <button
                                            key={d.id}
                                            className="w-full text-left px-4 py-3 hover:bg-accent/20 text-sm border-b border-slate-800 last:border-none group transition-colors"
                                            onClick={() => handleSelectDevice(d)}
                                        >
                                            <div className="font-bold text-slate-200 group-hover:text-accent">{d.name || d.ip}</div>
                                            <div className="text-[10px] text-secondary font-mono">{d.ip} {d.location?.name ? `• ${d.location.name}` : ''}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Assunto / Título do Defeito</label>
                            <input
                                className="w-full bg-page/50 border border-border rounded-lg px-4 py-3 text-sm text-main outline-none focus:ring-1 focus:ring-primary transition-all"
                                placeholder="Resumo do problema..."
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Descrição Detalhada / Sintomas</label>
                            <textarea
                                className="w-full bg-page/50 border border-border rounded-lg px-4 py-3 text-sm text-main outline-none focus:ring-1 focus:ring-primary h-24 resize-none transition-all"
                                placeholder="Descreva o que está acontecendo..."
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </div>

                        <CustomFieldsRenderer
                            category={form.category}
                            values={customFields}
                            onChange={setCustomFields}
                        />
                    </div>
                </div>

                {/* Suggestions Side Panel - DEEP TECH OPTIMIZED */}
                {suggestedArticles.length > 0 && (
                    <div className="flex-1 lg:min-w-[600px] lg:max-w-[600px] p-8 glass-panel overflow-y-auto max-h-[70vh] custom-scrollbar animate-in slide-in-from-right-4 duration-500 border-l-4 border-amber-500/50">
                        {/* Pulsing Alert Header */}
                        <div className="mb-6 p-4 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl border border-amber-500/30">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <Lightbulb className="w-6 h-6 text-amber-500 animate-pulse" />
                                <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest italic">
                                    ⚠️ Soluções Sugeridas
                                </h3>
                                <Lightbulb className="w-6 h-6 text-amber-500 animate-pulse" />
                            </div>
                            <p className="text-center text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">
                                Base de Conhecimento IronGrid
                            </p>
                        </div>

                        {/* Strong CTA Message */}
                        <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                            <p className="text-xs text-secondary font-bold leading-relaxed text-center">
                                🎯 <span className="text-amber-500 font-black uppercase">Atenção:</span> Identificamos soluções que podem resolver seu problema <span className="text-accent font-black uppercase">Agora</span>!
                            </p>
                        </div>

                        {/* Article Cards - Enhanced */}
                        <div className="space-y-3">
                            {suggestedArticles.map((article: any, index: number) => (
                                <div
                                    key={article.id}
                                    className="relative bg-white/5 border border-white/10 p-4 rounded-2xl hover:border-amber-500/50 hover:bg-white/10 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-2 duration-300"
                                    onClick={() => setSelectedArticle(article)}
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    {/* Priority Badge */}
                                    <div className="absolute -top-2 -right-2 bg-amber-600 text-main text-[8px] font-black px-3 py-1 rounded-full shadow-lg">
                                        SOLUÇÃO #{index + 1}
                                    </div>

                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            {/* Article Icon */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg shadow-md">
                                                    <Lightbulb className="w-4 h-4 text-main" />
                                                </div>
                                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                                                    {article.category?.name || 'Geral'}
                                                </span>
                                            </div>

                                            {/* Article Title */}
                                            <h4 className="text-sm font-black text-main group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug mb-3">
                                                {article.title}
                                            </h4>

                                            {/* CTA Button */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-main uppercase tracking-widest bg-gradient-to-r from-emerald-500 to-green-600 px-3 py-1.5 rounded-xl shadow-lg group-hover:shadow-emerald-500/50 transition-all">
                                                    👉 Ler Solução Agora
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-amber-500 group-hover:text-amber-600 group-hover:translate-x-1 transition-all mt-1 animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bottom Warning */}
                        <div className="mt-6 p-3 bg-gradient-to-r from-accent/10 to-accent/10 dark:from-accent/5 dark:to-accent/5 border border-accent/30 dark:border-accent/30 rounded-xl">
                            <p className="text-[10px] text-center text-accent dark:text-blue-300 font-bold italic">
                                💡 Resolver agora = <span className="text-emerald-600 dark:text-emerald-400 font-black">Economia de tempo</span> para você e para a equipe!
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-8 border-t border-border/10 flex gap-4 bg-page/10">
                <button
                    onClick={onClose}
                    className="flex-1 py-4 rounded-2xl text-xs font-black text-secondary hover:bg-page uppercase tracking-widest transition-all border border-transparent hover:border-border"
                >
                    Cancelar
                </button>
                <button
                    onClick={() => (createTicket as any).mutate({ ...form, customFields } as any)}
                    disabled={!form.title || createTicket.isLoading}
                    className="flex-2 bg-primary hover:bg-primary/90 text-main px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
                >
                    {createTicket.isLoading ? 'Sincronizando...' : 'Concluir Abertura'}
                </button>
            </div>
            {/* Article Viewer Modal within Create Ticket */}
            {selectedArticle && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[80] flex items-center justify-center p-6">
                    <div className="bg-card border border-border rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-border/10 flex justify-between items-start bg-page/10">
                            <div className="flex-1">
                                <h3 className="text-[10px] font-black text-accent uppercase tracking-widest italic flex items-center gap-2 mb-3">
                                    <FileSearch className="w-4 h-4" /> Artigo de Ajuda
                                </h3>
                                <h2 className="text-2xl font-black text-main italic tracking-tight leading-tight">
                                    {selectedArticle.title}
                                </h2>
                            </div>
                            <button
                                onClick={() => setSelectedArticle(null)}
                                className="p-3 hover:bg-white/5 rounded-2xl transition-all"
                            >
                                <X className="w-5 h-5 text-secondary/70" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 prose-sm dark:prose-invert prose-slate max-w-none">
                            <div
                                dangerouslySetInnerHTML={{ __html: (selectedArticle.content || '').replace(/\n/g, '<br/>') }}
                                className="text-secondary leading-relaxed font-medium"
                            />
                        </div>
                        <div className="p-8 border-t border-white/5 bg-white/[0.02] flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => { setSelectedArticle(null); onClose(); }}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-main px-6 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Resolveu meu Problema
                            </button>
                            <button
                                onClick={() => setSelectedArticle(null)}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-main/80 px-6 py-4 rounded-2xl font-black italic text-xs uppercase tracking-widest transition-all border border-white/10"
                            >
                                Continuar com o Chamado
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Visualização Detalhada do Chamado - Painel lateral com informações completas
 * @private
 */
function TicketDetailView({ ticketId, onClose }: { ticketId: string, onClose: () => void }) {
    const utils = trpc.useContext();
    const { data: me } = (trpc.auth as any).me.useQuery();
    const { data: ticket, isLoading, refetch } = trpc.tickets.getById.useQuery({ id: ticketId });
    const { data: users = [] } = (trpc.auth as any).listUsers.useQuery();

    const mutationOptions = { onSuccess: () => refetch() };
    const updateStatus = (trpc.tickets as any).updateStatus.useMutation(mutationOptions);
    const assignTicket = (trpc.tickets as any).assign.useMutation(mutationOptions);
    const rateTicket = (trpc.tickets as any).rateTicket.useMutation({
        onSuccess: () => {
            refetch();
            alert('Obrigado por sua avaliação!');
        }
    });

    const addComment = (trpc.tickets as any).addComment.useMutation({
        onSuccess: () => {
            refetch();
            setComment('');
        }
    });

    const [comment, setComment] = useState('');
    const [rating, setRating] = useState(0);
    const [ratingComment, setRatingComment] = useState('');

    // Novos estados para o técnico
    const [actionCost, setActionCost] = useState('');
    const [actionComment, setActionComment] = useState('');

    if (isLoading) return null;
    if (!ticket) return null;

    const isRequester = me?.id === ticket.requesterId;
    const canRate = isRequester && (ticket as any).status === 'RESOLVED' && !(ticket as any).rating;
    const technicians = users.filter((u: any) => ['ADMIN', 'OPERATOR', 'TECNICO'].includes(u.role));

    const handleAssign = (userId: string) => {
        if (userId) {
            assignTicket.mutate({ id: ticket.id, userId });
        }
    };

    return (
        <div className="bg-card w-full border border-border shadow-2xl flex flex-col animate-in fade-in duration-500 rounded-[2.5rem] overflow-hidden flex-1">
            <div className="p-8 border-b border-border/10 flex justify-between items-center bg-page/10">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                        <span className="text-main font-black font-mono text-sm leading-none">#{ticket.ticketNumber}</span>
                    </div>
                    <h2 className="text-xl font-black text-main italic tracking-tight uppercase line-clamp-1">{ticket.title}</h2>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-page rounded-2xl transition-all">
                    <X className="w-5 h-5 text-secondary" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                {/* Informações Básicas */}
                <div className="grid grid-cols-2 gap-8 bg-page/10 p-6 rounded-[2rem] border border-border shadow-inner">
                    <InfoItem label="Status" value={<StatusBadge status={ticket.status} />} />
                    <InfoItem label="Prioridade" value={<PriorityBadge priority={ticket.priority} />} />
                    <InfoItem label="Torre / Serviço" value={
                        (ticket as any).serviceType ? (
                            <div className="space-y-1">
                                <div className="text-[10px] text-secondary/70 font-black uppercase tracking-widest">{((ticket as any).serviceType as any).group?.name}</div>
                                <div className="text-main font-bold italic">{(ticket as any).serviceType.name}</div>
                            </div>
                        ) : <span className="text-secondary italic">Não categorizado</span>
                    } />
                    <InfoItem label="Solicitante" value={<span className="font-black italic text-main">@{ticket.requesterId}</span>} />
                    <InfoItem
                        label="Técnico Responsável"
                        value={
                            // Se for Admin, sempre pode alterar
                            // Se não for Admin, mas o chamado estiver sem técnico, pode definir
                            (me?.role === 'ADMIN' || (!(ticket as any).assignedToId && me?.role !== 'USER')) ? (
                                <select
                                    onChange={(e) => handleAssign(e.target.value)}
                                    className="bg-card border border-border rounded-lg px-2 py-1 text-[10px] outline-none focus:border-primary transition-all font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400"
                                    value={(ticket as any).assignedToId || ""}
                                >
                                    <option value="">Atribuir Técnico</option>
                                    {technicians.map((u: any) => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            ) : (
                                (ticket as any).assignedToId ? (
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black italic">
                                        <User className="w-3.5 h-3.5" /> @{(ticket as any).assignedTo?.name || (ticket as any).assignedToId}
                                    </div>
                                ) : (
                                    <span className="text-secondary italic">Aguardando Atribuição</span>
                                )
                            )
                        }
                    />
                </div>

                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-main" /> Descrição do Defeito
                    </h4>
                    <div className="bg-card border border-border p-6 rounded-[2rem] text-sm text-secondary leading-relaxed font-medium italic shadow-sm">
                        {ticket.description || 'Sem descrição detalhada disponível.'}
                    </div>

                    <CustomFieldsRenderer
                        category={ticket.category}
                        values={(ticket as any).customValues || []}
                        readOnly
                    />
                </div>

                {/* Rating Section - Só aparece se estiver RESOLVED e for o solicitante */}
                {canRate && (
                    <div className="bg-emerald-600/5 border border-emerald-500/20 rounded-[2rem] p-8 space-y-6 animate-in zoom-in-95 duration-500 shadow-lg shadow-emerald-500/5">
                        <div className="text-center space-y-2">
                            <h4 className="text-xl font-black text-main italic uppercase tracking-tight">Avaliar Atendimento</h4>
                            <p className="text-xs text-secondary font-bold uppercase tracking-widest leading-relaxed">O técnico encerrou o atendimento. Por favor, avalie para fecharmos definitivamente o chamado.</p>
                        </div>

                        <div className="flex justify-center gap-3">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`p-2 transition-all transform hover:scale-110 ${rating >= star ? 'text-amber-500 fill-amber-500' : 'text-secondary'}`}
                                >
                                    <Star className="w-10 h-10" />
                                </button>
                            ))}
                        </div>

                        <textarea
                            className="w-full bg-card border border-border rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none h-24 text-main"
                            placeholder="Deixe um comentário sobre a solução (opcional)..."
                            value={ratingComment}
                            onChange={e => setRatingComment(e.target.value)}
                        />

                        <button
                            onClick={() => (rateTicket as any).mutate({ id: ticket.id, rating, comment: ratingComment })}
                            disabled={rating === 0 || rateTicket.isLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-main py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 className="w-5 h-5" /> AVALIAR E FECHAR CHAMADO
                        </button>
                    </div>
                )}

                {/* Exibição da Avaliação se já existir */}
                {(ticket as any).rating && (
                    <div className="bg-accent/5 border border-accent/20 rounded-[2rem] p-8 space-y-4">
                        <h4 className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Atendimento Avaliado
                        </h4>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Star key={star} className={`w-5 h-5 ${(ticket as any).rating >= star ? 'text-amber-500 fill-amber-500' : 'text-secondary'}`} />
                            ))}
                        </div>
                        {(ticket as any).ratingComment && (
                            <p className="text-sm text-secondary italic font-medium">"{(ticket as any).ratingComment}"</p>
                        )}
                    </div>
                )}

                {/* Linha do Tempo */}
                <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-emerald-500" /> Linha do Tempo / Atividade
                    </h4>
                    <div className="space-y-8 pl-4 border-l border-border/10 ml-2">
                        {ticket.activities.map((activity: any) => (
                            <div key={activity.id} className="relative group">
                                <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-card ${activity.type === 'TECHNICAL_NOTE' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' :
                                    activity.type === 'COMMENT' ? 'bg-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]' :
                                        'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`} />
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-main bg-page px-2 py-1 rounded-lg italic">@{activity.userId}</span>
                                        <span className="text-[10px] text-secondary font-bold uppercase tracking-tight">{new Date(activity.createdAt).toLocaleString()}</span>
                                        {activity.type === 'STATUS_CHANGE' && <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-emerald-500/20">Auto Log</span>}
                                        {activity.type === 'TECHNICAL_NOTE' && <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-amber-500/20 italic">Nota Técnica</span>}
                                    </div>
                                    <div className={`text-sm font-medium leading-relaxed p-4 rounded-2xl border shadow-sm group-hover:border-primary/20 transition-all ${activity.type === 'TECHNICAL_NOTE'
                                        ? 'bg-amber-500/5 border-amber-500/20 text-main italic'
                                        : 'bg-card border-border text-secondary'
                                        }`}>
                                        {activity.message}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Ações / Footer */}
            <div className="p-8 border-t border-border/10 space-y-6 bg-page/10">
                <div className="relative">
                    <textarea
                        className="w-full bg-card border border-border rounded-[2rem] p-5 pb-16 text-sm text-main outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner resize-none h-40"
                        placeholder="Escreva sua mensagem ou atualização técnica..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                    <button
                        onClick={() => addComment.mutate({ ticketId: ticket.id, message: comment })}
                        disabled={!comment || addComment.isLoading}
                        className="absolute right-4 bottom-4 px-6 py-3 bg-primary hover:bg-primary/90 text-main rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 active:scale-95 shadow-xl shadow-primary/20 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Enviar Resposta
                    </button>

                    {me?.role !== 'USER' && (
                        <button
                            onClick={() => addComment.mutate({ ticketId: ticket.id, message: comment, isTechnical: true })}
                            disabled={!comment || addComment.isLoading}
                            className="absolute right-[210px] bottom-4 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-main rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 active:scale-95 shadow-xl shadow-amber-500/20 flex items-center gap-2"
                            title="Registrar como Nota Técnia (Destaque Laranja)"
                        >
                            <Lightbulb className="w-5 h-5" /> Nota Técnica
                        </button>
                    )}
                </div>
                {/* Seção de Resolução para o Técnico */}
                {me?.role !== 'USER' && ticket.status === 'IN_PROGRESS' && (
                    <div className="bg-emerald-600/5 border border-emerald-500/20 rounded-[2.5rem] p-8 space-y-6 animate-in slide-in-from-bottom-4 duration-500 shadow-xl shadow-emerald-500/5">
                        <div className="flex items-center gap-4 border-b border-emerald-500/10 pb-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-main italic uppercase tracking-tight">Finalizar Atendimento</h4>
                                <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Registre os custos e notas técnicas para encerrar</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Custo do Serviço (BRL)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary font-black text-xs">R$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-card border border-border rounded-2xl pl-10 pr-4 py-4 text-sm font-black text-main outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                        placeholder="0,00"
                                        value={actionCost}
                                        onChange={e => setActionCost(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Tempo Gasto (opcional)</label>
                                <input
                                    type="text"
                                    className="w-full bg-card border border-border rounded-2xl px-4 py-4 text-sm font-black text-main outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                    placeholder="Ex: 2h 30min"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Notas Técnicas de Fechamento (Opcional)</label>
                            <textarea
                                className="w-full bg-card border border-border rounded-[1.5rem] p-4 text-sm text-secondary outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm resize-none h-24 placeholder:italic"
                                placeholder="Descreva a solução técnica aplicada..."
                                value={actionComment}
                                onChange={e => setActionComment(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={() => updateStatus.mutate({
                                id: ticket.id,
                                status: 'RESOLVED',
                                cost: actionCost ? parseFloat(actionCost) : undefined,
                                comment: actionComment || 'Atendimento finalizado pelo técnico.'
                            })}
                            disabled={updateStatus.isLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-main py-5 rounded-[1.5rem] font-black italic uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 group"
                        >
                            <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            {updateStatus.isLoading ? 'REGISTRANDO...' : 'ENCERRAR CHAMADO (TÉCNICO)'}
                        </button>
                    </div>
                )}

                <div className="flex flex-wrap gap-3 pb-2 custom-scrollbar items-center">
                    {['IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'].filter(s => s !== ticket.status).map(s => (
                        <button
                            key={s}
                            onClick={() => {
                                if (s === 'RESOLVED') {
                                    // Deixa para a seção de finalização acima tratar
                                    return;
                                }
                                updateStatus.mutate({ id: ticket.id, status: s as any });
                            }}
                            className={`px-4 py-2 bg-card border border-border rounded-xl text-[10px] text-secondary hover:text-main hover:border-primary/30 transition-all font-black uppercase tracking-widest shadow-sm shadow-black/5 whitespace-nowrap ${(s === 'RESOLVED' && me?.role !== 'USER') ? 'hidden' : ''}`}
                        >
                            {STATUS_LABELS[s]}
                        </button>
                    ))}

                    {/* Botão de Alterar Técnico (Apenas Admin) */}
                    {me?.role === 'ADMIN' && (
                        <div className="relative group/assign">
                            <button
                                className="px-4 py-2 bg-primary/10 text-main border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-main transition-all shadow-sm flex items-center gap-2"
                            >
                                <User className="w-3 h-3" /> Alterar
                            </button>
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover/assign:block z-50 bg-card border border-border rounded-2xl shadow-2xl p-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-2">
                                <div className="text-[8px] font-black text-secondary/70 uppercase tracking-widest px-3 py-2 border-b border-border/10 mb-2">Reatribuir Técnico</div>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                    {technicians.map((u: any) => (
                                        <button
                                            key={u.id}
                                            onClick={() => handleAssign(u.id)}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-between group/item ${ticket.assignedToId === u.id ? 'bg-primary/10 text-main' : 'text-secondary hover:bg-page'}`}
                                        >
                                            <span>{u.name}</span>
                                            {ticket.assignedToId === u.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Admin Actions */}
                {me?.role === 'ADMIN' && (
                    <div className="p-4 bg-page/10 rounded-2xl border border-border shadow-inner">
                        <AdminActions
                            ticket={ticket}
                            onAction={() => {
                                utils.tickets.list.invalidate();
                                onClose();
                            }}
                        />
                    </div>
                )}


            </div>
        </div>
    );
}

/**
 * Ações Administrativas - Funções restritas para administradores
 * @private
 */
function AdminActions({ ticket, onAction }: { ticket: any, onAction: () => void }) {
    const deleteTicket = (trpc.tickets as any).delete.useMutation({ onSuccess: onAction });
    const extendSLA = (trpc.tickets as any).extendSLA.useMutation({ onSuccess: onAction });
    const togglePause = (trpc.tickets as any).togglePause.useMutation({ onSuccess: onAction });

    const [justification, setJustification] = useState('');
    const [showExtend, setShowExtend] = useState(false);
    const [showPause, setShowPause] = useState(false);
    const [newDeadline, setNewDeadline] = useState('');

    const handleDelete = () => {
        if (confirm('Tem certeza que deseja EXCLUIR este chamado permanentemente?')) {
            deleteTicket.mutate({ id: ticket.id });
        }
    };

    const handlePause = () => {
        if (!justification) {
            alert('Por favor, insira uma justificativa para pausar/retomar o clock.');
            return;
        }
        togglePause.mutate({ id: ticket.id, justification });
        setJustification('');
        setShowPause(false);
    };

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-main rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 shadow-sm"
                >
                    Excluir Chamado
                </button>
                <button
                    onClick={() => { setShowPause(!showPause); setShowExtend(false); setJustification(''); }}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${ticket.slaPaused
                        ? 'bg-emerald-500 text-main border-emerald-600'
                        : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-main border-amber-500/20'}`}
                >
                    {ticket.slaPaused ? 'Retomar Clock' : 'Parar Clock'}
                </button>
                <button
                    onClick={() => { setShowExtend(!showExtend); setShowPause(false); setJustification(''); }}
                    className="px-4 py-2 bg-accent/10 text-accent hover:bg-accent hover:text-main rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-accent/20 shadow-sm"
                >
                    Expandir SLA
                </button>
            </div>

            {(showExtend || showPause) && (
                <div className="space-y-3 p-4 bg-card rounded-xl border border-border animate-in slide-in-from-top-2">
                    {showExtend && (
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest ml-1">Novo Prazo (Deadline)</label>
                            <input
                                type="datetime-local"
                                className="w-full bg-card/30 border border-border rounded-lg px-3 py-2 text-xs font-bold"
                                value={newDeadline}
                                onChange={(e) => setNewDeadline(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest ml-1">Justificativa</label>
                        <textarea
                            className="w-full bg-card/30 border border-border rounded-lg px-3 py-2 text-xs font-medium h-20 resize-none"
                            placeholder={showPause ? "Motivo da pausa/retomada..." : "Motivo da alteração..."}
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                        />
                    </div>
                    {showExtend ? (
                        <button
                            onClick={() => extendSLA.mutate({ id: ticket.id, newDeadline: new Date(newDeadline).toISOString(), justification })}
                            disabled={!newDeadline || !justification || extendSLA.isLoading}
                            className="w-full bg-accent text-main py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-accent transition-all disabled:opacity-50"
                        >
                            Confirmar Expansão
                        </button>
                    ) : (
                        <button
                            onClick={handlePause}
                            disabled={!justification || togglePause.isLoading}
                            className="w-full bg-amber-600 text-main py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all disabled:opacity-50"
                        >
                            Confirmar Alteração de Clock
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Item de Informação - Utilitário para exibição de label/valor formatado
 * @private
 */
function InfoItem({ label, value }: { label: string, value: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <span className="text-[10px] text-secondary/70 uppercase font-black tracking-widest">{label}</span>
            <div className="text-sm text-main font-bold">{value}</div>
        </div>
    );
}
