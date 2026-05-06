import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Mail, Bell, Shield, Save, Trash2, Send, CheckCircle2, XCircle, Plus, Loader2, Edit2 } from 'lucide-react';

/**
 * Componente principal para gerenciamento de canais de notificação.
 * Permite listar, criar e organizar os destinos dos alertas (Email, Slack, Telegram, etc).
 */
export function NotificationChannelManager() {
    // Acesso ao contexto do tRPC para invalidação de queries (refetch de dados)
    const utils = trpc.useContext();
    // Busca a lista de canais configurados no servidor
    const { data: channels = [], isLoading } = trpc.notifications.listChannels.useQuery();
    // Estado para controlar a exibição do formulário de criação
    const [isCreating, setIsCreating] = useState(false);

    return (
        <div className="space-y-6">
            {/* Cabeçalho da Seção */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-black text-main italic tracking-tight uppercase">Canais de Notificação</h3>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Configure o destino das notificações automáticas</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-accent hover:bg-accent text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Novo Canal
                    </button>
                )}
            </div>

            {/* Formulário de Criação (exibido condicionalmente) */}
            {isCreating && (
                <ChannelForm
                    onCancel={() => setIsCreating(false)}
                    onSuccess={() => {
                        setIsCreating(false);
                        // Atualiza a lista após criar com sucesso
                        utils.notifications.listChannels.invalidate();
                    }}
                />
            )}

            {/* Grade de Canais Existentes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {channels.map((channel: any) => (
                    <ChannelCard
                        key={channel.id}
                        channel={channel}
                        onUpdate={() => utils.notifications.listChannels.invalidate()}
                    />
                ))}
            </div>

            {/* Estado Vazio - Nenhum canal cadastrado */}
            {!isLoading && channels.length === 0 && !isCreating && (
                <div className="p-12 border-2 border-dashed border-border rounded-[2rem] text-center">
                    <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4 opacity-20" />
                    <p className="text-secondary font-medium italic">Nenhum canal de notificação configurado.</p>
                </div>
            )}
        </div>
    );
}

/**
 * Card individual de exibição de um canal de notificação.
 * Permite editar, excluir, ativar/desativar e testar o canal.
 */
