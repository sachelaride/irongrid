import { useState, useEffect } from 'react';
import { trpc } from '../utils/trpc';
import { Settings, Save, Loader2, Info, Building, Clock, Star, CalendarClock, LayoutDashboard, Target, HardDrive } from 'lucide-react';

export function SystemCustomization() {
    const utils = trpc.useContext();
    const { data: config, isLoading } = (trpc.system as any).getSystemCustomization.useQuery();
    const updateMutation = (trpc.system as any).updateSystemCustomization.useMutation({
        onSuccess: () => {
            utils.system.getSystemCustomization.invalidate();
            alert('Configurações do sistema atualizadas com sucesso!');
        },
        onError: (err: any) => {
            alert(`Erro ao salvar configurações: ${err.message}`);
        }
    });

    const [formData, setFormData] = useState({
        companyName: '',
        workingHours: '',
        ticketAutoCloseDays: 15,
        ticketDefaultRating: 4,
        dashSlaGoal: 98,
        dashStorageCritical: 90,
        dashStorageWarning: 80
    });

    useEffect(() => {
        if (config) {
            setFormData({
                companyName: config.companyName,
                workingHours: config.workingHours,
                ticketAutoCloseDays: config.ticketAutoCloseDays,
                ticketDefaultRating: config.ticketDefaultRating,
                dashSlaGoal: config.dashSlaGoal || 98,
                dashStorageCritical: config.dashStorageCritical || 90,
                dashStorageWarning: config.dashStorageWarning || 80
            });
        }
    }, [config]);

    const handleSave = () => {
        updateMutation.mutate(formData);
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
                <h3 className="text-xl font-black text-main italic tracking-tight uppercase flex items-center gap-3">
                    <Settings className="w-6 h-6 text-accent" />
                    Customização do Sistema
                </h3>
                <p className="text-[10px] text-secondary font-bold uppercase tracking-widest pl-9">
                    Defina parâmetros globais de comportamento e identidade do IronGrid
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Identidade */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <div className="p-2 bg-accent/10 rounded-xl">
                            <Building className="w-5 h-5 text-accent" />
                        </div>
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Identidade & Expediente</h4>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest ml-1">Nome da Empresa</label>
                            <input
                                type="text"
                                value={formData.companyName}
                                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                className="w-full bg-card/30 border border-border rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                placeholder="Ex: Minha Empresa LTDA"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest ml-1">Horário de Expediente</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/70" />
                                <input
                                    type="text"
                                    value={formData.workingHours}
                                    onChange={e => setFormData({ ...formData, workingHours: e.target.value })}
                                    className="w-full bg-card/30 border border-border rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                    placeholder="Ex: 08:00 - 18:00"
                                />
                            </div>
                            <p className="text-[9px] text-secondary/70 font-medium italic pl-1">Utilizado para cálculo de SLA e notificações fora de horário.</p>
                        </div>
                    </div>
                </div>

                {/* Comportamento de Chamados */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <CalendarClock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Automação de Chamados</h4>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest ml-1">Dias para Fechamento Automático</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="1"
                                    max="60"
                                    value={formData.ticketAutoCloseDays}
                                    onChange={e => setFormData({ ...formData, ticketAutoCloseDays: parseInt(e.target.value) })}
                                    className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                                <div className="w-16 text-center font-black text-emerald-600 dark:text-emerald-400 text-lg bg-emerald-500/10 py-1 rounded-lg border border-emerald-500/20">
                                    {formData.ticketAutoCloseDays}d
                                </div>
                            </div>
                            <p className="text-[9px] text-secondary/70 font-medium italic pl-1">Chamados "Encerrados" (Resolvidos) serão fechados automaticamente após este período se não avaliados.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest ml-1">Avaliação Padrão (Auto-Fechamento)</label>
                            <div className="flex items-center justify-between bg-card/30 p-4 rounded-xl border border-border">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setFormData({ ...formData, ticketDefaultRating: star })}
                                            className={`transition-all hover:scale-110 ${star <= formData.ticketDefaultRating
                                                ? 'text-amber-400 fill-amber-400'
                                                : 'text-slate-300 dark:text-slate-700'
                                                }`}
                                        >
                                            <Star className="w-6 h-6" />
                                        </button>
                                    ))}
                                </div>
                                <span className="text-xs font-black text-secondary uppercase tracking-widest">{formData.ticketDefaultRating} Estrelas</span>
                            </div>
                            <p className="text-[9px] text-secondary/70 font-medium italic pl-1">Nota atribuída automaticamente quando o sistema fecha o chamado por inatividade.</p>
                        </div>
                    </div>
                </div>

                {/* Dashboard Estratégico */}
                <div className="md:col-span-2 bg-card border border-border rounded-[2.5rem] p-8 shadow-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <div className="p-2 bg-accent/10 rounded-xl">
                            <LayoutDashboard className="w-5 h-5 text-accent dark:text-accent" />
                        </div>
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Dashboard Estratégico</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Target className="w-3 h-3" /> Meta de SLA (%)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="80"
                                    max="100"
                                    step="0.1"
                                    value={formData.dashSlaGoal}
                                    onChange={e => setFormData({ ...formData, dashSlaGoal: parseFloat(e.target.value) })}
                                    className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <div className="w-20 text-center font-black text-accent dark:text-accent text-lg bg-accent/10 py-1 rounded-lg border border-accent/20">
                                    {formData.dashSlaGoal}%
                                </div>
                            </div>
                            <p className="text-[9px] text-secondary/70 font-medium italic pl-1">Meta de conformidade exibida nos indicadores executivos.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <HardDrive className="w-3 h-3" /> Alerta HD (Atenção)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    min="50"
                                    max="95"
                                    value={formData.dashStorageWarning}
                                    onChange={e => setFormData({ ...formData, dashStorageWarning: parseInt(e.target.value) })}
                                    className="w-full bg-card/30 border border-border rounded-xl px-4 py-3 text-sm font-bold text-amber-500 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                />
                                <span className="text-xs font-black text-secondary">%</span>
                            </div>
                            <p className="text-[9px] text-secondary/70 font-medium italic pl-1">Porcentagem de uso para alerta amarelo.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary/70 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <HardDrive className="w-3 h-3 text-red-500" /> Alerta HD (Crítico)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    min="60"
                                    max="99"
                                    value={formData.dashStorageCritical}
                                    onChange={e => setFormData({ ...formData, dashStorageCritical: parseInt(e.target.value) })}
                                    className="w-full bg-card/30 border border-border rounded-xl px-4 py-3 text-sm font-bold text-red-500 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                                />
                                <span className="text-xs font-black text-secondary">%</span>
                            </div>
                            <p className="text-[9px] text-secondary/70 font-medium italic pl-1">Porcentagem de uso para alerta vermelho.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={updateMutation.isLoading}
                    className="bg-accent hover:bg-accent text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-xl shadow-accent/20 flex items-center gap-3 hover:-translate-y-1"
                >
                    {updateMutation.isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {updateMutation.isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>

            <div className="p-4 bg-accent/5 border border-accent/10 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <p className="text-xs text-secondary leading-relaxed">
                    <span className="font-bold text-accent">Nota:</span> Algumas alterações podem levar alguns minutos para serem propagadas para todos os serviços agendados (ex: Cron Jobs).
                </p>
            </div>
        </div>
    );
}
