import React from 'react';

interface ShapeProps {
    type: string;
    color: string;
    width: number;
    height: number;
    opacity?: number;
}

export const IronGridShapes: React.FC<ShapeProps> = ({ type, color, width, height, opacity = 0.2 }) => {
    const strokeColor = color;
    const fillColor = `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
    
    // Gradiente ID Único para evitar conflitos no DOM
    const gradientId = `grad-${type}-${color.replace('#', '')}`;

    switch (type) {
        case 'cylinder':
            return (
                <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.8 }} />
                            <stop offset="50%" style={{ stopColor: '#ffffff', stopOpacity: 0.4 }} />
                            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.8 }} />
                        </linearGradient>
                    </defs>
                    {/* Corpo do Cilindro */}
                    <path 
                        d={`M 0,${height * 0.15} L 0,${height * 0.85} A ${width / 2},${height * 0.15} 0 0 0 ${width},${height * 0.85} L ${width},${height * 0.15} A ${width / 2},${height * 0.15} 0 0 1 0,${height * 0.15}`}
                        fill={`url(#${gradientId})`}
                        stroke={strokeColor}
                        strokeWidth="2"
                    />
                    {/* Topo do Cilindro */}
                    <ellipse 
                        cx={width / 2} cy={height * 0.15} rx={width / 2} ry={height * 0.15}
                        fill={color} fillOpacity="0.3"
                        stroke={strokeColor} strokeWidth="2"
                    />
                </svg>
            );

        case 'cloud':
            return (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path 
                        d="M25,60 C25,40 40,30 50,30 C60,30 75,30 75,50 C85,50 95,60 95,75 C95,90 80,100 70,100 L30,100 C15,100 5,90 5,75 C5,60 15,60 25,60 Z"
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth="2"
                        transform="scale(1, 0.8) translate(0, 15)"
                    />
                </svg>
            );

        case 'router':
            return (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                    <circle cx="50" cy="50" r="45" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
                    <path d="M50,20 L50,80 M20,50 L80,50" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
                    <path d="M40,30 L50,20 L60,30 M40,70 L50,80 L60,70 M30,40 L20,50 L30,60 M70,40 L80,50 L70,60" fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );

        case 'switch':
            return (
                <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
                    <rect x="5" y="5" width="90" height="50" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
                    <path d="M25,20 L75,40 M25,40 L75,20" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
                    <path d="M35,20 L25,20 L25,30 M65,40 L75,40 L75,30 M35,40 L25,40 L25,30 M65,20 L75,20 L75,30" fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );

        case 'firewall':
            return (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <rect x="0" y="0" width="100%" height="100%" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
                    <path d="M0,25 L100,25 M0,50 L100,50 M0,75 L100,75 M25,0 L25,25 M75,0 L75,25 M50,25 L50,50 M25,50 L25,75 M75,50 L75,75 M50,75 L50,100" stroke={strokeColor} strokeWidth="2" />
                </svg>
            );

        case 'triangle':
            return (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M50,5 L95,95 L5,95 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
                </svg>
            );

        case 'diamond':
            return (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M50,5 L95,50 L50,95 L5,50 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
                </svg>
            );

        case 'circle':
            return (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <circle cx="50" cy="50" r="45" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
                </svg>
            );

        case 'hexagon':
            return (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M25,5 L75,5 L100,50 L75,95 L25,95 L0,50 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
                </svg>
            );

        default:
            return (
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <rect x="2" y="2" width="96" height="96" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
                </svg>
            );
    }
};
