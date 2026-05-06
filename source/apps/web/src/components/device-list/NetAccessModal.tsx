import { useState, useEffect, useRef } from 'react';
import { Globe, Terminal, Lock, X, ExternalLink, Copy, Check } from 'lucide-react';

interface NetAccessModalProps {
    device: any;
    onClose: () => void;
    triggerRect?: DOMRect | null;
}

type Protocol = 'http' | 'https' | 'telnet';

const PROTOCOL_DEFAULTS: Record<Protocol, { port: number; label: string; icon: React.ReactNode }> = {
    http:   { port: 80,  label: 'HTTP',   icon: <Globe    className="h-4 w-4" /> },
    https:  { port: 443, label: 'HTTPS',  icon: <Lock     className="h-4 w-4" /> },
    telnet: { port: 23,  label: 'Telnet', icon: <Terminal className="h-4 w-4" /> },
};

export function NetAccessModal({ device, onClose, triggerRect }: NetAccessModalProps) {
    const [protocol, setProtocol] = useState<Protocol>('http');
    const [port, setPort] = useState(80);
    const [copied, setCopied] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    // Update port when protocol changes
    useEffect(() => {
        setPort(PROTOCOL_DEFAULTS[protocol].port);
    }, [protocol]);

    // Calculate position relative to triggerRect
    useEffect(() => {
        if (!triggerRect) return;

        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const modalHeight = 400; // Expected height
        const modalWidth = 320;  // Expected width
        
        let top = triggerRect.bottom + 8;
        let left = triggerRect.left;

        // If not enough space below, show above
        if (spaceBelow < modalHeight) {
            top = triggerRect.top - modalHeight - 8;
        }

        // Adjust horizontally if it overflows
        if (left + modalWidth > window.innerWidth) {
            left = window.innerWidth - modalWidth - 16;
        }

        setPosition({ top, left });
    }, [triggerRect]);

    // Close on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Small delay to prevent immediate close from the trigger click
        const timeout = setTimeout(() => {
            document.addEventListener('mousedown', handler);
        }, 10);
        return () => {
            clearTimeout(timeout);
            document.removeEventListener('mousedown', handler);
        };
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const buildUrl = () => {
        if (protocol === 'telnet') return `telnet://${device.ip}:${port}`;
        const defaultPort = PROTOCOL_DEFAULTS[protocol].port;
        return port === defaultPort
            ? `${protocol}://${device.ip}`
            : `${protocol}://${device.ip}:${port}`;
    };

    const handleOpen = () => {
        window.open(buildUrl(), '_blank', 'noopener,noreferrer');
        onClose();
    };

    const handleCopy = () => {
        const text = protocol === 'telnet'
            ? `telnet ${device.ip} ${port}`
            : buildUrl();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!triggerRect) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] bg-black/5 backdrop-blur-[1px]"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                onClick={(e) => e.stopPropagation()}
                style={{ 
                    top: `${position.top}px`, 
                    left: `${position.left}px`,
                    width: '320px'
                }}
                className="fixed z-[101] bg-card border border-border rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-secondary uppercase tracking-widest whitespace-nowrap">Acesso Direto</span>
                        <span className="font-bold text-main text-sm leading-tight truncate w-48">{device.name || device.ip}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-page text-secondary transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Protocol tabs */}
                <div className="flex gap-1 mb-3 bg-page rounded-lg p-1">
                    {(Object.entries(PROTOCOL_DEFAULTS) as [Protocol, typeof PROTOCOL_DEFAULTS[Protocol]][]).map(([key, meta]) => (
                        <button
                            key={key}
                            onClick={() => setProtocol(key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tight transition-all ${
                                protocol === key
                                    ? key === 'telnet'
                                        ? 'bg-accent text-white'
                                        : key === 'https'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-primary text-white'
                                    : 'text-secondary hover:text-main'
                            }`}
                        >
                            {meta.label}
                        </button>
                    ))}
                </div>

                {/* Port input */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[9px] font-black text-secondary uppercase tracking-widest">Porta</label>
                        <div className="flex gap-1">
                            {Object.entries(PROTOCOL_DEFAULTS).map(([key, meta]) => (
                                <button
                                    key={key}
                                    onClick={() => setPort(meta.port)}
                                    className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                                        port === meta.port && protocol === key
                                            ? 'border-primary text-main bg-primary/10'
                                            : 'border-border text-secondary'
                                    }`}
                                >
                                    :{meta.port}
                                </button>
                            ))}
                        </div>
                    </div>
                    <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        className="w-full bg-page border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-main focus:outline-none focus:border-primary transition-colors"
                    />
                </div>

                {/* URL Preview */}
                <div className="bg-page border border-border rounded-lg px-2.5 py-1.5 mb-4 flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] font-mono text-secondary flex-1 truncate">
                        {protocol === 'telnet' ? `telnet ${device.ip} ${port}` : buildUrl()}
                    </span>
                    <button onClick={handleCopy} className="shrink-0 text-secondary hover:text-main">
                        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={handleOpen}
                        className={`flex-1 py-2 rounded-lg text-white text-xs font-black flex items-center justify-center gap-2 transition-all ${
                            protocol === 'telnet' ? 'bg-accent' : protocol === 'https' ? 'bg-emerald-600' : 'bg-primary'
                        }`}
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir Conexão
                    </button>
                </div>
            </div>
        </div>
    );
}
