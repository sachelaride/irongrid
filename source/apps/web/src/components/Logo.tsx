import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface LogoProps {
  className?: string;
  size?: number;
  hideText?: boolean;
}

export function Logo({ className = '', size = 42, hideText = false }: LogoProps) {
  const { customStyles } = useTheme();
  
  // Simple check for light mode based on bg-main brightness
  const isLightMode = customStyles['bg-main'] === '#ffffff' || customStyles['bg-main'] === '#f8fafc';
  
  const redColor = isLightMode ? '#b91c1c' : '#ff3e3e';
  const cyanColor = isLightMode ? '#0369a1' : '#00f2ff';

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="relative group" style={{ width: size, height: size * 1.1 }}>
        {/* DISPUTE SYMBOL: CYAN VS RED */}
        <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-all group-hover:scale-110">
          {/* Circular Rings (Dispute) */}
          <path d="M100 40 A 60 60 0 0 0 100 160" stroke={cyanColor} strokeWidth="16" strokeLinecap="round" className="drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
          <path d="M100 40 A 60 60 0 0 1 100 160" stroke={redColor} strokeWidth="16" strokeLinecap="round" className="drop-shadow-[0_0_10px_rgba(255,62,62,0.5)]" />
          
          {/* Inner Cross Structure */}
          <rect x="94" y="20" width="12" height="180" fill={isLightMode ? '#0f172a' : 'white'} rx="6" opacity="0.9" />
          <rect x="50" y="94" width="100" height="12" fill={isLightMode ? '#0f172a' : 'white'} rx="6" opacity="0.9" />

          {/* Glow Overlays for the split */}
          <rect x="94" y="20" width="6" height="180" fill={cyanColor} opacity="0.6" rx="3" />
          <rect x="100" y="20" width="6" height="180" fill={redColor} opacity="0.6" rx="3" />
          
          <rect x="50" y="94" width="50" height="12" fill={cyanColor} opacity="0.6" rx="3" />
          <rect x="100" y="94" width="50" height="12" fill={redColor} opacity="0.6" rx="3" />

          {/* Center Core (The Grid Heart) */}
          <circle cx="100" cy="100" r="14" fill={isLightMode ? '#0f172a' : 'white'} className="animate-pulse shadow-glow" />
          <circle cx="100" cy="100" r="20" stroke={isLightMode ? '#0f172a' : 'white'} strokeWidth="2" opacity="0.5" />
          <circle cx="100" cy="100" r="30" stroke={cyanColor} strokeWidth="1" opacity="0.2" className="animate-ping" />
        </svg>
      </div>
      
      {!hideText && (
        <div className="flex flex-col -space-y-1">
          <span className="text-3xl font-black italic tracking-[-0.08em] uppercase flex items-center leading-none" 
                style={{ 
                  fontFamily: '"Orbitron", "Inter", sans-serif',
                }}>
            <span style={{ 
              color: redColor,
              textShadow: isLightMode ? 'none' : '0 0 10px rgba(255,62,62,0.5), 0 0 20px rgba(255,62,62,0.3)'
            }}>IRON</span>
            <span className="ml-1 italic" style={{ 
              color: cyanColor,
              textShadow: isLightMode ? 'none' : '0 0 10px rgba(0,242,255,0.5), 0 0 20px rgba(0,242,255,0.3)'
            }}>GRID</span>
          </span>
          <span className="text-[9px] font-black text-secondary tracking-[0.5em] uppercase opacity-70 ml-1">SECURITY SUITE</span>
        </div>
      )}
    </div>
  );
}
