import React from 'react';
import { VncViewer } from './VncViewer';
import { X } from 'lucide-react';

interface RemoteViewerProps {
    agentId: string;
    mode: 'viewer' | 'administrator';
    connectionId?: string; // Mantido por compatibilidade de prop
    serverUrl?: string; // Mantido por compatibilidade de prop
    onClose: () => void;
}

export function RemoteViewer({ agentId, mode, onClose }: RemoteViewerProps) {
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex flex-col p-4 md:p-10 animate-in fade-in duration-300">
            <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden relative">
                {/* Header Compacto para o Viewer em tela cheia */}
                <div className="absolute top-6 right-6 z-[110]">
                    <button 
                        onClick={onClose}
                        className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all shadow-lg active:scale-90"
                        title="Fechar Visualizador"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 min-h-0">
                    <VncViewer 
                        agentId={agentId} 
                        mode={mode} 
                        onDisconnect={onClose} 
                    />
                </div>
            </div>
        </div>
    );
}
