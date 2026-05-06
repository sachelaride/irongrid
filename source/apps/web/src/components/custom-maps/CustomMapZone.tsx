import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Type } from 'lucide-react';
import { IronGridShapes } from './IronGridShapes';

interface CustomMapZoneProps {
    zone: any;
    onUpdate: (id: string, data: any) => void;
    onRemove: (id: string) => void;
    zoom?: number;
    isEditMode?: boolean;
    snapToGrid: (val: number) => number;
    isSelected?: boolean;
    onClick?: () => void;
}

export function CustomMapZone({ 
    zone, 
    onUpdate, 
    onRemove, 
    zoom = 1, 
    isEditMode = false, 
    snapToGrid,
    isSelected = false,
    onClick
}: CustomMapZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(zone.label);
    
    const [position, setPosition] = useState({ x: zone.x, y: zone.y });
    const [size, setSize] = useState({ width: zone.width, height: zone.height });
    const [dragContext, setDragContext] = useState({ startX: 0, startY: 0, initialX: 0, initialY: 0, initialWidth: 0, initialHeight: 0 });
    
    const positionRef = useRef(position);
    positionRef.current = position;
    const sizeRef = useRef(size);
    sizeRef.current = size;
    const dragContextRef = useRef(dragContext);
    dragContextRef.current = dragContext;

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isEditing || !isEditMode) return;
        if (e.button !== 0) return;
        e.preventDefault(); // Prevent native drag/text selection hijacking
        e.stopPropagation();
        setIsDragging(true);
        setDragContext({ startX: e.clientX, startY: e.clientY, initialX: position.x, initialY: position.y, initialWidth: size.width, initialHeight: size.height });
    };

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0 || !isEditMode) return;
        e.preventDefault(); // Prevent native drag/text selection hijacking
        e.stopPropagation();
        setIsResizing(true);
        setDragContext({ startX: e.clientX, startY: e.clientY, initialX: position.x, initialY: position.y, initialWidth: size.width, initialHeight: size.height });
    };

    useEffect(() => {
        if (!isDragging && !isResizing) return;

        const handleGlobalMove = (e: MouseEvent) => {
            const ctx = dragContextRef.current;
            
            // Calculamos o deslocamento com base no nível de zoom atual do mapa
            const dx = (e.clientX - ctx.startX) / zoom;
            const dy = (e.clientY - ctx.startY) / zoom;
            
            if (isDragging) {
                // Modo Arraste: Altera apenas X e Y Absoluto
                setPosition({ x: ctx.initialX + dx, y: ctx.initialY + dy });
            } else if (isResizing) {
                // Modo Redimensionamento (Grab na âncora inferior direita)
                setSize({ 
                    width: Math.max(40, ctx.initialWidth + dx), 
                    height: Math.max(40, ctx.initialHeight + dy) 
                });
            }
        };

        const handleGlobalUp = () => {
            const pos = positionRef.current;
            const sz = sizeRef.current;
            const ctx = dragContextRef.current;
            
            if (isDragging) {
                setIsDragging(false);
                const snappedX = snapToGrid(pos.x);
                const snappedY = snapToGrid(pos.y);
                if (snappedX !== ctx.initialX || snappedY !== ctx.initialY) {
                    onUpdate(zone.id, { x: snappedX, y: snappedY });
                }
            }
            if (isResizing) {
                setIsResizing(false);
                const snappedW = snapToGrid(sz.width);
                const snappedH = snapToGrid(sz.height);
                if (snappedW !== ctx.initialWidth || snappedH !== ctx.initialHeight) {
                    onUpdate(zone.id, { width: snappedW, height: snappedH });
                }
            }
        };

        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('mouseup', handleGlobalUp);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
        };
    }, [isDragging, isResizing, zoom, zone.id]);

    useEffect(() => {
        if (!isDragging) setPosition({ x: zone.x, y: zone.y });
        if (!isResizing) setSize({ width: zone.width, height: zone.height });
        setLabel(zone.label);
    }, [zone.x, zone.y, zone.width, zone.height, zone.label]);

    return (
        <div 
            className={`absolute group/zone border-2 ${isDragging ? 'z-[60] cursor-grabbing' : isSelected ? 'z-[55]' : 'z-[5]'} ${isEditMode ? 'hover:border-accent/50' : 'border-transparent'}`}
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
                borderColor: isSelected ? '#3b82f6' : (isEditMode && !isDragging ? `${zone.color}44` : 'transparent'),
                borderStyle: isSelected ? 'solid' : 'dashed',
                backgroundColor: 'transparent',
                cursor: !isEditMode ? 'default' : isDragging ? 'grabbing' : 'grab',
                pointerEvents: isEditing ? 'auto' : 'auto',
                filter: isSelected ? 'drop-shadow(0 0 8px rgba(59,130,246,0.5))' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
            }}
            onMouseDown={handleMouseDown}
            onClick={(e) => {
                if (isEditMode) {
                    e.stopPropagation();
                    onClick?.();
                }
            }}
        >
            {/* SVG Background Layer (Visio-Style) */}
            <div className="absolute inset-0 pointer-events-none">
                <IronGridShapes 
                    type={zone.type} 
                    color={zone.color} 
                    width={size.width} 
                    height={size.height} 
                    opacity={0.15}
                />
            </div>
            {/* Actions Menu */}
            {isEditMode && (
                <div 
                    className={`absolute -top-10 left-0 bg-card border border-border rounded-lg p-1.5 flex gap-1 shadow-xl opacity-0 group-hover/zone:opacity-100 transition-opacity z-10 ${isDragging || isResizing ? 'hidden' : 'flex'}`} 
                    onMouseDown={e => e.stopPropagation()}
                >
                    <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className="p-1 hover:bg-page/10 rounded-md text-main transition-colors"
                        title="Editar Texto"
                    >
                        <Type size={14} />
                    </button>
                    <div className="w-px h-4 bg-border my-auto mx-1" />
                    <input 
                        type="color" 
                        value={zone.color} 
                        title="Mudar Cor"
                        onChange={e => onUpdate(zone.id, { color: e.target.value })} 
                        className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-0"
                    />
                    <div className="w-px h-4 bg-border my-auto mx-1" />
                    <button 
                        onClick={() => onRemove(zone.id)}
                        className="p-1 hover:bg-red-500/10 text-red-500 rounded-md transition-colors"
                        title="Remover Zona"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}

            {/* Label Display */}
            {isEditing ? (
                <div className="p-2 w-full h-full" onMouseDown={e => e.stopPropagation()}>
                    <input 
                        className="bg-card border border-primary outline-none px-2 py-1 text-sm rounded shadow-lg text-main w-full pointer-events-auto"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        onBlur={() => {
                            setIsEditing(false);
                            if (label !== zone.label) onUpdate(zone.id, { label });
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                setIsEditing(false);
                                if (label !== zone.label) onUpdate(zone.id, { label });
                            }
                        }}
                        autoFocus
                    />
                </div>
            ) : (
                <div 
                    className="absolute top-0 left-0 px-2 py-1 text-sm font-bold opacity-80 backdrop-blur-sm select-none truncate max-w-full"
                    style={{ color: zone.color, backgroundColor: `${zone.color}2A` }}
                >
                    {zone.label}
                </div>
            )}

            {/* Resize Handle */}
            {isEditMode && (
                <div 
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-black/20 hover:bg-black/40 transition-colors opacity-0 group-hover/zone:opacity-100 border-l border-t border-white/20"
                    onMouseDown={handleResizeMouseDown}
                />
            )}
        </div>
    );
}
