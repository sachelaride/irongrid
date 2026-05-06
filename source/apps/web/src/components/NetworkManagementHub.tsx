import { useEffect, useState } from 'react';
import { trpc } from '../utils/trpc';
import { Network, Trash2, Edit2, Key, Play, Loader2, Calendar } from 'lucide-react';
import {
    FormCard,
    ListCard,
    ActionButton,
    StatusBadge,
    EmptyState,
    SearchBar,
    PrimaryButton
} from './ui/DesignSystem';

/**
 * Centro de Gerenciamento de Rede.
 * Permite configurar comunidades SNMP e faixas de IP (subredes) para monitoramento e descoberta automática.
 */
export function NetworkManagementHub({ initialTab }: { initialTab?: 'communities' | 'ranges' }) {
    // Estado para alternar entre gerenciamento de comunidades e faixas
    const [subTab, setSubTab] = useState<'communities' | 'ranges'>(initialTab || 'communities');

    useEffect(() => {
        if (initialTab) {
            setSubTab(initialTab);
        }
    }, [initialTab]);

    return (
        <div className="space-y-6">
            {/* Abas de Navegação Interna */}
            <div className="flex gap-2 bg-card p-1.5 rounded-2xl border border-border backdrop-blur-sm shadow-xl w-fit">
                <TabButton active={subTab === 'communities'} onClick={() => setSubTab('communities')} label="Comunidades SNMP" icon={Key} />
                <TabButton active={subTab === 'ranges'} onClick={() => setSubTab('ranges')} label="Faixas de Rede" icon={Network} />
            </div>

            {/* Conteúdo Dinâmico Baseado na Aba Selecionada */}
            <div className="animate-in fade-in slide-in-from-top-2 duration-500 bg-card p-8 rounded-[2.5rem] border border-border shadow-2xl">
                {subTab === 'communities' && <SnmpCommunityManager />}
                {subTab === 'ranges' && <NetworkRangeManager />}
            </div>
        </div>
    );
}

/**
 * Componente de botão estilizado para as abas do Hub.
 */
