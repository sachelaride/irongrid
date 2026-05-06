import React from 'react';
import { trpc } from '../../utils/trpc';

interface CustomMapLineProps {
    edge: any;
    sourceNode: any;
    targetNode: any;
    draggedNodes: Record<string, { x: number, y: number }>;
    onClick?: () => void;
    index?: number;
    total?: number;
    edgeStyle?: 'curved' | 'straight' | 'step';
    pollInterval?: number;
}

export const CustomMapLine: React.FC<CustomMapLineProps> = ({ 
    edge, 
    sourceNode, 
    targetNode, 
    draggedNodes,
    onClick,
    index = 0,
    total = 1,
    edgeStyle = 'curved',
    pollInterval = 5000
}) => {
    // Current positions (accounting for real-time drag)
    const sX = (draggedNodes[sourceNode.id]?.x ?? sourceNode.x) + 50;
    const sY = (draggedNodes[sourceNode.id]?.y ?? sourceNode.y) + 44;
    const tX = (draggedNodes[targetNode.id]?.x ?? targetNode.x) + 50;
    const tY = (draggedNodes[targetNode.id]?.y ?? targetNode.y) + 44;

    // Fetch bandwidth from source or target depending on which is configured
    const monitoringSource = edge.sourcePort ? { deviceId: sourceNode.deviceId, port: edge.sourcePort } : 
                             edge.targetPort ? { deviceId: targetNode.deviceId, port: edge.targetPort } : 
                             null;

    const { data: bandwidth } = trpc.customMaps.getPortBandwidth.useQuery(
        { deviceId: monitoringSource?.deviceId ?? '', portName: monitoringSource?.port ?? '' },
        { 
            enabled: !!monitoringSource,
            refetchInterval: pollInterval
        }
    );

    const { data: interfaces } = (trpc as any).customMaps.getDeviceInterfaces.useQuery(
        { deviceId: monitoringSource?.deviceId ?? '' },
        { enabled: !!monitoringSource }
    );

    const interfaceInfo = (interfaces as any[])?.find((i: any) => i.name === monitoringSource?.port);

    // Calculate curve or straight line
    const isMultiple = total > 1;
    const midX = (sX + tX) / 2;
    const midY = (sY + tY) / 2;
    
    let pathData = `M ${sX} ${sY} L ${tX} ${tY}`;
    let labelX = midX;
    let labelY = midY;

    if (edgeStyle === 'curved') {
        if (isMultiple) {
            const dx = tX - sX;
            const dy = tY - sY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const offset = (index - (total - 1) / 2) * 80;
            const ctrlX = midX + nx * offset;
            const ctrlY = midY + ny * offset;
            
            pathData = `M ${sX} ${sY} Q ${ctrlX} ${ctrlY} ${tX} ${tY}`;
            
            const t = total > 1 ? 0.3 + (index / (total - 1)) * 0.4 : 0.5;
            const invT = 1 - t;
            labelX = invT * invT * sX + 2 * invT * t * ctrlX + t * t * tX;
            labelY = invT * invT * sY + 2 * invT * t * ctrlY + t * t * tY;
        }
    } else if (edgeStyle === 'straight') {
        if (isMultiple) {
            const dx = tX - sX;
            const dy = tY - sY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const offset = (index - (total - 1) / 2) * 20; // smaller offset to look cleaner near nodes
            const pSX = sX + nx * offset;
            const pSY = sY + ny * offset;
            const pTX = tX + nx * offset;
            const pTY = tY + ny * offset;
            // Line from center -> offset parallel start -> offset parallel end -> center
            pathData = `M ${sX} ${sY} L ${pSX} ${pSY} L ${pTX} ${pTY} L ${tX} ${tY}`;
            const t = total > 1 ? 0.3 + (index / (total - 1)) * 0.4 : 0.5;
            labelX = pSX + (pTX - pSX) * t;
            labelY = pSY + (pTY - pSY) * t;
        }
    } else if (edgeStyle === 'step') {
        if (isMultiple) {
            const dx = tX - sX;
            const dy = tY - sY;
            const offX = (index - (total - 1) / 2) * 20;
            const offY = (index - (total - 1) / 2) * 20;
            
            const t = total > 1 ? 0.3 + (index / (total - 1)) * 0.4 : 0.5;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                const medX = midX + offX;
                const syo = sY + offY;
                const tyo = tY + offY;
                pathData = `M ${sX} ${sY} L ${sX} ${syo} L ${medX} ${syo} L ${medX} ${tyo} L ${tX} ${tyo} L ${tX} ${tY}`;
                labelX = medX;
                labelY = syo + (tyo - syo) * t;
            } else {
                const medY = midY + offY;
                const sxo = sX + offX;
                const txo = tX + offX;
                pathData = `M ${sX} ${sY} L ${sxo} ${sY} L ${sxo} ${medY} L ${txo} ${medY} L ${txo} ${tY} L ${tX} ${tY}`;
                labelX = sxo + (txo - sxo) * t;
                labelY = medY;
            }
        } else {
            const dx = tX - sX;
            const dy = tY - sY;
            if (Math.abs(dx) > Math.abs(dy)) {
                pathData = `M ${sX} ${sY} L ${midX} ${sY} L ${midX} ${tY} L ${tX} ${tY}`;
            } else {
                pathData = `M ${sX} ${sY} L ${sX} ${midY} L ${tX} ${midY} L ${tX} ${tY}`;
            }
        }
    }

    const bps = (() => {
        if (!bandwidth) return 0;
        const valIn = bandwidth.in || 0;
        const valOut = bandwidth.out || 0;
        return Math.max(valIn, valOut) * 8;
    })();

    const formatRate = (rate: number) => {
        if (rate >= 1000 * 1000 * 1000) return (rate / (1000 * 1000 * 1000)).toFixed(1) + ' Gb';
        if (rate >= 1000 * 1000) return (rate / (1000 * 1000)).toFixed(1) + ' Mb';
        if (rate >= 1000) return (rate / 1000).toFixed(0) + ' Kb';
        return rate.toFixed(0) + ' b';
    };

    const tooltipText = (() => {
        if (!monitoringSource) return 'Link não configurado';
        const portId = monitoringSource.port;
        const desc = interfaceInfo?.description;
        const alias = interfaceInfo?.alias;
        
        let displayDesc = desc || alias;
        
        if (displayDesc && displayDesc.trim().length > 0) {
            return `${displayDesc} (${portId})`;
        }
        return portId;
    })();

    return (
        <g 
            className="cursor-pointer group" 
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        >
            <title>{tooltipText}</title>
            {/* Hit area (invisible thicker path for easier clicking) */}
            <path 
                d={pathData}
                stroke="transparent" 
                strokeWidth="30" 
                fill="none"
                className="pointer-events-auto"
            />
            
            {/* The visible path */}
            <path 
                d={pathData}
                stroke={monitoringSource ? "#3b82f6" : "#4b5563"} 
                strokeWidth={monitoringSource ? (isMultiple ? "5" : "4") : "2"}
                fill="none"
                className={`${monitoringSource ? "animate-pulse" : "transition-all"} group-hover:stroke-blue-400 group-hover:stroke-[6] drop-shadow-sm`}
            />

            {/* Traffic Label (Compact Style) */}
            {monitoringSource && (bandwidth?.in !== undefined || bandwidth?.out !== undefined) && (
                <g transform={`translate(${labelX}, ${labelY})`}>
                    <rect 
                        x="-30" y="-10" width="60" height="20" 
                        rx="10" 
                        fill="#10b981" 
                        className="shadow-xl"
                    />
                    <text 
                        textAnchor="middle" 
                        dominantBaseline="middle"
                        fill="white" 
                        fontSize="10"
                        fontWeight="950"
                        style={{ userSelect: 'none', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}
                    >
                        {formatRate(bps)}
                    </text>
                </g>
            )}
        </g>
    );
};
