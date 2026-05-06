import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { X, Save, Server, Shield, Laptop, Printer, Wifi, Globe, Database, Phone, HardDrive, Camera, Radio, Cloud } from 'lucide-react';

interface AddDeviceModalProps {
    onClose: () => void;
}

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

export function AddDeviceModal({ onClose }: AddDeviceModalProps) {
    const [name, setName] = useState('');
    const [ipAddress, setIpAddress] = useState('');
    const [type, setType] = useState('SERVER');
    const [model, setModel] = useState('');
    const [macAddress, setMacAddress] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [locationId, setLocationId] = useState('');

    const utils = trpc.useContext();

    // Fetch organizational data for selection
    const { data: departments = [] } = (trpc as any).organization.listDepartments.useQuery();
    const { data: locations = [] } = (trpc as any).organization.listLocations.useQuery();

    const createMutation = (trpc as any).organization.createDevice.useMutation({
        onSuccess: () => {
            ((utils as any).scan as any).getDevices.invalidate();
            onClose();
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !ipAddress) return;

        createMutation.mutate({
            name,
            ipAddress,
            type: type as any,
            model: model || undefined,
            macAddress: macAddress || undefined,
            departmentId: departmentId || undefined,
            locationId: locationId || undefined,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-8 border-b border-slate-800 bg-slate-900/50">
                    <div>
                        <h2 className="text-2xl font-black text-main italic tracking-tight">CADASTRAR ATIVO</h2>
                        <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">Registro manual de infraestrutura</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 text-secondary/70 hover:text-main rounded-2xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    {/* Basic Info Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Identificação / Nome</label>
                            <input
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Ex: Servidor Provedor 01"
                                className="w-full bg-input-bg border-input-border rounded-2xl p-4 text-main placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Endereço IP (Gestão)</label>
                            <input
                                required
                                value={ipAddress}
                                onChange={e => setIpAddress(e.target.value)}
                                placeholder="192.168.1.100"
                                className="w-full bg-input-bg border-input-border rounded-2xl p-4 text-main font-mono placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Hardware Info Group */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Tipo de Ativo</label>
                            <select
                                value={type}
                                onChange={e => setType(e.target.value)}
                                className="w-full bg-input-bg border-input-border rounded-2xl p-4 text-main outline-none focus:border-accent/50 transition-all font-medium"
                            >
                                {DEVICE_TYPES.map(t => (
                                    <option key={t.value} value={t.value} className="bg-slate-900">{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Modelo / Marca</label>
                            <input
                                value={model}
                                onChange={e => setModel(e.target.value)}
                                placeholder="Dell PowerEdge R740"
                                className="w-full bg-input-bg border-input-border rounded-2xl p-4 text-main placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Endereço MAC</label>
                            <input
                                value={macAddress}
                                onChange={e => setMacAddress(e.target.value)}
                                placeholder="00:1A:2B:3C:4D:5E"
                                className="w-full bg-input-bg border-input-border rounded-2xl p-4 text-main font-mono placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Organizational Group */}
                    <div className="p-6 bg-slate-800/20 rounded-[2rem] border border-slate-800/50 space-y-6">
                        <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] italic">Vínculos Organizacionais</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Unidade / Local</label>
                                <select
                                    value={locationId}
                                    onChange={e => setLocationId(e.target.value)}
                                    className="w-full bg-input-bg border-input-border rounded-xl p-3 text-xs text-main outline-none focus:border-accent"
                                >
                                    <option value="" className="bg-slate-900">Não Definido</option>
                                    {locations.map((l: any) => <option key={l.id} value={l.id} className="bg-slate-900">{l.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Departamento</label>
                                <select
                                    value={departmentId}
                                    onChange={e => setDepartmentId(e.target.value)}
                                    className="w-full bg-input-bg border-input-border rounded-xl p-3 text-xs text-main outline-none focus:border-accent"
                                >
                                    <option value="" className="bg-slate-900">Não Definido</option>
                                    {departments.map((d: any) => <option key={d.id} value={d.id} className="bg-slate-900">{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex items-center gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-8 py-4 text-secondary/70 hover:text-main font-bold uppercase tracking-widest text-xs transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || !name || !ipAddress}
                            className="flex-[2] bg-accent hover:bg-accent disabled:bg-slate-800 text-main px-8 py-5 rounded-2xl font-black italic transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/20 active:scale-[0.98] uppercase tracking-widest text-xs"
                        >
                            {createMutation.isPending ? 'REGISTRANDO...' : <><Save className="w-4 h-4" /> SALVAR EQUIPAMENTO</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
