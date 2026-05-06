import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { trpc } from '../utils/trpc';
import { X, Save } from 'lucide-react';

interface EditDeviceModalProps {
    device: any;
    onClose: () => void;
}

const DEVICE_TYPES = [
    { value: 'SERVER', label: 'Servidor' },
    { value: 'ROUTER', label: 'Roteador' },
    { value: 'SWITCH', label: 'Switch' },
    { value: 'FIREWALL', label: 'Firewall' },
    { value: 'GATEWAY', label: 'Gateway' },
    { value: 'INTERNET', label: 'Internet / Nuvem' },
    { value: 'DATABASE', label: 'Banco de Dados' },
    { value: 'VOIP', label: 'VoIP' },
    { value: 'NAS', label: 'NAS / Storage' },
    { value: 'CAMERA', label: 'Câmera (CCTV)' },
    { value: 'ACCESS_POINT', label: 'Access Point' },
    { value: 'PRINTER', label: 'Impressora' },
    { value: 'WORKSTATION', label: 'Computador' },
    { value: 'OTHER', label: 'Outro' },
];

export function EditDeviceModal({ device, onClose }: EditDeviceModalProps) {
    const [name, setName] = useState(device.name || '');
    const [type, setType] = useState((device.type || 'OTHER').toUpperCase());
    const [deptId, setDeptId] = useState(device.departmentId || '');
    const [locId, setLocId] = useState(device.locationId || '');
    const [userId, setUserId] = useState(device.userId || '');
    const [parentId, setParentId] = useState(device.parentId || '');
    const [purchaseValue, setPurchaseValue] = useState<number | null>(device.purchaseValue || null);
    const [maintenanceCost, setMaintenanceCost] = useState<number | null>(null);
    const [portSpeed, setPortSpeed] = useState(device.portSpeed || '10G');

    // Novos campos de Patrimônio
    const [assetNumber, setAssetNumber] = useState(device.assetNumber || '');
    const [supplier, setSupplier] = useState(device.supplier || '');
    const [purchaseDate, setPurchaseDate] = useState(device.purchaseDate ? new Date(device.purchaseDate).toISOString().split('T')[0] : '');
    const [warrantyExpiry, setWarrantyExpiry] = useState(device.warrantyExpiry ? new Date(device.warrantyExpiry).toISOString().split('T')[0] : '');
    const [notes, setNotes] = useState(device.notes || '');
    const [voipExtension, setVoipExtension] = useState(device.voipExtension || '');
    const [hasWebcam, setHasWebcam] = useState(device.hasWebcam || false);
    const [hasHeadset, setHasHeadset] = useState(device.hasHeadset || false);
    const [macAddress, setMacAddress] = useState(device.macAddress || device.mac || '');
    const [hostname, setHostname] = useState(device.hostname || '');

    const utils = trpc.useContext();
    const { data: depts = [] } = (trpc as any).organization.listDepartments.useQuery();
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();
    const { data: users = [] } = (trpc as any).auth.listUsers.useQuery();

    // Fetch switches for parent selection
    const { data: allDevices = [] } = (trpc as any).scan.getDevices.useQuery({});
    const switches = allDevices
        .filter((d: any) => d.type === 'switch' && d.id !== device.id)
        .sort((a: any, b: any) => (a.name || a.ip).localeCompare(b.name || b.ip));

    const updateMutation = (trpc as any).organization.updateDevice.useMutation({
        onSuccess: () => {
            ((utils as any).scan as any).getDevices.invalidate();
            ((utils as any).ipam as any).listAddresses.invalidate();
            onClose();
        }
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateMutation.mutateAsync({
                id: device.id,
                name,
                type,
                departmentId: deptId || undefined,
                locationId: locId || undefined,
                userId: userId || undefined,
                parentId: parentId || null,
                purchaseValue: purchaseValue || undefined,
                maintenanceCost: maintenanceCost || undefined,
                assetNumber: assetNumber || undefined,
                supplier: supplier || undefined,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
                warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : undefined,
                notes: notes || undefined,
                portSpeed,
                voipExtension: voipExtension || undefined,
                hasWebcam,
                hasHeadset,
                macAddress: macAddress || undefined,
                hostname: hostname || undefined
            });
        } catch (error) {
            console.error('Failed to update device:', error);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}>
            <div className="flex min-h-screen items-start justify-center pt-4 px-3 pb-3">
                <div className="glass-panel rounded-[32px] w-full max-w-7xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-white/[0.02]">
                        <div className="space-y-0.5">
                            <h2 className="text-xl font-black text-main uppercase tracking-wider italic">Editar Dispositivo</h2>
                            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest opacity-60">Configuração de infraestrutura crítica</p>
                        </div>
                        
                        <div className="flex items-center gap-4 ml-auto mr-4">
                            <div className={`px-5 py-2 flex items-center gap-3 rounded-[20px] border transition-all ${device.ipamStatus === 'RESERVED' ? 'bg-accent/10 border-accent/30 text-accent status-pulse-cyan' : 'bg-red-500/10 border-red-500/30 text-red-500 status-pulse-red'}`}>
                                <span className="text-3xl font-black leading-none">{device.ipamStatus === 'RESERVED' ? 'R' : 'O'}</span>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-50">Status IPAM</span>
                                    <span className="text-xs font-black uppercase tracking-widest">{device.ipamStatus === 'RESERVED' ? 'Reservado' : 'Ocupado'}</span>
                                </div>
                            </div>
                        </div>

                        <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group border border-white/5">
                            <X className="h-5 w-5 text-secondary/70 group-hover:text-main transition-colors" />
                        </button>
                    </div>

                <form onSubmit={handleSave} className="p-5 scrollbar-hide">
                    {/* Two-column layout: left = identidade + organização, right = patrimônio */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {/* COLUNA ESQUERDA */}
                        <div className="space-y-4">
                            {/* Seção 1: Identificação */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] ml-1">Identificação</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Nome</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all font-semibold"
                                            placeholder="Ex: Servidor-DB-01"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Hostname</label>
                                        <input
                                            type="text"
                                            value={hostname}
                                            onChange={(e) => setHostname(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all font-mono"
                                            placeholder="hostname.domain"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Endereço IP</label>
                                        <input
                                            type="text"
                                            value={device.ipAddress || device.ip}
                                            disabled
                                            className="w-full bg-slate-800/30 border border-white/5 rounded-2xl px-4 py-3 text-sm text-secondary/50 cursor-not-allowed font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">MAC Address</label>
                                        <input
                                            type="text"
                                            value={macAddress}
                                            onChange={(e) => setMacAddress(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all font-mono"
                                            placeholder="00:00:00:00:00:00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seção 2: Organização */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] ml-1">Organização & Rede</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Tipo</label>
                                        <select
                                            value={type}
                                            onChange={(e) => setType(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all cursor-pointer font-semibold"
                                        >
                                            {DEVICE_TYPES.map(t => (
                                                <option key={t.value} value={t.value} className="bg-slate-900">{t.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Unidade</label>
                                        <select
                                            value={locId}
                                            onChange={(e) => setLocId(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all cursor-pointer"
                                        >
                                            <option value="" className="bg-slate-900">Nenhuma</option>
                                            {locations.map((l: any) => <option key={l.id} value={l.id} className="bg-slate-900">{l.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Departamento</label>
                                        <select
                                            value={deptId}
                                            onChange={(e) => setDeptId(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all cursor-pointer"
                                        >
                                            <option value="" className="bg-slate-900">Nenhum</option>
                                            {depts.map((d: any) => <option key={d.id} value={d.id} className="bg-slate-900">{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Topologia (Pai)</label>
                                        <select
                                            value={parentId}
                                            onChange={(e) => setParentId(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all cursor-pointer"
                                        >
                                            <option value="" className="bg-slate-900">Core Switch (Padrão)</option>
                                            {switches.map((sw: any) => (
                                                <option key={sw.id} value={sw.id} className="bg-slate-900">{sw.name || sw.ip}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Velocidade do Link</label>
                                        <select
                                            value={portSpeed}
                                            onChange={(e) => setPortSpeed(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all cursor-pointer"
                                        >
                                            <option value="40G" className="bg-slate-900">40G (Esmeralda)</option>
                                            <option value="10G" className="bg-slate-900">10G (Verde)</option>
                                            <option value="1G" className="bg-slate-900">1G (Azul)</option>
                                            <option value="100M" className="bg-slate-900">100M (Laranja)</option>
                                            <option value="Wireless" className="bg-slate-900">Wireless (Tracejado)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Ramal / VoIP</label>
                                        <input
                                            type="text"
                                            value={voipExtension}
                                            onChange={(e) => setVoipExtension(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all font-mono"
                                            placeholder="Ex: 2001"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-secondary uppercase ml-1">Usuário Responsável</label>
                                        <select
                                            value={userId}
                                            onChange={(e) => setUserId(e.target.value)}
                                            className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all cursor-pointer"
                                        >
                                            <option value="" className="bg-slate-900">Nenhum</option>
                                            {users.map((u: any) => <option key={u.id} value={u.id} className="bg-slate-900">{u.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-5 pt-4">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={hasWebcam} onChange={(e) => setHasWebcam(e.target.checked)} className="w-5 h-5 rounded-lg border-white/10 bg-input-bg text-accent focus:ring-accent transition-all" />
                                            <span className="text-[11px] font-bold text-secondary uppercase group-hover:text-slate-300 transition-colors">Webcam</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={hasHeadset} onChange={(e) => setHasHeadset(e.target.checked)} className="w-5 h-5 rounded-lg border-white/10 bg-input-bg text-accent focus:ring-accent transition-all" />
                                            <span className="text-[11px] font-bold text-secondary uppercase group-hover:text-slate-300 transition-colors">Headset</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* COLUNA DIREITA: Patrimônio */}
                        <div className="bg-accent/5 border border-accent/10 p-5 rounded-[24px] space-y-3 h-fit">
                            <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Gestão de Patrimônio</h3>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-secondary uppercase ml-1">Nº Patrimônio</label>
                                    <input
                                        type="text"
                                        value={assetNumber}
                                        onChange={(e) => setAssetNumber(e.target.value)}
                                        className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all font-mono"
                                        placeholder="PAT-0000"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-secondary uppercase ml-1">Fornecedor / Marca</label>
                                    <input
                                        type="text"
                                        value={supplier}
                                        onChange={(e) => setSupplier(e.target.value)}
                                        className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all"
                                        placeholder="Dell, HP, Cisco..."
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-secondary uppercase ml-1">Data Aquisição</label>
                                    <input
                                        type="date"
                                        value={purchaseDate}
                                        onChange={(e) => setPurchaseDate(e.target.value)}
                                        className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all cursor-pointer"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-secondary uppercase ml-1">Expiração Garantia</label>
                                    <input
                                        type="date"
                                        value={warrantyExpiry}
                                        onChange={(e) => setWarrantyExpiry(e.target.value)}
                                        className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all cursor-pointer"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-secondary uppercase ml-1">Valor Aquisição (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={purchaseValue || ''}
                                        onChange={(e) => setPurchaseValue(e.target.value ? parseFloat(e.target.value) : null)}
                                        className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent transition-all font-mono"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-secondary uppercase ml-1">Custo Manutenção (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={maintenanceCost || ''}
                                        onChange={(e) => setMaintenanceCost(e.target.value ? parseFloat(e.target.value) : null)}
                                        className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Observações do Ativo</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full bg-input-bg border-input-border rounded-2xl px-4 py-3 text-sm text-main focus:outline-none focus:border-accent h-20 resize-none transition-all"
                                    placeholder="Detalhes técnicos relevantes..."
                                />
                            </div>
                        </div>
                    </div> {/* end two-column grid */}

                    <div className="flex justify-end gap-4 pt-4 mt-3 border-t border-slate-700/30">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-4 text-[11px] font-black uppercase tracking-widest text-secondary/70 hover:text-main transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isLoading}
                            className="cyber-button px-10 py-5 rounded-2xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {updateMutation.isLoading ? (<span className="flex items-center gap-2 animate-pulse">PROCESSANDO...</span>) : (
                                <><Save className="h-4 w-4 group-hover:rotate-12 transition-transform" /> SALVAR ALTERAÇÕES</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
            </div>
        </div>,
        document.body
    );
}
