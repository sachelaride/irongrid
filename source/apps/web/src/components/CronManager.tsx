import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { 
    Clock, Play, Edit2, Trash2, Power, FileText, 
    Plus, Loader2, CheckCircle2, XCircle, AlertCircle,
    ChevronRight, Calendar, Activity, Zap
} from 'lucide-react';
import { CronJobModal } from './cron/CronJobModal';

/**
 * CronManager - Dashboard de Agendamento de Tarefas
 * 
 * Permite gerenciar execuções periódicas de scripts e ações remotas.
 */
export function CronManager() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<any>(null);
    const [selectedJobForLog, setSelectedJobForLog] = useState<any>(null);

    const utils = trpc.useContext();

    // Consultas tRPC
    const { data: jobs = [], isLoading } = (trpc as any).cron.listJobs.useQuery();
    const { data: logContent, isLoading: isLoadingLog } = (trpc as any).cron.getLatestLog.useQuery(
        { id: selectedJobForLog?.id },
        { enabled: !!selectedJobForLog, refetchInterval: 3000 }
    );

    // Mutações
    const executeMutation = (trpc as any).cron.executeNow.useMutation({
        onSuccess: () => utils.cron.listJobs.invalidate()
    });
    const removeMutation = (trpc as any).cron.removeJob.useMutation({
        onSuccess: () => utils.cron.listJobs.invalidate()
    });
    const toggleMutation = (trpc as any).cron.updateJob.useMutation({
        onSuccess: () => utils.cron.listJobs.invalidate()
    });

    const handleEdit = (job: any) => {
        setEditingJob(job);
        setIsModalOpen(true);
    };

    const handleExecute = (id: string) => {
        if (confirm('Deseja executar esta tarefa agora?')) {
            executeMutation.mutate({ id });
        }
    };

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja excluir este agendamento?')) {
            removeMutation.mutate({ id });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border border-border p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Clock size={120} className="text-main" />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
                        <Clock className="w-8 h-8 text-main" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-main italic">Agendador de Tarefas</h2>
                        <p className="text-secondary text-xs font-bold uppercase tracking-widest mt-1">Automação e Execuções Programadas (Cron)</p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingJob(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg shadow-primary/20 relative z-10"
                >
                    <Plus size={16} /> Nova Tarefa
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Job List */}
                <div className="xl:col-span-2 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-card/50 border border-border/50 rounded-[2rem]">
                            <Loader2 className="w-10 h-10 text-main animate-spin mb-4" />
                            <span className="text-secondary text-[10px] font-black uppercase tracking-[0.3em]">Carregando Agendamentos</span>
                        </div>
                    ) : jobs.length === 0 ? (
                        <div className="text-center py-20 bg-card/50 border border-border/50 rounded-[2rem] border-dashed">
                            <Clock className="w-12 h-12 text-secondary/30 mx-auto mb-4" />
                            <p className="text-secondary font-bold uppercase tracking-widest text-sm">Nenhuma tarefa agendada encontrada</p>
                        </div>
                    ) : (
                        jobs.map((job: any) => (
                            <div 
                                key={job.id} 
                                className={`group bg-card border transition-all rounded-[1.5rem] hover:shadow-2xl hover:shadow-black/5 ${selectedJobForLog?.id === job.id ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-border'}`}
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl border ${job.enabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-white/5 border-slate-500/20 text-secondary'}`}>
                                                <Zap size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-main italic tracking-tight">{job.name}</h3>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] font-mono font-bold text-main bg-primary/10 px-2 py-0.5 rounded border border-primary/20 uppercase">
                                                        {job.schedule}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest opacity-60">
                                                        {job.action}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleExecute(job.id)}
                                                className="p-2.5 text-secondary hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all flex flex-col items-center gap-1"
                                                title="Executar Agora"
                                            >
                                                <Play size={18} />
                                                <span className="text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Iniciar</span>
                                            </button>
                                            <button 
                                                onClick={() => handleEdit(job)}
                                                className="p-2.5 text-secondary hover:text-main hover:bg-primary/10 rounded-xl transition-all flex flex-col items-center gap-1"
                                                title="Editar"
                                            >
                                                <Edit2 size={18} />
                                                <span className="text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Editar</span>
                                            </button>
                                            <button 
                                                onClick={() => toggleMutation.mutate({ id: job.id, enabled: !job.enabled })}
                                                className={`p-2.5 transition-all rounded-xl flex flex-col items-center gap-1 min-w-[60px] ${job.enabled ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-red-500 hover:bg-red-500/10'}`}
                                                title={job.enabled ? "Desativar" : "Ativar"}
                                            >
                                                <Power size={18} className={!job.enabled ? 'text-red-500' : ''} />
                                                <span className={`text-[8px] font-black uppercase tracking-tighter ${job.enabled ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {job.enabled ? 'Ligado' : 'Desligado'}
                                                </span>
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(job.id)}
                                                className="p-2.5 text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all flex flex-col items-center gap-1"
                                                title="Excluir"
                                            >
                                                <Trash2 size={18} />
                                                <span className="text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Excluir</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-border/50">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] mb-1 opacity-50 flex items-center gap-1.5 font-sans">
                                                <Activity size={10} className="text-main" /> Último Status
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {job.logs?.[0]?.status === 'SUCCESS' ? (
                                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                                ) : job.logs?.[0]?.status === 'FAILED' ? (
                                                    <XCircle size={14} className="text-red-500" />
                                                ) : job.logs?.[0]?.status === 'RUNNING' ? (
                                                    <Loader2 size={14} className="text-accent animate-spin" />
                                                ) : (
                                                    <AlertCircle size={14} className="text-secondary/70" />
                                                )}
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${
                                                    job.logs?.[0]?.status === 'SUCCESS' ? 'text-emerald-500' :
                                                    job.logs?.[0]?.status === 'FAILED' ? 'text-red-500' :
                                                    job.logs?.[0]?.status === 'RUNNING' ? 'text-accent' : 'text-secondary/70'
                                                }`}>
                                                    {job.logs?.[0]?.status || 'Nunca Executada'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] mb-1 opacity-50 flex items-center gap-1.5 font-sans">
                                                <Calendar size={10} className="text-main" /> Última Execução
                                            </p>
                                            <p className="text-xs font-black text-main italic">
                                                {job.lastRun ? new Date(job.lastRun).toLocaleString() : '---'}
                                            </p>
                                        </div>
                                        <div className="flex items-end justify-end">
                                            <button 
                                                onClick={() => setSelectedJobForLog(job)}
                                                className={`text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                                                    selectedJobForLog?.id === job.id ? 'bg-primary text-white shadow-lg' : 'bg-secondary/5 text-secondary hover:bg-primary/10 hover:text-main'
                                                }`}
                                            >
                                                <FileText size={14} /> Ver Log <ChevronRight size={14} className={selectedJobForLog?.id === job.id ? 'rotate-90 transition-transform' : ''} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Log Viewer Side Panel */}
                <div className="xl:col-span-1">
                    <div className="bg-slate-900 border border-white/5 rounded-[2rem] h-full min-h-[500px] flex flex-col overflow-hidden shadow-2xl relative">
                        <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/20 rounded-lg">
                                    <FileText size={16} className="text-main" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white italic tracking-tight uppercase">Saída do Console</h3>
                                    <p className="text-[9px] font-bold text-secondary uppercase tracking-widest">{selectedJobForLog?.name || 'Selecione uma tarefa'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-6 font-mono text-[11px] overflow-auto custom-scrollbar bg-black/30">
                            {!selectedJobForLog ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale">
                                    <FileText size={40} className="text-slate-600 mb-4" />
                                    <p className="text-secondary font-bold uppercase tracking-widest">Aguardando Seleção</p>
                                </div>
                            ) : (
                                <pre className="text-emerald-500/90 whitespace-pre-wrap leading-relaxed animate-in fade-in duration-500">
                                    {isLoadingLog ? 'Lendo log de execução...' : logContent}
                                </pre>
                            )}
                        </div>

                        {selectedJobForLog && (
                            <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
                                <span className="text-[8px] font-black text-secondary uppercase tracking-widest">Auto-Refresh Ativo</span>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <CronJobModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    job={editingJob} 
                    onSuccess={() => utils.cron.listJobs.invalidate()}
                />
            )}
        </div>
    );
}
