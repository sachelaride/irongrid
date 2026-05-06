import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { X, RotateCcw, Palette, Check, Layout, Sidebar, CreditCard, Type, Square, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DESIGN_TOKENS = [
    { key: 'bg-main', label: 'Fundo Principal', icon: Layout, category: 'Superfícies' },
    { key: 'bg-sidebar', label: 'Menu Lateral', icon: Sidebar, category: 'Superfícies' },
    { key: 'card', label: 'Cards & Painéis', icon: CreditCard, category: 'Superfícies' },
    { key: 'text-primary', label: 'Texto Principal', icon: Type, category: 'Tipografia' },
    { key: 'text-secondary', label: 'Texto Secundário', icon: Type, category: 'Tipografia' },
    { key: 'accent', label: 'Cor de Destaque', icon: Zap, category: 'Identidade' },
    { key: 'border', label: 'Bordas', icon: Square, category: 'Identidade' },
    { key: 'input-bg', label: 'Fundo de Inputs', icon: Square, category: 'Identidade' },
];

const PRESETS = [
    {
        name: 'Tron Legacy (Grid)',
        styles: {
            'bg-main': '#020617',
            'bg-sidebar': '#0a0b10',
            'card': '#14161f',
            'text-primary': '#ffffff',
            'text-secondary': '#94a3b8',
            'accent': '#00f2ff',
            'border': '#1e212d',
            'input-bg': '#020617'
        }
    },
    {
        name: 'Cyber Neon',
        styles: {
            'bg-main': '#020617',
            'bg-sidebar': '#0f172a',
            'card': '#1e293b',
            'text-primary': '#f8fafc',
            'text-secondary': '#94a3b8',
            'accent': '#f472b6',
            'border': '#334155',
            'input-bg': '#0f172a'
        }
    },
    {
        name: 'Matrix Emerald',
        styles: {
            'bg-main': '#020617',
            'bg-sidebar': '#052e16',
            'card': '#064e3b',
            'text-primary': '#34d399',
            'text-secondary': '#6ee7b7',
            'accent': '#10b981',
            'border': '#065f46',
            'input-bg': '#020617'
        }
    },
    {
        name: 'Royal Blue',
        styles: {
            'bg-main': '#020617',
            'bg-sidebar': '#0f172a',
            'card': '#1e293b',
            'text-primary': '#f8fafc',
            'text-secondary': '#94a3b8',
            'accent': '#38bdf8',
            'border': '#334155',
            'input-bg': '#0f172a'
        }
    },
    {
        name: 'Light Corporate',
        styles: {
            'bg-main': '#ffffff',
            'bg-sidebar': '#f8fafc',
            'card': '#ffffff',
            'text-primary': '#0f172a',
            'text-secondary': '#475569',
            'accent': '#2563eb',
            'border': '#e2e8f0',
            'input-bg': '#f1f5f9'
        }
    }
];

export function ThemeDesigner({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { customStyles, updateCustomStyle, resetCustomStyles } = useTheme();
    const [activeTab, setActiveTab] = useState<'colors' | 'presets'>('colors');

    // Helper to get current color (either custom or from CSS variable)
    const getColor = (key: string) => {
        if (customStyles[key]) return customStyles[key];
        // Fallback to reading from computed style if possible, or use a default map
        return '#000000'; 
    };

    const applyPreset = (preset: typeof PRESETS[0]) => {
        Object.entries(preset.styles).forEach(([key, value]) => {
            updateCustomStyle(key, value);
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" 
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-card border-l border-border shadow-2xl z-[101] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border flex justify-between items-center bg-page/50 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-accent/20 rounded-xl">
                                    <Palette className="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-main uppercase tracking-tight italic">Personalizar Estilo</h2>
                                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Interface Engine v2.0</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-secondary" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-border">
                            <button 
                                onClick={() => setActiveTab('colors')}
                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'colors' ? 'text-accent border-b-2 border-accent' : 'text-secondary hover:text-white'}`}
                            >
                                Cores Customizadas
                            </button>
                            <button 
                                onClick={() => setActiveTab('presets')}
                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'presets' ? 'text-accent border-b-2 border-accent' : 'text-secondary hover:text-white'}`}
                            >
                                Temas Prontos
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {activeTab === 'colors' ? (
                                <div className="space-y-8">
                                    {['Superfícies', 'Tipografia', 'Identidade'].map(cat => (
                                        <div key={cat} className="space-y-4">
                                            <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] border-b border-border pb-2">
                                                {cat}
                                            </h3>
                                            <div className="grid gap-4">
                                                {DESIGN_TOKENS.filter(t => t.category === cat).map(token => (
                                                    <div key={token.key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-accent/30 transition-all group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-page rounded-lg group-hover:bg-accent/10 transition-colors">
                                                                <token.icon className="w-4 h-4 text-secondary group-hover:text-accent" />
                                                            </div>
                                                            <span className="text-xs font-bold text-main uppercase tracking-wide">{token.label}</span>
                                                        </div>
                                                        <div className="relative flex items-center">
                                                            <input 
                                                                type="color" 
                                                                value={getColor(token.key)}
                                                                onChange={(e) => updateCustomStyle(token.key, e.target.value)}
                                                                className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer p-0 overflow-hidden"
                                                            />
                                                            <div 
                                                                className="absolute inset-0 rounded-lg pointer-events-none border border-white/20"
                                                                style={{ backgroundColor: getColor(token.key) }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {PRESETS.map(preset => (
                                        <button
                                            key={preset.name}
                                            onClick={() => applyPreset(preset)}
                                            className="p-4 rounded-2xl border border-border bg-white/5 hover:border-accent hover:bg-accent/5 transition-all text-left group"
                                        >
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-sm font-black text-main uppercase italic">{preset.name}</span>
                                                <div className="flex -space-x-2">
                                                    {['bg-main', 'accent', 'text-primary'].map(k => (
                                                        <div 
                                                            key={k}
                                                            className="w-4 h-4 rounded-full border border-black/50"
                                                            style={{ backgroundColor: (preset.styles as any)[k] }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <div className="h-2 w-12 rounded bg-accent group-hover:w-16 transition-all" />
                                                <div className="h-2 w-full rounded bg-white/10" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-border bg-page/50 backdrop-blur-md flex gap-3">
                            <button 
                                onClick={resetCustomStyles}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-secondary hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-white/5"
                            >
                                <RotateCcw className="w-4 h-4" /> Resetar Tudo
                            </button>
                            <button 
                                onClick={onClose}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-black font-black uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                <Check className="w-4 h-4" /> Concluir
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
