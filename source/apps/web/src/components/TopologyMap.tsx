import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Monitor, Check, X, Plus, Minus, Maximize, Trash2, Activity, Info
} from 'lucide-react';
import {
    ReactFlow,
    Background,
    Panel,
    useNodesState,
    useEdgesState,
    Edge,
    Handle,
    Position,
    NodeProps,
    Node,
    OnSelectionChangeParams,
    XYPosition,
    useStore,
    getSmoothStepPath,
    getStraightPath,
    BaseEdge,
    EdgeProps,
    useReactFlow,
    BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { trpc } from '../utils/trpc';
import { RemoteViewer } from './RemoteViewer';
import { DeviceEditModal } from './DeviceEditModal';

class ErrorBoundary extends React.Component<any, { hasError: boolean, error: any }> {
    constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) return <div className="absolute inset-0 bg-red-900/50 flex flex-col items-center justify-center p-8 z-50 text-white"><h1 className="text-2xl font-bold mb-4">Map rendering crashed!</h1><pre className="bg-black/50 p-4 rounded text-sm overflow-auto max-w-full">{this.state.error?.message}</pre></div>;
        return this.props.children;
    }
}

// --- Types ---

interface DeviceNodeData extends Record<string, unknown> {
    id: string;
    label: string;
    type: string;
    status: 'ok' | 'warning' | 'error';
    ip?: string;
    latency?: number;
    lastLatency?: number;
    parentId?: string | null;
    agentId?: string;
    vlan?: number;
    purchaseValue?: number;
    portSpeed?: string;
    hiddenChildrenCount?: number;
    hiddenSwitchesCount?: number;
    isStatic?: boolean;
    isSwitchGroup?: boolean;
    layer?: string;
    connectedPort?: number | null;
    hasChildren?: boolean;
    isCollapsed?: boolean;
    topologyRole?: string;
    latencyThresholds?: any[];
    additionalParents?: string[];
    hiddenSecSwitchesCount?: number;
    toggleCollapse?: (id: string) => void;
}

// --- Custom Components ---

const NodeIcon = ({ type, size = 24, className = "" }: { type: string, size?: number, className?: string }) => {
    const getIconPath = (t: string) => {
        switch (t.toLowerCase()) {
            case 'router':
            case 'gateway': return '/icons/topology/router.png';
            case 'internet': return '/icons/topology/cloud.png';
            case 'firewall': return '/icons/topology/firewall.png';
            case 'switch': return '/icons/topology/switch.png';
            case 'server': return '/icons/topology/server.png';
            case 'storage':
            case 'nas': return '/icons/topology/nas.png';
            case 'db':
            case 'database': return '/icons/topology/database.png';
            case 'workstation':
            case 'pc':
            case 'computer':
            case 'desktop':
            case 'laptop':
            case 'endpoint': return '/icons/topology/computer.png';
            case 'printer': return '/icons/topology/printer.png';
            case 'voip':
            case 'phone': return '/icons/topology/voip.png';
            case 'camera': return '/icons/topology/camera.png';
            case 'ap':
            case 'wifi':
            case 'access_point': return '/icons/topology/access-point.png';
            default: return '/icons/topology/server.png';
        }
    };

    return (
        <img
            src={`${getIconPath(type)}?v=${Date.now()}`}
            className={className}
            style={{ width: size, height: size }}
            alt={type}
        />
    );
};

const getStatusColor = (status: string, latency?: number) => {
    if (status === 'error') return '#ef4444';
    if (status === 'warning' || (latency && latency > 50)) return '#f59e0b';
    return '#22c55e';
};

const getLatencyColor = (latency: number, configs?: any[]) => {
    if (!configs || configs.length === 0) return '#34d399'; // default emerald-400
    
    // Sort configs by level to ensure we have 1, 2, 3
    const l1 = configs.find(c => c.level === 1)?.latencyThreshold || 50;
    const l2 = configs.find(c => c.level === 2)?.latencyThreshold || 100;
    const l3 = configs.find(c => c.level === 3)?.latencyThreshold || 200;

    if (latency < l1) return '#34d399'; // emerald-400 (Verde)
    if (latency < l2) return '#fbbf24'; // amber-400 (Amarelo)
    if (latency < l3) return '#fb7185'; // rose-400 (Vermelho)
    return '#ef4444'; // Red-500 (Crítico)
};

