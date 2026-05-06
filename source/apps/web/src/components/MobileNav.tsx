import { motion } from 'framer-motion';
import { Home, TrendingUp, Plus, Bell, Menu } from 'lucide-react';
import { type Tab } from './Layout';

interface MobileNavProps {
    currentTab: Tab;
    onNavigate: (tab: Tab) => void;
    onQuickAction: () => void;
}

export function MobileNav({ currentTab, onNavigate, onQuickAction }: MobileNavProps) {
    const navItems = [
        { id: 'dashboard' as Tab, label: 'Home', icon: Home },
        { id: 'graficos' as Tab, label: 'Gráficos', icon: TrendingUp },
        { id: 'plus' as const, label: '', icon: Plus, isAction: true },
        { id: 'alerts' as Tab, label: 'Alertas', icon: Bell },
        { id: 'menu' as const, label: 'Menu', icon: Menu, isMenu: true }
    ];

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-6 pt-2 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-2xl border border-white/5 rounded-[2rem] h-20 flex items-center justify-around px-2 shadow-2xl pointer-events-auto relative overflow-hidden">
                {/* Subtle top glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;

                    if (item.isAction) {
                        return (
                            <motion.button
                                key={item.id}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={onQuickAction}
                                className="relative -top-10 w-16 h-16 bg-accent rounded-full flex items-center justify-center shadow-xl shadow-accent/20 border-4 border-black group"
                            >
                                <Icon className="w-8 h-8 text-white group-hover:rotate-90 transition-transform duration-300" />
                                <div className="absolute inset-0 rounded-full animate-ping bg-accent/20 -z-10" />
                            </motion.button>
                        );
                    }

                    return (
                        <button
                            key={item.id}
                            onClick={() => !item.isMenu && onNavigate(item.id as Tab)}
                            className="flex flex-col items-center gap-1 group relative py-2"
                        >
                            <div className={`p-2 rounded-xl transition-all ${isActive ? 'text-accent' : 'text-secondary group-hover:text-main'}`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            {item.label && (
                                <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? 'text-accent opacity-100' : 'text-secondary opacity-40 group-hover:opacity-80'}`}>
                                    {item.label}
                                </span>
                            )}
                            
                            {isActive && (
                                <motion.div 
                                    layoutId="mobile-nav-indicator"
                                    className="absolute -top-2 w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_rgb(var(--accent))]"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
