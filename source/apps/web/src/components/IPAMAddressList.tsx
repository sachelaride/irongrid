import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { trpc } from '../utils/trpc';
import { Search, Filter, Monitor, RotateCcw, X, Save, Camera, Activity, Phone, Database, Plus } from 'lucide-react';
import { EditDeviceModal } from './EditDeviceModal';

interface IPAMAddressListProps {
    subnetId: string;
}

export function IPAMAddressList({ subnetId }: IPAMAddressListProps) {
    const { data: addresses = [], isLoading, refetch } = (trpc as any).ipam.listAddresses.useQuery({ subnetId });
    const [search, setSearch] = useState('');
    const [editingAddress, setEditingAddress] = useState<any>(null);
    const [editingDevice, setEditingDevice] = useState<any>(null);

    if (isLoading) return <div className="animate-pulse flex items-center gap-2 text-secondary font-bold text-[10px] uppercase tracking-widest"><RotateCcw className="w-3 h-3 animate-spin" /> Sincronizando endereços...</div>;

    const filtered = addresses
        .filter((a: any) =>
            a.ip.includes(search) ||
            (a.hostname?.toLowerCase().includes(search.toLowerCase())) ||
            (a.mac?.toLowerCase().includes(search.toLowerCase()))
        )
        .sort((a: any, b: any) => {
            const lastA = parseInt(a.ip.split('.').pop() ?? '0', 10);
            const lastB = parseInt(b.ip.split('.').pop() ?? '0', 10);
            return lastA - lastB;
        });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-4 flex-1">
                    <Search className="w-5 h-5 text-secondary/70" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por IP, Hostname ou MAC..."
                        className="bg-transparent border-none outline-none text-sm text-main w-full font-medium"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary hover:text-main transition-colors">
                    <Filter className="w-3 h-3" /> Filtrar
                </button>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-[10px] font-black uppercase tracking-widest text-secondary">
                <div className="flex items-center gap-1.5"><span className="w-5 h-5 flex items-center justify-center rounded-lg bg-emerald-500 ring-1 ring-emerald-400 text-white shadow-lg shadow-emerald-500/20">—</span>Livre</div>
                <div className="flex items-center gap-1.5"><span className="w-5 h-5 flex items-center justify-center rounded-lg bg-red-500 ring-1 ring-red-400 text-white shadow-lg shadow-red-500/20">O</span>Ocupado (≤ 15 dias)</div>
                <div className="flex items-center gap-1.5"><span className="w-5 h-5 flex items-center justify-center rounded-lg bg-yellow-400 ring-1 ring-yellow-300 text-white shadow-lg shadow-yellow-400/20">V</span>Visto (+15 dias)</div>
                <div className="flex items-center gap-1.5"><span className="w-5 h-5 flex items-center justify-center rounded-lg bg-accent ring-1 ring-accent text-white shadow-lg shadow-accent/20">R</span>Reservado</div>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-9 xl:grid-cols-12 gap-2">
                {filtered.map((addr: any) => (
                    <IPBox key={addr.id} address={addr} onClick={() => setEditingAddress(addr)} />
                ))}
            </div>

            {editingAddress && (
                <EditIPModal
                    address={editingAddress}
                    onClose={() => setEditingAddress(null)}
                    onUpdate={() => {
                        refetch();
                        setEditingAddress(null);
                    }}
                    onOpenDevice={(device: any) => {
                        setEditingAddress(null);
                        setEditingDevice(device);
                    }}
                />
            )}

            {editingDevice && (
                <EditDeviceModal
                    device={editingDevice}
                    onClose={() => {
                        setEditingDevice(null);
                        refetch();
                    }}
                />
            )}
        </div>
    );
}

interface IPBoxProps {
    address: any;
    onClick: () => void;
}

