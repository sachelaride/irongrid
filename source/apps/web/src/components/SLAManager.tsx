import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Clock, CheckCircle2, Save, Loader2, AlertCircle } from 'lucide-react';

export function SLAManager() {
    const utils = trpc.useContext();
    const { data: configs = [], isLoading } = (trpc.tickets as any).listSLA.useQuery();
    const updateMutation = (trpc.tickets as any).updateSLA.useMutation({
        onSuccess: () => {
            utils.tickets.listSLA.invalidate();
            alert('Configuração de SLA atualizada!');
        }
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [responseTime, setResponseTime] = useState(0);
    const [resolutionTime, setResolutionTime] = useState(0);

    const handleEdit = (config: any) => {
        setEditingId(config.id);
        setResponseTime(config.responseTimeMinutes);
        setResolutionTime(config.resolutionTimeMinutes);
    };

    const handleSave = () => {
        if (!editingId) return;
        updateMutation.mutate({
            id: editingId,
            responseTimeMinutes: responseTime,
            resolutionTimeMinutes: resolutionTime
        });
        setEditingId(null);
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
            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-black text-main italic tracking-tight uppercase">Acordos de Nível de Serviço (SLA)</h3>
                <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Defina prazos máximos de atendimento para cada nível de prioridade</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {configs.map((config: any) => {
                    const isEditing = editingId === config.id;
                    const priorityColor =
                        config.priority === 'CRITICAL' ? 'text-red-500 bg-red-500/10' :
                            config.priority === 'HIGH' ? 'text-orange-500 bg-orange-500/10' :
                                config.priority === 'MEDIUM' ? 'text-accent bg-accent/10' :
                                    'text-secondary bg-white/5';

                    return (
                        <div key={config.id} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl transition-all hover:border-accent/30">
                            <div className="flex justify-between items-center mb-6">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${priorityColor}`}>
                                    {config.priority}
                                </span>
                                {!isEditing && (
                                    <button
                                        onClick={() => handleEdit(config)}
                                        className="text-[10px] font-black text-accent uppercase tracking-widest hover:underline"
                                    >
                                        Editar Prazos
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] text-secondary font-bold uppercase tracking-widest">
                                        <Clock className="w-3.5 h-3.5" /> Resposta
                                    </div>
                                    {isEditing ? (
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={responseTime}
                                                onChange={e => setResponseTime(parseInt(e.target.value))}
                                                className="w-full bg-card/40 border border-border rounded-xl p-3 text-sm font-bold text-accent outline-none focus:border-accent"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-secondary/70 font-black uppercase">min</span>
                                        </div>
                                    ) : (
                                        <div className="text-2xl font-black text-main italic">
                                            {config.responseTimeMinutes}
                                            <span className="text-[10px] uppercase ml-1 opacity-40 not-italic">minutos</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] text-secondary font-bold uppercase tracking-widest">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolução
                                    </div>
                                    {isEditing ? (
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={resolutionTime}
                                                onChange={e => setResolutionTime(parseInt(e.target.value))}
                                                className="w-full bg-card/40 border border-border rounded-xl p-3 text-sm font-bold text-emerald-500 outline-none focus:border-emerald-500"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-secondary/70 font-black uppercase">min</span>
                                        </div>
                                    ) : (
                                        <div className="text-2xl font-black text-main italic">
                                            {config.resolutionTimeMinutes}
                                            <span className="text-[10px] uppercase ml-1 opacity-40 not-italic">minutos</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isEditing && (
                                <div className="mt-8 flex gap-3 animate-in slide-in-from-bottom-2">
                                    <button
                                        onClick={() => setEditingId(null)}
                                        className="flex-1 py-3 text-[10px] font-black text-secondary uppercase tracking-widest hover:bg-transparent dark:hover:bg-white/5 rounded-xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="flex-[2] bg-accent hover:bg-accent text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
                                    >
                                        <Save className="w-3.5 h-3.5" /> Salvar SLA
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">Informação Técnica</p>
                    <p className="text-xs text-secondary leading-relaxed font-medium">
                        As alterações no SLA serão aplicadas apenas a **novos chamados**. Chamados já abertos manterão seus prazos originais calculados no momento da criação para preservar a integridade histórica dos indicadores.
                    </p>
                </div>
            </div>
        </div>
    );
}
