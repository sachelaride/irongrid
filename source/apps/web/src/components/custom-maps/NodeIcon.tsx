import React from 'react';
interface NodeIconProps {
    type: string;
    size?: number;
    className?: string;
}

export const NodeIcon: React.FC<NodeIconProps> = ({ type, size = 24, className = "" }) => {
    const getIconPath = (t: string) => {
        switch (t.toLowerCase()) {
            case 'internet': return '/icons/topology/internet.png';
            case 'router':
            case 'gateway': return '/icons/topology/router.png';
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
            src={`${getIconPath(type)}?v=1`}
            className={className}
            style={{ width: size, height: size, objectFit: 'contain' }}
            alt={type}
        />
    );
};