function IPBox({ address, onClick }: IPBoxProps) {
    const [isHovered, setIsHovered] = useState(false);
    const isOccupied = address.status !== 'AVAILABLE';

    function getColorClass(): string {
        if (address.status === 'AVAILABLE') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20';
        if (address.status === 'RESERVED') return 'bg-accent/20 border-accent/50 text-accent hover:bg-accent/30';
        if (address.status === 'STATIC') return 'bg-accent/20 border-accent/50 text-accent hover:bg-accent/30';
        
        if (!address.lastSeen) return 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30';
        const daysSince = (Date.now() - new Date(address.lastSeen).getTime()) / 86_400_000;
        if (daysSince > 15) return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/30';
        return 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30';
    }

    const statusLetter = address.status === 'RESERVED' ? 'R' : (address.status === 'AVAILABLE' ? '' : 'O');

    const colorClass = getColorClass();

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${colorClass} hover:scale-105 hover:shadow-lg ${isHovered ? 'z-[60]' : 'z-10'}`}
        >
            {isOccupied && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
            <div className="flex items-center gap-1">
                <span className="text-[9px] opacity-40 font-black tracking-tight">{address.ip.split('.').pop()}</span>
                {statusLetter && <span className="text-[14px] font-black leading-none">{statusLetter}</span>}
            </div>

            {isOccupied && (
                <div className="flex flex-col items-center gap-0.5">
                    <Monitor className="w-3 h-3 opacity-50" />
                    {address.hostname && <span className="text-[8px] font-bold uppercase truncate max-w-[60px]">{address.hostname}</span>}
                    {address.mac && <span className="text-[7px] font-mono opacity-40 uppercase truncate max-w-[55px]">{address.mac.replace(/:/g, '')}</span>}
                    
                    {/* Peripheral Icons */}
                    {address.device && (
                        <div className="flex gap-1 mt-0.5 opacity-60 items-center">
                            {address.device.hasWebcam && <Camera className="w-2.5 h-2.5 text-emerald-500" />}
                            {address.device.hasHeadset && <Activity className="w-2.5 h-2.5 text-accent" />}
                            {address.device.voipExtension && (
                                <div className="flex items-center gap-0.5 bg-accent/20 px-1 rounded-[4px] text-[7px] text-accent font-black">
                                    <Phone className="w-2 h-2" />
                                    {address.device.voipExtension}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-4 glass-panel rounded-3xl z-50 shadow-2xl min-w-[240px] pointer-events-none transition-all">
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-[10px] font-black text-main uppercase tracking-widest">{address.ip}</p>
                    </div>
                    <div className="space-y-1.5 text-[9px] text-secondary font-bold uppercase">
                        <p className="flex justify-between">Status: <span className="text-main">{address.status}</span></p>
                        {address.status === 'RESERVED' && (
                            <div className="bg-primary/10 border border-primary/20 p-2 rounded-xl mb-2 mt-1">
                                <p className="text-main font-black">RESERVA: {address.reservedFor || 'Sem nome'}</p>
                                {address.reservedNote && <p className="text-[8px] leading-tight mt-1 lowercase font-medium">{address.reservedNote}</p>}
                            </div>
                        )}
                        <p className="flex justify-between">Host: <span className="text-main">{address.hostname || 'N/A'}</span></p>
                        <p className="flex justify-between">MAC: <span className="text-main font-mono">{address.mac || 'N/A'}</span></p>
                        
                        {address.device && (
                            <>
                                <div className="border-t border-border/10 pt-1.5 mt-1.5 space-y-1">
                                    {address.device.voipExtension && (
                                        <p className="flex justify-between text-main">Ramal VoIP: <span className="text-main font-black">{address.device.voipExtension}</span></p>
                                    )}
                                    <p className="flex justify-between">Depto: <span className="text-main">{address.device.departmentRef?.name || 'N/A'}</span></p>
                                    <p className="flex justify-between">Local: <span className="text-main">{address.device.location?.name || 'N/A'}</span></p>
                                    
                                    {address.device.hardware && (
                                        <>
                                            <p className="flex justify-between">Processador: <span className="text-main text-[8px] truncate max-w-[120px]">{address.device.hardware.cpuModel || 'N/A'}</span></p>
                                            <p className="flex justify-between">Memória: <span className="text-main">{address.device.hardware.totalMemory ? `${Math.round(Number(address.device.hardware.totalMemory) / (1024**3))} GB` : 'N/A'}</span></p>
                                            <p className="flex justify-between">Disco: <span className="text-main">{address.device.hardware.totalDisk ? `${Math.round(Number(address.device.hardware.totalDisk) / (1024**3))} GB` : 'N/A'}</span></p>
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {address.device.hasWebcam && <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[7px]">Webcam</span>}
                                    {address.device.hasHeadset && <span className="px-1.5 py-0.5 bg-accent/10 text-accent rounded text-[7px]">Headset</span>}
                                </div>
                            </>
                        )}

                        <p className="flex justify-between border-t border-border/10 pt-1.5 mt-1.5">
                            Visto em:
                            <span className="text-main">
                                {address.lastSeen
                                    ? `${new Date(address.lastSeen).toLocaleDateString()} (${Math.floor((Date.now() - new Date(address.lastSeen).getTime()) / 86400000)} dias)`
                                    : 'Nunca'}
                            </span>
                        </p>
                    </div>
                    <p className="text-[7px] text-secondary/70 mt-3 text-center animate-pulse">Clique para editar ou reservar</p>
                </div>
            )}
        </div>
    );
}

function EditIPModal({ address, onClose, onUpdate, onOpenDevice }: { address: any, onClose: () => void, onUpdate: () => void, onOpenDevice: (device: any) => void }) {
    const [status, setStatus] = useState(address.status);
    const [hostname, setHostname] = useState(address.hostname || '');
    const [mac, setMac] = useState(address.mac || '');
    const [reservedFor, setReservedFor] = useState(address.reservedFor || '');
    const [reservedNote, setReservedNote] = useState(address.reservedNote || '');

    const [error, setError] = useState<string | null>(null);

    // Bloquear scroll do body ao abrir o modal
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = originalStyle; };
    }, []);

    const updateMutation = (trpc as any).ipam.updateMetadata.useMutation({
        onSuccess: onUpdate,
        onError: (err: any) => {
            setError(err.message || 'Erro ao atualizar IP');
        }
    });
    const createDeviceMutation = (trpc as any).organization.createDevice.useMutation();

    const handleRelease = () => {
        updateMutation.mutate({
            id: address.id,
            status: 'AVAILABLE',
            reservedFor: null,
            reservedNote: null
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[1000000] flex items-start justify-center p-4 pt-8 overflow-y-auto"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
                onClick={onClose}
            />

            <div
                className="relative z-[1000001] bg-card border border-border p-6 sm:p-7 rounded-[40px] shadow-2xl w-full max-w-4xl animate-in zoom-in-95 duration-200 scrollbar-hide"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="space-y-0.5">
                        <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em]">DETALHES DO ENDEREÇO</h3>
                        <p className="text-3xl font-black text-main leading-none">{address.ip}</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-page/10 hover:bg-page/20 rounded-2xl transition-all group">
                        <X className="w-5 h-5 text-secondary group-hover:text-main transition-colors" />
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-xs font-bold animate-in fade-in duration-300">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* LADO ESQUERDO: STATUS E IDENTIFICAÇÃO */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Status IPAM</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStatus('AVAILABLE')}
                                    className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all ${status === 'AVAILABLE' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-page/10 border-border/10 text-secondary hover:border-emerald-500/30'}`}
                                >
                                    <span className="text-lg font-black">—</span>
                                    <span className="text-[8px] font-bold uppercase tracking-widest mt-1">Livre</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatus('USED')}
                                    className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all duration-300 ${status === 'USED' ? 'bg-red-500/20 border-red-500/50 text-red-500 shadow-xl shadow-red-500/20 scale-105' : 'bg-page/10 border-border/10 text-secondary hover:border-red-500/30'}`}
                                >
                                    <span className="text-3xl font-black">O</span>
                                    <span className="text-[8px] font-black uppercase tracking-widest mt-1">Ocupado</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatus('RESERVED')}
                                    className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all duration-300 ${status === 'RESERVED' ? 'bg-primary/20 border-primary/50 text-main shadow-xl shadow-primary/20 scale-105' : 'bg-page/10 border-border/10 text-secondary hover:border-primary/30'}`}
                                >
                                    <span className="text-3xl font-black">R</span>
                                    <span className="text-[8px] font-black uppercase tracking-widest mt-1">Reservado</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Hostname</label>
                                <input
                                    value={hostname}
                                    onChange={(e) => setHostname(e.target.value)}
                                    className="w-full bg-page/10 border border-border/10 rounded-2xl p-4 text-xs text-main outline-none focus:border-primary transition-all font-bold"
                                    placeholder="N/A"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Endereço MAC</label>
                                <input
                                    value={mac}
                                    onChange={(e) => setMac(e.target.value)}
                                    className="w-full bg-page/10 border border-border/10 rounded-2xl p-4 text-xs text-main outline-none focus:border-primary transition-all font-mono uppercase"
                                    placeholder="00:00:00:00:00:00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* LADO DIREITO: RESERVA OU INVENTÁRIO */}
                    <div className="space-y-4">
                        {(status === 'RESERVED' || address.status === 'RESERVED') && (
                            <div className={`space-y-4 bg-accent/5 border border-accent/20 p-5 rounded-[32px] animate-in slide-in-from-right-4 duration-300 ${status !== 'RESERVED' ? 'opacity-30 pointer-events-none' : ''}`}>
                                <h4 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                    Dados da Reserva
                                </h4>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-secondary uppercase ml-1">Reservado para</label>
                                    <input
                                        value={reservedFor}
                                        onChange={(e) => setReservedFor(e.target.value)}
                                        placeholder="Ex: Servidor Backup"
                                        className="w-full bg-page/10 border border-primary/30 rounded-2xl p-3.5 text-xs text-main outline-none focus:border-primary"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-secondary uppercase ml-1">Observações</label>
                                    <textarea
                                        value={reservedNote}
                                        onChange={(e) => setReservedNote(e.target.value)}
                                        className="w-full bg-page/10 border border-border/10 rounded-2xl p-3.5 text-xs text-main outline-none focus:border-primary h-16 resize-none transition-all"
                                        placeholder="..."
                                    />
                                </div>
                            </div>
                        )}

                        {address.device ? (
                            <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-[32px] space-y-3">
                                <h4 className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                    <Database className="w-3.5 h-3.5" />
                                    Equipamento no Inventário
                                </h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] text-secondary font-bold uppercase">Patrimônio</p>
                                        <p className="text-[11px] text-main font-black">{address.device.assetNumber || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] text-secondary font-bold uppercase">Depto</p>
                                        <p className="text-[11px] text-main font-black truncate">{address.device.departmentRef?.name || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] text-secondary font-bold uppercase">Ramal</p>
                                        <p className="text-[11px] text-main font-black">{address.device.voipExtension || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] text-secondary font-bold uppercase">Local</p>
                                        <p className="text-[11px] text-main font-black truncate">{address.device.location?.name || 'N/A'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onOpenDevice({ ...address.device, ip: address.ip, mac: address.mac, ipamStatus: address.status })}
                                    className="w-full mt-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <Database className="w-4 h-4" />
                                    Alterar dispositivo no inventário
                                </button>
                            </div>
                        ) : (
                            (!address.device && (status === 'RESERVED' || status === 'USED')) && (
                                <div className="p-5 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-center space-y-3 py-8">
                                    <div className="p-3 bg-white/5 rounded-full">
                                        <Plus className="w-6 h-6 text-slate-600" />
                                    </div>
                                    <p className="text-[10px] text-secondary font-black uppercase tracking-widest">Sem Inventário</p>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const newDevice = await createDeviceMutation.mutateAsync({
                                                    name: hostname || reservedFor || `Dispositivo ${address.ip}`,
                                                    ipAddress: address.ip,
                                                    type: 'OTHER',
                                                    macAddress: mac || undefined,
                                                    hostname: hostname || undefined,
                                                });
                                                await updateMutation.mutateAsync({
                                                    id: address.id,
                                                    hostname,
                                                    mac,
                                                    status,
                                                    reservedFor: status === 'RESERVED' ? reservedFor : null,
                                                    reservedNote: status === 'RESERVED' ? reservedNote : null
                                                });
                                                onOpenDevice(newDevice);
                                            } catch (e) {
                                                console.error('Error creating device', e);
                                            }
                                        }}
                                        disabled={createDeviceMutation.isPending || updateMutation.isPending}
                                        className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-xl py-4 text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        {(createDeviceMutation.isPending || updateMutation.isPending) ? <RotateCcw className="w-4 h-4 animate-spin mx-auto" /> : 'Criar & Configurar Dispositivo'}
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-4 pt-6 mt-6 border-t border-border/10">
                    {(address.status !== 'AVAILABLE' || status !== 'AVAILABLE') && (
                        <button
                            onClick={handleRelease}
                            className="px-8 py-4 bg-page/10 hover:bg-red-500/10 text-secondary hover:text-red-500 border border-transparent hover:border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Liberar IP
                        </button>
                    )}
                    <button
                        onClick={async () => {
                            updateMutation.mutate({
                                id: address.id,
                                hostname,
                                mac,
                                status,
                                reservedFor: status === 'RESERVED' ? reservedFor : null,
                                reservedNote: status === 'RESERVED' ? reservedNote : null
                            });
                        }}
                        disabled={updateMutation.isPending}
                        className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-2xl py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-3"
                    >
                        {updateMutation.isPending ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
