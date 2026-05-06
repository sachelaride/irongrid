import React, { useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc/lib/rfb';
import { Loader2, Maximize, Minimize, MousePointer2, Keyboard, Power, ShieldAlert } from 'lucide-react';

interface VncViewerProps {
    agentId: string;
    password?: string;
    mode: 'viewer' | 'administrator';
    onDisconnect?: () => void;
}

export function VncViewer({ agentId, password, mode, onDisconnect }: VncViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rfbRef = useRef<RFB | null>(null);
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
    const [errorMessage, setErrorMessage] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        // Constrói a URL do WebSocket usando o proxy configurado no Vite
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/vnc-tunnel/${agentId}`;

        console.log(`[VncViewer] Conectando a ${url}`);

        try {
            const rfb = new RFB(containerRef.current, url, {
                credentials: { password: password || 'IronGrid123' },
            });

            rfb.scaleViewport = true;
            rfb.resizeSession = true;
            rfb.viewOnly = mode === 'viewer';

            rfb.addEventListener('connect', () => {
                console.log('[VncViewer] Conectado!');
                setStatus('connected');
            });

            rfb.addEventListener('disconnect', (e: any) => {
                console.log('[VncViewer] Desconectado:', e.detail.clean);
                setStatus('disconnected');
                if (onDisconnect) onDisconnect();
            });

            rfb.addEventListener('credentialsrequired', () => {
                console.warn('[VncViewer] Credenciais solicitadas');
                // Geralmente não deve cair aqui se passarmos no construtor
            });

            rfbRef.current = rfb;
        } catch (err: any) {
            console.error('[VncViewer] Erro ao instanciar RFB:', err);
            setStatus('error');
            setErrorMessage(err.message);
        }

        return () => {
            if (rfbRef.current) {
                rfbRef.current.disconnect();
                rfbRef.current = null;
            }
        };
    }, [agentId, password, mode, onDisconnect]);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    return (
        <div className="w-full h-full bg-slate-950 flex flex-col rounded-2xl overflow-hidden relative group">
            {/* Barra de Ferramentas Flutuante */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700 p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="flex items-center gap-2 px-3 mr-2 border-r border-slate-700">
                    <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-yellow-500 animate-pulse'}`} />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest italic">{agentId}</span>
                </div>
                
                <button 
                    onClick={() => rfbRef.current?.sendCtrlAltDel()}
                    className="p-2 hover:bg-slate-800 text-secondary/70 hover:text-white rounded-lg transition-all"
                    title="Enviar CTRL+ALT+DEL"
                >
                    <Keyboard size={16} />
                </button>

                <button 
                    onClick={toggleFullscreen}
                    className="p-2 hover:bg-slate-800 text-secondary/70 hover:text-white rounded-lg transition-all"
                    title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                >
                    {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>

                <button 
                    onClick={onDisconnect}
                    className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                    title="Encerrar Sessão"
                >
                    <Power size={18} />
                </button>
            </div>

            {/* Container do noVNC */}
            <div 
                ref={containerRef} 
                className="flex-1 w-full h-full"
                style={{ cursor: mode === 'administrator' ? 'default' : 'not-allowed' }}
            />

            {/* Overlay de Status */}
            {status !== 'connected' && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-4 z-10 transition-all">
                    {status === 'connecting' && (
                        <>
                            <Loader2 className="w-10 h-10 text-accent animate-spin" />
                            <div className="text-center">
                                <h3 className="text-white font-black italic uppercase tracking-widest">Sincronizando Túnel</h3>
                                <p className="text-secondary text-[10px] font-bold uppercase tracking-wider mt-1">Negociando handshake RFB...</p>
                            </div>
                        </>
                    )}
                    {status === 'error' && (
                        <div className="text-center p-6 max-w-xs">
                            <h3 className="text-red-500 font-bold italic uppercase tracking-widest mb-2">Erro de Conexão</h3>
                            <p className="text-secondary/70 text-xs italic">{errorMessage}</p>
                            <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Tentar Novamente</button>
                        </div>
                    )}
                    {status === 'disconnected' && (
                        <div className="text-center">
                            <h3 className="text-secondary font-bold italic uppercase tracking-widest">Sessão Encerrada</h3>
                            <button onClick={onDisconnect} className="mt-4 px-6 py-2 bg-accent hover:bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Voltar ao Painel</button>
                        </div>
                    )}
                </div>
            )}

            {/* Banner de Modo */}
            <div className="absolute bottom-4 right-4 z-20">
                <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2 shadow-2xl ${
                    mode === 'administrator' 
                    ? 'bg-accent/10 border-accent/30 text-accent' 
                    : 'bg-accent/10 border-accent/30 text-accent'
                }`}>
                    {mode === 'administrator' ? <ShieldAlert size={12} /> : <MousePointer2 size={12} />}
                    {mode === 'administrator' ? 'Modo: Administrador' : 'Modo: Visualizador'}
                </div>
            </div>
        </div>
    );
}

