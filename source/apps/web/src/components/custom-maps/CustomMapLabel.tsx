import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Check, Settings2 } from 'lucide-react';

interface CustomMapLabelProps {
    label: any;
    onUpdate: (id: string, data: any) => void;
    onRemove: (id: string) => void;
    zoom: number;
    isEditMode?: boolean;
    snapToGrid: (val: number) => number;
    isSelected?: boolean;
    onClick?: () => void;
}

export function CustomMapLabel({ 
    label, 
    onUpdate, 
    onRemove, 
    zoom, 
    isEditMode = true,
    snapToGrid,
    isSelected = false,
    onClick
}: CustomMapLabelProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [text, setText] = useState(label.text);
    
    const [position, setPosition] = useState({ x: label.x, y: label.y });
    const [dragContext, setDragContext] = useState({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    const positionRef = useRef(position);
    positionRef.current = position;
    const dragContextRef = useRef(dragContext);
    dragContextRef.current = dragContext;
    const hasMovedRef = useRef(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isEditing || showConfig) return;
        if (e.button !== 0) return;
        e.preventDefault(); // Previne o drag nativo de seleção de textos gerado pelo sistema operativo
        e.stopPropagation();
        hasMovedRef.current = false;
        setIsDragging(true);
        setDragContext({ startX: e.clientX, startY: e.clientY, initialX: position.x, initialY: position.y });
    };

    /**
     * Efeito de Drag com Supressão Inteligente de Clique
     */
    useEffect(() => {
        if (!isDragging) return;

        const handleGlobalMove = (e: MouseEvent) => {
            const ctx = dragContextRef.current;
            const dx = (e.clientX - ctx.startX) / zoom;
            const dy = (e.clientY - ctx.startY) / zoom;
            
            // Limite de tolerância vetorial e Tremor da Fibrilação Motora do Usuário
            // Usuários movem imperceptivelmente o mouse entre o momento que engajam o OnMouseDown e o OnMouseUp ("click").
            // Se o vetor cruza 3px em tela, detectamos estruturalmente isso como 'hasMoved' (Arrastou), e abortamos 
            // no onClick principal a chance desse label ser exposto ao formulário Inline Edit.
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMovedRef.current = true;
            }
            setPosition({ x: ctx.initialX + dx, y: ctx.initialY + dy });
        };

        const handleGlobalUp = () => {
            setIsDragging(false);
            const pos = positionRef.current;
            const ctx = dragContextRef.current;
            if (pos.x !== ctx.initialX || pos.y !== ctx.initialY) {
                const snappedX = snapToGrid(pos.x);
                const snappedY = snapToGrid(pos.y);
                onUpdate(label.id, { x: snappedX, y: snappedY });
            }
        };

        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('mouseup', handleGlobalUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
        };
    }, [isDragging, zoom, label.id]);

    useEffect(() => {
        if (!isDragging) setPosition({ x: label.x, y: label.y });
        setText(label.text);
    }, [label.x, label.y, label.text]);

    return (
        <div 
            className={`absolute group/label p-2 cursor-move border-2 transition-all ${isDragging ? 'z-[60]' : isSelected ? 'z-[55]' : 'z-[5]'}`}
            style={{
                left: position.x,
                top: position.y,
                backgroundColor: label.bgColor || '#1e293b',
                color: label.color || '#e2e8f0',
                fontSize: `${label.fontSize || 12}px`,
                borderColor: isSelected ? '#3b82f6' : 'transparent',
                borderRadius: '4px',
                boxShadow: isSelected ? '0 0 10px rgba(59,130,246,0.5)' : 'none'
            }}
            onMouseDown={handleMouseDown}
            onClick={(e) => {
                e.stopPropagation();
                if (!hasMovedRef.current) {
                    if (isSelected) {
                        setIsEditing(true);
                    } else {
                        onClick?.();
                    }
                }
            }}
        >
            <div 
                className={`absolute -top-12 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg p-1.5 flex flex-nowrap w-max items-center gap-1 shadow-lg opacity-0 group-hover/label:opacity-100 transition-opacity z-[70] ${isDragging ? 'hidden' : 'flex'} ${showConfig || isEditing ? '!opacity-100' : ''}`} 
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
            >
                {isEditMode && (
                    <>
                        {showConfig ? (
                            <>
                                <div className="flex items-center gap-1 bg-page/5 px-1 rounded" title="Cor do Texto">
                                    <span className="text-[10px] text-main/50 font-bold px-1">T</span>
                                    <input 
                                        type="color" 
                                        value={label.color} 
                                        onChange={e => onUpdate(label.id, { color: e.target.value })} 
                                        className="w-5 h-5 cursor-pointer bg-transparent border-0 outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-1 bg-page/5 px-1 rounded" title="Cor de Fundo">
                                    <span className="text-[10px] text-main/50 font-bold px-1">F</span>
                                    <input 
                                        type="color" 
                                        value={label.bgColor === 'transparent' ? '#000000' : label.bgColor} 
                                        onChange={e => onUpdate(label.id, { bgColor: e.target.value === '#000000' && label.bgColor === 'transparent' ? 'transparent' : e.target.value })} 
                                        className="w-5 h-5 cursor-pointer bg-transparent border-0 outline-none"
                                    />
                                </div>
                                <input 
                                    type="number" 
                                    min={10} max={128}
                                    value={label.fontSize}
                                    onChange={e => onUpdate(label.id, { fontSize: parseInt(e.target.value) || 12 })}
                                    title="Tamanho da Fonte"
                                    className="w-12 bg-page/5 text-main font-bold text-xs border border-border rounded px-1 outline-none focus:border-primary"
                                />
                                <button 
                                    onClick={() => setShowConfig(false)}
                                    className="p-1 hover:bg-page/10 text-main rounded-md transition-colors"
                                    title="Fechar Estilos"
                                >
                                    <Check size={14} className="text-emerald-500" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                    onClick={() => setShowConfig(true)}
                                    className="p-1 hover:bg-page/10 text-main rounded-md transition-colors"
                                    title="Configurar Estilo"
                                >
                                    <Settings2 size={14} />
                                </button>
                                <div className="w-px h-4 bg-border my-auto mx-1" />
                                <button 
                                    onClick={() => onRemove(label.id)}
                                    className="p-1 hover:bg-red-500/10 text-red-500 rounded-md transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>

            {isEditing ? (
                <textarea 
                    className="bg-transparent border border-primary outline-none whitespace-pre-wrap rounded resize-none overflow-hidden m-2 pointer-events-auto min-w-[150px] min-h-[50px] focus:ring-1 focus:ring-primary"
                    value={text}
                    style={{ color: label.color, fontSize: label.fontSize }}
                    onChange={e => {
                        setText(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onBlur={() => {
                        setIsEditing(false);
                        if (text !== label.text) onUpdate(label.id, { text });
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Escape') {
                            setIsEditing(false);
                            setText(label.text);
                        }
                    }}
                    autoFocus
                />
            ) : (
                <div className="p-3 whitespace-pre-wrap select-none" style={{ fontFamily: 'monospace' }}>
                    {text}
                </div>
            )}
        </div>
    );
}
