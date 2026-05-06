import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { MapPin, Plus, Trash2, Shield, Globe, Laptop, Server, Wifi, Printer, Save, Edit2, X, Users, Bell, Database, Phone, HardDrive, Camera, Radio, Cloud } from 'lucide-react';
import { UserManager } from './UserManager';
import { AlertSettings } from './AlertSettings';

/**
 * Componente principal para gestão da estrutura organizacional e ativos.
 * Centraliza o gerenciamento de Unidades, Departamentos e Ativos de Rede.
 */
export function OrganizationHub() {
    const [subTab, setSubTab] = useState<'ativos' | 'departments' | 'locations' | 'snmp' | 'ranges' | 'users'>('locations');

    return (
        <div className="space-y-6">
            <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-xl w-fit flex-wrap">
                <TabButton active={subTab === 'locations'} onClick={() => setSubTab('locations')} label="Organização" icon={MapPin} />
                <TabButton active={subTab === 'users'} onClick={() => setSubTab('users')} label="Usuários" icon={Users} />
                <TabButton active={subTab === 'ranges'} onClick={() => setSubTab('ranges')} label="Redes" icon={Globe} />
                <TabButton active={subTab === 'ativos'} onClick={() => setSubTab('ativos')} label="Ativos" icon={Plus} />
                <TabButton active={subTab === 'snmp'} onClick={() => setSubTab('snmp')} label="SNMP" icon={Shield} />
                <TabButton active={subTab === 'monitoring' as any} onClick={() => setSubTab('monitoring' as any)} label="Alertas" icon={Bell} />
            </div>

            <div className="animate-in fade-in slide-in-from-top-2 duration-500 bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                {subTab === 'locations' && <OrgHierarchyManager />}
                {subTab === 'users' && <UserManager />}
                {subTab === 'ranges' && <NetworkRangeManager />}
                {subTab === 'ativos' && <AssetManager />}
                {subTab === 'snmp' && <SnmpCommunityManager />}
                {(subTab as string) === 'monitoring' && <AlertSettings />}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, label, icon: Icon }: any) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-black italic tracking-tighter transition-all uppercase text-xs
                ${active
                    ? 'bg-accent text-white shadow-lg shadow-accent/20 scale-[1.02] ring-2 ring-accent/20'
                    : 'text-secondary hover:text-slate-200 hover:bg-slate-800/50'}
            `}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}

// --- GESTOR DE ATIVOS (NET ASSETS) ---
function AssetManager() {
    const utils = trpc.useContext();
    const { data: depts = [] } = (trpc as any).organization.listDepartments.useQuery();
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();
    const { data: users = [] } = (trpc as any).auth.listUsers.useQuery();

    const [name, setName] = useState('');
    const [ip, setIp] = useState('');
    const [type, setType] = useState('SERVER');
    const [deptId, setDeptId] = useState('');
    const [locId, setLocId] = useState('');
    const [userId, setUserId] = useState('');

    const createMutation = (trpc as any).organization.createDevice.useMutation({
        onSuccess: () => {
            ((utils as any).scan as any).getDevices.invalidate();
            setName(''); setIp(''); setType('SERVER');
            setDeptId(''); setLocId(''); setUserId('');
        }
    });

    const DEVICE_TYPES = [
        { value: 'SERVER', label: 'Servidor', icon: Server },
        { value: 'ROUTER', label: 'Roteador', icon: Globe },
        { value: 'SWITCH', label: 'Switch', icon: Wifi },
        { value: 'FIREWALL', label: 'Firewall', icon: Shield },
        { value: 'INTERNET', label: 'Internet / Nuvem', icon: Cloud },
        { value: 'DATABASE', label: 'Banco de Dados', icon: Database },
        { value: 'VOIP', label: 'VoIP', icon: Phone },
        { value: 'NAS', label: 'NAS / Storage', icon: HardDrive },
        { value: 'CAMERA', label: 'Câmera (CCTV)', icon: Camera },
        { value: 'ACCESS_POINT', label: 'Access Point', icon: Radio },
        { value: 'PRINTER', label: 'Impressora', icon: Printer },
        { value: 'WORKSTATION', label: 'Computador', icon: Laptop },
        { value: 'OTHER', label: 'Outro', icon: Shield },
    ];

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
                <Laptop className="w-32 h-32 text-accent" />
            </div>
            <h3 className="text-2xl font-black text-white italic mb-8">Novo Ativo de Rede</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Identificação / Nome</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium" placeholder="Ex: Servidor de Dados Principal" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Endereço IP (Gestão)</label>
                        <input value={ip} onChange={e => setIp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-mono placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all" placeholder="192.168..." />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Tipo de Equipamento</label>
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium appearance-none">
                            {DEVICE_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-6 bg-slate-800/30 rounded-[2.5rem] border border-slate-800 space-y-4">
                    <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] italic mb-2">Vínculos Organizacionais (Opcional)</h4>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Unidade / Local</label>
                            <select value={locId} onChange={e => setLocId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-accent">
                                <option value="">Não Vinculado</option>
                                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Departamento</label>
                            <select value={deptId} onChange={e => setDeptId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-accent">
                                <option value="">Não Vinculado</option>
                                {depts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Operador / Usuário</label>
                            <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-accent">
                                <option value="">Não Vinculado</option>
                                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={() => createMutation.mutate({
                    name, ipAddress: ip, type: type as any,
                    departmentId: deptId || undefined,
                    locationId: locId || undefined,
                    userId: userId || undefined
                })}
                disabled={!name || !ip || createMutation.isPending}
                className="w-full bg-accent hover:bg-accent disabled:bg-accent text-white font-black py-5 rounded-2xl shadow-xl shadow-accent/20 transition-all active:scale-[0.98] uppercase tracking-widest text-xs flex items-center justify-center gap-2"
            >
                {createMutation.isPending ? 'REGISTRANDO...' : <><Save className="w-4 h-4" /> CADASTRAR NO INVENTÁRIO</>}
            </button>
        </div>
    );
}

// --- GESTOR DE HIERARQUIA ORGANIZACIONAL (Combined View) ---
function OrgHierarchyManager() {
    const [view, setView] = useState<'locations' | 'departments'>('locations');

    return (
        <div className="space-y-8">
            <div className="flex gap-4 border-b border-slate-800 pb-4">
                <button onClick={() => setView('locations')} className={`text-sm font-bold ${view === 'locations' ? 'text-accent' : 'text-secondary'}`}>Unidades</button>
                <button onClick={() => setView('departments')} className={`text-sm font-bold ${view === 'departments' ? 'text-accent' : 'text-secondary'}`}>Departamentos</button>
            </div>

            {view === 'locations' && <LocationManager />}
            {view === 'departments' && <DepartmentManager />}
        </div>
    );
}

// --- GESTOR DE DEPARTAMENTOS ---
function DepartmentManager() {
    const utils = trpc.useContext();
    const { data: depts = [] } = (trpc as any).organization.listDepartments.useQuery();
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();

    const [name, setName] = useState('');
    const [locId, setLocId] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const createMutation = (trpc as any).organization.createDepartment.useMutation({
        onSuccess: () => {
            ((utils as any).organization as any).listDepartments.invalidate();
            setName(''); setLocId('');
        }
    });

    const updateMutation = (trpc as any).organization.updateDepartment.useMutation({
        onSuccess: () => {
            ((utils as any).organization as any).listDepartments.invalidate();
            setName(''); setLocId(''); setEditingId(null);
        }
    });

    const deleteMutation = (trpc as any).organization.deleteDepartment.useMutation({
        onSuccess: () => ((utils as any).organization as any).listDepartments.invalidate()
    });

    const startEdit = (dept: any) => {
        setEditingId(dept.id);
        setName(dept.name);
        setLocId(dept.locationId || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName('');
        setLocId('');
    };

    const handleSave = () => {
        if (editingId) {
            updateMutation.mutate({ id: editingId, name, locationId: locId || undefined });
        } else {
            createMutation.mutate({ name, locationId: locId || undefined });
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-xl font-black text-white italic mb-6">
                    {editingId ? 'Editar Departamento' : 'Novo Departamento'}
                </h3>
                <div className="space-y-4">
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" placeholder="Nome do Depto." />
                    <select value={locId} onChange={e => setLocId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white">
                        <option value="">Nenhuma Unidade</option>
                        {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={!name || createMutation.isPending || updateMutation.isPending}
                            className="flex-1 bg-accent py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {editingId ? 'Salvar Alterações' : 'Cadastrar Departamento'}
                        </button>
                        {editingId && (
                            <button onClick={cancelEdit} className="bg-slate-800 px-6 rounded-2xl text-secondary/70 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className="space-y-3">
                {depts.map((d: any) => (
                    <div key={d.id} className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex justify-between items-center text-slate-100 group">
                        <div>
                            <p className="font-bold italic">{d.name}</p>
                            <p className="text-[10px] text-secondary uppercase">{d.location?.name || 'Geral'}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(d)} className="p-2 text-secondary hover:text-accent"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => deleteMutation.mutate({ id: d.id })} className="p-2 text-secondary hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- GESTOR DE UNIDADES / LOCAIS ---
function LocationManager() {
    const utils = trpc.useContext();
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();

    const [name, setName] = useState('');
    const [addr, setAddr] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const createMutation = (trpc as any).organization.createLocation.useMutation({
        onSuccess: () => {
            ((utils as any).organization as any).listLocations.invalidate();
            setName(''); setAddr('');
        }
    });

    const updateMutation = (trpc as any).organization.updateLocation.useMutation({
        onSuccess: () => {
            ((utils as any).organization as any).listLocations.invalidate();
            setName(''); setAddr(''); setEditingId(null);
        }
    });

    const deleteMutation = (trpc as any).organization.deleteLocation.useMutation({
        onSuccess: () => ((utils as any).organization as any).listLocations.invalidate()
    });

    const startEdit = (loc: any) => {
        setEditingId(loc.id);
        setName(loc.name);
        setAddr(loc.address || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName('');
        setAddr('');
    };

    const handleSave = () => {
        if (editingId) {
            updateMutation.mutate({ id: editingId, name, address: addr });
        } else {
            createMutation.mutate({ name, address: addr });
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-xl font-black text-white italic mb-6">
                    {editingId ? 'Editar Unidade' : 'Nova Unidade'}
                </h3>
                <div className="space-y-4">
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" placeholder="Nome da Unidade" />
                    <input value={addr} onChange={e => setAddr(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" placeholder="Endereço" />
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={!name || createMutation.isPending || updateMutation.isPending}
                            className="flex-1 bg-accent py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {editingId ? 'Salvar Alterações' : 'Cadastrar Unidade'}
                        </button>
                        {editingId && (
                            <button onClick={cancelEdit} className="bg-slate-800 px-6 rounded-2xl text-secondary/70 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className="space-y-3">
                {locations.map((l: any) => (
                    <div key={l.id} className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex justify-between items-center text-slate-100 group">
                        <div>
                            <p className="font-bold italic">{l.name}</p>
                            <p className="text-[10px] text-secondary uppercase truncate max-w-[200px]">{l.address || 'Sem endereço'}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(l)} className="p-2 text-secondary hover:text-accent"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => deleteMutation.mutate({ id: l.id })} className="p-2 text-secondary hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- GESTOR DE COMUNIDADES SNMP ---
function SnmpCommunityManager() {
    const utils = trpc.useContext();
    const { data: communities = [] } = (trpc as any).snmp.listCommunities.useQuery();
    const [name, setName] = useState('');
    const [version, setVersion] = useState<'v1' | 'v2c' | 'v3'>('v2c');
    const [community, setCommunity] = useState('');

    const createMutation = (trpc as any).snmp.createCommunity.useMutation({
        onSuccess: () => {
            (utils as any).snmp.listCommunities.invalidate();
            setName(''); setCommunity('');
        }
    });

    const deleteMutation = (trpc as any).snmp.deleteCommunity.useMutation({
        onSuccess: () => (utils as any).snmp.listCommunities.invalidate()
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-xl font-black text-white italic mb-6">Nova Credencial SNMP</h3>
                <div className="space-y-4">
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" placeholder="Nome (Ex: Unigran Public)" />
                    <select value={version} onChange={e => setVersion(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white">
                        <option value="v1">SNMP v1</option>
                        <option value="v2c">SNMP v2c</option>
                    </select>
                    <input value={community} onChange={e => setCommunity(e.target.value)} type="password" className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" placeholder="Comunidade (Ex: public)" />
                    <button
                        onClick={() => createMutation.mutate({ name, version, community })}
                        className="w-full bg-accent py-4 rounded-2xl font-black uppercase text-xs"
                    >
                        Adicionar Credencial
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {communities.map((c: any) => (
                    <div key={c.id} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex justify-between items-center text-slate-100">
                        <div>
                            <p className="font-bold italic">{c.name}</p>
                            <p className="text-[10px] text-secondary uppercase">{c.version} • {c.community?.replace(/./g, '*')}</p>
                        </div>
                        <button onClick={() => deleteMutation.mutate({ id: c.id })} className="p-2 text-secondary hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- GESTOR DE FAIXAS DE REDE ---
function NetworkRangeManager() {
    const utils = trpc.useContext();
    const { data: ranges = [] } = (trpc as any).snmp.listRanges.useQuery();
    const { data: communities = [] } = (trpc as any).snmp.listCommunities.useQuery();
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();

    const [name, setName] = useState('');
    const [subnet, setSubnet] = useState('');
    const [locId, setLocId] = useState('');
    const [snmpId, setSnmpId] = useState('');

    const createMutation = (trpc as any).snmp.createRange.useMutation({
        onSuccess: () => {
            (utils as any).snmp.listRanges.invalidate();
            setName(''); setSubnet('');
        }
    });

    const deleteMutation = (trpc as any).snmp.deleteRange.useMutation({
        onSuccess: () => (utils as any).snmp.listRanges.invalidate()
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-xl font-black text-white italic mb-6">Nova Faixa de Escaneamento</h3>
                <div className="space-y-4">
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" placeholder="Nome (Ex: Subnet Escritório)" />
                    <input value={subnet} onChange={e => setSubnet(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-mono" placeholder="192.168.1.0/24" />

                    <select value={locId} onChange={e => setLocId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white">
                        <option value="">Nenhuma Unidade</option>
                        {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>

                    <select value={snmpId} onChange={e => setSnmpId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white">
                        <option value="">Probar todas as credenciais SNMP</option>
                        {communities.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <button
                        onClick={() => createMutation.mutate({
                            name, subnet, locationId: locId || undefined,
                            snmpEnabled: true, snmpCommunityId: snmpId || undefined
                        })}
                        className="w-full bg-accent py-4 rounded-2xl font-black uppercase text-xs"
                    >
                        Salvar Faixa de Rede
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {ranges.map((r: any) => (
                    <div key={r.id} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex justify-between items-center text-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent"><Globe className="w-5 h-5" /></div>
                            <div>
                                <p className="font-bold italic">{r.name}</p>
                                <p className="text-[10px] text-secondary font-mono uppercase">{r.subnet} • {r.location?.name || 'Sem Unidade'}</p>
                            </div>
                        </div>
                        <button onClick={() => deleteMutation.mutate({ id: r.id })} className="p-2 text-secondary hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}
