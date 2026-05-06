import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { X, CheckCircle, AlertCircle, Play, Loader2, Activity, Terminal, MessageSquare } from 'lucide-react';
import { RemoteActionsComponent } from './RemoteActionsComponent';

interface ManageDeviceModalProps {
    device: any;
    onClose: () => void;
}

export function ManageDeviceModal({ device, onClose }: ManageDeviceModalProps) {
    const [activeTab, setActiveTab] = useState<'monitoring' | 'actions' | 'tickets'>('monitoring');
    const [step, setStep] = useState<1 | 2>(1);
    const [community, setCommunity] = useState('unigran');
    const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [snmpData, setSnmpData] = useState<any>(null);
    const [selectedInterfaces, setSelectedInterfaces] = useState<number[]>([]);

    const testConnection = (trpc.snmp as any).testConnection.useMutation();
    const startMonitoring = (trpc.snmp as any).startMonitoring.useMutation();

    const handleTest = async () => {
        setConnectionStatus('testing');
        setPingStatus('testing');
        try {
            const result = await testConnection.mutateAsync({
                ip: device.ip,
                community
            });

            if (result.success) {
                setPingStatus('success');
                setConnectionStatus('success');
                setSnmpData(result.data);

                const upIfaces = result.data.interfaces
                    .filter((i: any) => i.operStatus === 1)
                    .map((i: any) => i.index);
                setSelectedInterfaces(upIfaces);
                setTimeout(() => setStep(2), 800);
            } else {
                if (result.ping) {
                    setPingStatus('success'); // Ping OK
                    setConnectionStatus('error'); // SNMP Failed
                } else {
                    setPingStatus('error'); // Ping Failed
                    setConnectionStatus('idle'); // Didn't reach SNMP
                }
            }
        } catch (e) {
            setPingStatus('error');
            setConnectionStatus('error');
        }
    };

    const handleSave = async () => {
        try {
            await startMonitoring.mutateAsync({
                ip: device.ip,
                community,
                interfaces: selectedInterfaces
            });
            alert(`Monitoring started for ${device.ip}`);
            onClose();
        } catch (e) {
            alert('Failed to start monitoring');
        }
    };

    const toggleInterface = (index: number) => {
        if (selectedInterfaces.includes(index)) {
            setSelectedInterfaces(prev => prev.filter(i => i !== index));
        } else {
            setSelectedInterfaces(prev => [...prev, index]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">Manage Device</h2>
                            <p className="text-secondary/70 text-sm">{device.name || device.ipAddress}</p>
                        </div>
                        <button onClick={onClose} className="text-secondary/70 hover:text-white transition-colors">
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex gap-4 border-b border-slate-800 -mb-6">
                        <button
                            onClick={() => setActiveTab('monitoring')}
                            className={`pb-3 px-1 text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'monitoring' ? 'text-accent border-b-2 border-accent' : 'text-secondary hover:text-slate-300'}`}
                        >
                            <Activity className="w-4 h-4" /> Monitoramento (SNMP)
                        </button>
                        <button
                            onClick={() => setActiveTab('actions')}
                            className={`pb-3 px-1 text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'actions' ? 'text-accent border-b-2 border-accent' : 'text-secondary hover:text-slate-300'}`}
                        >
                            <Terminal className="w-4 h-4" /> Ações Remotas
                        </button>
                        <button
                            onClick={() => setActiveTab('tickets')}
                            className={`pb-3 px-1 text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'tickets' ? 'text-accent border-b-2 border-accent' : 'text-secondary hover:text-slate-300'}`}
                        >
                            <MessageSquare className="w-4 h-4" /> Chamados (ITSM)
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {activeTab === 'actions' && (
                        <RemoteActionsComponent device={device} />
                    )}

                    {activeTab === 'tickets' && (
                        <DeviceTicketsList deviceId={device.id} />
                    )}

                    {activeTab === 'monitoring' && step === 1 && (
                        <div className="space-y-6">
                            <div className="bg-blue-900/20 border border-accent/30 rounded-lg p-4 text-blue-200 text-sm">
                                Verify SNMP connectivity to assume control of this device.
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-300">SNMP Community String</label>
                                <input
                                    type="text"
                                    value={community}
                                    onChange={(e) => setCommunity(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
                                    placeholder="public"
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleTest}
                                    disabled={connectionStatus === 'testing'}
                                    className="flex items-center gap-2 bg-accent hover:bg-accent text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
                                >
                                    {connectionStatus === 'testing' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                                    Test Connection
                                </button>



                                <div className="flex flex-col gap-1 text-sm">
                                    {pingStatus !== 'idle' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-secondary w-12">Ping:</span>
                                            {pingStatus === 'testing' && <span className="text-accent animate-pulse">Checking...</span>}
                                            {pingStatus === 'success' && <span className="text-green-400 font-medium">OK</span>}
                                            {pingStatus === 'error' && <span className="text-red-400 font-bold">Unreachable</span>}
                                        </div>
                                    )}
                                    {connectionStatus !== 'idle' && pingStatus === 'success' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-secondary w-12">SNMP:</span>
                                            {connectionStatus === 'testing' && <span className="text-accent animate-pulse">Checking...</span>}
                                            {connectionStatus === 'success' && <span className="text-green-400 font-medium">Connected</span>}
                                            {connectionStatus === 'error' && <span className="text-red-400 font-bold">Failed</span>}
                                        </div>
                                    )}
                                </div>

                                {connectionStatus === 'error' && (
                                    <span className="flex items-center gap-2 text-red-400 font-medium animate-in fade-in slide-in-from-left-2">
                                        <AlertCircle className="h-5 w-5" /> Connection Failed
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && snmpData && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white">Select Interfaces to Monitor</h3>
                                <div className="text-sm text-secondary/70">
                                    {selectedInterfaces.length} selected
                                </div>
                            </div>

                            <div className="border border-slate-700 rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left text-secondary/70">
                                    <thead className="bg-slate-800 text-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 w-10"></th>
                                            <th className="px-4 py-3">Index</th>
                                            <th className="px-4 py-3">Name/Desc</th>
                                            <th className="px-4 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                                        {snmpData.interfaces.map((iface: any) => (
                                            <tr
                                                key={iface.index}
                                                className={`hover:bg-slate-800/50 cursor-pointer ${selectedInterfaces.includes(iface.index) ? 'bg-accent/5' : ''}`}
                                                onClick={() => toggleInterface(iface.index)}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedInterfaces.includes(iface.index) ? 'bg-accent border-accent' : 'border-slate-600'}`}>
                                                        {selectedInterfaces.includes(iface.index) && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs">{iface.index}</td>
                                                <td className="px-4 py-3 text-white font-medium">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black italic text-accent">
                                                            {iface.alias || iface.description}
                                                        </span>
                                                        {iface.alias && (
                                                            <span className="text-[10px] text-secondary font-bold uppercase tracking-tight">
                                                                {iface.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {iface.operStatus === 1
                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400">UP</span>
                                                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400">DOWN</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-900/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-secondary/70 hover:text-white"
                    >
                        Cancel
                    </button>
                    {step === 2 && (
                        <button
                            onClick={handleSave}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <Play className="h-4 w-4" /> Start Monitoring
                        </button>
                    )}
                </div>
            </div>
        </div>

    );
}

function DeviceTicketsList({ deviceId }: { deviceId: string }) {
    const { data: tickets = [], isLoading } = trpc.tickets.list.useQuery({ deviceId });

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-white mb-4">Chamados deste Dispositivo</h3>
            {isLoading ? (
                <p className="text-secondary">A carregar...</p>
            ) : tickets.length === 0 ? (
                <div className="bg-slate-800/30 p-8 rounded-xl border border-dashed border-slate-700 text-center">
                    <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-secondary text-sm">Nenhum chamado vinculado a este ativo</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {tickets.map((ticket: any) => (
                        <div key={ticket.id} className="bg-slate-800 border border-slate-700 p-3 rounded-lg flex justify-between items-center group">
                            <div>
                                <div className="text-[10px] font-mono text-secondary">#{ticket.ticketNumber}</div>
                                <div className="text-sm font-medium text-slate-200">{ticket.title}</div>
                                <div className="text-[10px] text-secondary">{new Date(ticket.createdAt).toLocaleDateString()}</div>
                            </div>
                            <span className="text-[10px] font-bold bg-accent/10 text-accent px-2 py-1 rounded lowercase">
                                {ticket.status}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
