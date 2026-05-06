import { trpc } from '../utils/trpc';
import { Network, Activity, Plus, X, Layers, RotateCcw, Trash2, Pencil, Save, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { IPAMAddressList } from './IPAMAddressList';

/* ─── Modal helpers ──────────────────────────────────────────────── */

function Modal({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-10 sm:pt-20 overflow-y-auto">
            <div className="bg-card border border-border rounded-[3rem] w-full max-w-xl p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black text-main italic tracking-tighter uppercase">{title}</h3>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 dark:hover:bg-slate-800 text-secondary hover:text-red-500 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function Field({ label, name, placeholder, defaultValue, required }: { label: string, name: string, placeholder?: string, defaultValue?: string, required?: boolean }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-black text-secondary uppercase ml-1">{label}</label>
            <input
                name={name}
                required={required}
                defaultValue={defaultValue}
                className="w-full bg-page/50 border border-border rounded-2xl p-4 text-sm focus:border-accent outline-none transition-all text-main placeholder:text-secondary/70"
                placeholder={placeholder}
            />
        </div>
    );
}

/* ─── Create/Edit Subnet Modal ───────────────────────────────────── */

function SubnetModal({ editing, onClose, onSuccess }: { editing?: any, onClose: () => void, onSuccess: () => void }) {
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();
    const createMutation = (trpc as any).ipam.createSubnet.useMutation({ onSuccess });
    const updateMutation = (trpc as any).ipam.updateSubnet.useMutation({ onSuccess });

    const mutation = editing ? updateMutation : createMutation;
    const isLoading = mutation.isLoading;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const payload = {
            name: (formData.get('name') as string) || undefined,
            description: (formData.get('description') as string) || undefined,
            vlan: (formData.get('vlan') as string) || undefined,
            locationId: (formData.get('locationId') as string) || undefined,
        };

        if (editing) {
            updateMutation.mutate({ id: editing.id, ...payload });
        } else {
            const subnet = (formData.get('subnet') as string)?.trim();
            if (subnet && !subnet.endsWith('/24')) {
                alert('Atenção: No momento, apenas sub-redes com máscara /24 são suportadas para varredura automática.');
            }
            createMutation.mutate({
                ...payload,
                subnet: subnet,
            });
        }
    };

    return (
        <Modal title={editing ? 'Editar Sub-rede' : 'Nova Sub-rede'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <Field label="Nome da Rede" name="name" placeholder="VLAN Produção" defaultValue={editing?.name} />
                {!editing && (
                    <Field label="Sub-rede (CIDR)" name="subnet" placeholder="192.168.1.0/24" required />
                )}
                <Field label="Descrição" name="description" placeholder="Rede de servidores internos" defaultValue={editing?.description} />
                <div className="grid grid-cols-2 gap-4">
                    <Field label="VLAN ID" name="vlan" placeholder="10" defaultValue={editing?.vlan} />
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-secondary uppercase ml-1">Localização</label>
                        <select
                            name="locationId"
                            defaultValue={editing?.locationId}
                            className="w-full bg-page/50 border border-border rounded-2xl p-4 text-sm focus:border-accent outline-none transition-all text-main"
                        >
                            <option value="">Nenhuma</option>
                            {locations.map((loc: any) => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {mutation.isError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {(mutation.error as any)?.message || 'Erro ao salvar sub-rede'}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-secondary hover:bg-white/5 dark:hover:bg-slate-800 transition-all">
                        Cancelar
                    </button>
                    <button type="submit" disabled={isLoading} className="bg-accent hover:bg-accent disabled:opacity-50 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-accent/20 flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        {isLoading ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar Sub-rede'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/* ─── Subnet Card ────────────────────────────────────────────────── */

function SubnetCard({ subnet, onSelect, onEdit, onDelete }: { subnet: any, onSelect: () => void, onEdit: () => void, onDelete: () => void }) {
    const isCritical = subnet.percent > 85;

    return (
        <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
            <div className={`absolute -top-24 -right-24 w-48 h-48 blur-[80px] rounded-full transition-opacity opacity-0 group-hover:opacity-20 pointer-events-none ${isCritical ? 'bg-red-500' : 'bg-accent'}`} />

            <div className="flex justify-between items-start mb-6">
                <div>
                    <h4 className="text-lg font-black text-main italic uppercase tracking-tight">{subnet.name || 'Sem Nome'}</h4>
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] text-accent font-black uppercase tracking-widest">{subnet.subnet}</p>
                        {subnet.location && (
                            <span className="text-[9px] bg-card text-secondary px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold">
                                {subnet.location.name}
                            </span>
                        )}
                    </div>
                    {subnet.vlan && <p className="text-[10px] text-secondary/70 font-bold mt-1">VLAN {subnet.vlan}</p>}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                    <div className={`px-3 py-1.5 rounded-xl ${isCritical ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {subnet.percent}%
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="h-2 w-full bg-card rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : 'bg-accent'} ${subnet.isScanning ? 'animate-pulse' : ''}`}
                        style={{ width: `${subnet.percent}%` }}
                    />
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-1.5 text-secondary">
                        <div className={`w-1.5 h-1.5 rounded-full ${subnet.isScanning ? 'bg-accent animate-pulse' : 'bg-accent'}`} />
                        <span>{subnet.used} Ocupados {subnet.isScanning && '(ESCANEANDO)'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-secondary">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <span>{subnet.total - subnet.used} Livres</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-8">
                <button
                    onClick={onSelect}
                    className="col-span-1 py-3 bg-page/50 hover:bg-accent hover:text-white text-secondary rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center group/btn"
                >
                    Ver IPs
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="py-3 bg-card hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-secondary/70 hover:text-accent rounded-2xl transition-all flex items-center justify-center"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="py-3 bg-card hover:bg-red-100 dark:hover:bg-red-900/40 text-secondary/70 hover:text-red-500 rounded-2xl transition-all flex items-center justify-center"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

/* ─── Main Dashboard ─────────────────────────────────────────────── */

export function IPAMDashboard() {
    const utils = (trpc as any).useUtils();
    const { data: summary = [], isLoading } = (trpc as any).ipam.getSummary.useQuery(undefined, {
        refetchInterval: (data: any) => data?.some((s: any) => s.isScanning) ? 3000 : false
    });
    const [selectedSubnet, setSelectedSubnet] = useState<any>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [editingSubnet, setEditingSubnet] = useState<any>(null);
    const [deletingSubnet, setDeletingSubnet] = useState<any>(null);

    const deleteMutation = (trpc as any).ipam.deleteSubnet.useMutation({
        onSuccess: (_data: any, deletedId: string) => {
            setDeletingSubnet(null);
            utils.ipam.getSummary.invalidate();
            if (selectedSubnet?.id === deletedId) setSelectedSubnet(null);
        }
    });

    const scanMutation = (trpc as any).ipam.scanSubnet.useMutation({
        onSuccess: () => {
            utils.ipam.getSummary.invalidate();
        }
    });

    const invalidateSummary = () => {
        utils.ipam.getSummary.invalidate();
        setIsCreating(false);
        setEditingSubnet(null);
    };

    if (isLoading) return (
        <div className="animate-pulse flex items-center gap-3 text-secondary font-bold uppercase text-[10px] tracking-widest">
            <Activity className="w-4 h-4 animate-spin" /> Carregando gestão de redes...
        </div>
    );

    // Sync selectedSubnet data if summary updates
    const currentSubnet = selectedSubnet ? summary.find((s: any) => s.id === selectedSubnet.id) : null;
    const activeSubnet = currentSubnet || selectedSubnet;

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-main italic tracking-tighter uppercase flex items-center gap-4">
                        <div className="p-3 bg-accent/10 rounded-2xl">
                            <Network className="w-8 h-8 text-accent" />
                        </div>
                        IPAM & Network
                    </h2>
                    <p className="text-secondary font-bold uppercase tracking-widest mt-2 ml-16 text-[10px]">Gestão de Endereçamento e Sub-redes</p>
                </div>
                {selectedSubnet ? (
                     <div className="flex gap-3">
                        <button
                            onClick={() => setSelectedSubnet(null)}
                            className="bg-border text-secondary px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                        >
                            <X className="w-4 h-4" /> Voltar
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/20"
                    >
                        <Plus className="w-4 h-4" /> Nova Sub-rede
                    </button>
                )}
            </div>

            {/* Subnet Grid */}
            {!selectedSubnet ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(summary as any[]).map((subnet: any) => (
                        <SubnetCard
                            key={subnet.id}
                            subnet={subnet}
                            onSelect={() => setSelectedSubnet(subnet)}
                            onEdit={() => setEditingSubnet(subnet)}
                            onDelete={() => setDeletingSubnet(subnet)}
                        />
                    ))}
                    {summary.length === 0 && (
                        <div
                            onClick={() => setIsCreating(true)}
                            className="border-2 border-dashed border-border rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center group hover:border-accent/30 transition-all cursor-pointer min-h-[250px] col-span-full"
                        >
                            <div className="p-4 bg-white/5 bg-card rounded-3xl mb-4 group-hover:scale-110 transition-transform">
                                <Plus className="w-8 h-8 text-secondary/70 group-hover:text-accent" />
                            </div>
                            <h4 className="font-black text-secondary/70 dark:text-slate-600 uppercase italic text-sm">Nenhuma sub-rede cadastrada</h4>
                            <p className="text-[10px] text-secondary font-medium mt-1">Clique para adicionar a primeira</p>
                        </div>
                    )}
                </div>
            ) : (
                /* IP Address Detail View */
                <div className="glass-panel rounded-[3rem] p-10 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-10">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-accent/10 rounded-3xl">
                                <Layers className={`w-8 h-8 text-accent ${activeSubnet.isScanning ? 'animate-pulse' : ''}`} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-main italic uppercase tracking-tight">{activeSubnet.name || activeSubnet.subnet}</h3>
                                <p className="text-xs text-accent font-black uppercase tracking-widest">{activeSubnet.subnet}</p>
                                {activeSubnet.isScanning && <p className="text-[8px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-black uppercase tracking-[0.2em] mt-1 inline-block animate-pulse">Escaneamento em Progresso...</p>}
                            </div>
                        </div>
                        <div className="flex gap-4 items-center">
                            <div className="text-right mr-4">
                                <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Utilização</p>
                                <p className={`text-xl font-black italic ${activeSubnet.percent > 85 ? 'text-red-500' : 'text-emerald-500'}`}>{activeSubnet.percent}%</p>
                            </div>
                                <button
                                    onClick={() => scanMutation.mutate(activeSubnet.id)}
                                    disabled={scanMutation.isPending || activeSubnet.isScanning}
                                    className="cyber-button flex items-center gap-2 px-8 py-4 rounded-2xl text-[10px] uppercase transition-all"
                                >
                                    <RotateCcw className={`w-5 h-5 ${(scanMutation.isPending || activeSubnet.isScanning) ? 'animate-spin' : ''}`} />
                                    {(scanMutation.isPending || activeSubnet.isScanning) ? 'Escaneando...' : 'Escanear Rede'}
                                </button>
                        </div>
                    </div>

                    <IPAMAddressList subnetId={activeSubnet.id} />
                </div>
            )}

            {/* Create Modal */}
            {isCreating && (
                <SubnetModal
                    onClose={() => setIsCreating(false)}
                    onSuccess={invalidateSummary}
                />
            )}

            {/* Edit Modal */}
            {editingSubnet && (
                <SubnetModal
                    editing={editingSubnet}
                    onClose={() => setEditingSubnet(null)}
                    onSuccess={invalidateSummary}
                />
            )}

            {/* Delete Confirm Modal */}
            {deletingSubnet && (
                <Modal title="Excluir Sub-rede" onClose={() => setDeletingSubnet(null)}>
                    <div className="space-y-6">
                        <div className="flex items-start gap-4 p-5 bg-red-500/5 border border-red-500/20 rounded-3xl">
                            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-black text-slate-800 dark:text-slate-200 text-sm">Tem certeza que deseja excluir?</p>
                                <p className="text-secondary text-xs mt-1">
                                    A sub-rede <span className="font-black text-accent">{deletingSubnet.subnet}</span> será removida permanentemente.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeletingSubnet(null)} className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-secondary hover:bg-white/5 dark:hover:bg-slate-800 transition-all">
                                Cancelar
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deletingSubnet.id)}
                                disabled={deleteMutation.isPending}
                                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {deleteMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
