import { useState, useEffect } from 'react';
import { trpc } from '../../utils/trpc';
import { 
    X, Save, Loader2, Info, Clock, 
    Server, Terminal, Shield, Wrench, Check
} from 'lucide-react';

interface CronJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    job?: any;
    onSuccess: () => void;
}

export function CronJobModal({ isOpen, onClose, job, onSuccess }: CronJobModalProps) {
    const [name, setName] = useState(job?.name || '');
    const [schedule, setSchedule] = useState(job?.schedule || '0 0 * * *');
    const [action, setAction] = useState(job?.action || 'executeScript');
    const [targetId, setTargetId] = useState(job?.targetId || '');
    const [scriptContent, setScriptContent] = useState(job?.parameters?.scriptContent || '');
    const [parameters, setParameters] = useState(job?.parameters ? JSON.stringify(job.parameters, null, 2) : '{}');
    
    // Friendly Scheduler State
    const [useAdvanced, setUseAdvanced] = useState(false);
    const [selectedDays, setSelectedDays] = useState<string[]>(['*']);
    const [hour, setHour] = useState('0');
    const [minute, setMinute] = useState('0');

    // Sincronizar Friendly -> Cron
    useEffect(() => {
        if (!useAdvanced) {
            const daysStr = selectedDays.length === 0 || selectedDays.includes('*') ? '*' : selectedDays.join(',');
            setSchedule(`${minute} ${hour} * * ${daysStr}`);
        }
    }, [selectedDays, hour, minute, useAdvanced]);

    // Inicializar Friendly se o job existir
    useEffect(() => {
        if (job?.schedule && !job.schedule.includes('/') && !job.schedule.includes('-')) {
            const parts = job.schedule.split(' ');
            if (parts.length === 5) {
                setMinute(parts[0]);
                setHour(parts[1]);
                if (parts[4] !== '*') {
                    setSelectedDays(parts[4].split(','));
                } else {
                    setSelectedDays(['*']);
                }
            }
        }
    }, [job]);

    // Listar dispositivos para seleção de alvo (apenas os que têm agente)
    const { data: devices = [] } = (trpc as any).scan.getDevices.useQuery();
    const agentDevices = (devices as any[]).filter(d => d.agentId);

    const createMutation = (trpc as any).cron.createJob.useMutation({
        onSuccess: () => {
            onSuccess();
            onClose();
        }
    });

    const updateMutation = (trpc as any).cron.updateJob.useMutation({
        onSuccess: () => {
            onSuccess();
            onClose();
        }
    });

    const handleSave = () => {
        if (!name || !schedule || !action) {
            alert('Por favor, preencha os campos obrigatórios.');
            return;
        }

        let parsedParams: any = {};
        try {
            parsedParams = JSON.parse(parameters);
        } catch (e) {
            // Se falhar o parse, ignoramos se for apenas {}, mas avisamos se tiver conteúdo
            if (parameters !== '{}') {
                alert('Parâmetros JSON inválidos.');
                return;
            }
        }

        // Adiciona o conteúdo do script se for executeScript
        if (action === 'executeScript' && scriptContent) {
            parsedParams.scriptContent = scriptContent;
        }

        const payload = {
            name,
            schedule,
            action,
            targetId: targetId || null,
            parameters: parsedParams
        };

        if (job) {
            updateMutation.mutate({ id: job.id, ...payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-page/80 backdrop-blur-xl transition-all" onClick={onClose} />
            
            <div className="bg-card w-full max-w-2xl border border-border rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 border-b border-border/50 bg-page/30 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                            <Clock className="w-6 h-6 text-main" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-main italic">{job ? 'Editar' : 'Nova'} Tarefa Agendada</h2>
                            <p className="text-secondary text-[10px] font-bold uppercase tracking-widest mt-1">Configuração de Execução Automática</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-page rounded-xl transition-all text-secondary">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Nome da Tarefa */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Nome da Tarefa</label>
                            <div className="relative">
                                <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Backup Diario Servidor"
                                    className="w-full bg-page border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-bold placeholder:opacity-50 focus:border-primary/50 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Agendamento */}
                        <div className="space-y-1.5 md:col-span-2 bg-page/50 p-6 rounded-2xl border border-border/50">
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Clock size={14} className="text-main" /> Agendamento
                                </label>
                                <button 
                                    onClick={() => setUseAdvanced(!useAdvanced)}
                                    className="text-[9px] font-black text-main uppercase tracking-widest hover:underline"
                                >
                                    {useAdvanced ? 'Modo Simples' : 'Modo Avançado (Cron)'}
                                </button>
                            </div>

                            {useAdvanced ? (
                                <div className="relative">
                                    <input
                                        value={schedule}
                                        onChange={e => setSchedule(e.target.value)}
                                        placeholder="0 0 * * *"
                                        className="w-full bg-page border border-border rounded-xl py-3 px-4 text-sm font-mono font-bold focus:border-primary/50 outline-none transition-all"
                                    />
                                    <p className="text-[9px] text-secondary mt-2 flex items-center gap-1">
                                        <Info size={10} /> Minuto Hora Dia Mês Semana (Ex: 0 0 * * * = Meia-noite)
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-7 gap-2">
                                        {[
                                            { d: '0', l: 'Dom' }, { d: '1', l: 'Seg' }, { d: '2', l: 'Ter' },
                                            { d: '3', l: 'Qua' }, { d: '4', l: 'Qui' }, { d: '5', l: 'Sex' },
                                            { d: '6', l: 'Sab' }
                                        ].map(day => (
                                            <button
                                                key={day.d}
                                                onClick={() => {
                                                    if (selectedDays.includes(day.d)) {
                                                        setSelectedDays(selectedDays.filter(d => d !== day.d));
                                                    } else {
                                                        setSelectedDays([...selectedDays.filter(d => d !== '*'), day.d]);
                                                    }
                                                }}
                                                className={`py-3 px-1 rounded-xl text-[10px] font-black uppercase transition-all border flex flex-col items-center justify-center gap-1 relative overflow-hidden ${
                                                    selectedDays.includes(day.d) 
                                                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.05] z-10' 
                                                        : 'bg-page border-border text-secondary/40 hover:border-primary/30'
                                                }`}
                                            >
                                                {selectedDays.includes(day.d) ? (
                                                    <Check size={10} className="text-white animate-in zoom-in duration-200" />
                                                ) : (
                                                    <div className="w-2.5 h-2.5 rounded-full border border-border" />
                                                )}
                                                
                                                <span className={selectedDays.includes(day.d) ? 'text-white' : 'text-secondary/60'}>
                                                    {day.l}
                                                </span>

                                                <span className={`text-[7px] font-bold tracking-tight ${
                                                    selectedDays.includes(day.d) ? 'text-white/90' : 'text-secondary/30'
                                                }`}>
                                                    {selectedDays.includes(day.d) ? 'ATIVO' : 'DESATIVADO'}
                                                </span>

                                                {selectedDays.includes(day.d) && (
                                                    <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 space-y-1">
                                            <label className="text-[9px] font-black text-secondary uppercase">Hora</label>
                                            <select 
                                                value={hour} 
                                                onChange={e => setHour(e.target.value)}
                                                className="w-full bg-page border border-border rounded-xl p-2 text-sm font-bold outline-none"
                                            >
                                                {Array.from({ length: 24 }).map((_, i) => (
                                                    <option key={i} value={i}>{i.toString().padStart(2, '0')}h</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <label className="text-[9px] font-black text-secondary uppercase">Minuto</label>
                                            <select 
                                                value={minute} 
                                                onChange={e => setMinute(e.target.value)}
                                                className="w-full bg-page border border-border rounded-xl p-2 text-sm font-bold outline-none"
                                            >
                                                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                                                    <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Tipo de Ação */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Ação a Executar</label>
                            <div className="relative">
                                <Wrench className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                                <select
                                    value={action}
                                    onChange={e => setAction(e.target.value)}
                                    className="w-full bg-page border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-bold focus:border-primary/50 outline-none appearance-none transition-all"
                                >
                                    <option value="executeScript">Executar Script Remoto</option>
                                    <option value="manageService">Gerenciar Serviço</option>
                                    <option value="systemControl">Controle de Energia</option>
                                </select>
                            </div>
                        </div>

                        {/* Dispositivo Alvo */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Dispositivo Alvo (Agente)</label>
                            <div className="relative">
                                <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                                <select
                                    value={targetId}
                                    onChange={e => setTargetId(e.target.value)}
                                    className="w-full bg-page border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-bold focus:border-primary/50 outline-none appearance-none transition-all"
                                >
                                    <option value="">Selecione um dispositivo...</option>
                                    {agentDevices.map((d: any) => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.ipAddress})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Conteúdo do Script */}
                    {action === 'executeScript' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1 flex items-center justify-between">
                                Conteúdo do Script (Expect/Bash/PS)
                                <span className="text-[8px] font-mono opacity-50 lowercase tracking-normal italic">Cole o código para execução remota</span>
                            </label>
                            <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-inner">
                                <textarea
                                    value={scriptContent}
                                    onChange={e => setScriptContent(e.target.value)}
                                    rows={10}
                                    placeholder="#!/usr/bin/expect..."
                                    className="w-full bg-transparent p-6 text-[11px] font-mono text-emerald-400 placeholder:opacity-30 outline-none custom-scrollbar resize-none leading-relaxed"
                                />
                            </div>
                        </div>
                    )}

                    {/* Parâmetros JSON (Avançado) */}
                    <div className="space-y-2">
                        <button 
                            onClick={() => setParameters(parameters === '{}' ? '{\n  "shell": "bash"\n}' : '{}')}
                            className="text-[9px] font-black text-secondary uppercase tracking-widest hover:text-main transition-colors ml-1"
                        >
                            {parameters === '{}' ? '+ Mostrar Parâmetros JSON Extras' : '- Ocultar Parâmetros JSON'}
                        </button>
                        {parameters !== '{}' && (
                            <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-inner mt-2">
                                <textarea
                                    value={parameters}
                                    onChange={e => setParameters(e.target.value)}
                                    rows={4}
                                    className="w-full bg-transparent p-6 text-xs font-mono text-accent placeholder:opacity-30 outline-none custom-scrollbar resize-none leading-relaxed"
                                />
                            </div>
                        )}
                        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/10 rounded-xl mt-4">
                            <Shield size={14} className="text-main shrink-0" />
                            <p className="text-[9px] font-bold text-secondary italic leading-tight">
                                Certifique-se de que o dispositivo alvo tenha as dependências necessárias (ex: expect) instaladas.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-border/50 bg-page/30 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-main hover:bg-page rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={createMutation.isLoading || updateMutation.isLoading}
                        className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        {(createMutation.isLoading || updateMutation.isLoading) ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        {job ? 'Salvar Alterações' : 'Criar Agendamento'}
                    </button>
                </div>
            </div>
        </div>
    );
}