function TabButton({ active, onClick, label, icon: Icon }: any) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-black italic tracking-tighter transition-all uppercase text-[10px]
                ${active
                    ? 'bg-accent text-white shadow-lg shadow-accent/20 scale-[1.02]'
                    : 'text-secondary  hover:text-main dark:hover:text-slate-300 hover:bg-white/5 dark:hover:bg-slate-800/50'}
            `}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}

/**
 * Gerenciador de Comunidades SNMP.
 * Lida com CRUD de credenciais SNMP (v1, v2c e v3).
 */
function SnmpCommunityManager() {
    const utils = trpc.useContext();

    // Consulta lista de comunidades cadastradas
    const { data: communities = [] } = (trpc as any).snmp.listCommunities.useQuery();

    // Estados do formulário
    const [name, setName] = useState('');
    const [version, setVersion] = useState<'v1' | 'v2c' | 'v3'>('v2c');
    const [community, setCommunity] = useState('');
    const [username, setUsername] = useState('');
    const [authProto, setAuthProto] = useState('');
    const [authPass, setAuthPass] = useState('');
    const [privProto, setPrivProto] = useState('');
    const [privPass, setPrivPass] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Mutação para criação
    const createMutation = (trpc as any).snmp.createCommunity.useMutation({
        onSuccess: () => {
            ((utils as any).snmp as any).listCommunities.invalidate();
            resetForm();
        }
    });

    // Mutação para atualização
    const updateMutation = (trpc as any).snmp.updateCommunity.useMutation({
        onSuccess: () => {
            ((utils as any).snmp as any).listCommunities.invalidate();
            resetForm();
        }
    });

    // Mutação para exclusão
    const deleteMutation = (trpc as any).snmp.deleteCommunity.useMutation({
        onSuccess: () => ((utils as any).snmp as any).listCommunities.invalidate()
    });

    /**
     * Reseta os campos do formulário para o estado inicial.
     */
    const resetForm = () => {
        setName('');
        setVersion('v2c');
        setCommunity('');
        setUsername('');
        setAuthProto('');
        setAuthPass('');
        setPrivProto('');
        setPrivPass('');
        setEditingId(null);
        setIsSubmitting(false);
    };

    /**
     * Carrega os dados de uma comunidade existente para edição.
     */
    const handleEdit = (comm: any) => {
        setEditingId(comm.id);
        setName(comm.name);
        setVersion(comm.version);
        setCommunity(comm.community || '');
        setUsername(comm.username || '');
        setAuthProto(comm.authProto || '');
        setAuthPass(comm.authPass || '');
        setPrivProto(comm.privProto || '');
        setPrivPass(comm.privPass || '');
    };

    /**
     * Envia os dados do formulário (Criação ou Edição).
     */
    const handleSubmit = () => {
        setIsSubmitting(true);
        const data: any = { name, version };

        // Define campos baseados na versão SNMP selecionada
        if (version === 'v1' || version === 'v2c') {
            data.community = community;
        } else if (version === 'v3') {
            data.username = username;
            data.authProto = authProto;
            data.authPass = authPass;
            data.privProto = privProto;
            data.privPass = privPass;
        }

        if (editingId) {
            updateMutation.mutate({ id: editingId, ...data });
        } else {
            createMutation.mutate(data);
        }
    };

    // Filtra comunidades localmente para a barra de busca
    const filteredCommunities = communities.filter((c: any) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.version.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Formulário de Cadastro/Edição */}
            <FormCard
                title={editingId ? 'Editar Comunidade' : 'Nova Comunidade SNMP'}
                icon={Key}
                iconColor="text-accent"
                onClose={editingId ? resetForm : undefined}
            >
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Nome da Comunidade</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border border-border rounded-2xl p-4 text-main placeholder:text-secondary/70 dark:placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium shadow-inner" placeholder="Ex: Rede Principal" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Versão SNMP</label>
                    <select value={version} onChange={e => setVersion(e.target.value as any)} className="w-full bg-transparent border border-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium appearance-none shadow-inner">
                        <option value="v1">SNMP v1</option>
                        <option value="v2c">SNMP v2c</option>
                        <option value="v3">SNMP v3</option>
                    </select>
                </div>

                {/* Campos específicos para v1/v2c */}
                {(version === 'v1' || version === 'v2c') && (
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Community String</label>
                        <input type="password" value={community} onChange={e => setCommunity(e.target.value)} className="w-full bg-transparent border border-border rounded-2xl p-4 text-main placeholder:text-secondary/70 dark:placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-mono shadow-inner" placeholder="public / private" />
                    </div>
                )}

                {/* Campos complexos para v3 (Segurança baseada em usuário) */}
                {version === 'v3' && (
                    <>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Usuário (Username)</label>
                            <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-transparent border border-border rounded-2xl p-4 text-main placeholder:text-secondary/70 dark:placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium shadow-inner" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Protocolo Auth</label>
                                <select value={authProto} onChange={e => setAuthProto(e.target.value)} className="w-full bg-transparent border border-border rounded-xl p-3 text-xs text-main outline-none focus:border-accent shadow-inner">
                                    <option value="">Nenhum</option>
                                    <option value="MD5">MD5</option>
                                    <option value="SHA">SHA</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Senha Auth</label>
                                <input type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} className="w-full bg-transparent border border-border rounded-xl p-3 text-xs text-main outline-none focus:border-accent shadow-inner" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Protocolo Priv</label>
                                <select value={privProto} onChange={e => setPrivProto(e.target.value)} className="w-full bg-transparent border border-border rounded-xl p-3 text-xs text-main outline-none focus:border-accent shadow-inner">
                                    <option value="">Nenhum</option>
                                    <option value="DES">DES</option>
                                    <option value="AES">AES</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Senha Priv</label>
                                <input type="password" value={privPass} onChange={e => setPrivPass(e.target.value)} className="w-full bg-transparent border border-border rounded-xl p-3 text-xs text-main outline-none focus:border-accent shadow-inner" />
                            </div>
                        </div>
                    </>
                )}

                <PrimaryButton
                    onClick={handleSubmit}
                    disabled={!name || isSubmitting}
                    loading={isSubmitting}
                    fullWidth
                >
                    {editingId ? 'Salvar Alterações' : 'Cadastrar Comunidade'}
                </PrimaryButton>
            </FormCard>

            {/* Listagem de Comunidades Existentes */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-secondary uppercase tracking-widest px-2">Comunidades Ativas ({filteredCommunities.length})</h3>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Buscar comunidades..."
                        className="w-64"
                    />
                </div>

                <div className="space-y-3">
                    {filteredCommunities.length === 0 ? (
                        <EmptyState
                            icon={Key}
                            title={searchQuery ? 'Nenhuma comunidade encontrada' : 'Nenhuma comunidade cadastrada'}
                            description={searchQuery ? 'Tente ajustar sua busca' : 'Crie sua primeira comunidade SNMP'}
                        />
                    ) : (
                        filteredCommunities.map((c: any) => (
                            <ListCard
                                key={c.id}
                                icon={Key}
                                iconColor="text-accent"
                                iconBg="bg-accent/10 dark:bg-accent/10"
                                title={c.name}
                                badges={
                                    <>
                                        <StatusBadge label={c.version} variant="primary" />
                                        <span className="text-xs text-secondary font-medium">
                                            {c.version === 'v3' ? `User: ${c.username}` : 'Community String'}
                                        </span>
                                    </>
                                }
                                stats={[
                                    { label: 'Ranges', value: (c as any)._count?.networkRanges || 0 }
                                ]}
                                actions={
                                    <>
                                        <ActionButton icon={Edit2} onClick={() => handleEdit(c)} variant="primary" />
                                        <ActionButton
                                            icon={Trash2}
                                            onClick={() => confirm('Excluir esta comunidade?') && deleteMutation.mutate({ id: c.id })}
                                            variant="danger"
                                        />
                                    </>
                                }
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Gerenciador de Faixas de Rede (Network Ranges).
 * Permite configurar subredes para escaneamentos automáticos agendados.
 */
function NetworkRangeManager() {
    const utils = trpc.useContext();

    // Consultas de dados necessários
    const { data: ranges = [] } = (trpc as any).snmp.listRanges.useQuery();
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();
    const { data: communities = [] } = (trpc as any).snmp.listCommunities.useQuery();

    // Estados do formulário
    const [name, setName] = useState('');
    const [subnet, setSubnet] = useState('');
    const [locationId, setLocationId] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [snmpEnabled, setSnmpEnabled] = useState(false);
    const [snmpCommunityId, setSnmpCommunityId] = useState('');
    const [scanSchedule, setScanSchedule] = useState('');
    const [scanIntervalDays, setScanIntervalDays] = useState(7);
    const [scanHour, setScanHour] = useState(3);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Mutação para criação
    const createMutation = (trpc as any).snmp.createRange.useMutation({
        onSuccess: () => {
            ((utils as any).snmp as any).listRanges.invalidate();
            resetForm();
        }
    });

    // Mutação para atualização
    const updateMutation = (trpc as any).snmp.updateRange.useMutation({
        onSuccess: () => {
            ((utils as any).snmp as any).listRanges.invalidate();
            resetForm();
        }
    });

    // Mutação para exclusão
    const deleteMutation = (trpc as any).snmp.deleteRange.useMutation({
        onSuccess: () => ((utils as any).snmp as any).listRanges.invalidate()
    });

    // Mutação para executar varredura agora
    const runMutation = (trpc as any).discovery.scanRange.useMutation({
        onSuccess: () => alert('Varredura iniciada! Acompanhe o progresso na Central de Descoberta.')
    });

    const resetForm = () => {
        setName('');
        setSubnet('');
        setLocationId('');
        setEnabled(true);
        setSnmpEnabled(false);
        setSnmpCommunityId('');
        setScanSchedule('');
        setScanIntervalDays(7);
        setScanHour(3);
        setEditingId(null);
        setIsSubmitting(false);
    };

    const handleEdit = (range: any) => {
        setEditingId(range.id);
        setName(range.name);
        setSubnet(range.subnet);
        setLocationId(range.locationId || '');
        setEnabled(range.enabled);
        setSnmpEnabled(range.snmpEnabled);
        setSnmpCommunityId(range.snmpCommunityId || '');
        setScanSchedule(range.scanSchedule || '');
        setScanIntervalDays(range.scanIntervalDays ?? 7);
        setScanHour(range.scanHour ?? 3);
    };

    const handleSubmit = () => {
        setIsSubmitting(true);
        const data = {
            name,
            subnet,
            locationId: locationId || undefined,
            enabled,
            snmpEnabled,
            snmpCommunityId: snmpCommunityId || undefined,
            scanSchedule: scanSchedule || undefined,
            scanIntervalDays,
            scanHour
        };

        if (editingId) {
            updateMutation.mutate({ id: editingId, ...data });
        } else {
            createMutation.mutate(data);
        }
    };

    const filteredRanges = ranges.filter((r: any) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.subnet.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <FormCard
                title={editingId ? 'Editar Faixa' : 'Nova Faixa de Rede'}
                icon={Network}
                iconColor="text-emerald-600 dark:text-emerald-500"
                onClose={editingId ? resetForm : undefined}
            >
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Nome da Faixa</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border border-border rounded-2xl p-4 text-main placeholder:text-secondary/70 dark:placeholder:text-slate-700 outline-none focus:border-emerald-500/50 transition-all font-medium shadow-inner" placeholder="Ex: Rede Corporativa" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Subnet (CIDR)</label>
                    <input value={subnet} onChange={e => setSubnet(e.target.value)} className="w-full bg-transparent border border-border rounded-2xl p-4 text-main font-mono placeholder:text-secondary/70 dark:placeholder:text-slate-700 outline-none focus:border-emerald-500/50 transition-all shadow-inner" placeholder="192.168.1.0/24" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Unidade (Opcional)</label>
                    <select value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full bg-transparent border border-border rounded-2xl p-4 text-main outline-none focus:border-emerald-500/50 transition-all font-medium appearance-none shadow-inner">
                        <option value="">Nenhuma Unidade</option>
                        {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>

                {/* Sub-form para configurações SNMP vinculadas à faixa */}
                <div className="p-4 bg-card rounded-2xl border border-border space-y-3">
                    <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-[0.2em] italic">Configurações SNMP</h4>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={snmpEnabled} onChange={e => setSnmpEnabled(e.target.checked)} className="w-5 h-5 rounded bg-transparent border-slate-300 dark:border-slate-700" />
                        <span className="text-sm text-secondary font-medium">Habilitar SNMP nesta faixa</span>
                    </label>
                    {snmpEnabled && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Comunidade SNMP</label>
                            <select value={snmpCommunityId} onChange={e => setSnmpCommunityId(e.target.value)} className="w-full bg-transparent border border-border rounded-xl p-3 text-xs text-main outline-none focus:border-emerald-500 shadow-inner">
                                <option value="">Selecione...</option>
                                {communities.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.version})</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Configurações de Agendamento */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-accent/50 space-y-4">
                    <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] italic flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Agendamento de Varredura
                    </h4>
                    <p className="text-[9px] text-secondary font-bold uppercase tracking-tight">
                        Defina a periodicidade para atualização automática do inventário desta rede.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Frequência (dias)</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="365" 
                                value={scanIntervalDays} 
                                onChange={e => setScanIntervalDays(parseInt(e.target.value) || 1)} 
                                className="w-full bg-transparent border border-border rounded-xl p-3 text-xs text-main outline-none focus:border-accent shadow-inner" 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Horário (0-23h)</label>
                            <input 
                                type="number" 
                                min="0" 
                                max="23" 
                                value={scanHour} 
                                onChange={e => setScanHour(parseInt(e.target.value) || 0)} 
                                className="w-full bg-transparent border border-border rounded-xl p-3 text-xs text-main outline-none focus:border-accent shadow-inner" 
                            />
                        </div>
                    </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-5 h-5 rounded bg-transparent border-slate-300 dark:border-slate-700" />
                    <span className="text-sm text-secondary font-medium">Faixa ativa para escaneamento</span>
                </label>

                <PrimaryButton
                    onClick={handleSubmit}
                    disabled={!name || !subnet || isSubmitting}
                    loading={isSubmitting}
                    variant="success"
                    fullWidth
                >
                    {editingId ? 'Salvar Alterações' : 'Cadastrar Faixa'}
                </PrimaryButton>
            </FormCard>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-secondary uppercase tracking-widest px-2">Faixas Configuradas ({filteredRanges.length})</h3>
                    <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Buscar faixas..."
                        className="w-64"
                    />
                </div>

                <div className="space-y-3">
                    {filteredRanges.length === 0 ? (
                        <EmptyState
                            icon={Network}
                            title={searchQuery ? 'Nenhuma faixa encontrada' : 'Nenhuma faixa configurada'}
                            description={searchQuery ? 'Tente ajustar sua busca' : 'Crie sua primeira faixa de rede'}
                        />
                    ) : (
                        filteredRanges.map((r: any) => (
                            <ListCard
                                key={r.id}
                                icon={Network}
                                iconColor="text-emerald-600 dark:text-emerald-500"
                                iconBg="bg-emerald-600/10 dark:bg-emerald-500/10"
                                title={r.name}
                                badges={
                                    <>
                                        <StatusBadge label={r.subnet} variant="success" />
                                        {r.location && <StatusBadge label={r.location.name} variant="info" />}
                                        {r.snmpEnabled && <StatusBadge label={`SNMP: ${r.snmpCommunity?.name}`} variant="primary" />}
                                        <StatusBadge label={`${r.scanIntervalDays || 7}d / ${r.scanHour || 3}h`} variant="info" />
                                        {r.lastScanAt && (
                                            <StatusBadge 
                                                label={`Último: ${new Date(r.lastScanAt).toLocaleString()}`} 
                                                variant="default" 
                                            />
                                        )}
                                        {!r.enabled && <StatusBadge label="INATIVA" variant="danger" />}
                                    </>
                                }
                                actions={
                                    <>
                                        <ActionButton
                                            icon={runMutation.isLoading ? Loader2 : Play}
                                            onClick={() => runMutation.mutate({ rangeId: r.id })}
                                            variant="primary"
                                            tooltip="Executar Agora"
                                            disabled={runMutation.isLoading}
                                        />
                                        <ActionButton icon={Edit2} onClick={() => handleEdit(r)} variant="success" />
                                        <ActionButton
                                            icon={Trash2}
                                            onClick={() => confirm('Excluir esta faixa?') && deleteMutation.mutate({ id: r.id })}
                                            variant="danger"
                                        />
                                    </>
                                }
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