const DeviceNode = ({ data, selected }: NodeProps<Node<DeviceNodeData>>) => {
    const statusColor = getStatusColor(data.status, data.latency);
    const iconSize = data.isSwitchGroup ? 70 : 54;

    const l1Threshold = data.latencyThresholds?.find((c: any) => c.level === 1)?.latencyThreshold || 50;
    const l2Threshold = data.latencyThresholds?.find((c: any) => c.level === 2)?.latencyThreshold || 100;
    
    const isL1Alert = data.lastLatency != null && data.lastLatency >= l1Threshold && data.lastLatency < l2Threshold;
    const isL2Alert = data.lastLatency != null && data.lastLatency >= l2Threshold;

    return (
        <div className={`relative flex flex-col items-center group transition-all ${selected ? 'scale-110' : 'hover:scale-105'}`}>
            <Handle type="target" position={Position.Top} className="opacity-0" />

            {/* Selection Glow */}
            {selected && (
                <div className="absolute inset-x-0 top-0 flex items-center justify-center -translate-y-1/2">
                    <div className="w-[120%] h-[120%] border-2 border-accent border-dashed rounded-full animate-[spin_10s_linear_infinite]" />
                </div>
            )}

            {/* Offline Pulse */}
            {data.status !== 'ok' && (
                <div className="absolute inset-0 bg-red-500/20 rounded-full animate-pulse blur-xl" />
            )}

            {/* Latency Alert (L1/L2/LL3) */}
            {isL1Alert && !isL2Alert && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div 
                        className="rounded-full border-[3px] border-amber-400 animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.8)]" 
                        style={{ width: iconSize + 12, height: iconSize + 12 }}
                    />
                </div>
            )}
            {isL2Alert && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div 
                        className="rounded-full border-[3px] border-rose-600 animate-pulse shadow-[0_0_25px_rgba(225,29,72,0.9)]" 
                        style={{ width: iconSize + 16, height: iconSize + 16 }}
                    />
                </div>
            )}

            {/* Icon Container — no z-index to avoid stacking context trapping the badge */}
            <div className="relative flex flex-col items-center">
                <NodeIcon type={data.type} size={iconSize} className="drop-shadow-2xl" />

                {/* Status Badge */}
                <div
                    className="absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-[#0f0f0f] flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: statusColor }}
                >
                    {data.status === 'ok' ? (
                        <Check size={8} className="text-white" strokeWidth={4} />
                    ) : (
                        <X size={8} className="text-white" strokeWidth={4} />
                    )}
                </div>
            </div>

            {/* Labels */}
            <div className={`mt-[-16px] flex flex-col items-center pointer-events-none space-y-0 transition-transform duration-300 ${isL2Alert ? 'scale-[1.7] z-10' : ''}`}>
                <span className={`text-[11px] font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(0,0,0,1)] whitespace-nowrap px-2.5 py-0.5 bg-black/80 rounded-full border border-white/10 ${isL2Alert ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : ''}`}>
                    {data.label}
                </span>
                <div className="flex items-center gap-1 mt-[-2px]">
                    {data.ip && (
                        <span className="text-[8px] font-mono text-secondary/70 font-bold bg-black/40 px-1 rounded flex items-center whitespace-nowrap">
                            {data.ip}
                            {data.lastLatency != null && (
                                <>
                                    <span>&nbsp;&nbsp;</span>
                                    <span style={{ color: getLatencyColor(data.lastLatency, data.latencyThresholds) }}>
                                        {data.lastLatency.toFixed(1)}ms
                                    </span>
                                </>
                            )}
                        </span>
                    )}
                </div>
            </div>

            {/* Hidden Children Indicator (Visible only when collapsed and has hidden switches) */}
            {data.isCollapsed && ((data.hiddenSwitchesCount ?? 0) > 0 || (data.hiddenSecSwitchesCount ?? 0) > 0) && (
                <div className="mt-2 px-3 py-0.5 bg-accent border border-accent/50 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)] animate-pulse">
                    <span className="text-[8px] text-white font-black uppercase tracking-widest whitespace-nowrap">
                        {data.hiddenSwitchesCount ? `+ ${data.hiddenSwitchesCount} SW` : ''}{data.hiddenSwitchesCount && (data.hiddenSecSwitchesCount) ? ' ' : ''}{data.hiddenSecSwitchesCount ? `+ ${data.hiddenSecSwitchesCount} 2ºSW` : ''}
                    </span>
                </div>
            )}

            {/* Expand/Collapse Toggle Button — rendered at root level to avoid z-index stacking issues */}
            {data.hasChildren && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (data.toggleCollapse) data.toggleCollapse(data.id);
                    }}
                    title={data.isCollapsed ? 'Expandir filhos' : 'Recolher filhos'}
                    className={`mt-1 w-8 h-8 rounded-full border-[3px] border-[#0b0b0b] flex items-center justify-center shadow-2xl transition-all z-50 pointer-events-auto ${data.isCollapsed
                            ? 'bg-accent hover:bg-accent shadow-[0_0_16px_rgba(59,130,246,0.7)]'
                            : 'bg-slate-700 hover:bg-white/10 border-slate-500'
                        }`}
                >
                    {data.isCollapsed ? (
                        <Plus size={14} className="text-white" strokeWidth={3} />
                    ) : (
                        <Minus size={14} className="text-white" strokeWidth={3} />
                    )}
                </button>
            )}

            <Handle type="source" position={Position.Bottom} className="opacity-0" />
        </div>
    );
};

// --- Smart Edge Routing ---
function getNodeIntersection(intersectionNode: any, targetNode: any) {
    const x = intersectionNode.internals?.positionAbsolute?.x || intersectionNode.position?.x || 0;
    const y = intersectionNode.internals?.positionAbsolute?.y || intersectionNode.position?.y || 0;
    const w = intersectionNode.measured?.width || 120;
    const cx = x + w / 2; // Icon is strictly horizontally centered

    // The icon is slightly offset from the top
    const iconSize = intersectionNode.data?.isSwitchGroup ? 70 : 54;
    const iconCy = y + iconSize / 2 + 5; // adding 5px to account for small top padding/glow

    // Target calculation just for direction
    const tx = targetNode.internals?.positionAbsolute?.x || targetNode.position?.x || 0;
    const ty = targetNode.internals?.positionAbsolute?.y || targetNode.position?.y || 0;
    const tw = targetNode.measured?.width || 120;
    const tcx = tx + tw / 2;

    const targetIconSize = targetNode.data?.isSwitchGroup ? 70 : 54;
    const targetIconCy = ty + targetIconSize / 2 + 5;

    const dx = tcx - cx;
    const dy = targetIconCy - iconCy;

    const r = iconSize / 2;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) return { x: cx + r, y: iconCy, pos: Position.Right };
        return { x: cx - r, y: iconCy, pos: Position.Left };
    } else {
        if (dy > 0) return { x: cx, y: iconCy + r, pos: Position.Bottom };
        return { x: cx, y: iconCy - r, pos: Position.Top };
    }
}

function getEdgeParams(source: any, target: any) {
    const sourceIntersection = getNodeIntersection(source, target);
    const targetIntersection = getNodeIntersection(target, source);

    return {
        sx: sourceIntersection.x,
        sy: sourceIntersection.y,
        tx: targetIntersection.x,
        ty: targetIntersection.y,
        sourcePos: sourceIntersection.pos,
        targetPos: targetIntersection.pos,
    };
}

const SmartEdge = ({
    id,
    source,
    target,
    style,
    className,
    markerEnd,
    markerStart,
    interactionWidth
}: EdgeProps & { className?: string }) => {
    const nodeLookup = useStore(useCallback((store: any) => store.nodeLookup, []));
    const edges = useStore(useCallback((store: any) => store.edges, []));

    const sourceNode = nodeLookup.get(source);
    const targetNode = nodeLookup.get(target);

    const edgeProps = { id, style, className, markerEnd, markerStart, interactionWidth };

    if (!sourceNode || !targetNode) return <BaseEdge path="" {...edgeProps} />;

    const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

    // Calculate Parallel Offset for edges originating from the same source
    const siblingEdges = edges.filter((e: any) => e.source === source);

    // Sort siblings by their target's X position to prevent lines crossing each other
    const sortedSiblings = [...siblingEdges].sort((a: any, b: any) => {
        const nA = nodeLookup.get(a.target);
        const nB = nodeLookup.get(b.target);
        const xA = nA?.internals?.positionAbsolute?.x || nA?.position?.x || 0;
        const xB = nB?.internals?.positionAbsolute?.x || nB?.position?.x || 0;
        return xA - xB;
    });

    const siblingIndex = sortedSiblings.findIndex((e: any) => e.id === id);
    const siblingCount = sortedSiblings.length;

    // Constrain spread to stay safely within the width of the physical node icon (max spread 40px)
    const maxSpread = 40;
    let offset = 0;

    if (siblingCount > 1) {
        // Max gap of 10px between lines, but scale down if there are many cables to fit within maxSpread
        const gap = Math.min(10, maxSpread / (siblingCount - 1));
        offset = (siblingIndex - (siblingCount - 1) / 2) * gap;
    }

    // Apply offset perpendicularly to the source face
    const sxAdj = (sourcePos === Position.Top || sourcePos === Position.Bottom) ? sx + offset : sx;
    const syAdj = (sourcePos === Position.Left || sourcePos === Position.Right) ? sy + offset : sy;

    const [edgePath] = getSmoothStepPath({
        sourceX: sxAdj,
        sourceY: syAdj,
        sourcePosition: sourcePos,
        targetPosition: targetPos,
        targetX: tx,
        targetY: ty,
        borderRadius: 16,
    });

    return <BaseEdge path={edgePath} {...edgeProps} />;
};

