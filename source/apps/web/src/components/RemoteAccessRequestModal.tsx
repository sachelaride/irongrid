import { useState, useEffect } from 'react';
import { trpc } from '../utils/trpc';
import { X, Shield, Eye, ShieldAlert, CheckCircle2, XCircle, Monitor, Copy, ExternalLink, Terminal } from 'lucide-react';
import { VncViewer } from './VncViewer';

interface RemoteAccessRequestModalProps {
    agentId: string;
    onGranted: (mode: 'viewer' | 'administrator', connectionId?: string) => void;
    onClose: () => void;
}

export function RemoteAccessRequestModal({ agentId, onGranted, onClose }: RemoteAccessRequestModalProps) {
    const [mode, setMode] = useState<'viewer' | 'administrator'>('viewer');
    const [status, setStatus] = useState<'idle' | 'pending' | 'granted' | 'rejected'>('idle');
    const [requestId, setRequestId] = useState<string | null>(null);
    const [vncPassword, setVncPassword] = useState<string | undefined>(undefined);
    const [proxyPort, setProxyPort] = useState<number | undefined>(undefined);
    const [showViewer, setShowViewer] = useState(false);

    const requestMutation = (trpc as any).remote.requestAccess.useMutation();
    const { data: requestStatus } = (trpc as any).remote.checkRequestStatus.useQuery(
        { requestId: requestId! },
        {
            enabled: !!requestId && status === 'pending',
            refetchInterval: 2000
        }
    );

    useEffect(() => {
        if (requestStatus?.status === 'granted') {
            setStatus('granted');
            if (requestStatus.password) {
                setVncPassword(requestStatus.password);
            }
            if (requestStatus.proxyPort) {
                setProxyPort(requestStatus.proxyPort);
            }
        } else if (requestStatus?.status === 'rejected') {
            setStatus('rejected');
        }
    }, [requestStatus]);

    const handleRequest = async () => {
        try {
            setStatus('pending');
            const res = await requestMutation.mutateAsync({ agentId, mode });
            setRequestId(res.requestId);
        } catch (e) {
            console.error(e);
            setStatus('idle');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="text-accent w-6 h-6" />
                        <h3 className="text-xl font-bold text-white">Acesso Remoto</h3>
                    </div>
                    <button onClick={onClose} className="text-secondary hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {status === 'idle' && (
                        <>
                            <p className="text-secondary/70 text-sm">
                                Selecione o nível de privilégio necessário. O usuário do dispositivo precisará autorizar a conexão.
                            </p>

                            <div className="grid grid-cols-1 gap-4">
                                <button
                                    onClick={() => setMode('viewer')}
                                    className={`p-4 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${mode === 'viewer' ? 'border-accent bg-accent/10' : 'border-slate-800 hover:border-slate-700'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${mode === 'viewer' ? 'bg-accent text-white' : 'bg-slate-800 text-secondary'}`}>
                                        <Eye size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">Visualizador</div>
                                        <div className="text-xs text-secondary mt-1">Apenas visualização do desktop. Sem entrada de mouse/teclado.</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setMode('administrator')}
                                    className={`p-4 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${mode === 'administrator' ? 'border-accent bg-accent/10' : 'border-slate-800 hover:border-slate-700'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${mode === 'administrator' ? 'bg-accent text-white' : 'bg-slate-800 text-secondary'}`}>
                                        <ShieldAlert size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">Administrador</div>
                                        <div className="text-xs text-secondary mt-1">Controle total. Permite mover mouse e digitar remotamente.</div>
                                    </div>
                                </button>
                            </div>

                            <button
                                onClick={handleRequest}
                                className="w-full bg-accent hover:bg-accent text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-accent/20"
                            >
                                Solicitar Permissão
                            </button>
                        </>
                    )}

                    {status === 'pending' && (
                        <div className="text-center py-6 space-y-4">
                            <div className="relative inline-block">
                                <div className="w-16 h-16 border-4 border-accent/20 border-t-blue-500 rounded-full animate-spin"></div>
                                <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent w-6 h-6 animate-pulse" />
                            </div>
                            <h4 className="text-lg font-bold text-white">Aguardando Autorização</h4>
                            <p className="text-secondary/70 text-sm">
                                Uma solicitação foi enviada ao usuário em <strong>{agentId}</strong>.
                                Por favor, peça para clicarem em "Sim" no diálogo exibido.
                            </p>
                        </div>
                    )}

                    {status === 'granted' && (
                        <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-300">
                            <div className="space-y-4">
                                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                                <h4 className="text-lg font-bold text-white">Acesso Concedido!</h4>
                            </div>

                            {proxyPort && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-left space-y-4">
                                    <div className="flex items-center gap-2 text-accent text-xs font-black uppercase tracking-widest italic pb-2 border-b border-slate-700">
                                        <Terminal size={14} />
                                        Conexão Via VNC Nativo
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded border border-slate-700">
                                            <code className="text-green-400 text-sm font-mono">{window.location.hostname}:{proxyPort}</code>
                                            <button 
                                                onClick={() => navigator.clipboard.writeText(`${window.location.hostname}:${proxyPort}`)}
                                                className="text-secondary hover:text-white transition-colors"
                                                title="Copiar Endereço"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded border border-slate-700">
                                            <div className="text-secondary/70 text-xs">Senha: <span className="text-white font-mono font-bold ml-2">{vncPassword}</span></div>
                                            <button 
                                                onClick={() => navigator.clipboard.writeText(vncPassword || '')}
                                                className="text-secondary hover:text-white transition-colors"
                                                title="Copiar Senha"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <a 
                                        href={`vnc://${window.location.hostname}:${proxyPort}`}
                                        className="w-full flex justify-center items-center gap-2 bg-accent hover:bg-accent text-white font-bold py-3 rounded-xl transition-colors shadow-lg mt-2"
                                    >
                                        <ExternalLink size={20} />
                                        Abrir Programa de VNC Local
                                    </a>
                                </div>
                            )}

                            <button 
                                onClick={() => setShowViewer(true)}
                                className="w-full flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors border border-slate-700"
                            >
                                <Monitor size={20} />
                                Ou Visualizar Via Web Browser
                            </button>
                        </div>
                    )}

                    {status === 'rejected' && (
                        <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-300">
                            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                            <h4 className="text-lg font-bold text-white">Acesso Negado</h4>
                            <p className="text-secondary/70 text-sm">O usuário recusou o pedido de conexão.</p>
                            <button
                                onClick={() => setStatus('idle')}
                                className="text-accent hover:underline text-sm font-medium"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Visualizador VNC Fullscreen quando o acesso for permitido */}
            {showViewer && (
                <div className="fixed inset-0 z-[120] bg-black animate-in fade-in duration-500">
                    <div className="absolute top-4 right-4 z-[130]">
                        <button 
                            onClick={onClose}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-xl transition-all"
                            title="Encerrar Acesso Remoto"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <VncViewer 
                        agentId={agentId} 
                        password={vncPassword}
                        mode={mode} 
                        onDisconnect={onClose} 
                    />
                </div>
            )}
        </div>
    );
}