function ChannelCard({ channel, onUpdate }: { channel: any, onUpdate: () => void }) {
    // Estado para controlar o modal de edição
    const [isEditing, setIsEditing] = useState(false);
    // Mutações tRPC para ações no canal
    const deleteMutation = trpc.notifications.deleteChannel.useMutation({ onSuccess: onUpdate });
    const toggleMutation = trpc.notifications.updateChannel.useMutation({ onSuccess: onUpdate });
    const testMutation = trpc.notifications.testChannel.useMutation();

    // Mapeamento de ícones por tipo de canal
    const icons: any = {
        EMAIL: Mail,
        WEBHOOK: Bell,
        TELEGRAM: Bell,
        SLACK: Bell,
        DISCORD: Bell
    };

    const Icon = icons[channel.type] || Bell;

    /**
     * Dispara um envio de teste para validar a configuração atual do canal
     */
    const handleTest = async () => {
        try {
            const res = await testMutation.mutateAsync({ id: channel.id });
            if (res.success) {
                alert('Teste enviado com sucesso!');
            } else {
                alert('Erro no teste: ' + res.message);
            }
        } catch (e: any) {
            alert('Falha crítica no teste: ' + e.message);
        }
    };

    return (
        <div className="bg-card border border-border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group relative">
            {/* Topo do Card: Ícone, Nome e Ações */}
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-card/30 rounded-2xl border border-border">
                        <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-main italic uppercase tracking-tight">{channel.name}</h4>
                        <span className="text-[9px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded-full uppercase tracking-widest">{channel.type}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Switch de Ativo/Inativo */}
                    <button
                        onClick={() => toggleMutation.mutate({ id: channel.id, enabled: !channel.enabled })}
                        className={`w-10 h-6 rounded-full relative transition-all ${channel.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${channel.enabled ? 'left-5' : 'left-1'}`} />
                    </button>
                    {/* Botões de Edição e Exclusão */}
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-secondary/70 hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { if (confirm('Excluir este canal?')) deleteMutation.mutate({ id: channel.id }); }}
                        className="p-2 text-secondary/70 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-4 mb-6">
                {/* Listagem de Severidades Monitoradas */}
                <div className="flex items-center gap-2 text-[10px] text-secondary font-bold uppercase">
                    <Shield className="w-3.5 h-3.5" /> Severidades:
                    <div className="flex gap-1">
                        {channel.severities.map((s: string) => (
                            <span key={s} className="px-2 py-0.5 bg-white/5 rounded-md border border-white/10">{s}</span>
                        ))}
                    </div>
                </div>
                {/* Status do Último Teste Realizado */}
                {channel.lastTested && (
                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-tight">
                        {channel.testStatus === 'success' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                        <span className={channel.testStatus === 'success' ? 'text-emerald-500' : 'text-red-500'}>
                            Último Teste: {new Date(channel.lastTested).toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Botão de Teste de Envio */}
            <button
                onClick={handleTest}
                disabled={testMutation.isPending}
                className="w-full bg-white/5 hover:bg-accent hover:text-white text-secondary py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
            >
                {testMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Testar Envio
            </button>

            {/* Modal de Edição (exibido condicionalmente) */}
            {
                isEditing && (
                    <EditChannelModal
                        channel={channel}
                        onClose={() => setIsEditing(false)}
                        onSuccess={() => {
                            setIsEditing(false);
                            onUpdate();
                        }}
                    />
                )
            }
        </div >
    );
}

/**
 * Formulário para criação de um novo canal de notificação.
 * Lida com diferentes tipos de configuração dependendo do serviço selecionado.
 */
function ChannelForm({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) {
    // Mutação para salvar o novo canal no servidor
    const createMutation = trpc.notifications.createChannel.useMutation({ onSuccess });
    // Estados locais do formulário
    const [name, setName] = useState('');
    const [type, setType] = useState('EMAIL');
    const [config, setConfig] = useState<any>({
        host: '',
        port: '587',
        user: '',
        pass: '',
        from: '',
        to: '', // Lista de destinatários
        secure: false
    });
    // Severidades que dispararão notificações através deste canal
    const [severities, setSeverities] = useState(['CRITICAL', 'WARNING']);

    /**
     * Envia os dados do formulário para a mutação de criação
     */
    const handleSave = () => {
        createMutation.mutate({
            name,
            type: type as any,
            config,
            severities: severities as any
        });
    };

    /**
     * Preenche automaticamente os campos de host e porta para o Gmail
     */
    const handleGmailPreset = () => {
        setConfig({
            host: 'smtp.gmail.com',
            port: '587',
            user: config.user,
            pass: config.pass,
            from: config.from,
            secure: false
        });
    };

    return (
        <div className="bg-card/30 border border-border p-8 rounded-[2.5rem] shadow-inner space-y-8 animate-in zoom-in-95 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {/* Campo de Nome do Canal */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-secondary/70 uppercase tracking-widest ml-1">Nome do Canal</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-card border border-border rounded-2xl p-4 text-main outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all font-medium"
                            placeholder="Ex: Servidor SMTP TI"
                        />
                    </div>
                    {/* Seleção do Tipo de Serviço */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-secondary/70 uppercase tracking-widest ml-1">Tipo de Serviço</label>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value)}
                            className="w-full bg-card border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 appearance-none font-medium"
                        >
                            <option value="EMAIL">E-mail (SMTP)</option>
                            <option value="WEBHOOK">Webhook Customizado</option>
                            <option value="TELEGRAM">Telegram Bot</option>
                            <option value="SLACK">Slack Webhook</option>
                            <option value="DISCORD">Discord Webhook</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Seleção de Severidades (Multi-select via botões) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-secondary/70 uppercase tracking-widest ml-1">Severidades Monitoradas</label>
                        <div className="flex flex-wrap gap-2 pt-2">
                            {['INFO', 'WARNING', 'CRITICAL'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSeverities(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${severities.includes(s) ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-card border-border text-secondary/70'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Configuração Específica para E-mail (Exibido se Tipo === EMAIL) */}
            {type === 'EMAIL' && (
                <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 space-y-6">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Configuração SMTP</label>
                        <button
                            type="button"
                            onClick={handleGmailPreset}
                            className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-secondary border border-white/10 transition-all flex items-center gap-2"
                        >
                            <Mail className="w-3 h-3 text-red-500" /> Preencher Gmail Hub
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Servidor SMTP (Host)</label>
                            <input value={config.host} onChange={e => setConfig({ ...config, host: e.target.value })} className="w-full bg-card border border-border rounded-xl p-3 text-sm" placeholder="smtp.servidor.com" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Porta</label>
                            <input value={config.port} onChange={e => setConfig({ ...config, port: e.target.value })} className="w-full bg-card border border-border rounded-xl p-3 text-sm" placeholder="587" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Usuário</label>
                            <input value={config.user} onChange={e => setConfig({ ...config, user: e.target.value })} className="w-full bg-card border border-border rounded-xl p-3 text-sm" placeholder="email@dominio.com" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Senha</label>
                            <input value={config.pass} onChange={e => setConfig({ ...config, pass: e.target.value })} type="password" className="w-full bg-card border border-border rounded-xl p-3 text-sm" placeholder="••••••••" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Destinatários (E-mails separados por vírgula)</label>
                            <input value={config.to || ''} onChange={e => setConfig({ ...config, to: e.target.value })} className="w-full bg-card border border-border rounded-xl p-3 text-sm" placeholder="alerta@empresa.com, ti@empresa.com" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Remetente (From)</label>
                            <input value={config.from} onChange={e => setConfig({ ...config, from: e.target.value })} className="w-full bg-card border border-border rounded-xl p-3 text-sm" placeholder="IronGrid <noreply@irongrid.com>" />
                        </div>
                    </div>
                </div>
            )}

            {/* Ações do Formulário */}
            <div className="flex gap-4 pt-4">
                <button onClick={onCancel} className="flex-1 py-4 rounded-2xl text-xs font-black text-secondary hover:bg-white/5 uppercase tracking-widest transition-all">Descartar</button>
                <button
                    onClick={handleSave}
                    disabled={!name || createMutation.isPending}
                    className="flex-[2] bg-accent hover:bg-accent text-white py-4 rounded-2xl shadow-xl shadow-accent/20 font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Novo Canal
                </button>
            </div>
        </div>
    );
}

/**
 * Modal sobreposto para edição dos dados de um canal existente.
 */
function EditChannelModal({ channel, onClose, onSuccess }: { channel: any, onClose: () => void, onSuccess: () => void }) {
    // Mutação para atualizar os dados no servidor
    const updateMutation = trpc.notifications.updateChannel.useMutation({ onSuccess });
    // Estados locais inicializados com os valores atuais do canal
    const [name, setName] = useState(channel.name);
    const [config, setConfig] = useState<any>({
        ...channel.config,
        to: channel.config.to || channel.config.recipients || '' // Compatibilidade de campos de destinatário
    });
    const [severities, setSeverities] = useState(channel.severities || []);

    /**
     * Envia os novos dados para a mutação de atualização
     */
    const handleUpdate = () => {
        updateMutation.mutate({
            id: channel.id,
            name,
            config,
            severities: severities as any
        });
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
                {/* Botão de Fechar Modal */}
                <button onClick={onClose} className="absolute top-6 right-6 p-3 text-secondary/70 hover:text-white hover:bg-slate-800 rounded-2xl transition-all z-10">
                    <Save className="w-5 h-5 rotate-45" />
                </button>

                <h3 className="text-2xl font-black text-white italic mb-6">Editar Canal de Notificação</h3>

                <div className="space-y-6">
                    {/* Edição do Nome */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Nome do Canal</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium"
                            placeholder="Ex: Servidor SMTP TI"
                        />
                    </div>

                    {/* Edição de Severidades */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Severidades Monitoradas</label>
                        <div className="flex flex-wrap gap-2 pt-2">
                            {['INFO', 'WARNING', 'CRITICAL'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSeverities((prev: string[]) => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${severities.includes(s) ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-slate-950 border-slate-800 text-secondary/70'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Configuração de E-mail (se aplicável ao canal) */}
                    {channel.type === 'EMAIL' && (
                        <div className="p-6 bg-slate-950 rounded-[2rem] border border-slate-800 space-y-4">
                            <label className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Configuração SMTP</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Host</label>
                                    <input value={config.host || ''} onChange={e => setConfig({ ...config, host: e.target.value })} className="w-full bg-black border border-slate-800 rounded-xl p-3 text-sm text-white" placeholder="smtp.servidor.com" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Porta</label>
                                    <input value={config.port || ''} onChange={e => setConfig({ ...config, port: e.target.value })} className="w-full bg-black border border-slate-800 rounded-xl p-3 text-sm text-white" placeholder="587" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Usuário</label>
                                    <input value={config.user || ''} onChange={e => setConfig({ ...config, user: e.target.value })} className="w-full bg-black border border-slate-800 rounded-xl p-3 text-sm text-white" placeholder="email@dominio.com" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Senha</label>
                                    <input value={config.pass || ''} onChange={e => setConfig({ ...config, pass: e.target.value })} type="password" className="w-full bg-black border border-slate-800 rounded-xl p-3 text-sm text-white" placeholder="••••••••" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Destinatários (To)</label>
                                    <input value={config.to || ''} onChange={e => setConfig({ ...config, to: e.target.value })} className="w-full bg-black border border-slate-800 rounded-xl p-3 text-sm text-white" placeholder="ti@empresa.com" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Remetente</label>
                                    <input value={config.from || ''} onChange={e => setConfig({ ...config, from: e.target.value })} className="w-full bg-black border border-slate-800 rounded-xl p-3 text-sm text-white" placeholder="IronGrid <noreply@irongrid.com>" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Botões de Ação do Modal */}
                    <div className="flex gap-4 pt-4">
                        <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all uppercase text-xs tracking-widest">
                            Cancelar
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={!name || updateMutation.isPending}
                            className="flex-1 bg-accent hover:bg-accent disabled:bg-accent text-white font-black py-4 rounded-2xl shadow-xl shadow-accent/20 transition-all uppercase text-xs tracking-widest"
                        >
                            {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
