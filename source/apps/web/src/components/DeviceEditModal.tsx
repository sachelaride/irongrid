import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { trpc } from '../utils/trpc';
import { PrimaryButton } from './ui/DesignSystem';

interface DeviceEditModalProps {
    deviceId: string;
    deviceName: string;
    deviceIp: string;
    deviceType: string;
    parentId?: string | null;
    connectedPort?: number | null;
    vlan?: string | null;
    purchaseValue?: number | null;
    portSpeed?: string | null;
    topologyRole?: string | null;
    onClose: () => void;
}

export function DeviceEditModal({
    deviceId,
    deviceName,
    deviceIp,
    deviceType,
    parentId,
    connectedPort,
    vlan,
    purchaseValue,
    portSpeed,
    topologyRole,
    onClose
}: DeviceEditModalProps) {
    const [name, setName] = useState(deviceName);
    const [ip, setIp] = useState(deviceIp);
    const [type, setType] = useState(deviceType);
    const [parent, setParent] = useState(parentId || 'null');
    const [portNumber, setPortNumber] = useState<number | null>(connectedPort || null);
    const [vlanValue, setVlanValue] = useState(vlan || '');
    const [pValue, setPValue] = useState<number | null>(purchaseValue || null);
    const [mCost, setMCost] = useState<number | null>(null);
    const [notes, setNotes] = useState('');
    const [pSpeed, setPSpeed] = useState(portSpeed || '10G');
    const [role, setRole] = useState(topologyRole || '');

    const utils = trpc.useContext();
    const { data: devices = [] } = trpc.scan.getDevices.useQuery();

    const updateDevice = (trpc.scan as any).updateDevice?.useMutation({
        onSuccess: () => {
            (utils.scan as any).getDevices.invalidate();
            onClose();
        }
    });

    const updateDevicePort = (trpc.scan as any).updateDevicePort?.useMutation({
        onSuccess: () => {
            (utils.scan as any).getDevices.invalidate();
        }
    });

    const switches = devices
        .filter((d: any) => ['switch', 'router', 'firewall', 'gateway', 'access_point', 'voip', 'nas'].includes(d.type?.toLowerCase()))
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

    const handleSave = () => {
        updateDevice.mutate({
            deviceId,
            name,
            ip,
            type,
            parentId: parent === 'null' ? null : parent,
            vlan: vlanValue,
            purchaseValue: pValue,
            maintenanceCost: mCost,
            portSpeed: pSpeed,
            topologyRole: role
        });

        // Update port separately if changed
        if (portNumber !== connectedPort && updateDevicePort) {
            updateDevicePort.mutate({
                deviceId,
                portNumber
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                className="bg-slate-900 border border-slate-700/50 rounded-[32px] w-full max-w-6xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-7 border-b border-slate-700/30">
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-white uppercase tracking-wider italic">Editar Dispositivo</h2>
                        <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Configurações do Ativo de Rede</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group">
                        <X className="h-5 w-5 text-secondary/70 group-hover:text-white transition-colors" />
                    </button>
                </div>

                <form className="p-8 space-y-8 overflow-y-auto max-h-[85vh] scrollbar-hide">
                    {/* Seção 1: Identificação */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] ml-1">Identificação do Ativo</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Nome do Dispositivo</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent transition-all font-semibold"
                                    placeholder="Ex: Switch Principal"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Endereço IP</label>
                                <input
                                    type="text"
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent transition-all font-mono"
                                    placeholder="192.168.1.100"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Tipo de Dispositivo</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent transition-all cursor-pointer appearance-none font-semibold"
                                >
                                    <option value="SWITCH">Switch</option>
                                    <option value="ROUTER">Roteador</option>
                                    <option value="FIREWALL">Firewall</option>
                                    <option value="GATEWAY">Gateway</option>
                                    <option value="SERVER">Servidor</option>
                                    <option value="DATABASE">Banco de Dados</option>
                                    <option value="VOIP">VoIP</option>
                                    <option value="NAS">NAS / Storage</option>
                                    <option value="CAMERA">Câmera (CCTV)</option>
                                    <option value="ACCESS_POINT">Access Point</option>
                                    <option value="PRINTER">Impressora</option>
                                    <option value="WORKSTATION">Computador</option>
                                    <option value="INTERNET">Internet / Nuvem</option>
                                    <option value="OTHER">Outros</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Seção 2: Conectividade & VLAN */}
                    <div className="space-y-4 pt-2">
                        <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] ml-1">Conectividade & Topologia</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Conectado em (Switch Pai)</label>
                                <select
                                    value={parent || 'null'}
                                    onChange={(e) => setParent(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent transition-all cursor-pointer appearance-none"
                                >
                                    <option value="null">Nenhum (Raiz)</option>
                                    {switches.map((sw: any) => (
                                        <option key={sw.id} value={sw.id}>{sw.name} ({sw.ip})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Porta do Switch (1-48)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="48"
                                    value={portNumber || ''}
                                    onChange={(e) => setPortNumber(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent transition-all font-mono disabled:opacity-30"
                                    placeholder="Ex: 24"
                                    disabled={!parent || parent === 'null'}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">VLAN (ID ou Nome)</label>
                                <input
                                    type="text"
                                    value={vlanValue}
                                    onChange={(e) => setVlanValue(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent transition-all"
                                    placeholder="Ex: 10 ou VLAN_DATA"
                                />
                            </div>
                            <div className="space-y-1.5 text-accent">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Função na Topologia</label>
                                <div className="relative">
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent transition-all cursor-pointer appearance-none font-bold italic"
                                    >
                                        <option value="" className="bg-slate-900">Padrão</option>
                                        <option value="CORE" className="bg-slate-900 text-accent font-bold">CORE HUB</option>
                                        <option value="BACKBONE" className="bg-slate-900 text-accent font-bold">BACKBONE</option>
                                        <option value="BACKBONE_SEC" className="bg-slate-900 text-indigo-300 font-bold italic">BACKBONE SECUNDÁRIO</option>
                                        <option value="WAN" className="bg-slate-900 text-emerald-400 font-bold">INTERNET / CLOUD</option>
                                        <option value="WAN_SEC" className="bg-slate-900 text-emerald-300 font-bold italic">INTERNET SECUNDÁRIA</option>
                                        <option value="GATEWAY" className="bg-slate-900 text-orange-400 font-bold">FIREWALL / GATEWAY</option>
                                        <option value="ACCESS" className="bg-slate-900 text-sky-400 font-bold">ACESSO</option>
                                        <option value="ACCESS_SEC" className="bg-slate-900 text-sky-300 font-bold italic">ACESSO SECUNDÁRIO</option>
                                    </select>
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5 text-orange-400">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Velocidade do Link</label>
                                <select
                                    value={pSpeed}
                                    onChange={(e) => setPSpeed(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent transition-all cursor-pointer appearance-none font-bold"
                                >
                                    <option value="40G" className="bg-slate-900 text-green-500 font-bold">40G (Fibra)</option>
                                    <option value="10G" className="bg-slate-900 text-accent font-bold">10G (Verde)</option>
                                    <option value="1G" className="bg-slate-900 text-yellow-500 font-bold">1G (Amarelo)</option>
                                    <option value="100M" className="bg-slate-900 text-orange-500 font-bold">100M (Laranja)</option>
                                    <option value="Wireless" className="bg-slate-900 text-purple-500 font-bold">Wireless (Roxo)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Seção 3: Financeiro & Notas */}
                    <div className="bg-accent/5 border border-accent/10 p-7 rounded-[24px] space-y-6">
                        <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Financeiro & Notas</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Valor de Aquisição (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={pValue || ''}
                                    onChange={(e) => setPValue(e.target.value ? parseFloat(e.target.value) : null)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent transition-all font-mono"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-secondary uppercase ml-1">Adicionar Upgrade (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={mCost || ''}
                                    onChange={(e) => setMCost(e.target.value ? parseFloat(e.target.value) : null)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 transition-all font-mono"
                                    placeholder="Valor opcional..."
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-2">
                            <label className="text-[11px] font-bold text-secondary uppercase ml-1">Observações</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-accent h-24 resize-none transition-all"
                                placeholder="Notas adicionais sobre o ativo..."
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-700/30">
                        <button
                            onClick={onClose}
                            className="px-8 py-4 text-[11px] font-black uppercase tracking-widest text-secondary/70 hover:text-white transition-all"
                        >
                            Cancelar
                        </button>
                        <PrimaryButton
                            onClick={handleSave}
                            disabled={!name || !ip || updateDevice.isLoading}
                            loading={updateDevice.isLoading}
                            className="bg-accent hover:bg-accent disabled:opacity-50 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-accent/20 flex items-center gap-2 h-[52px]"
                        >
                            <Save className="w-4 h-4" />
                            SALVAR ALTERAÇÕES
                        </PrimaryButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