const ZabbixEdge = ({
    id,
    source,
    target,
    style,
    className,
    markerEnd,
    markerStart,
    interactionWidth
}: EdgeProps & { className?: string }) => {
    const nodeLookup = useStore(useCallback((store: any) => store.nodeLookup, []));

    const sourceNode = nodeLookup.get(source);
    const targetNode = nodeLookup.get(target);

    const edgeProps = { id, style, className, markerEnd, markerStart, interactionWidth };

    if (!sourceNode || !targetNode) return <BaseEdge path="" {...edgeProps} />;

    const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

    const [edgePath] = getStraightPath({
        sourceX: sx,
        sourceY: sy,
        targetX: tx,
        targetY: ty,
    });

    return <BaseEdge path={edgePath} {...edgeProps} />;
};

const edgeTypes = {
    smart: SmartEdge,
    zabbix: ZabbixEdge,
};

const nodeTypes = {
    device: DeviceNode,
} as const;

// --- Custom Top Bar ---

const TopControls = ({ 
    onBack, edgeStyle, setEdgeStyle
}: any) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const [showLegend, setShowLegend] = useState(false);

    return (
        <Panel position="top-right" className="m-4 flex items-center pointer-events-auto z-[60]">
            <div className="flex items-center bg-black/40 backdrop-blur-xl p-1 rounded-2xl border border-white/10 shadow-2xl relative gap-1">
                
                {/* 1. Legend Popup Tool (Amber) */}
                <div className="relative">
                    <button 
                        onMouseEnter={() => setShowLegend(true)}
                        onMouseLeave={() => setShowLegend(false)}
                        onClick={() => setShowLegend(!showLegend)}
                        className={`p-1.5 rounded-lg transition-all ${showLegend ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-amber-400/70 hover:text-amber-400'}`}
                        title="Legenda de Velocidades"
                    >
                        <Info size={14} strokeWidth={3} />
                    </button>

                    {showLegend && (
                        <div className="absolute top-full left-0 mt-2 p-3 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[70] min-w-[160px] animate-in fade-in zoom-in-95 duration-200">
                            <h4 className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] mb-3 ml-1">Legenda</h4>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-[2.5px] bg-[#22c55e] rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                                    <span className="text-[#22c55e] text-[10px] font-black uppercase tracking-widest">40G</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-[1.5px] bg-[#3b82f6] rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                    <span className="text-[#3b82f6] text-[10px] font-black uppercase tracking-widest">10G</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-[1.5px] bg-[#eab308] rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                                    <span className="text-[#eab308] text-[10px] font-black uppercase tracking-widest">1G</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-[1.5px] bg-[#f97316] rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
                                    <span className="text-[#f97316] text-[10px] font-black uppercase tracking-widest">100M</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-[1.5px] border-t-[1.5px] border-[#a855f7] border-dashed shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                                    <span className="text-[#a855f7] text-[10px] font-black uppercase tracking-widest">Wifi</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-[1.5px] bg-[#ef4444] rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                    <span className="text-[#ef4444] text-[10px] font-black uppercase tracking-widest">Off</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-px h-4 bg-white/10 mx-1"></div>

                {/* 2. Edge Style Toggle (Indigo) */}
                <button 
                    onClick={() => setEdgeStyle(edgeStyle === 'curved' ? 'zabbix' : 'curved')} 
                    className={`p-1.5 rounded-lg transition-all ${edgeStyle === 'curved' ? 'bg-accent/30 text-accent shadow-[0_0_10px_rgba(79,70,229,0.3)] border border-accent/30' : 'text-accent/70 hover:text-accent'}`}
                    title={edgeStyle === 'curved' ? 'Estilo: Curvo' : 'Estilo: Reto'}
                >
                    <Activity size={14} strokeWidth={3} />
                </button>

                <div className="w-px h-4 bg-white/10 mx-1"></div>

                {/* 3. Zoom Controls (Rose / Emerald / Cyan) */}
                <div className="flex items-center">
                    <button onClick={() => zoomOut()} className="p-1.5 hover:bg-white/10 rounded-lg text-rose-400 hover:text-rose-300 transition-colors" title="Diminuir Zoom">
                        <Minus size={14} strokeWidth={3} />
                    </button>
                    <button onClick={() => zoomIn()} className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors" title="Aumentar Zoom">
                        <Plus size={14} strokeWidth={3} />
                    </button>
                    <button onClick={() => fitView({ duration: 800 })} className="p-1.5 hover:bg-white/10 rounded-lg text-cyan-400 hover:text-cyan-300 transition-colors" title="Centralizar Mapa">
                        <Maximize size={14} strokeWidth={3} />
                    </button>
                </div>

                {onBack && (
                    <>
                        <div className="w-px h-4 bg-white/10 mx-1"></div>
                        <button
                            onClick={onBack}
                            className="px-3 py-1.5 bg-accent hover:bg-accent rounded-xl text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-[0_0_10px_rgba(37,99,235,0.3)] flex items-center gap-1.5"
                        >
                            <X size={14} strokeWidth={3} />
                            Voltar
                        </button>
                    </>
                )}
            </div>
        </Panel>
    );
};

// --- Main Component ---

export function TopologyMap({ onBack }: { onBack?: () => void }) {
    const { data: devices = [] } = trpc.scan.getDevices.useQuery(undefined, {
        refetchInterval: 3000,
        staleTime: 0 // Aggressive refresh: always consider data stale
    });
    const { data: monitoringConfigs } = trpc.monitoring.getMonitoringConfigs.useQuery(undefined, {
        staleTime: 30000
    });
    const utils = (trpc as any).useContext();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node<DeviceNodeData>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [remoteAgentId, setRemoteAgentId] = useState<string | null>(null);
    const [viewMode] = useState<'all' | 'infra'>('infra');
    const [edgeStyle, setEdgeStyle] = useState<'curved' | 'zabbix' | 'focus'>('zabbix');
    const [showGrid] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [hasInitializedCollapse, setHasInitializedCollapse] = useState(false);

    // Pending edit states for side panel (using local state avoids refetch wiping mutations)
    const [pendingRole, setPendingRole] = useState<string>('');
    const [pendingParentId, setPendingParentId] = useState<string>('');
    const [pendingAdditionalParents, setPendingAdditionalParents] = useState<string[]>([]);
    const [pendingPortSpeed, setPendingPortSpeed] = useState<string>('10G');

    const updateDevice = (trpc.scan as any).updateDevice.useMutation({
        onSuccess: () => {
            (utils.scan as any).getDevices.invalidate();
        }
    });

    const updateDevicePosition = (trpc.scan as any).updateDevicePosition.useMutation({
        onSuccess: () => {
            (utils.scan as any).getDevices.invalidate();
        }
    });

    const toggleCollapse = useCallback((id: string) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // --- Data Parsing ---

    useEffect(() => {
        if (!devices || devices.length === 0) return;

        const newNodes: Node<DeviceNodeData>[] = [];
        const newEdges: Edge[] = [];

        const ipCounts: Record<string, number> = {};
        const devicesList = Array.isArray(devices) ? devices : (devices as any)?.devices ?? [];
        if (devicesList && Array.isArray(devicesList)) {
            devicesList.forEach((d: any) => { if (d.ip) ipCounts[d.ip] = (ipCounts[d.ip] || 0) + 1; });
        }

        // =============================================
        // HIERARCHY RESOLUTION
        // Level 1: CORE / GATEWAY / WAN (root)
        // Level 2: BACKBONE  (parent: CORE)
        // Level 3: BACKBONE_SEC, ACCESS (parent: BACKBONE)
        // Level 4: Switches under BACKBONE_SEC / ACCESS
        // Level 5: Sub-switches of ACCESS
        // =============================================

        // Helper to classify a role from the topologyRole or device name
        const getRole = (d: any): string | null => {
            if (!d) return null;
            if (d.topologyRole) return d.topologyRole;
            const n = (d.name || d.label || d.hostname || '').toUpperCase();
            if (n.includes('WAN') || n.includes('INTERNET')) return 'WAN';
            if (n.includes('GATEWAY') || n.includes('FIREWALL') || n === 'FW') return 'GATEWAY';
            if (n.includes('CORE')) return 'CORE';
            if (n.includes('BACKBONE')) return n.includes('SEC') ? 'BACKBONE_SEC' : 'BACKBONE';
            if (n.includes('ACCESS') || n.includes('ACESSO')) return n.includes('SEC') ? 'ACCESS_SEC' : 'ACCESS';
            return null;
        };

        // Bucket devices by level
        const byRole: Record<string, any[]> = { WAN: [], GATEWAY: [], CORE: [], BACKBONE: [], BACKBONE_SEC: [], ACCESS: [], ACCESS_SEC: [], OTHER: [] };
        devices.forEach((d: any) => {
            const r = getRole(d);
            if (r && byRole[r]) byRole[r].push(d);
            else byRole.OTHER.push(d);
        });

        // Single-instance shortcuts for each tier (first found)
        const rootDevice = byRole.WAN[0] || byRole.GATEWAY[0] || byRole.CORE[0] || devices.find((d: any) => d.ip === '192.168.0.1') || devices.find((d: any) => !d.parentId) || devices[0];
        const rootId = rootDevice?.id || null;

        // Helper: find the closest ancestor from a set by name-prefix similarity
        const findClosestParent = (device: any, candidates: any[]): string | null => {
            if (!candidates || candidates.length === 0) return null;
            if (candidates.length === 1) return candidates[0].id;
            // Try to find one whose name is a prefix of this device's name
            const myName = (device.name || '').toUpperCase();
            const prefixMatch = candidates.find(c => {
                const cn = (c.name || '').toUpperCase();
                return myName.startsWith(cn.split('_').slice(0, 3).join('_'));  // e.g. SW_B03_BACKBONE
            });
            if (prefixMatch) return prefixMatch.id;
            // Also try matching the "building" code (e.g. B03, B01)
            const buildingMatch = myName.match(/[_-]B(\d+)[_-]/);
            if (buildingMatch) {
                const building = buildingMatch[0]; // "_B03_"
                const sameBuilding = candidates.find(c => (c.name || '').toUpperCase().includes(building));
                if (sameBuilding) return sameBuilding.id;
            }
            return candidates[0].id; // fallback to first
        };

        // Collect all backbone-tier candidates (BACKBONE + BACKBONE_SEC)
        const allBackbones = [...byRole.BACKBONE, ...byRole.BACKBONE_SEC];
        // Collect all access-tier candidates (ACCESS + ACCESS_SEC)
        const allAccess = [...byRole.ACCESS, ...byRole.ACCESS_SEC];

        // Pass 1: Assign computedParentId
        const processedDevices = devices.map((device: any) => {
            // If parent is explicitly set in DB, use it (unless circular)
            let parentId = device.parentId;
            if (parentId === device.id) parentId = null;

            const role = getRole(device);

            if (!parentId && device.id !== rootId) {
                if (role === 'WAN' || role === 'WAN_SEC') {
                    parentId = null; // WAN is always root
                } else if (role === 'GATEWAY') {
                    parentId = byRole.WAN[0]?.id || null;
                } else if (role === 'CORE') {
                    parentId = byRole.GATEWAY[0]?.id || byRole.WAN[0]?.id || null;
                } else if (role === 'BACKBONE' || role === 'BACKBONE_SEC') {
                    // Level 2: Backbones connect to CORE
                    const coreParents = byRole.CORE.length > 0 ? byRole.CORE : (rootDevice ? [rootDevice] : []);
                    parentId = findClosestParent(device, coreParents);
                } else if (role === 'ACCESS' || role === 'ACCESS_SEC') {
                    // Level 3: Access connects to closest Backbone
                    parentId = findClosestParent(device, allBackbones) || byRole.CORE[0]?.id || rootId;
                } else {
                    // Level 4/5: Generic switches/endpoints connect to the closest ACCESS, then BACKBONE, then CORE
                    const deviceType = device.type?.toLowerCase() || '';
                    const isSwitch = ['switch', 'router', 'firewall', 'gateway'].includes(deviceType);
                    if (isSwitch && allAccess.length > 0) {
                        parentId = findClosestParent(device, allAccess);
                    } else if (allBackbones.length > 0) {
                        parentId = findClosestParent(device, allBackbones);
                    } else if (byRole.CORE.length > 0) {
                        parentId = byRole.CORE[0].id;
                    } else {
                        parentId = rootId;
                    }
                }
            }

            // Reverse WAN detection: if a WAN/INTERNET device has stored parentId = this device's id,
            // the user intended this device to connect UP to that WAN node.
            // Override computedParentId to create the correct edge: WAN → this device.
            if (!['WAN', 'WAN_SEC'].includes(role || '')) {
                const reverseWan = devices.find((d: any) => {
                    const r = getRole(d);
                    return d.parentId === device.id && (r === 'WAN' || r === 'WAN_SEC');
                });
                if (reverseWan) parentId = reverseWan.id;
            }

            // Final safety: prevent connecting to self, and absolute root has no parent
            if (parentId === device.id || device.id === rootId) parentId = null;

            return { ...device, computedParentId: parentId };
        });

        const parentSet = new Set<string>();
        devices.forEach((d: any) => {
            if (d.parentId) parentSet.add(d.parentId);
        });
        processedDevices.forEach((d: any) => {
            if (d.computedParentId) parentSet.add(d.computedParentId);
        });

        let currentCollapsedIds = collapsedIds;
        if (!hasInitializedCollapse && parentSet.size > 0 && processedDevices.length > 0) {
            // Default to fully EXPANDED now to avoid "blank map" frustration
            setCollapsedIds(new Set());
            currentCollapsedIds = new Set();
            setHasInitializedCollapse(true);
        }

        // Helper to check if any ancestor is collapsed
        const isCollapsedByAncestor = (parentId: string | null, visited = new Set<string>()): boolean => {
            if (!parentId || visited.has(parentId)) return false;
            visited.add(parentId);

            const parentNode = processedDevices.find((d: any) => d.id === parentId);
            if (!parentNode) return false;

            const parentType = parentNode.type?.toLowerCase() || '';
            const parentRole = getRole(parentNode) || '';

            // Only consider the parent as a "collapser" if it is visible in the current viewMode
            const visibleTypes = ['switch', 'firewall', 'router', 'gateway', 'wan', 'core', 'backbone', 'server', 'access_point', 'ap'];
            const isVisible = viewMode === 'all' || visibleTypes.includes(parentType);

            if (isVisible && currentCollapsedIds.has(parentId)) return true;

            // Essential nodes that are NOT collapsed act as walls:
            // they break the recursive check so their children are never hidden
            // by a higher ancestor's collapsed state.
            const parentIsEssential =
                ['firewall', 'router', 'gateway'].includes(parentType) ||
                ['CORE', 'BACKBONE', 'BACKBONE_SEC', 'GATEWAY', 'FIREWALL', 'WAN', 'WAN_SEC'].includes(parentRole);
            if (parentIsEssential && !currentCollapsedIds.has(parentId)) return false;

            return isCollapsedByAncestor(parentNode.computedParentId, visited);
        };

        // Pre-calculate counts of hidden items for each collapsed node
        const hiddenCounts: Record<string, { dev: number, sw: number, secSw: number }> = {};
        if (currentCollapsedIds.size > 0) {
            currentCollapsedIds.forEach(cid => {
                let devCount = 0;
                let swCount = 0;
                let secSwCount = 0;
                const visited = new Set<string>();

                const countDescendants = (pid: string) => {
                    if (visited.has(pid)) return;
                    visited.add(pid);
                    processedDevices.filter((d: any) => d.computedParentId === pid).forEach((child: any) => {
                        const role = getRole(child);
                        const type = child.type?.toLowerCase() || '';
                        
                        const isMainSw = ['FIREWALL', 'ROUTER', 'GATEWAY', 'WAN', 'CORE', 'BACKBONE', 'ACCESS'].includes(role || '') ||
                                         (['firewall', 'router', 'gateway', 'switch'].includes(type) && role !== 'ACCESS_SEC' && role !== 'BACKBONE_SEC');
                        
                        const isSecSw = (role === 'ACCESS_SEC' || role === 'BACKBONE_SEC') || 
                                        (['access_point', 'ap'].includes(type));

                        if (isMainSw) swCount++; 
                        else if (isSecSw) secSwCount++;
                        else devCount++;

                        countDescendants(child.id);
                    });
                };
                countDescendants(cid);
                hiddenCounts[cid] = { dev: devCount, sw: swCount, secSw: secSwCount };
            });
        }
        processedDevices.forEach((device: any) => {
            const role = getRole(device);
            const isInfra = ['switch', 'firewall', 'router', 'gateway', 'wan', 'core', 'backbone'].includes(device.type?.toLowerCase() || '') || 
                            ['SWITCH', 'FIREWALL', 'ROUTER', 'GATEWAY', 'WAN', 'CORE', 'BACKBONE'].includes(role || '') ||
                            device.id === rootId;
            
            if (viewMode === 'infra' && !isInfra) {
                return;
            }

            const parentId = device.computedParentId;

            let type = device.type?.toLowerCase();
            const nameLower = (device.name || '').toLowerCase();
            if (!type || type === 'endpoint' || type === 'other') {
                if (nameLower.includes('pc') || nameLower.includes('desktop')) type = 'pc';
                else if (nameLower.includes('cam')) type = 'camera';
                else if (nameLower.includes('ap') || nameLower.includes('unifi') || nameLower.includes('wifi')) type = 'access_point';
                else if (nameLower.includes('voip') || nameLower.includes('tel') || nameLower.includes('phone')) type = 'voip';
                else if (nameLower.includes('nas') || nameLower.includes('storage')) type = 'nas';
                else if (nameLower.includes('print')) type = 'printer';
                else if (nameLower.includes('srv') || nameLower.includes('server')) type = 'server';
                else if (nameLower.includes('db') || nameLower.includes('banco')) type = 'database';
                else type = 'endpoint';
            }

            // Essential infrastructure nodes are always visible (immune to ancestor collapse)
            const isEssentialDevice =
                ['firewall', 'router', 'gateway'].includes(type) ||
                ['CORE', 'BACKBONE', 'BACKBONE_SEC', 'GATEWAY', 'FIREWALL', 'WAN', 'WAN_SEC'].includes(role || '');

            // Don't render if a non-essential device has a collapsed ancestor
            if (!isEssentialDevice && isCollapsedByAncestor(parentId)) return;

            const isSwitchGroup = ['switch', 'firewall', 'router', 'gateway', 'access_point', 'voip', 'nas'].includes(type) || !!getRole(device);

            const isWireless = type === 'ap' || type === 'wifi' || type === 'access_point' || device.portSpeed === 'Wireless';
            let strokeColor = '#22c55e'; // 40G / Default Green
            if (device.portSpeed === '10G') strokeColor = '#3b82f6'; // Blue
            if (device.portSpeed === '1G') strokeColor = '#eab308'; // Yellow
            if (device.portSpeed === '100M') strokeColor = '#f97316'; // Orange
            if (isWireless) strokeColor = '#a855f7'; // Purple
            if (device.status !== 'online') strokeColor = '#ef4444'; // Red

            newNodes.push({
                id: device.id,
                type: 'device',
                position: { x: device.topoX ?? 1500, y: device.topoY ?? 600 } as XYPosition,
                data: {
                    ...device,
                    id: device.id,
                    type,
                    label: device.name || device.ip,
                    status: (ipCounts[device.ip] > 1) ? 'error' : (device.status === 'online' ? 'ok' : 'error'),
                    isSwitchGroup,
                    parentId,
                    hasChildren: parentSet.has(device.id),
                    isCollapsed: collapsedIds.has(device.id),
                    hiddenChildrenCount: hiddenCounts[device.id]?.dev || 0,
                    hiddenSwitchesCount: hiddenCounts[device.id]?.sw || 0,
                    hiddenSecSwitchesCount: hiddenCounts[device.id]?.secSw || 0,
                    latencyThresholds: monitoringConfigs,
                    toggleCollapse
                }
            });

            let showEdge = true;
            if (edgeStyle === 'focus') {
                showEdge = selectedNodeId ? selectedNodeId === parentId : false;
            }

            // Primary Parent edge
            if (parentId) {
                (newEdges as any).push({
                    id: `e-${parentId}-${device.id}`,
                    source: parentId,
                    target: device.id,
                    type: edgeStyle === 'zabbix' ? 'zabbix' : 'smart',
                    hidden: !showEdge,
                    style: {
                        stroke: strokeColor,
                        strokeWidth: device.portSpeed === '40G' ? (edgeStyle === 'zabbix' ? 3 : 1.8) : (edgeStyle === 'zabbix' ? 2 : 0.8),
                        opacity: edgeStyle === 'focus' ? 0.8 : 0.5
                    },
                    className: isWireless ? 'react-flow__edge-path-wireless' : '',
                    animated: device.status === 'online'
                });
            }

            // Additional Parents edges
            if (device.additionalParents && Array.isArray(device.additionalParents)) {
                device.additionalParents.forEach((apId: string, idx: number) => {
                    if (apId && apId !== device.id) {
                        (newEdges as any).push({
                            id: `e-extra-${apId}-${device.id}-${idx}`,
                            source: apId,
                            target: device.id,
                            type: edgeStyle === 'zabbix' ? 'zabbix' : 'smart',
                            hidden: !showEdge,
                            style: {
                                stroke: strokeColor,
                                strokeWidth: device.portSpeed === '40G' ? (edgeStyle === 'zabbix' ? 2 : 1.2) : (edgeStyle === 'zabbix' ? 1.5 : 0.6),
                                opacity: edgeStyle === 'focus' ? 0.7 : 0.4,
                                strokeDasharray: '5,5' // Distinction for secondary links
                            },
                            className: isWireless ? 'react-flow__edge-path-wireless' : '',
                            animated: device.status === 'online'
                        });
                    }
                });
            }
        });

        const H_SPACING = 200;
        const V_SPACING = 250;

        const layoutSubtree = (parentId: string, startX: number, startY: number, visited = new Set<string>()) => {
            if (visited.has(parentId)) return;
            visited.add(parentId);

            const children = newNodes.filter(n => n.data.parentId === parentId && n.position.x === 1500 && n.position.y === 600);
            if (children.length === 0) return;

            const totalW = (children.length - 1) * H_SPACING;
            let currentX = startX - (totalW / 2);

            children.forEach(child => {
                child.position = { x: currentX, y: startY };
                layoutSubtree(child.id, currentX, startY + V_SPACING, new Set(visited));
                currentX += H_SPACING;
            });
        };

        // --- Multi-Root Layout ---
        const newNodeIds = new Set(newNodes.map(n => n.id));
        const roots = newNodes.filter(n => !n.data.parentId || !newNodeIds.has(n.data.parentId));
        if (roots.length > 0) {
            const ROOT_H_SPACING = 600; // More space for roots
            const totalWidth = (roots.length - 1) * ROOT_H_SPACING;
            let currentRootX = 1500 - (totalWidth / 2);

            roots.forEach(rootNode => {
                // Only auto-position root if it lacks a saved position
                if (rootNode.position.x === 1500 && rootNode.position.y === 600) {
                    rootNode.position = { x: currentRootX, y: 100 };
                    layoutSubtree(rootNode.id, currentRootX, 100 + V_SPACING);
                } else {
                    // Start subtree layout from its current manual position
                    layoutSubtree(rootNode.id, rootNode.position.x, rootNode.position.y + V_SPACING);
                }
                currentRootX += ROOT_H_SPACING;
            });
        }

        // --- Selective Update to avoid selection flicker ---
        setNodes(currentNodes => {
            const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
            return newNodes.map(newNode => {
                const existing = nodeMap.get(newNode.id);
                if (existing) {
                    // Update only data, preserving selection and position
                    return {
                        ...existing,
                        data: newNode.data,
                    };
                }
                return newNode;
            });
        });
        setEdges(newEdges);
    }, [devices, viewMode, collapsedIds, setNodes, setEdges, edgeStyle, selectedNodeId, hasInitializedCollapse, monitoringConfigs]);

    // --- Handlers ---

    const onNodeDragStop = useCallback((_event: any, node: Node) => {
        const selectedNodes = nodes.filter(n => n.selected && !n.data.isStatic);

        // If the dragged node wasn't selected, just update it
        const nodesToUpdate = selectedNodes.length > 0 ? selectedNodes : [node];

        nodesToUpdate.forEach(n => {
            if (n.data.isStatic) return;
            updateDevicePosition.mutate({
                deviceId: n.id,
                x: Math.round(n.position.x),
                y: Math.round(n.position.y)
            });
        });
    }, [updateDevicePosition, nodes]);

    const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
        const selected = params.nodes[0];
        setSelectedNodeId(selected ? selected.id : null);
    }, []);

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node<DeviceNodeData>) => {
        event.preventDefault();
        if (!node.data.isStatic) {
            setEditingNodeId(node.id);
        }
    }, []);

    const selectedDevice = useMemo(() => {
        if (!selectedNodeId) return null;
        const node = nodes.find(n => n.id === selectedNodeId);
        return node?.data || null;
    }, [selectedNodeId, nodes]);

    // Sync pending state when selection changes
    useEffect(() => {
        if (selectedDevice) {
            setPendingRole(selectedDevice.topologyRole || '');
            setPendingParentId(selectedDevice.parentId || '');
            setPendingAdditionalParents(Array.isArray(selectedDevice.additionalParents) ? selectedDevice.additionalParents : []);
            setPendingPortSpeed(selectedDevice.portSpeed || '10G');
            setHasUnsavedChanges(false);
        }
    }, [selectedNodeId]); // Only reset when selection changes, NOT when data refetches

    return (
        <div className="relative w-full h-full bg-[#0b0b0b] overflow-hidden select-none">
            {/* React Flow Canvas */}
            <div className="w-full h-full">
                <ErrorBoundary>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeDragStop={onNodeDragStop}
                        onSelectionChange={onSelectionChange}
                        onPaneClick={() => setSelectedNodeId(null)}
                        onNodeContextMenu={handleNodeContextMenu as any}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes as any}
                        fitView
                        minZoom={0.1}
                        maxZoom={2}
                        defaultEdgeOptions={{ type: 'smart', zIndex: 0 }}
                        elevateNodesOnSelect={true}
                        selectNodesOnDrag={false}
                        multiSelectionKeyCode="Control"
                        proOptions={{ hideAttribution: true }}
                    >
                        {showGrid && <Background variant={BackgroundVariant.Dots} color={showGrid ? "rgba(255, 255, 255, 0.15)" : "transparent"} gap={30} size={1.5} style={{ transition: 'all 0.3s' }} />}
                        <Background variant={BackgroundVariant.Lines} color={showGrid ? "rgba(255, 255, 255, 0.04)" : "transparent"} gap={30} lineWidth={1} style={{ transition: 'all 0.3s' }} />
                        {/* Custom Top Controls replacing Default Controls and overlaid panels */}
                        <TopControls 
                            onBack={onBack} 
                            edgeStyle={edgeStyle} 
                            setEdgeStyle={setEdgeStyle} 
                        />

                    </ReactFlow>
                </ErrorBoundary>
            </div>

            {/* Info Panel Lateral */}
            {selectedDevice && (
                <div className="absolute bottom-8 right-8 bg-[#1e1e1e]/95 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] w-80 shadow-2xl animate-in fade-in slide-in-from-right-4 z-[70]">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Ativo Info</h3>
                            <p className="text-[8px] text-secondary font-bold uppercase tracking-widest">Detalhes do Dispositivo</p>
                        </div>
                        <button onClick={() => setSelectedNodeId(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-secondary hover:text-white">×</button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                            <div className={`p-2 rounded-xl ${selectedDevice.status === 'ok' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                                <NodeIcon type={selectedDevice.type} size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-black text-white italic truncate max-w-[180px]">{selectedDevice.label}</p>
                                <p className="text-[10px] text-secondary/70 font-mono">{selectedDevice.ip}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                <span className="text-[8px] text-secondary font-bold uppercase block mb-1">Status</span>
                                <span className="text-xs font-bold capitalize flex items-center gap-2">
                                    <span className="flex items-center justify-center w-4 h-4 rounded-full" style={{ backgroundColor: getStatusColor(selectedDevice.status, selectedDevice.latency) }}>
                                        {selectedDevice.status === 'ok' ? <Check className="w-3 h-3 text-[rgba(0,0,0,0.8)]" strokeWidth={3} /> : <X className="w-3 h-3 text-[rgba(0,0,0,0.8)]" strokeWidth={3} />}
                                    </span>
                                    <span className="text-white">{selectedDevice.status === 'ok' ? 'Ativo' : 'Offline'}</span>
                                </span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                <span className="text-[8px] text-secondary font-bold uppercase block mb-1">Layer</span>
                                <span className="text-xs font-black text-accent uppercase tracking-tight">{selectedDevice.layer || '-'}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs px-2">
                                <span className="text-secondary font-bold uppercase tracking-tighter">Tipo</span>
                                <span className="text-white font-black truncate max-w-[150px] uppercase">{selectedDevice.type}</span>
                            </div>
                            {selectedDevice.ip && (
                                <div className="flex justify-between text-xs px-2">
                                    <span className="text-secondary font-bold uppercase tracking-tighter">Endereço</span>
                                    <span className="text-accent font-mono font-bold">{selectedDevice.ip}</span>
                                </div>
                            )}
                            {selectedDevice.lastLatency != null && (
                                <div className="flex justify-between text-xs px-2">
                                    <span className="text-secondary font-bold uppercase tracking-tighter">Latência</span>
                                    <span className="text-emerald-400 font-mono font-bold">{selectedDevice.lastLatency.toFixed(1)}ms</span>
                                </div>
                            )}
                        </div>

                        {!selectedDevice.isStatic && (
                            <>
                                <div className="pt-1 px-1">
                                    <label className="text-[8px] text-accent font-bold uppercase tracking-widest px-2 block mb-1">Função Topologia:</label>
                                    <select
                                        className="w-full bg-white/5 border border-accent/40 text-blue-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-accent transition-all font-bold italic"
                                        value={pendingRole}
                                        onChange={(e) => { setPendingRole(e.target.value); setHasUnsavedChanges(true); }}
                                    >
                                        <option value="" className="bg-slate-900">Nenhuma</option>
                                        <option value="CORE" className="bg-slate-900">CORE HUB</option>
                                        <option value="BACKBONE" className="bg-slate-900">BACKBONE</option>
                                        <option value="BACKBONE_SEC" className="bg-slate-900">BACKBONE SECUNDÁRIO</option>
                                        <option value="WAN" className="bg-slate-900">INTERNET (WAN)</option>
                                        <option value="WAN_SEC" className="bg-slate-900">INTERNET SECUNDÁRIA</option>
                                        <option value="GATEWAY" className="bg-slate-900">FIREWALL / GATEWAY</option>
                                        <option value="ACCESS" className="bg-slate-900">ACESSO</option>
                                        <option value="ACCESS_SEC" className="bg-slate-900">ACESSO SECUNDÁRIO</option>
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <label className="text-[8px] text-secondary font-bold uppercase tracking-widest px-2 block flex-1">Conexão:</label>
                                        <label className="text-[8px] text-secondary font-bold uppercase tracking-widest px-2 block flex-1">Velocidade:</label>
                                    </div>
                                    <div className="flex gap-2">
                                        <select
                                            className="w-2/3 bg-white/5 border border-white/5 text-slate-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-accent transition-all font-bold"
                                            value={pendingParentId || 'null'}
                                            onChange={(e) => { setPendingParentId(e.target.value === 'null' ? '' : e.target.value); setHasUnsavedChanges(true); }}
                                        >
                                            <option value="null" className="bg-slate-900">Uplink 1 (Principal)</option>
                                            {devices
                                                .filter((d: any) => {
                                                    const type = d.type?.toLowerCase();
                                                    const name = (d.name || d.label || '').toUpperCase();
                                                    const role = d.topologyRole || (
                                                        (name.includes('WAN') || name.includes('INTERNET')) ? 'WAN' :
                                                        (name.includes('CORE')) ? 'CORE' :
                                                        (name.includes('BACKBONE')) ? 'BACKBONE' :
                                                        (name.includes('GATEWAY') || name.includes('FIREWALL')) ? 'GATEWAY' : null
                                                    );
                                                    return (['switch', 'router', 'firewall', 'gateway', 'access_point', 'voip', 'nas'].includes(type) || !!role) && d.id !== (selectedDevice as any).id;
                                                })
                                                .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
                                                .map((sw: any) => (
                                                    <option key={sw.id} value={sw.id} className="bg-slate-900">{sw.name} ({sw.ip})</option>
                                                ))}
                                        </select>

                                        <select
                                            className="w-1/3 bg-white/5 border border-white/5 text-slate-200 rounded-xl px-2 py-2 text-[10px] outline-none focus:border-accent transition-all font-bold"
                                            value={pendingPortSpeed}
                                            onChange={(e) => { setPendingPortSpeed(e.target.value); setHasUnsavedChanges(true); }}
                                        >
                                            <option value="40G" className="bg-slate-900 text-green-500 font-bold">40G</option>
                                            <option value="10G" className="bg-slate-900 text-accent font-bold">10G</option>
                                            <option value="1G" className="bg-slate-900 text-yellow-500 font-bold">1G</option>
                                            <option value="100M" className="bg-slate-900 text-orange-500 font-bold">100M</option>
                                            <option value="Wireless" className="bg-slate-900 text-purple-500 font-bold">Wifi</option>
                                        </select>
                                    </div>

                                    {/* Additional Parents (Multi-Uplink) */}
                                    <div className="space-y-2 mt-2">
                                        {pendingAdditionalParents.map((apId, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <select
                                                    className="flex-1 bg-white/5 border border-white/5 text-slate-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-accent transition-all font-bold"
                                                    value={apId || 'null'}
                                                    onChange={(e) => {
                                                        const newVal = e.target.value === 'null' ? '' : e.target.value;
                                                        const next = [...pendingAdditionalParents];
                                                        next[idx] = newVal;
                                                        setPendingAdditionalParents(next);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                >
                                                    <option value="null" className="bg-slate-900">Uplink {idx + 2}</option>
                                                    {devices
                                                        .filter((d: any) => {
                                                            const type = d.type?.toLowerCase();
                                                            const name = (d.name || d.label || '').toUpperCase();
                                                            const role = d.topologyRole || (
                                                                (name.includes('WAN') || name.includes('INTERNET')) ? 'WAN' :
                                                                (name.includes('CORE')) ? 'CORE' :
                                                                (name.includes('BACKBONE')) ? 'BACKBONE' :
                                                                (name.includes('GATEWAY') || name.includes('FIREWALL')) ? 'GATEWAY' : null
                                                            );
                                                            return (['switch', 'router', 'firewall', 'gateway', 'access_point', 'voip', 'nas'].includes(type) || !!role) && 
                                                                   d.id !== (selectedDevice as any).id && 
                                                                   d.id !== pendingParentId && 
                                                                   !pendingAdditionalParents.slice(0, idx).includes(d.id);
                                                        })
                                                        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
                                                        .map((sw: any) => (
                                                            <option key={sw.id} value={sw.id} className="bg-slate-900">{sw.name} ({sw.ip})</option>
                                                        ))}
                                                </select>
                                                <button 
                                                    onClick={() => {
                                                        const next = pendingAdditionalParents.filter((_, i) => i !== idx);
                                                        setPendingAdditionalParents(next);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="p-2 bg-rose-500/20 text-rose-500 rounded-xl hover:bg-rose-500/40 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}

                                        {pendingAdditionalParents.length < 3 && (
                                            <button
                                                onClick={() => {
                                                    setPendingAdditionalParents([...pendingAdditionalParents, '']);
                                                }}
                                                className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 border border-dashed border-white/10 rounded-xl text-[10px] text-secondary/70 font-bold uppercase hover:bg-white/10 transition-all mt-1"
                                            >
                                                <Plus size={12} /> Adicionar Uplink Especial
                                            </button>
                                        )}
                                    </div>
                                    {hasUnsavedChanges && (
                                        <button
                                            disabled={updateDevice.isLoading}
                                            onClick={() => {
                                                updateDevice.mutate({
                                                    id: (selectedDevice as any).id,
                                                    portSpeed: pendingPortSpeed,
                                                    parentId: pendingParentId || null,
                                                    topologyRole: pendingRole || null,
                                                    additionalParents: pendingAdditionalParents.filter(id => !!id),
                                                }, {
                                                    onSuccess: () => {
                                                        alert('Alterações salvas com sucesso!');
                                                        setHasUnsavedChanges(false);
                                                    },
                                                    onError: (err: any) => {
                                                        console.error('Erro ao salvar alterações:', err);
                                                        alert('Erro ao salvar alterações. Verifique o console.');
                                                    }
                                                });
                                            }}
                                            className={`w-full mt-2 ${updateDevice.isLoading ? 'bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-500'} text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2`}
                                        >
                                            {updateDevice.isLoading ? 'Salvando...' : 'Salvar Alterações'}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}


                        <div className="pt-2 space-y-2">
                            <button onClick={() => setEditingNodeId(selectedNodeId)} className="w-full bg-[#2b2b2b] hover:bg-[#3b3b3b] text-white font-black italic py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all">
                                Editar Ativo
                            </button>
                            {selectedDevice.agentId && (
                                <button
                                    onClick={() => setRemoteAgentId(selectedDevice.agentId || null)}
                                    className="w-full bg-accent hover:bg-accent text-white font-black italic py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <Monitor className="w-4 h-4" />
                                    Acesso Remoto
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {remoteAgentId && <RemoteViewer agentId={remoteAgentId} mode="viewer" serverUrl={`http://${window.location.hostname}:3001`} onClose={() => setRemoteAgentId(null)} />}
            {editingNodeId && (() => {
                const node = nodes.find(n => n.id === editingNodeId);
                if (!node) return null;
                const d = node.data;
                return <DeviceEditModal deviceId={d.id} deviceName={d.label} deviceIp={d.ip || ''} deviceType={d.type as any} parentId={d.parentId} connectedPort={d.connectedPort} portSpeed={d.portSpeed} topologyRole={d.topologyRole} vlan={d.vlan ? d.vlan.toString() : undefined} purchaseValue={d.purchaseValue} onClose={() => setEditingNodeId(null)} />;
            })()}

            <style>{`
                .react-flow__edge-path {
                    stroke-dasharray: 0;
                    transition: stroke-width 0.3s, stroke 0.3s;
                }
                .react-flow__edge.selected .react-flow__edge-path {
                    stroke: #3b82f6 !important;
                    stroke-width: 6 !important;
                }
                .react-flow__edge-path-wireless {
                    stroke-dasharray: 5,5;
                }
                .react-flow__controls {
                    box-shadow: none;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .react-flow__controls-button {
                    background: rgba(0,0,0,0.6) !important;
                    border-bottom: 1px solid rgba(255,255,255,0.05) !important;
                    fill: #94a3b8 !important;
                }
                .react-flow__controls-button:hover {
                    background: rgba(0,0,0,0.8) !important;
                    fill: white !important;
                }
                .react-flow__handle {
                    width: 8px;
                    height: 8px;
                    background: #3b82f6;
                }
            `}</style>
        </div>
    );
}
