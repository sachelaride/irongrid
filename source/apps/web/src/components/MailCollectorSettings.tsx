import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Mail, Plus, Trash2, Power, PowerOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export function MailCollectorSettings() {
    const utils = trpc.useContext();
    const { data: configs = [], isLoading } = (trpc as any).mailCollector.list.useQuery();
    const [isAdding, setIsAdding] = useState(false);

    const createMutation = (trpc as any).mailCollector.create.useMutation({
        onSuccess: () => {
            utils.mailCollector.list.invalidate();
            setIsAdding(false);
        }
    });

    const updateMutation = (trpc as any).mailCollector.update.useMutation({
        onSuccess: () => utils.mailCollector.list.invalidate()
    });

    const deleteMutation = (trpc as any).mailCollector.delete.useMutation({
        onSuccess: () => utils.mailCollector.list.invalidate()
    });

    if (isLoading) return <div className="animate-pulse flex items-center gap-3 text-secondary font-bold uppercase text-xs"><RefreshCw className="w-4 h-4 animate-spin" /> Carregando coletores...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-2xl font-black text-main italic tracking-tighter uppercase flex items-center gap-3">
                        <Mail className="w-6 h-6 text-emerald-500" />
                        Mail Collector
                    </h3>
                    <p className="text-[10px] font-black text-secondary uppercase tracking-widest mt-1">Transformação automática de e-mails em tickets</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Novo Coletor
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {configs.map((config: any) => (
                    <div key={config.id} className={`bg-slate-950/40 border ${config.enabled ? 'border-emerald-500/20' : 'border-slate-800'} rounded-[2rem] p-6 relative overflow-hidden group`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${config.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-secondary'}`}>
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white uppercase italic tracking-tight">{config.name}</h4>
                                    <p className="text-[10px] text-secondary font-medium">{config.user} @ {config.host}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateMutation.mutate({ id: config.id, enabled: !config.enabled })}
                                    className={`p-2 rounded-lg transition-all ${config.enabled ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-secondary hover:bg-slate-800'}`}
                                >
                                    {config.enabled ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={() => { if (confirm('Excluir este coletor?')) deleteMutation.mutate(config.id) }}
                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 mt-4">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-secondary">Status Sync</span>
                                {config.lastSync ? (
                                    <span className="text-emerald-400 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Sincronizado {new Date(config.lastSync).toLocaleTimeString()}
                                    </span>
                                ) : (
                                    <span className="text-slate-600 italic">Nunca sincronizado</span>
                                )}
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-secondary">Ação de Ticket</span>
                                <span className="text-accent">{config.category}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {configs.length === 0 && !isAdding && (
                    <div className="col-span-full border-2 border-dashed border-slate-800 rounded-[2rem] p-12 text-center">
                        <Mail className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
                        <p className="text-secondary font-bold uppercase tracking-widest text-xs">Nenhum coletor configurado</p>
                    </div>
                )}
            </div>

            {isAdding && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Novo Coletor de E-mail</h3>
                            <button onClick={() => setIsAdding(false)} className="text-secondary hover:text-white transition-colors uppercase font-black text-[10px] tracking-widest">Fechar</button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            createMutation.mutate({
                                name: formData.get('name') as string,
                                host: formData.get('host') as string,
                                port: Number(formData.get('port')),
                                user: formData.get('user') as string,
                                password: formData.get('password') as string,
                                category: formData.get('category') as any,
                                enabled: true
                            });
                        }} className="grid grid-cols-2 gap-6">
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-secondary uppercase ml-1">Nome Identificador (ex: Suporte TI)</label>
                                <input name="name" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-accent outline-none" placeholder="Suporte Central" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-secondary uppercase ml-1">Servidor IMAP</label>
                                <input name="host" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-accent outline-none" placeholder="imap.gmail.com" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-secondary uppercase ml-1">Porta</label>
                                <input name="port" type="number" defaultValue={993} required className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-accent outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-secondary uppercase ml-1">Usuário / E-mail</label>
                                <input name="user" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-accent outline-none" placeholder="suporte@empresa.com" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-secondary uppercase ml-1">Senha</label>
                                <input name="password" type="password" required className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-accent outline-none" />
                            </div>
                            <div className="col-span-2 flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-secondary hover:bg-slate-800 transition-all">Cancelar</button>
                                <button type="submit" disabled={createMutation.isLoading} className="bg-accent hover:bg-accent disabled:opacity-50 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/20">
                                    {createMutation.isLoading ? 'Salvando...' : 'Salvar Configuração'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
