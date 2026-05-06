import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Shield, Trash2, Edit2, X } from 'lucide-react';

export function UserManager() {
    const utils = trpc.useContext();
    const { data: users = [] } = (trpc.auth as any).listUsers.useQuery();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'ADMIN' | 'OPERATOR' | 'TECNICO' | 'USER'>('USER');

    const [editingUser, setEditingUser] = useState<any>(null);
    const [editRole, setEditRole] = useState<'ADMIN' | 'OPERATOR' | 'TECNICO' | 'USER'>('USER');
    const [editEmail, setEditEmail] = useState('');
    const [departmentId, setDepartmentId] = useState<string>('');
    const [editDepartmentId, setEditDepartmentId] = useState<string>('');

    const { data: departments = [] } = (trpc as any).organization.listDepartments.useQuery();

    const createMutation = (trpc.auth as any).createUser.useMutation({
        onSuccess: () => {
            ((utils as any).auth as any).listUsers.invalidate();
            setName('');
            setEmail('');
            setUsername('');
            setPassword('');
            setRole('USER');
            setDepartmentId('');
        }
    });

    const deleteMutation = (trpc.auth as any).deleteUser.useMutation({
        onSuccess: () => ((utils as any).auth as any).listUsers.invalidate()
    });

    const updateMutation = (trpc.auth as any).updateUser.useMutation({
        onSuccess: () => {
            ((utils as any).auth as any).listUsers.invalidate();
            setEditingUser(null);
        }
    });

    const openEditModal = (user: any) => {
        setEditingUser(user);
        setEditRole(user.role);
        setEditEmail(user.email || '');
        setEditDepartmentId(user.departmentId || '');
    };

    const handleUpdate = () => {
        updateMutation.mutate({
            id: editingUser.id,
            role: editRole,
            email: editEmail || undefined,
            departmentId: editDepartmentId || null
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Formulário de Criação */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group h-fit">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Shield className="w-24 h-24 text-accent" />
                        </div>
                        <h3 className="text-xl font-black text-white italic mb-6">Novo Operador / Técnico</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Nome Completo</label>
                                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium" placeholder="Ex: João Silva" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Login / Usuário</label>
                                    <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium" placeholder="ex: joao.silva" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">E-mail para Notificações</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium" placeholder="ex: joao@empresa.com" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Nível de Acesso</label>
                                    <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium appearance-none">
                                        <option value="USER">Usuário (Padrão)</option>
                                        <option value="TECNICO">Técnico de Atendimento</option>
                                        <option value="OPERATOR">Operador / Gestor</option>
                                        <option value="ADMIN">Administrador (Total)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Senha Inicial</label>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium" placeholder="••••••••" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Departamento</label>
                                <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium appearance-none">
                                    <option value="">Nenhum</option>
                                    {departments.map((dept: any) => (
                                        <option key={dept.id} value={dept.id}>{dept.name} {dept.location?.name ? `(${dept.location.name})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={() => createMutation.mutate({ name, username, password, role, email, departmentId: departmentId || undefined })}
                                disabled={!name || !username || !password || createMutation.isPending}
                                className="w-full bg-accent hover:bg-accent disabled:bg-accent text-white font-black py-4 rounded-2xl shadow-xl shadow-accent/20 transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
                            >
                                {createMutation.isPending ? 'Criando...' : 'Criar Conta de Acesso'}
                            </button>
                        </div>
                    </div>

                    {/* Lista de Usuários */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-secondary uppercase tracking-widest px-2">Usuários do Sistema ({users.length})</h3>
                        {users.map((u: any) => (
                            <div key={u.id} className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-3xl group hover:border-slate-700 transition-all shadow-lg shadow-black/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-secondary/70 group-hover:bg-accent group-hover:text-white transition-all font-bold">
                                        {u.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="text-white font-black italic">{u.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-secondary font-mono">@{u.username}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${u.role === 'ADMIN' ? 'bg-red-500/10 text-red-500' :
                                                u.role === 'OPERATOR' ? 'bg-amber-500/10 text-amber-500' :
                                                    u.role === 'TECNICO' ? 'bg-emerald-500/10 text-emerald-500' :
                                                        'bg-accent/10 text-accent'
                                                }`}>
                                                {u.role === 'ADMIN' ? 'Administrador' : u.role === 'OPERATOR' ? 'Operador' : u.role === 'TECNICO' ? 'Técnico' : 'Usuário'}
                                            </span>
                                            {u.email && <span className="text-[9px] text-secondary/70 font-medium truncate max-w-[150px]">({u.email})</span>}
                                            {u.department && <span className="text-[9px] text-accent font-bold px-2 py-0.5 bg-accent/10 rounded-lg">{u.department.name}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openEditModal(u)} className="p-3 text-slate-600 hover:text-accent hover:bg-accent/10 rounded-2xl transition-all"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => deleteMutation.mutate({ id: u.id })} className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative">
                        <button onClick={() => setEditingUser(null)} className="absolute top-6 right-6 p-2 text-secondary/70 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-2xl font-black text-white italic mb-6">Editar Usuário</h3>

                        <div className="space-y-5">
                            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800">
                                <p className="text-xs font-bold text-secondary uppercase mb-1">Nome</p>
                                <p className="text-lg font-black text-white italic">{editingUser.name}</p>
                                <p className="text-sm text-secondary/70 font-mono">@{editingUser.username}</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">E-mail</label>
                                <input
                                    value={editEmail}
                                    onChange={e => setEditEmail(e.target.value)}
                                    type="email"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium"
                                    placeholder="email@empresa.com"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Nível de Acesso</label>
                                <select
                                    value={editRole}
                                    onChange={e => setEditRole(e.target.value as any)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium appearance-none"
                                >
                                    <option value="USER">Usuário (Padrão)</option>
                                    <option value="TECNICO">Técnico de Atendimento</option>
                                    <option value="OPERATOR">Operador / Gestor</option>
                                    <option value="ADMIN">Administrador (Total)</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Departamento</label>
                                <select
                                    value={editDepartmentId}
                                    onChange={e => setEditDepartmentId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium appearance-none"
                                >
                                    <option value="">Nenhum</option>
                                    {departments.map((dept: any) => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setEditingUser(null)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all uppercase text-xs tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUpdate}
                                    disabled={updateMutation.isPending}
                                    className="flex-1 bg-accent hover:bg-accent disabled:bg-accent text-white font-black py-4 rounded-2xl shadow-xl shadow-accent/20 transition-all uppercase text-xs tracking-widest"
                                >
                                    {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
