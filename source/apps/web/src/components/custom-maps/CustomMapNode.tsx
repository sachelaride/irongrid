import { useState, useEffect, useRef } from 'react';
import { Trash2, Cloud, Database, Monitor, Server as ServerIcon, Wifi, Shield } from 'lucide-react';
import { NodeIcon } from './NodeIcon';

interface CustomMapNodeProps {
    node: any; // CustomMapNode with device relation
    onUpdatePosition: (id: string, x: number, y: number) => void;
    onRemove: (id: string) => void;
    onClick?: () => void;
    isLinkSource?: boolean;
    linkMode?: boolean;
    onDrag?: (x: number, y: number) => void;
    onDragEnd?: () => void;
    zoom: number;
    isEditMode?: boolean;
    isSelected?: boolean;
}

export function CustomMapNode({ 
    node, 
    onUpdatePosition, 
    onRemove, 
    onClick, 
    isLinkSource, 
    linkMode, 
    onDrag, 
    onDragEnd, 
    zoom, 
    isEditMode = false,
    isSelected = false
}: CustomMapNodeProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: node.x, y: node.y });
    const [dragContext, setDragContext] = useState({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    const positionRef = useRef(position);
    positionRef.current = position;
    const dragContextRef = useRef(dragContext);
    dragContextRef.current = dragContext;

    const handleMouseDown = (e: React.MouseEvent) => {
        if (linkMode || !isEditMode) {
            return;
        }
        if (e.button !== 0) return; // Aceita apenas Clique Esquerdo
        
        // CRÍTICO: e.preventDefault() é mandatório aqui. Ele impede o navegador 
        // de iniciar nativamente eventos de arrastar imagens ou seleção de texto. 
        // Sem isso, o evento global `mousemove` é suprimido na janela e nosso componente "congela".
        e.preventDefault(); 
        setIsDragging(true);
        
        // Congela as coordenadas iniciais absolutas do ponteiro do Sistema e o vetor local (X/Y) do Componente
        setDragContext({ startX: e.clientX, startY: e.clientY, initialX: position.x, initialY: position.y });
        
        // Bloqueia que o click vaze para o Editor pai (que iniciaria um movimento de Panning na malha)
        e.stopPropagation();
        
        // Notifica o componente pai sobre a interação
        onClick?.();
    };

    /**
     * Efeito de Tracking Global do Movimento do Mouse
     * É bindado (registrado) na Window dinamicamente só quando o componente transiciona para `isDragging=true`.
     */
    useEffect(() => {
        if (!isDragging) return;

        const handleGlobalMove = (e: MouseEvent) => {
            // Utilizamos .current (useRef) em vez do state diretamente para ler variáveis.
            // Ler state num event listener não atrelado às dependências do UseEffect cria o problema grave de Stale Closures (Dados Fantasmas).
            const ctx = dragContextRef.current;
            
            // Matemática de Delta e Escala: (Posição Atual ABS - Início ABS) ÷ Escala do Mapa
            // Se o mapa estiver com zoom 200%, 100 pixels do mouse equivalem a 50 pontos lógicos vetoriais no SVG.
            const dx = (e.clientX - ctx.startX) / zoom;
            const dy = (e.clientY - ctx.startY) / zoom;
            const newPos = { x: ctx.initialX + dx, y: ctx.initialY + dy };
            
            // O componente principal visualiza a reação ao estado instantâneo (UI 60 fps)
            setPosition(newPos);
            // Aciona o hook visual de cordas elásticas do Canvas (linhas que se esticam com o nó)
            onDrag?.(newPos.x, newPos.y);
        };

        const handleGlobalUp = () => {
            setIsDragging(false);
            onDragEnd?.();
            
            const pos = positionRef.current;
            const ctx = dragContextRef.current;
            
            // Dispara persistência HTTP/WebSocket somente se, de fato, houve uma alteração real na malha após o arrasto terminar.
            if (pos.x !== ctx.initialX || pos.y !== ctx.initialY) {
                onUpdatePosition(node.id, pos.x, pos.y);
            }
        };

        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('mouseup', handleGlobalUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
        };
    }, [isDragging, zoom, node.id]);
    
    /**
     * Recebimento Optimista e Reconciliação
     * Regula se os valores vindo de props forçam render.
     * Omissão do `isDragging` na array `[node.x, node.y]` é proposital. Ele inibe que um evento imediato de 
     * setIsDragging(false) force o componente instantaneamente de volta pro estado congelado antes do fetch() de confirmação 
     * via tRPC retornar (o famoso e temido glitch grafico de UI 'snap-back').
     */
    useEffect(() => {
        if (!isDragging) setPosition({ x: node.x, y: node.y });
    }, [node.x, node.y]);

    return (
        <div 
            className="absolute select-none group/node"
            style={{ 
                left: position.x, 
                top: position.y, 
                zIndex: isDragging ? 100 : isSelected ? 90 : (node.deviceId ? 20 : 10),
                cursor: isEditMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer'
            }}
            onMouseDown={handleMouseDown}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
        >
            <div className={`relative flex flex-col items-center transition-all duration-200 ${isSelected ? 'scale-110' : ''}`}>
                {/* Selection Ring */}
                {isSelected && (
                    <div className="absolute -inset-2 border-2 border-accent rounded-2xl animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                )}
                
                {/* Actions (Hover Overlay) */}
                {isEditMode && (
                    <div className="absolute -top-4 -right-2 opacity-0 group-hover/node:opacity-100 transition-opacity z-20">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemove(node.id); }}
                            className="p-1 px-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors flex items-center gap-1.5"
                            title="Remover"
                        >
                            <Trash2 size={10} />
                            <span className="text-[8px] font-bold uppercase">Excluir</span>
                        </button>
                    </div>
                )}

                <div className={`
                    p-2 rounded-2xl bg-slate-800/80 backdrop-blur-md border-2 transition-all shadow-xl
                    ${isLinkSource ? 'border-primary ring-4 ring-primary/20 scale-110' : isSelected ? 'border-accent' : 'border-slate-700 hover:border-slate-500'}
                `}>
                    {node.deviceId ? (
                        <NodeIcon type={node.device?.type} size={72} className="drop-shadow-2xl" />
                    ) : (
                        <div className="text-main drop-shadow-2xl">
                            {node.type === 'cloud' && <Cloud size={72} />}
                            {node.type === 'database' && <Database size={72} />}
                            {node.type === 'terminal' && <Monitor size={72} />}
                            {node.type === 'server' && <ServerIcon size={72} />}
                            {node.type === 'wifi' && <Wifi size={72} />}
                            {node.type === 'shield' && <Shield size={72} />}
                            {['switch', 'router', 'firewall', 'access_point'].includes(node.type || '') && (
                                <NodeIcon type={node.type} size={72} />
                            )}
                        </div>
                    )}
                </div>

                {/* Status Badge - Only for managed devices */}
                {node.deviceId && (
                    <div className={`absolute top-6 right-4 w-3 h-3 rounded-full border-2 border-slate-900 shadow-sm ${
                        node.device?.status === 'ONLINE' ? 'bg-emerald-500' :
                        node.device?.status === 'WARNING' ? 'bg-amber-500' :
                        node.device?.status === 'CRITICAL' ? 'bg-red-500' : 'bg-slate-400'
                    }`} />
                )}
            </div>

            <div className="mt-[-4px] flex flex-col items-center pointer-events-none">
                <div className="px-2.5 py-0.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-black rounded-full border border-white/10 shadow-xl whitespace-nowrap uppercase tracking-wider">
                    {node.deviceId ? node.device?.name : node.name}
                </div>
            </div>
        </div>
    );
}
