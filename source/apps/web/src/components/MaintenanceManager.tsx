/**
 * Componente MaintenanceManager - Gestão de Ciclo de Vida do Ativo
 * 
 * Este componente permite visualizar, filtrar e agendar manutenções (preventivas, 
 * corretivas, upgrades) para os ativos da rede. Oferece uma visão clara dos 
 * custos envolvidos e do histórico de intervenções em cada dispositivo.
 * 
 * Funcionalidades:
 * - Listagem de registros de manutenção com filtros por status.
 * - Suporte a visões específicas por dispositivo ou visão global.
 * - Cálculo e exibição de custos em Reais (BRL).
 * - Modal para agendamento de novas manutenções.
 * 
 * @module components/MaintenanceManager
 */

import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Wrench, Plus, Clock, User, DollarSign, X, Calendar, Server, ChevronDown, Check } from 'lucide-react';

interface MaintenanceManagerProps {
    /** ID opcional do dispositivo para filtrar manutenções específicas */
    deviceId?: string;
}

export function MaintenanceManager({ deviceId }: MaintenanceManagerProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

    // Consulta tRPC para listar registros de manutenção
    const { data: records = [], isLoading } = (trpc as any).maintenance.listRecords.useQuery({
        deviceId,
        status: filterStatus as any
    });

    /** Cores para os badges de status */
    const statusColors = {
        SCHEDULED: 'text-accent bg-accent/10 border-accent/20',
        IN_PROGRESS: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        COMPLETED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        CANCELLED: 'text-secondary bg-slate-950 border-slate-800'
    };

    /** Labels em português para os tipos de manutenção */
    const typeLabels = {
        PREVENTIVE: 'Preventiva',
        CORRECTIVE: 'Corretiva',
        UPGRADE: 'Upgrade',
        REPLACEMENT: 'Substituição'
    };

    return (
        <div className="space-y-6">
            {/* Header com Filtros e Ação */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card border border-border p-8 rounded-[2.5rem] shadow-xl">
                <div>
                    <h2 className="text-2xl font-black text-main italic flex items-center gap-3">
                        <Wrench className="w-6 h-6 text-accent" /> Gestão de Manutenção
                    </h2>
                    <p className="text-sm text-secondary font-medium ml-9">Prevenção e controle de custos de ativos</p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-accent hover:bg-accent text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/20 active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Agendar Manutenção
                    </button>
                    <div className="relative flex-1 lg:flex-none">
                        <select
                            value={filterStatus || ''}
                            onChange={e => setFilterStatus(e.target.value || undefined)}
                            className="w-full bg-page/50 border border-border rounded-[1.25rem] py-3.5 px-6 text-xs text-main outline-none focus:border-accent/50 appearance-none font-black uppercase tracking-widest min-w-[200px] transition-all"
                        >
                            <option value="" className="bg-card">Todos os Status</option>
                            <option value="SCHEDULED" className="bg-card">Agendadas</option>
                            <option value="IN_PROGRESS" className="bg-card">Em Execução</option>
                            <option value="COMPLETED" className="bg-card">Concluídas</option>
                            <option value="CANCELLED" className="bg-card">Canceladas</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/70 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Listagem de Cards de Manutenção */}
            {isLoading ? (
                <div className="p-12 text-center text-secondary animate-pulse font-black uppercase tracking-widest italic">Sincronizando registros...</div>
            ) : records.length === 0 ? (
                <div className="bg-card border border-dashed border-border p-20 rounded-[3rem] text-center shadow-sm">
                    <div className="w-20 h-20 bg-page/50 border border-border rounded-[2rem] flex items-center justify-center text-secondary/70 dark:text-slate-700 mx-auto mb-6">
                        <Wrench className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-black text-main italic mb-2">Sem registros ativos</h3>
                    <p className="text-secondary text-sm font-medium">Nenhuma manutenção foi registrada para os critérios selecionados.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {records.map((record: any) => (
                        <div key={record.id} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl hover:border-accent/30 dark:hover:border-accent/30 transition-all group flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusColors[record.status as keyof typeof statusColors]}`}>
                                        {record.status}
                                    </span>
                                    <span className="text-[10px] font-black text-secondary uppercase tracking-widest bg-page/50 px-3 py-1 rounded-lg border border-border shadow-sm">
                                        {typeLabels[record.type as keyof typeof typeLabels]}
                                    </span>
                                </div>

                                <h4 className="text-lg font-black text-main italic mb-4 group-hover:text-accent dark:group-hover:text-accent transition-colors leading-tight">
                                    {record.title}
                                </h4>

                                {record.description && (
                                    <p className="text-secondary text-xs mb-6 line-clamp-2 leading-relaxed">
                                        {record.description}
                                    </p>
                                )}

                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-[10px] font-bold text-secondary/70 uppercase tracking-widest">
                                        <div className="w-8 h-8 rounded-lg bg-page/50 flex items-center justify-center text-secondary/70 dark:text-slate-600 shadow-sm">
                                            <Calendar className="w-3.5 h-3.5" />
                                        </div>
                                        <span>{new Date(record.scheduledDate).toLocaleDateString()}</span>
                                    </div>
                                    {record.performer && (
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-secondary/70 uppercase tracking-widest">
                                            <div className="w-8 h-8 rounded-lg bg-page/50 flex items-center justify-center text-secondary/70 dark:text-slate-600 shadow-sm">
                                                <User className="w-3.5 h-3.5" />
                                            </div>
                                            <span>{record.performer}</span>
                                        </div>
                                    )}
                                    {!deviceId && (
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-secondary/70 uppercase tracking-widest">
                                            <div className="w-8 h-8 rounded-lg bg-page/50 flex items-center justify-center text-secondary/70 dark:text-slate-600 shadow-sm">
                                                <Server className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-accent">{record.device.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                                    <span className="text-xl font-black text-main italic">
                                        {record.cost ? (record.cost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(record.status !== 'COMPLETED' && record.status !== 'CANCELLED') && (
                                        <button
                                            onClick={() => setSelectedRecord(record)}
                                            className="p-3 bg-accent hover:bg-accent text-white rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                            title="Concluir e Registrar Custo"
                                        >
                                            <Check className="w-4 h-4" /> Concluir
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedRecord(record)}
                                        className="p-3 bg-page/50 hover:bg-white/5 dark:hover:bg-slate-800 text-secondary/70 hover:text-main dark:hover:text-white rounded-xl transition-all border border-border shadow-sm"
                                        title="Editar Registro"
                                    >
                                        <Clock className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal para Adicionar Novo Registro */}
            {showAddModal && (
                <AddMaintenanceModal
                    deviceId={deviceId}
                    onClose={() => setShowAddModal(false)}
                />
            )}

            {/* Modal para Atualizar Registro */}
            {selectedRecord && (
                <UpdateMaintenanceModal
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                />
            )}
        </div>
    );
}

/**
 * Modal interno para atualização de manutenção (conclusão e custos)
 * @private
 */
function UpdateMaintenanceModal({ record, onClose }: { record: any, onClose: () => void }) {
    const [title] = useState(record.title);
    const [description, setDescription] = useState(record.description || '');
    const [status, setStatus] = useState(record.status);
    const [cost, setCost] = useState(record.cost?.toString() || '');
    const [performer] = useState(record.performer || '');
    const [completedAt, setCompletedAt] = useState(new Date().toISOString().split('T')[0]);

    const utils = (trpc as any).useContext();

    const updateMutation = (trpc as any).maintenance.updateRecord.useMutation({
        onSuccess: () => {
            utils.maintenance.listRecords.invalidate();
            // Invalida também os devices para atualizar o custo acumulado no InventoryManager
            utils.scan.getDevices.invalidate();
            onClose();
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateMutation.mutate({
            id: record.id,
            title,
            description,
            status: status as any,
            cost: cost ? parseFloat(cost) : undefined,
            performer,
            completedAt: status === 'COMPLETED' ? completedAt : undefined
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-8 border-b border-border">
                    <div>
                        <h2 className="text-2xl font-black text-main italic tracking-tight uppercase">Atualizar Atendimento</h2>
                        <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">ID: {record.id.slice(-8)} • {record.device.name}</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-page/50 hover:bg-white/5 dark:hover:bg-slate-700 text-secondary/70 rounded-2xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Status do Atendimento</label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                                className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium appearance-none"
                            >
                                <option value="SCHEDULED" className="bg-card">Agendada</option>
                                <option value="IN_PROGRESS" className="bg-card">Em Execução</option>
                                <option value="COMPLETED" className="bg-card">Concluída</option>
                                <option value="CANCELLED" className="bg-card">Cancelada</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Custo Final (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={cost}
                                onChange={e => setCost(e.target.value)}
                                className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium placeholder:text-secondary/70 border-accent/30 ring-2 ring-accent/10"
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Resumo das Atividades</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium resize-none placeholder:text-secondary/70"
                            placeholder="Descreva o que foi feito..."
                        />
                    </div>

                    {status === 'COMPLETED' && (
                        <div className="space-y-1.5 animate-in slide-in-from-top-2">
                            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">Data de Conclusão</label>
                            <input
                                type="date"
                                value={completedAt}
                                onChange={e => setCompletedAt(e.target.value)}
                                className="w-full bg-page/50 border border-emerald-500/30 rounded-2xl p-4 text-main outline-none focus:border-emerald-500/50 transition-all font-medium"
                            />
                        </div>
                    )}

                    <div className="pt-4 flex items-center gap-4">
                        <button type="button" onClick={onClose} className="flex-1 px-8 py-4 text-secondary/70 hover:text-white font-bold uppercase tracking-widest text-xs transition-colors">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-5 rounded-2xl font-black italic transition-all disabled:opacity-50 uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20"
                        >
                            {updateMutation.isPending ? 'SALVANDO...' : 'SALVAR E ATUALIZAR'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * Modal interno para cadastro de manutenção
 * @private
 */
function AddMaintenanceModal({ deviceId: initialDeviceId, onClose }: { deviceId?: string, onClose: () => void }) {
    const [deviceId, setDeviceId] = useState(initialDeviceId || '');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('CORRECTIVE');
    const [status] = useState('SCHEDULED');
    const [cost, setCost] = useState('');
    const [performer, setPerformer] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const utils = (trpc as any).useContext();
    const { data: devicesData = [] } = (trpc as any).scan.getDevices.useQuery({});
    const devices = Array.isArray(devicesData) ? devicesData : (devicesData as any)?.devices ?? [];

    const createMutation = (trpc as any).maintenance.createRecord.useMutation({
        onSuccess: () => {
            utils.maintenance.listRecords.invalidate();
            onClose();
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({
            deviceId,
            title,
            description,
            type: type as any,
            status: status as any,
            cost: cost ? parseFloat(cost) : undefined,
            performer,
            scheduledDate: date
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-8 border-b border-border">
                    <div>
                        <h2 className="text-2xl font-black text-main italic tracking-tight uppercase">Registrar Manutenção</h2>
                        <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">Gestão de Ciclo de Vida do Ativo</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-page/50 hover:bg-white/5 dark:hover:bg-slate-700 text-secondary/70 rounded-2xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    {!initialDeviceId && (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Ativo / Dispositivo</label>
                            <select
                                required
                                value={deviceId}
                                onChange={e => setDeviceId(e.target.value)}
                                className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium appearance-none"
                            >
                                <option value="" className="bg-card">Selecionar Equipamento...</option>
                                {devices.map((d: any) => <option key={d.id} value={d.id} className="bg-card">{d.name || d.ipAddress}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Título da Manutenção</label>
                        <input
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium placeholder:text-secondary/70"
                            placeholder="Ex: Troca de cooler e limpeza"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Tipo</label>
                            <select
                                value={type}
                                onChange={e => setType(e.target.value)}
                                className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium appearance-none"
                            >
                                <option value="PREVENTIVE" className="bg-card">Preventiva</option>
                                <option value="CORRECTIVE" className="bg-card">Corretiva</option>
                                <option value="UPGRADE" className="bg-card">Upgrade</option>
                                <option value="REPLACEMENT" className="bg-card">Substituição</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Valor do Custo (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={cost}
                                onChange={e => setCost(e.target.value)}
                                className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium placeholder:text-secondary/70"
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Data / Agendamento</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Técnico / Performer</label>
                            <input
                                value={performer}
                                onChange={e => setPerformer(e.target.value)}
                                className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium placeholder:text-secondary/70"
                                placeholder="Nome do Responsável"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Observações Técnicas</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={4}
                            className="w-full bg-page/50 border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium resize-none placeholder:text-secondary/70"
                            placeholder="Detalhes sobre o que foi realizado..."
                        />
                    </div>

                    <div className="pt-4 flex items-center gap-4">
                        <button type="button" onClick={onClose} className="flex-1 px-8 py-4 text-secondary/70 hover:text-white font-bold uppercase tracking-widest text-xs transition-colors">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="flex-[2] bg-accent hover:bg-accent text-white px-8 py-5 rounded-2xl font-black italic transition-all disabled:opacity-50 uppercase tracking-widest text-xs"
                        >
                            {createMutation.isPending ? 'REGISTRANDO...' : 'SALVAR REGISTRO'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
