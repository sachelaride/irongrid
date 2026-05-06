import { useState, useEffect, useRef } from 'react';
import { trpc } from '../../utils/trpc';
import { CustomMapNode } from './CustomMapNode';
import { CustomMapLine } from './CustomMapLine';
import { CustomMapZone } from './CustomMapZone';
import { CustomMapLabel } from './CustomMapLabel';
import { NodeIcon } from './NodeIcon';
import { IronGridShapes } from './IronGridShapes';
import { AlignmentToolbar } from './AlignmentToolbar';
import { 
    ArrowLeft, Plus, Search, Loader2, Link2, X, Settings2, Minus, Layout, Activity, Spline, Type, Eye, Edit3, Monitor, Database, Wifi, Shield, Cloud, Server as ServerIcon, Maximize, Minimize, Circle, Square, Triangle, Diamond, Hexagon, Star, Magnet 
} from 'lucide-react';

interface CustomMapEditorProps {
    mapId: string;
    onBack: () => void;
}

export function CustomMapEditor({ mapId, onBack }: CustomMapEditorProps) {
    const utils = trpc.useContext();
    const { data: map, isLoading } = (trpc as any).customMaps.getById.useQuery({ id: mapId });

    const enterMap = (trpc as any).customMaps.enterMap.useMutation();
    const leaveMap = (trpc as any).customMaps.leaveMap.useMutation();

    useEffect(() => {
        enterMap.mutate({ mapId });
        return () => {
            leaveMap.mutate({ mapId });
        };
    }, [mapId]);
    
    // Sidebar for devices
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { data: devicesData } = (trpc as any).scan.getDevices.useQuery(undefined, { enabled: sidebarOpen });
    const devices = Array.isArray(devicesData) ? devicesData : (devicesData as any)?.devices ?? [];
    
    // Tracking dragging nodes for real-time line updates
    const [draggedNodes, setDraggedNodes] = useState<Record<string, {x: number, y: number}>>({});
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{startX: number, startY: number, endX: number, endY: number} | null>(null);
    const [lastClickedNodeId, setLastClickedNodeId] = useState<string | null>(null);

    const addNode = (trpc as any).customMaps.addNode.useMutation({
        onSuccess: () => {
            (utils as any).customMaps.getById.invalidate({ id: mapId });
            setSidebarOpen(false);
        }
    });

    const updateNode = (trpc as any).customMaps.updateNode.useMutation();
    const removeNode = (trpc as any).customMaps.removeNode.useMutation({
        onSuccess: () => (utils as any).customMaps.getById.invalidate({ id: mapId })
    });

    const [zoneMode, setZoneMode] = useState(false);
    const [selectedShape, setSelectedShape] = useState<'rectangle' | 'circle' | 'triangle' | 'diamond' | 'parallelogram' | 'trapezoid' | 'hexagon' | 'star' | 'arrow_right' | 'cylinder' | 'cloud'>('rectangle');
    const [draftZone, setDraftZone] = useState<{startX: number, startY: number, currentX: number, currentY: number} | null>(null);
    const SHAPE_OPTIONS = [
        { id: 'rectangle', label: 'Retângulo', icon: <Square size={14} /> },
        { id: 'circle', label: 'Círculo', icon: <Circle size={14} /> },
        { id: 'triangle', label: 'Triângulo', icon: <Triangle size={14} /> },
        { id: 'diamond', label: 'Diamante', icon: <Diamond size={14} /> },
        { id: 'parallelogram', label: 'Paralelogramo', icon: <Square size={14} className="skew-x-[-15deg]" /> },
        { id: 'trapezoid', label: 'Trapézio', icon: <Square size={14} style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)' }} /> },
        { id: 'hexagon', label: 'Hexágono', icon: <Hexagon size={14} /> },
        { id: 'star', label: 'Estrela', icon: <Star size={14} /> },
        { id: 'arrow_right', label: 'Seta Direita', icon: <ArrowLeft size={14} className="rotate-180" /> },
        { id: 'cylinder', label: 'Cilindro (DB)', icon: <Database size={14} /> },
        { id: 'cloud', label: 'Nuvem', icon: <Cloud size={14} /> },
        { id: 'router', label: 'Roteador', icon: <div className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[8px] font-bold">R</div> },
        { id: 'switch', label: 'Switch', icon: <div className="w-4 h-2.5 border border-current flex items-center justify-center text-[8px] font-bold">S</div> },
        { id: 'firewall', label: 'Firewall', icon: <Shield size={14} /> },
    ];

    const addZone = (trpc as any).customMaps.addZone.useMutation({
        onSuccess: () => { (utils as any).customMaps.getById.invalidate({ id: mapId }); }
    });
    const updateZone = (trpc as any).customMaps.updateZone.useMutation();
    const removeZone = (trpc as any).customMaps.removeZone.useMutation({
        onSuccess: () => (utils as any).customMaps.getById.invalidate({ id: mapId })
    });

    const [labelMode, setLabelMode] = useState(false);
    const addLabel = (trpc as any).customMaps.addLabel.useMutation({
        onSuccess: () => { (utils as any).customMaps.getById.invalidate({ id: mapId }); }
    });
    const updateLabel = (trpc as any).customMaps.updateLabel.useMutation();
    const removeLabel = (trpc as any).customMaps.removeLabel.useMutation({
        onSuccess: () => (utils as any).customMaps.getById.invalidate({ id: mapId })
    });

    const [linkMode, setLinkMode] = useState(false);
    const [linkSource, setLinkSource] = useState<string | null>(null);

    const addEdge = (trpc as any).customMaps.addEdge.useMutation({
        onSuccess: () => {
            (utils as any).customMaps.getById.invalidate({ id: mapId });
            setLinkMode(false);
            setLinkSource(null);
        }
    });

    const updateEdge = (trpc as any).customMaps.updateEdge.useMutation({
        onSuccess: () => (utils as any).customMaps.getById.invalidate({ id: mapId })
    });

    const removeEdge = (trpc as any).customMaps.removeEdge.useMutation({
        onSuccess: () => (utils as any).customMaps.getById.invalidate({ id: mapId })
    });

    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [edgeStyle, setEdgeStyle] = useState<'curved' | 'straight' | 'step'>('step');
    const [isEditMode, setIsEditMode] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'devices' | 'elements'>('devices');
    const [pollInterval, setPollInterval] = useState<5000 | 15000 | 30000 | 60000>(15000);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [useSnapping, setUseSnapping] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    const snapToGrid = (val: number) => {
        if (!useSnapping) return Math.round(val);
        const gridSize = 40;
        return Math.round(val / gridSize) * gridSize;
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleLayer = (type: 'front' | 'back') => {
        if (selectedIds.length === 0) return;

        const allElements = [
            ...(map?.nodes || []),
            ...(map?.zones || []),
            ...(map?.labels || [])
        ];

        const zIndices = allElements.map((el: any) => el.zIndex || 0);
        const maxZ = Math.max(0, ...zIndices);
        const minZ = Math.min(0, ...zIndices);

        selectedIds.forEach(id => {
            const node = map?.nodes.find((n: any) => n.id === id);
            const zone = map?.zones.find((z: any) => z.id === id);
            const label = map?.labels.find((l: any) => l.id === id);

            const newZ = type === 'front' ? maxZ + 1 : minZ - 1;

            if (node) updateNode.mutate({ id, zIndex: newZ });
            else if (zone) updateZone.mutate({ id, zIndex: newZ });
            else if (label) updateLabel.mutate({ id, zIndex: newZ });
        });
        (utils as any).customMaps.getById.invalidate({ id: mapId });
    };

    const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        if (selectedIds.length < 2) return;

        const selectedElements = [
            ...(map?.nodes.filter((n: any) => selectedIds.includes(n.id)) || []),
            ...(map?.zones.filter((z: any) => selectedIds.includes(z.id)) || []),
            ...(map?.labels.filter((l: any) => selectedIds.includes(l.id)) || [])
        ];

        if (selectedElements.length < 2) return;

        const xs = selectedElements.map(el => el.x);
        const ys = selectedElements.map(el => el.y);
        
        const getWidth = (el: any) => el.width || 100;
        const getHeight = (el: any) => el.height || 120;

        const minX = Math.min(...xs);
        const maxX = Math.max(...selectedElements.map(el => el.x + getWidth(el)));
        const minY = Math.min(...ys);
        const maxY = Math.max(...selectedElements.map(el => el.y + getHeight(el)));

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        selectedElements.forEach(el => {
            let newX = el.x;
            let newY = el.y;

            if (type === 'left') newX = minX;
            else if (type === 'right') newX = maxX - getWidth(el);
            else if (type === 'center') newX = centerX - getWidth(el) / 2;
            else if (type === 'top') newY = minY;
            else if (type === 'bottom') newY = maxY - getHeight(el);
            else if (type === 'middle') newY = centerY - getHeight(el) / 2;

            if (el.text !== undefined) updateLabel.mutate({ id: el.id, x: snapToGrid(newX), y: snapToGrid(newY) });
            else if (el.label !== undefined) updateZone.mutate({ id: el.id, x: snapToGrid(newX), y: snapToGrid(newY) });
            else updateNode.mutate({ id: el.id, x: snapToGrid(newX), y: snapToGrid(newY) });
        });
        (utils as any).customMaps.getById.invalidate({ id: mapId });
    };

    const handleDistribute = (type: 'horizontal' | 'vertical') => {
        if (selectedIds.length < 3) return;

        const selectedElements = [
            ...(map?.nodes.filter((n: any) => selectedIds.includes(n.id)) || []),
            ...(map?.zones.filter((z: any) => selectedIds.includes(z.id)) || []),
            ...(map?.labels.filter((l: any) => selectedIds.includes(l.id)) || [])
        ];

        if (selectedElements.length < 3) return;

        if (type === 'horizontal') {
            selectedElements.sort((a, b) => a.x - b.x);
            const first = selectedElements[0];
            const last = selectedElements[selectedElements.length - 1];
            const totalWidth = last.x - first.x;
            const step = totalWidth / (selectedElements.length - 1);

            selectedElements.forEach((el, i) => {
                const newX = first.x + (i * step);
                if (el.text !== undefined) updateLabel.mutate({ id: el.id, x: snapToGrid(newX) });
                else if (el.label !== undefined) updateZone.mutate({ id: el.id, x: snapToGrid(newX) });
                else updateNode.mutate({ id: el.id, x: snapToGrid(newX) });
            });
        } else {
            selectedElements.sort((a, b) => a.y - b.y);
            const first = selectedElements[0];
            const last = selectedElements[selectedElements.length - 1];
            const totalHeight = last.y - first.y;
            const step = totalHeight / (selectedElements.length - 1);

            selectedElements.forEach((el, i) => {
                const newY = first.y + (i * step);
                if (el.text !== undefined) updateLabel.mutate({ id: el.id, y: snapToGrid(newY) });
                else if (el.label !== undefined) updateZone.mutate({ id: el.id, y: snapToGrid(newY) });
                else updateNode.mutate({ id: el.id, y: snapToGrid(newY) });
            });
        }
        (utils as any).customMaps.getById.invalidate({ id: mapId });
    };

    const STATIC_ELEMENTS = [
        { type: 'cloud', label: 'Internet / Nuvem', icon: <Cloud size={28} /> },
        { type: 'switch', label: 'Switch (Estático)', icon: <NodeIcon type="switch" size={28} /> },
        { type: 'router', label: 'Roteador (Estático)', icon: <NodeIcon type="router" size={28} /> },
        { type: 'firewall', label: 'Firewall (Estático)', icon: <NodeIcon type="firewall" size={28} /> },
        {type: 'access_point', label: 'Access Point (Estático)', icon: <NodeIcon type="access_point" size={28} /> },
        { type: 'wifi', label: 'WiFi / Sinal', icon: <Wifi size={28} /> },
        { type: 'shield', label: 'Segurança / Shield', icon: <Shield size={28} /> },
        { type: 'server', label: 'Servidor (Estático)', icon: <ServerIcon size={28} /> },
        { type: 'database', label: 'Banco de Dados', icon: <Database size={28} /> },
        { type: 'terminal', label: 'Terminal / PC', icon: <Monitor size={28} /> },
    ];

    const selectedEdge = (map as any)?.edges?.find((e: any) => e.id === selectedEdgeId);

    // Fetch interfaces for the selected edge's nodes
    const { data: sourceInterfaces } = (trpc as any).customMaps.getDeviceInterfaces.useQuery(
        { deviceId: (map as any)?.nodes?.find((n: any) => n.id === selectedEdge?.sourceId)?.deviceId ?? '' },
        { enabled: !!selectedEdge && !!map }
    );
    const { data: targetInterfaces } = (trpc as any).customMaps.getDeviceInterfaces.useQuery(
        { deviceId: (map as any)?.nodes?.find((n: any) => n.id === selectedEdge?.targetId)?.deviceId ?? '' },
        { enabled: !!selectedEdge && !!map }
    );

    const sourceNodeName = (map as any)?.nodes?.find((n: any) => n.id === selectedEdge?.sourceId)?.device?.name || 'Origem';
    const targetNodeName = (map as any)?.nodes?.find((n: any) => n.id === selectedEdge?.targetId)?.device?.name || 'Destino';

    if (isLoading || !map) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        );
    }

    const filteredDevices = (devices as any[])?.filter((d: any) => 
        !map.nodes.some((n: any) => n.deviceId === d.id) &&
        (d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.ip.includes(searchQuery))
    );

    const handleAddNode = (deviceId: string) => {
        const referenceNode = (map as any)?.nodes?.find((n: any) => n.id === lastClickedNodeId);
        
        let x = 100;
        let y = 100;

        if (referenceNode) {
            x = referenceNode.x + 120;
            y = referenceNode.y;
        } else {
            x = (-offset.x / zoom) + 100;
            y = (-offset.y / zoom) + 100;
        }
        
        addNode.mutate({
            customMapId: mapId,
            deviceId,
            x: Math.round(x),
            y: Math.round(y)
        });
    };

    const handleNodeClick = (nodeId: string) => {
        setLastClickedNodeId(nodeId);
        if (!linkMode) return;
        if (!linkSource) {
            setLinkSource(nodeId);
        } else if (linkSource !== nodeId) {
            addEdge.mutate({ customMapId: mapId, sourceId: linkSource, targetId: nodeId });
            setLinkSource(null);
        }
    };

    const handleUpdatePosition = (id: string, x: number, y: number) => {
        const targetNode = map?.nodes.find((n: any) => n.id === id);
        const dx = x - (targetNode?.x || 0);
        const dy = y - (targetNode?.y || 0);

        const nodesToMove = selectedIds.includes(id) 
            ? map?.nodes.filter((n: any) => selectedIds.includes(n.id)) 
            : [targetNode];
        
        nodesToMove?.forEach((node: any) => {
            if (!node) return;
            const newX = snapToGrid(node.x + dx);
            const newY = snapToGrid(node.y + dy);

            updateNode.mutate({ id: node.id, x: newX, y: newY }, {
                onSuccess: () => {
                    setDraggedNodes(prev => {
                        const next = { ...prev };
                        delete next[node.id];
                        return next;
                    });
                    (utils as any).customMaps.getById.invalidate({ id: mapId });
                }
            });
        });

        if (selectedIds.includes(id)) {
            map?.zones.filter((z: any) => selectedIds.includes(z.id)).forEach((zone: any) => {
                updateZone.mutate({ id: zone.id, x: snapToGrid(zone.x + dx), y: snapToGrid(zone.y + dy) }, {
                    onSuccess: () => (utils as any).customMaps.getById.invalidate({ id: mapId })
                });
            });
            map?.labels.filter((l: any) => selectedIds.includes(l.id)).forEach((label: any) => {
                updateLabel.mutate({ id: label.id, x: snapToGrid(label.x + dx), y: snapToGrid(label.y + dy) }, {
                    onSuccess: () => (utils as any).customMaps.getById.invalidate({ id: mapId })
                });
            });
        }
    };


    const handleRemoveNode = (id: string) => {
        removeNode.mutate({ id });
    };

    const handleZoom = (delta: number) => {
        setZoom(prev => Math.min(Math.max(prev + delta, 0.2), 3));
    };

    const handleFitView = () => {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    };

    const handlePanMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        
        const target = e.target as HTMLElement;
        const isCanvasBackground = target === e.currentTarget || (target.className && typeof target.className === 'string' && target.className.includes('w-[5000px]'));
        
        if (!isCanvasBackground) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - offset.x) / zoom;
        const y = (e.clientY - rect.top - offset.y) / zoom;

        if (labelMode) {
            addLabel.mutate({ customMapId: mapId, x, y });
            setLabelMode(false);
            return;
        }

        if (zoneMode) {
            setDraftZone({ startX: x, startY: y, currentX: x, currentY: y });
            return;
        }

        if (e.button === 0 && !labelMode && !zoneMode && !linkMode) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;
            setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
            setSelectedIds([]);
        }

        setIsPanning(true);
        setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handlePanMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - offset.x) / zoom;
        const y = (e.clientY - rect.top - offset.y) / zoom;
        setMousePos({ x, y });

        if (selectionBox) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;
            setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null);

            const x1 = Math.min(selectionBox.startX, x);
            const x2 = Math.max(selectionBox.startX, x);
            const y1 = Math.min(selectionBox.startY, y);
            const y2 = Math.max(selectionBox.startY, y);

            const nodesSelected = map?.nodes.filter((n: any) => 
                n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2
            ).map((n: any) => n.id) || [];

            const zonesSelected = map?.zones.filter((z: any) => 
                z.x >= x1 && z.x <= x2 && z.y >= y1 && z.y <= y2
            ).map((z: any) => z.id) || [];

            const labelsSelected = map?.labels.filter((l: any) => 
                l.x >= x1 && l.x <= x2 && l.y >= y1 && l.y <= y2
            ).map((l: any) => l.id) || [];

            setSelectedIds([...nodesSelected, ...zonesSelected, ...labelsSelected]);
        }

        if (draftZone) {
            setDraftZone({ ...draftZone, currentX: x, currentY: y });
            return;
        }

        if (!isPanning) return;
        setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    };

    const handlePanMouseUp = () => {
        setIsPanning(false);
        setSelectionBox(null);
        if (draftZone) {
            const width = Math.abs(draftZone.currentX - draftZone.startX);
            const height = Math.abs(draftZone.currentY - draftZone.startY);
            
            if (width > 20 && height > 20) {
                addZone.mutate({
                    customMapId: mapId,
                    x: snapToGrid(Math.min(draftZone.startX, draftZone.currentX)),
                    y: snapToGrid(Math.min(draftZone.startY, draftZone.currentY)),
                    width: snapToGrid(width),
                    height: snapToGrid(height),
                    type: selectedShape
                });
            }
            setDraftZone(null);
            setZoneMode(false);
        }
    };

    return (
        <div ref={containerRef} className="h-full flex relative overflow-hidden bg-page">
            {/* Header / Toolbar overlay */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
                <div className="bg-card/90 backdrop-blur-sm border border-border p-3 rounded-xl shadow-lg pointer-events-auto flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-1.5 hover:bg-white/5 dark:hover:bg-slate-700 rounded-lg transition-colors text-secondary"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-sm font-black text-main uppercase tracking-tight">{map.name}</h2>
                        {map.description && <p className="text-[10px] text-main/50">{map.description}</p>}
                    </div>
                </div>

                {/* Header Controls */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1 bg-background/80 backdrop-blur-sm border rounded-lg shadow-lg">
                    <AlignmentToolbar 
                        visible={selectedIds.length > 0 && isEditMode}
                        onAlign={handleAlign} 
                        onDistribute={handleDistribute}
                        onLayer={handleLayer} 
                    />
                </div>

                <div className="pointer-events-auto flex gap-2">
                    {/* View/Edit Toggle */}
                    <div className="flex bg-card border border-border rounded-xl p-1 shadow-lg mr-2">
                        <button
                            onClick={() => setIsEditMode(false)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${!isEditMode ? 'bg-primary text-white shadow-lg' : 'text-secondary hover:text-main'}`}
                        >
                            <Eye size={14} /> Visualizar
                        </button>
                        <button
                            onClick={() => setIsEditMode(true)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${isEditMode ? 'bg-amber-500 text-white shadow-lg' : 'text-secondary hover:text-main'}`}
                        >
                            <Edit3 size={14} /> Editar
                        </button>
                    </div>

                    {isEditMode && (
                        <>
                            <button
                                onClick={() => {
                                    setEdgeStyle(prev => prev === 'curved' ? 'straight' : prev === 'straight' ? 'step' : 'curved');
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all shadow-lg font-bold text-xs bg-card text-main border border-border"
                                title="Alternar Estilo de Linha"
                            >
                                {edgeStyle === 'curved' && <><Spline size={16} /> <span>Curvas</span></>}
                                {edgeStyle === 'straight' && <><Minus size={16} /> <span>Retas</span></>}
                                {edgeStyle === 'step' && <><Activity size={16} /> <span>Degrau</span></>}
                            </button>

                            <button
                                onClick={() => {
                                    setLabelMode(!labelMode);
                                    setZoneMode(false);
                                    setLinkMode(false);
                                    setLinkSource(null);
                                }}
                                className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all shadow-lg font-bold text-xs
                                    ${labelMode ? 'bg-primary text-white shadow-primary/20' : 'bg-card text-main border border-border'}
                                `}
                            >
                                {labelMode ? <X size={16} /> : <Type size={16} />}
                                <span>{labelMode ? 'Cancelar Texto' : 'Texto'}</span>
                            </button>

                             <button
                                onClick={() => {
                                    setZoneMode(!zoneMode);
                                    setLabelMode(false);
                                    setLinkMode(false);
                                    setLinkSource(null);
                                }}
                                className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all shadow-lg font-bold text-xs relative
                                    ${zoneMode ? 'bg-accent text-white shadow-accent/20' : 'bg-card text-main border border-border'}
                                `}
                            >
                                {zoneMode ? <X size={16} /> : SHAPE_OPTIONS.find(s => s.id === selectedShape)?.icon || <Square size={16} />}
                                <span>{zoneMode ? 'Cancelar' : 'Formas'}</span>
                                {zoneMode && (
                                    <div className="absolute -bottom-36 left-0 grid grid-cols-4 bg-card border border-border rounded-lg p-1 gap-1 shadow-xl pointer-events-auto w-[160px]" onClick={e => e.stopPropagation()}>
                                        {SHAPE_OPTIONS.map(shape => (
                                            <button 
                                                key={shape.id}
                                                onClick={() => setSelectedShape(shape.id as any)}
                                                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${selectedShape === shape.id ? 'bg-accent text-white' : 'text-main hover:bg-page/10'}`}
                                                title={shape.label}
                                            >
                                                {shape.icon}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </button>

                             <button
                                onClick={() => {
                                    setLinkMode(!linkMode);
                                    setLabelMode(false);
                                    setZoneMode(false);
                                    setLinkSource(null);
                                }}
                                className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all shadow-lg font-bold text-xs
                                    ${linkMode ? 'bg-orange-500 text-white shadow-orange-500/20' : 'bg-card text-main border border-border'}
                                `}
                            >
                                {linkMode ? <X size={16} /> : <Link2 size={16} />}
                                <span>{linkMode ? 'Cancelar Link' : 'Criar Link'}</span>
                            </button>

                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all shadow-lg font-bold text-xs
                                    ${sidebarOpen ? 'bg-card border border-border text-main' : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'}
                                `}
                            >
                                <Plus size={16} />
                                <span>Adicionar</span>
                            </button>
                        </>
                    )}
                    
                    <div className="flex bg-card border border-border rounded-xl p-1 shadow-lg">
                        <div
                            className="flex items-center gap-1 px-2 py-1 rounded-lg relative group/interval"
                            title="Frequência de atualização da banda."
                        >
                            <Activity size={14} className="text-main/30 mr-1" />
                            {([5000, 15000, 30000, 60000] as const).map(ms => (
                                <button
                                    key={ms}
                                    onClick={() => setPollInterval(ms as any)}
                                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all ${
                                        pollInterval === ms 
                                            ? ms === 5000 
                                                ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                                                : ms === 15000
                                                    ? 'bg-orange-500/20 text-orange-500 border border-orange-500/30'
                                                    : ms === 30000
                                                        ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                                                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                            : 'text-secondary hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                >
                                    {ms >= 60000 ? '60s' : `${ms / 1000}s`}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={toggleFullscreen}
                            className={`p-1.5 rounded-lg transition-all border border-amber-500/30 ${
                                isFullscreen 
                                    ? 'bg-amber-600 text-black shadow-[0_0_15px_rgba(217,119,6,0.4)]' 
                                    : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                            }`}
                            title={isFullscreen ? 'Minimizar (Sair de Tela Cheia)' : 'Full Screen'}
                        >
                            {isFullscreen ? <Minimize size={18} strokeWidth={3} /> : <Maximize size={18} strokeWidth={3} />}
                        </button>

                        <button 
                            onClick={() => setUseSnapping(!useSnapping)}
                            className={`p-1.5 rounded-lg transition-all border ${
                                useSnapping 
                                    ? 'bg-accent text-white border-accent shadow-[0_0_15px_rgba(59,130,246,0.4)]' 
                                    : 'bg-white/5 text-secondary border-slate-500/30 hover:bg-white/10/20'
                            }`}
                            title={useSnapping ? 'Alinhamento Grade Ativo' : 'Ativar Alinhamento Grade'}
                        >
                            <Magnet size={18} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Zoom/Pan Controls */}
            <div className="absolute top-[80px] right-4 z-30 flex flex-col gap-3 pointer-events-auto">
                <div className="flex flex-col bg-card/90 backdrop-blur-md border border-border rounded-2xl shadow-2xl overflow-hidden">
                    <button onClick={() => handleZoom(0.1)} className="p-3.5 hover:bg-card/50 text-main/60 transition-colors border-b border-border" title="Aumentar Zoom">
                        <Plus size={20} strokeWidth={3} />
                    </button>
                    <button onClick={() => handleZoom(-0.1)} className="p-3.5 hover:bg-card/50 text-main/60 transition-colors border-b border-border" title="Diminuir Zoom">
                        <Minus size={20} strokeWidth={3} />
                    </button>
                    <button onClick={handleFitView} className="p-3.5 hover:bg-card/50 text-main/60 transition-colors" title="Centralizar / Resetar">
                        <Layout size={20} strokeWidth={3} />
                    </button>
                </div>
                <div className="px-3.5 py-1.5 bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-black rounded-full text-center shadow-xl border border-white/10">
                    {Math.round(zoom * 100)}%
                </div>
            </div>

            {/* Viewport: Handles panning and zooming */}
            <div 
                className={`flex-1 relative overflow-hidden bg-[#0a0a0f] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handlePanMouseDown}
                onMouseMove={handlePanMouseMove}
                onMouseUp={handlePanMouseUp}
                onMouseLeave={handlePanMouseUp}
                // Scroll do Mouse Central: Faz Zoom (se Ctrl pressionado) ou Pan Direcionado (Sem Ctrl)
                onWheel={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                        const delta = e.deltaY > 0 ? -0.1 : 0.1;
                        handleZoom(delta);
                    } else {
                        setOffset(prev => ({ 
                            x: prev.x - e.deltaX, 
                            y: prev.y - e.deltaY 
                        }));
                    }
                }}
                // API Nativa HTML5 Drag & Drop (DragOver)
                // e.preventDefault() aqui é estritamente OBRIGATÓRIO, caso contrário o evento onDrop NUNCA é disparado pelo navegador
                onDragOver={(e) => {
                    e.preventDefault(); 
                }}
                // API Nativa HTML5 Drag & Drop (Drop do Item do Sidebar para o Canvas)
                onDrop={(e) => {
                    e.preventDefault(); // Impede o browser de tentar 'abrir' o item como um link ou imagem
                    
                    // Se o usuário soltar a imagem com ferramenta ativa de Label/Zone/Panning, abortamos
                    if (labelMode || zoneMode || isPanning) return;
                    
                    try {
                        const data = e.dataTransfer.getData('application/json');
                        if (data) {
                            const payload = JSON.parse(data);
                            if (payload.deviceId || payload.type === 'static' || payload.type === 'shape') {
                                // Matemática Crucial de Drop Espacial (Atrito Viewport vs Infinite Canvas):
                                // 1. e.currentTarget.getBoundingClientRect() pega os limites da *janela visível* da tela.
                                const rect = e.currentTarget.getBoundingClientRect();
                                
                                // 2. Para descobrir onde o X e Y caiu no "mundo tridimensional interno do mapa", precisamos:
                                //    a. Pegar a distância do clique até a margem do viewport (e.clientX - rect.left)
                                //    b. Anular o deslocamento (Pan) que o usuário aplicou arrastando o background (- offset.x)
                                //    c. Dividir todo o resultado pelo limite de Zoom (escala de 0.1 a 3.0) para converter pixels da tela em pixels vetoriais lógicos
                                const x = (e.clientX - rect.left - offset.x) / zoom;
                                const y = (e.clientY - rect.top - offset.y) / zoom;
                                
                                if (payload.type === 'static') {
                                    addNode.mutate({
                                        customMapId: mapId,
                                        type: payload.staticType,
                                        name: payload.label,
                                        x: snapToGrid(x - 32),
                                        y: snapToGrid(y - 32)
                                    });
                                } else if (payload.type === 'shape') {
                                    addZone.mutate({
                                        customMapId: mapId,
                                        x: snapToGrid(x - 100),
                                        y: snapToGrid(y - 60),
                                        width: 200,
                                        height: 120,
                                        type: payload.shapeType,
                                        label: payload.label
                                    });
                                } else if (payload.deviceId) {
                                    addNode.mutate({
                                        customMapId: mapId,
                                        deviceId: payload.deviceId,
                                        x: snapToGrid(x - 32),
                                        y: snapToGrid(y - 32)
                                    });
                                }
                            }
                        }
                    } catch (err) {}
                }}
            >
                {/* Scalable & Pannable Canvas */}
                <div 
                    className="w-[5000px] h-[5000px] relative transition-transform duration-75 ease-out"
                    style={{ 
                        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.15) 1.5px, transparent 0)',
                        backgroundSize: '40px 40px',
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                        transformOrigin: '0 0'
                    }}
                >
                    {/* Zones Layer (Background) */}
                    {(map as any).zones?.map((zone: any) => (
                        <CustomMapZone 
                            key={zone.id} 
                            zone={zone} 
                            onUpdate={(id, data) => updateZone.mutate({ id, ...data })}
                            onRemove={id => {
                                if (window.confirm('Excluir esta área?')) removeZone.mutate({ id });
                            }}
                            zoom={zoom}
                            isEditMode={isEditMode}
                            snapToGrid={snapToGrid}
                            isSelected={selectedIds.includes(zone.id)}
                            onClick={() => setSelectedIds([zone.id])}
                        />
                    ))}

                    {/* Draft Zone */}
                    {draftZone && (
                        <div 
                            className="absolute border border-dashed border-accent/50 bg-accent/5 overflow-hidden pointer-events-none z-[5]"
                            style={{
                                left: snapToGrid(Math.min(draftZone.startX, draftZone.currentX)),
                                top: snapToGrid(Math.min(draftZone.startY, draftZone.currentY)),
                                width: snapToGrid(Math.abs(draftZone.currentX - draftZone.startX)),
                                height: snapToGrid(Math.abs(draftZone.currentY - draftZone.startY)),
                            }}
                        >
                            <IronGridShapes 
                                type={selectedShape}
                                color="#3b82f6"
                                width={Math.abs(draftZone.currentX - draftZone.startX)}
                                height={Math.abs(draftZone.currentY - draftZone.startY)}
                                opacity={0.1}
                            />
                        </div>
                    )}

                    {/* Lasso Selection Box */}
                    {selectionBox && (
                        <div 
                            className="absolute border-2 border-accent bg-accent/10 pointer-events-none z-[100]"
                            style={{
                                left: Math.min(selectionBox.startX, selectionBox.endX),
                                top: Math.min(selectionBox.startY, selectionBox.endY),
                                width: Math.abs(selectionBox.endX - selectionBox.startX),
                                height: Math.abs(selectionBox.endY - selectionBox.startY),
                            }}
                        />
                    )}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                        {(map as any).edges?.map((edge: any) => {
                            const sourceNode = (map as any).nodes.find((n: any) => n.id === edge.sourceId);
                            const targetNode = (map as any).nodes.find((n: any) => n.id === edge.targetId);
                            if (!sourceNode || !targetNode) return null;

                            // Edge grouping logic (to handle multiple links between the same nodes)
                            const groupEdges = (map as any).edges.filter((e: any) => 
                                (e.sourceId === edge.sourceId && e.targetId === edge.targetId) || 
                                (e.sourceId === edge.targetId && e.targetId === edge.sourceId)
                            );
                            // Sort by ID for deterministic order
                            groupEdges.sort((a: any, b: any) => a.id.localeCompare(b.id));
                            const index = groupEdges.findIndex((e: any) => e.id === edge.id);
                            const total = groupEdges.length;

                            return (
                                <CustomMapLine
                                    key={edge.id}
                                    edge={edge}
                                    sourceNode={sourceNode}
                                    targetNode={targetNode}
                                    draggedNodes={draggedNodes}
                                    onClick={() => setSelectedEdgeId(edge.id)}
                                    index={index}
                                    total={total}
                                    edgeStyle={edgeStyle}
                                    pollInterval={pollInterval}
                                />
                            );
                        })}
                        
                        {/* Current drafting link */}
                        {linkMode && linkSource && (
                            <line 
                                x1={(draggedNodes[linkSource]?.x ?? (map as any).nodes.find((n: any) => n.id === linkSource).x) + 50}
                                y1={(draggedNodes[linkSource]?.y ?? (map as any).nodes.find((n: any) => n.id === linkSource).y) + 44}
                                x2={mousePos.x}
                                y2={mousePos.y}
                                stroke="rgba(59, 130, 246, 0.6)"
                                strokeWidth="3"
                                strokeDasharray="6,4"
                                className="animate-pulse"
                            />
                        )}
                    </svg>

                    {(map as any).nodes.map((node: any) => (
                        <CustomMapNode 
                            key={node.id} 
                            node={node} 
                            onUpdatePosition={handleUpdatePosition}
                            onRemove={handleRemoveNode}
                            onClick={() => handleNodeClick(node.id)}
                            isLinkSource={linkSource === node.id}
                            linkMode={linkMode}
                            onDrag={(x, y) => setDraggedNodes(prev => ({ ...prev, [node.id]: { x, y } }))}
                            onDragEnd={() => setDraggedNodes({})}
                            zoom={zoom}
                            isEditMode={isEditMode}
                            isSelected={selectedIds.includes(node.id)}
                        />
                    ))}

                    {/* Labels Layer (Foreground) */}
                    {(map as any).labels?.map((label: any) => (
                        <CustomMapLabel 
                            key={label.id} 
                            label={label} 
                            onUpdate={(id, data) => updateLabel.mutate({ id, ...data })}
                            onRemove={id => {
                                if (window.confirm('Excluir este texto?')) removeLabel.mutate({ id });
                            }}
                            zoom={zoom}
                            snapToGrid={snapToGrid}
                            isSelected={selectedIds.includes(label.id)}
                            onClick={() => setSelectedIds([label.id])}
                        />
                    ))}
                </div>

                {/* Edge Configuration Overlay - Moved OUTSIDE scalable canvas to prevent clipping and scale issues */}
                {(() => {
                    if (!selectedEdge || !map) return null;
                    const sNode = (map as any).nodes.find((n: any) => n.id === selectedEdge.sourceId);
                    const tNode = (map as any).nodes.find((n: any) => n.id === selectedEdge.targetId);
                    if (!sNode || !tNode) return null;

                    const sX = (draggedNodes[sNode.id]?.x ?? sNode.x) + 50;
                    const sY = (draggedNodes[sNode.id]?.y ?? sNode.y) + 44;
                    const tX = (draggedNodes[tNode.id]?.x ?? tNode.x) + 50;
                    const tY = (draggedNodes[tNode.id]?.y ?? tNode.y) + 44;

                    const groupEdges = (map as any).edges.filter((e: any) => 
                        (e.sourceId === selectedEdge.sourceId && e.targetId === selectedEdge.targetId) || 
                        (e.sourceId === selectedEdge.targetId && e.targetId === selectedEdge.sourceId)
                    );
                    groupEdges.sort((a: any, b: any) => a.id.localeCompare(b.id));
                    const i = groupEdges.findIndex((e: any) => e.id === selectedEdge.id);
                    const t = groupEdges.length;

                    let lx = (sX + tX) / 2;
                    let ly = (sY + tY) / 2;

                    if (t > 1) {
                        const dx = tX - sX;
                        const dy = tY - sY;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        const nx = -dy / len;
                        const ny = dx / len;
                        const off = (i - (t - 1) / 2) * 80;
                        const midX = lx; 
                        const midY = ly;
                        const cx = midX + nx * off;
                        const cy = midY + ny * off;
                        
                        const tt = 0.3 + (i / (t - 1)) * 0.4;
                        const invT = 1 - tt;
                        lx = invT * invT * sX + 2 * invT * tt * cx + tt * tt * tX;
                        ly = invT * invT * sY + 2 * invT * tt * cy + tt * tt * tY;
                    }

                    // Convert to viewport coordinates
                    const vx = lx * zoom + offset.x;
                    const vy = ly * zoom + offset.y;

                    return (
                        <div 
                            className="absolute z-[60] animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
                            style={{ 
                                left: vx,
                                top: vy,
                                transform: 'translate(-50%, -105%)' 
                            }}
                        >
                            <div className="bg-card rounded-2xl shadow-2xl border border-border w-[320px] overflow-hidden">
                                <div className="bg-card/80 px-4 py-3 border-b border-border flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Settings2 className="text-main" size={16} />
                                        <h3 className="font-bold text-[10px] uppercase tracking-wider text-main">Configurar Link</h3>
                                    </div>
                                    <button onClick={() => setSelectedEdgeId(null)} className="p-1 hover:bg-card/50 rounded-lg transition-colors">
                                        <X size={14} className="text-main/40" />
                                    </button>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[9px] font-black text-main/40 uppercase mb-1 tracking-widest leading-relaxed">
                                                Monitorar porta de <span className="text-main uppercase">{sourceNodeName}</span>
                                            </label>
                                            <select 
                                                className="w-full bg-card/50 border border-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-main"
                                                value={selectedEdge.sourcePort || ''}
                                                onChange={(e) => {
                                                    updateEdge.mutate({ id: selectedEdge.id, sourcePort: e.target.value || null, targetPort: null });
                                                }}
                                            >
                                                <option value="">Nenhuma porta...</option>
                                                {(sourceInterfaces as any[] ?? []).map((iface: any) => (
                                                    <option key={iface.id} value={iface.name}>{iface.name} ({iface.description})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 py-1">
                                            <div className="h-px flex-1 bg-border/50"></div>
                                            <span className="text-[8px] font-bold text-main/30 uppercase italic">Ou</span>
                                            <div className="h-px flex-1 bg-border/50"></div>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black text-main/40 uppercase mb-1 tracking-widest leading-relaxed">
                                                Monitorar porta de <span className="text-accent uppercase">{targetNodeName}</span>
                                            </label>
                                            <select 
                                                className="w-full bg-card/50 border border-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-main"
                                                value={selectedEdge.targetPort || ''}
                                                onChange={(e) => {
                                                    updateEdge.mutate({ id: selectedEdge.id, targetPort: e.target.value || null, sourcePort: null });
                                                }}
                                            >
                                                <option value="">Nenhuma porta...</option>
                                                {(targetInterfaces as any[] ?? []).map((iface: any) => (
                                                    <option key={iface.id} value={iface.name}>{iface.name} ({iface.description})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-border flex justify-between gap-2">
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Excluir este link permanentemente?')) {
                                                    removeEdge.mutate({ id: selectedEdge.id });
                                                    setSelectedEdgeId(null);
                                                }
                                            }}
                                            className="flex-1 px-3 py-2 rounded-lg border border-red-500/20 text-red-500 text-[10px] font-bold hover:bg-red-500/10 transition-colors"
                                        >
                                            Excluir Link
                                        </button>
                                        <button
                                            onClick={() => setSelectedEdgeId(null)}
                                            className="flex-1 px-3 py-2 rounded-lg bg-page/10 text-main text-[10px] font-bold hover:bg-page/20 transition-colors"
                                        >
                                            Fechar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Right Sidebar for adding devices */}
            <div className={`
                absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-2xl z-30 transition-transform duration-300 flex flex-col
                ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                <div className="p-4 border-b border-border flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-sm text-main uppercase tracking-wide">Adicionar ao Mapa</h3>
                        <button onClick={() => setSidebarOpen(false)} className="text-main/40 hover:text-main text-xl">×</button>
                    </div>

                    <div className="flex bg-page/5 p-1 rounded-xl border border-border/50">
                        <button
                            onClick={() => setSidebarTab('devices')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${sidebarTab === 'devices' ? 'bg-card text-main shadow-sm border border-border' : 'text-main/40'}`}
                        >
                            <Layout size={14} /> Dispositivos
                        </button>
                        <button
                            onClick={() => setSidebarTab('elements')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${sidebarTab === 'elements' ? 'bg-card text-main shadow-sm border border-border' : 'text-main/40'}`}
                        >
                            <Plus size={14} /> Elementos
                        </button>
                    </div>

                    {sidebarTab === 'devices' && (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-main/30" />
                            <input
                                type="text"
                                placeholder="Buscar dispositivo..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-primary text-main"
                            />
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-6 custom-scrollbar">
                    {sidebarTab === 'elements' ? (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-[10px] font-black text-main/30 uppercase tracking-[0.2em] mb-3 px-2">Ativos de Rede</h4>
                                <div className="grid grid-cols-2 gap-2 p-1">
                                    {STATIC_ELEMENTS.map((el) => (
                                        <div
                                            key={el.type}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/json', JSON.stringify({ 
                                                    type: 'static', 
                                                    staticType: el.type,
                                                    label: el.label
                                                }));
                                            }}
                                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-page/5 hover:bg-page/10 border border-transparent hover:border-border transition-all cursor-grab active:cursor-grabbing group"
                                        >
                                            <div className="text-main/60 group-hover:scale-110 transition-transform">
                                                {el.icon}
                                            </div>
                                            <div className="text-[9px] font-bold text-main/60 text-center leading-tight">
                                                {el.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-black text-main/30 uppercase tracking-[0.2em] mb-3 px-2">Formas Geométricas</h4>
                                <div className="grid grid-cols-4 gap-2 p-1">
                                    {SHAPE_OPTIONS.map((shape) => (
                                        <div
                                            key={shape.id}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/json', JSON.stringify({ 
                                                    type: 'shape', 
                                                    shapeType: shape.id,
                                                    label: shape.label
                                                }));
                                            }}
                                            className="flex flex-col items-center gap-2 p-2 rounded-lg bg-page/5 hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all cursor-grab group"
                                            onClick={() => {
                                                setZoneMode(true);
                                                setSelectedShape(shape.id as any);
                                                setSidebarOpen(false);
                                            }}
                                        >
                                            <div className="text-main/40 group-hover:text-accent group-hover:scale-110 transition-all">
                                                {shape.icon}
                                            </div>
                                            <div className="text-[7px] font-black text-main/30 group-hover:text-accent uppercase">
                                                {shape.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : filteredDevices?.length === 0 ? (
                        <div className="p-4 text-center text-sm text-secondary">
                            Nenhum dispositivo encontrado ou todos já adicionados.
                        </div>
                    ) : (
                        filteredDevices?.map((device: any) => (
                            <div 
                                key={device.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/json', JSON.stringify({ deviceId: device.id }));
                                    if (e.dataTransfer.setDragImage) {
                                        const dragIcon = document.createElement('div');
                                        dragIcon.style.width = '50px';
                                        dragIcon.style.height = '50px';
                                        dragIcon.style.background = 'rgba(59, 130, 246, 0.5)';
                                        dragIcon.style.borderRadius = '50%';
                                        document.body.appendChild(dragIcon);
                                        e.dataTransfer.setDragImage(dragIcon, 25, 25);
                                        setTimeout(() => document.body.removeChild(dragIcon), 0);
                                    }
                                }}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-card/50 shadow-sm border border-transparent hover:border-border group transition-all cursor-grab active:cursor-grabbing"
                            >
                                <div className="p-2 bg-page/5 rounded-lg group-hover:scale-110 transition-transform text-main/60">
                                    <NodeIcon type={device.type} size={28} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-main truncate uppercase tracking-tight">{device.name}</div>
                                    <div className="text-[9px] text-main/30 font-mono truncate">{device.ipAddress || device.ip}</div>
                                </div>
                                <button
                                    onClick={() => handleAddNode(device.id)}
                                    disabled={addNode.isLoading}
                                    className="p-1.5 bg-primary/10 text-main rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/20"
                                    title="Adicionar ao mapa"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
