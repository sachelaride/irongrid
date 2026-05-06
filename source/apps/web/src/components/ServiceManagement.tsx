import { useState } from 'react';
import { trpc } from '../utils/trpc';
import {
    Clock,
    CheckCircle2,
    Save,
    Loader2,
    Plus,
    Trash2,
    Edit2,
    ChevronDown,
    ChevronUp,
    LayoutGrid,
    Settings2
} from 'lucide-react';

export function ServiceManagement() {
    const utils = trpc.useContext();
    const { data: groups = [], isLoading } = trpc.serviceTypes.listGroups.useQuery();

    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    const [editingGroup, setEditingGroup] = useState<any>(null);
    const [editingService, setEditingService] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    const upsertGroupMutation = trpc.serviceTypes.upsertGroup.useMutation({
        onSuccess: () => {
            utils.serviceTypes.listGroups.invalidate();
            setEditingGroup(null);
            setIsSaving(false);
        }
    });

    const upsertServiceMutation = trpc.serviceTypes.upsertService.useMutation({
        onSuccess: () => {
            utils.serviceTypes.listGroups.invalidate();
            setEditingService(null);
            setIsSaving(false);
        }
    });

    const deleteGroupMutation = trpc.serviceTypes.deleteGroup.useMutation({
        onSuccess: () => utils.serviceTypes.listGroups.invalidate(),
        onError: (err) => alert(err.message)
    });

    const deleteServiceMutation = trpc.serviceTypes.deleteService.useMutation({
        onSuccess: () => utils.serviceTypes.listGroups.invalidate()
    });

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="w-10 h-10 text-accent animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-black text-main italic tracking-tight uppercase">Grupos e Serviços</h3>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Gerencie o catálogo de serviços e SLAs por grupo</p>
                </div>
                <button
                    onClick={() => setEditingGroup({ name: '', description: '' })}
                    className="bg-accent hover:bg-accent text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
                >
                    <Plus size={16} /> Novo Grupo
                </button>
            </div>

            <div className="space-y-4">
                {groups.map((group) => (
                    <div key={group.id} className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-xl transition-all">
                        {/* Group Header */}
                        <div className="p-6 flex items-center justify-between group">
                            <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => toggleGroup(group.id)}>
                                <div className="p-3 bg-accent/10 text-accent rounded-2xl">
                                    <LayoutGrid size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-main uppercase tracking-tight italic">{group.name}</h4>
                                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">{group.services.length} SERVIÇOS VINCULADOS</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditingService({ name: '', description: '', groupId: group.id, priority: 'MEDIUM', responseTimeMinutes: 60, resolutionTimeMinutes: 480 })}
                                    className="p-2 text-secondary/70 hover:text-accent hover:bg-blue-50 dark:hover:bg-accent/10 rounded-xl transition-all"
                                    title="Adicionar Serviço"
                                >
                                    <Plus size={18} />
                                </button>
                                <button
                                    onClick={() => setEditingGroup(group)}
                                    className="p-2 text-secondary/70 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all"
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button
                                    onClick={() => { if (confirm('Excluir este grupo?')) deleteGroupMutation.mutate({ id: group.id }) }}
                                    className="p-2 text-secondary/70 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button
                                    onClick={() => toggleGroup(group.id)}
                                    className="p-2 text-secondary/70 hover:bg-card/30 dark:hover:bg-white/5 rounded-xl transition-all"
                                >
                                    {expandedGroups.includes(group.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Services List */}
                        {expandedGroups.includes(group.id) && (
                            <div className="border-t border-border p-4 bg-card/30/50 dark:bg-black/20 animate-in slide-in-from-top-2 duration-300">
                                {group.services.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <p className="text-[10px] text-secondary/70 font-black uppercase tracking-[0.2em]">Nenhum serviço neste grupo</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {group.services.map((service: any) => (
                                            <div key={service.id} className="bg-card border border-border p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h5 className="text-[12px] font-black text-main uppercase tracking-tight">{service.name}</h5>
                                                        <p className="text-[10px] text-secondary font-medium line-clamp-1 mt-1">{service.description}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button
                                                            onClick={() => setEditingService(service)}
                                                            className="p-1.5 text-secondary/70 hover:text-accent rounded-lg"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => { if (confirm('Excluir este serviço?')) deleteServiceMutation.mutate({ id: service.id }) }}
                                                            className="p-1.5 text-secondary/70 hover:text-red-500 rounded-lg"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5 p-1.5 bg-blue-50 dark:bg-accent/10 rounded-xl">
                                                        <Clock size={12} className="text-accent" />
                                                        <span className="text-[10px] font-black text-accent uppercase">{service.responseTimeMinutes}m</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                                                        <CheckCircle2 size={12} className="text-emerald-500" />
                                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">{service.resolutionTimeMinutes}m</span>
                                                    </div>
                                                    <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${service.priority === 'CRITICAL' ? 'bg-red-500 text-white' :
                                                        service.priority === 'HIGH' ? 'bg-orange-500 text-white' :
                                                            service.priority === 'MEDIUM' ? 'bg-accent text-white' :
                                                                'bg-slate-400 text-white'
                                                        }`}>
                                                        {service.priority}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal de Grupo */}
            {editingGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-white/10">
                        <h4 className="text-lg font-black text-main uppercase italic mb-6">
                            {editingGroup.id ? 'Editar Grupo' : 'Novo Grupo'}
                        </h4>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-2">Nome do Grupo</label>
                                <input
                                    className="w-full bg-white/5 dark:bg-black/40 border border-border rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 ring-accent/20 transition-all"
                                    value={editingGroup.name}
                                    onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                    placeholder="Ex: Grupo de Infraestrutura"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-2">Descrição</label>
                                <article className="w-full bg-white/5 dark:bg-black/40 border border-border rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 ring-accent/20 transition-all min-h-[100px]">
                                    <textarea
                                        className="w-full bg-transparent border-none p-0 outline-none resize-none"
                                        value={editingGroup.description || ''}
                                        onChange={e => setEditingGroup({ ...editingGroup, description: e.target.value })}
                                        placeholder="Descreva o propósito deste grupo..."
                                    />
                                </article>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => setEditingGroup(null)}
                                className="flex-1 py-4 text-[10px] font-black text-secondary uppercase tracking-widest hover:bg-white/5 dark:hover:bg-white/5 rounded-2xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setIsSaving(true);
                                    upsertGroupMutation.mutate(editingGroup);
                                }}
                                disabled={isSaving || !editingGroup.name}
                                className="flex-[2] bg-accent hover:bg-accent text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Salvar Grupo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Serviço */}
            {editingService && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl border border-white/10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-accent/10 text-accent rounded-2xl">
                                <Settings2 size={24} />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-main uppercase italic leading-none">
                                    {editingService.id ? 'Editar Serviço' : 'Novo Serviço'}
                                </h4>
                                <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-2">Configure o serviço e os tempos de SLA</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-2">Nome do Serviço</label>
                                    <input
                                        className="w-full bg-white/5 dark:bg-black/40 border border-border rounded-2xl p-4 text-sm font-bold outline-none"
                                        value={editingService.name}
                                        onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-2">Prioridade Padrão</label>
                                    <select
                                        className="w-full bg-white/5 dark:bg-black/40 border border-border rounded-2xl p-4 text-sm font-bold outline-none"
                                        value={editingService.priority}
                                        onChange={e => setEditingService({ ...editingService, priority: e.target.value })}
                                    >
                                        <option value="CRITICAL">CRITICAL</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="LOW">LOW</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-2">Descrição</label>
                                    <textarea
                                        className="w-full bg-white/5 dark:bg-black/40 border border-border rounded-2xl p-4 text-sm font-bold outline-none min-h-[80px]"
                                        value={editingService.description || ''}
                                        onChange={e => setEditingService({ ...editingService, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-card/30 p-6 rounded-[2rem] border border-border">
                                    <h5 className="text-[11px] font-black text-main uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <Clock size={14} className="text-accent" /> Tempos de SLA (Minutos)
                                    </h5>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest">Tempo de Resposta</label>
                                                <span className="text-[10px] font-black text-accent">{editingService.responseTimeMinutes}m</span>
                                            </div>
                                            <input
                                                type="number"
                                                className="w-full bg-card border border-border rounded-xl p-3 text-sm font-bold outline-none"
                                                value={editingService.responseTimeMinutes || ''}
                                                onChange={e => setEditingService({ ...editingService, responseTimeMinutes: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[9px] font-black text-secondary/70 uppercase tracking-widest">Tempo de Solução</label>
                                                <span className="text-[10px] font-black text-emerald-500">{editingService.resolutionTimeMinutes}m</span>
                                            </div>
                                            <input
                                                type="number"
                                                className="w-full bg-card border border-border rounded-xl p-3 text-sm font-bold outline-none"
                                                value={editingService.resolutionTimeMinutes || ''}
                                                onChange={e => setEditingService({ ...editingService, resolutionTimeMinutes: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-secondary/70 font-medium mt-4 leading-relaxed">
                                        * Define o tempo em minutos para o cumprimento do acordo.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => setEditingService(null)}
                                className="flex-1 py-4 text-[10px] font-black text-secondary uppercase tracking-widest hover:bg-white/5 dark:hover:bg-white/5 rounded-2xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setIsSaving(true);
                                    upsertServiceMutation.mutate(editingService);
                                }}
                                disabled={isSaving || !editingService.name}
                                className="flex-[2] bg-accent hover:bg-accent text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Salvar Serviço
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
