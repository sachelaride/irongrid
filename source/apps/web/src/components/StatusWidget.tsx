import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

interface StatusWidgetProps {
    title: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
    icon: LucideIcon;
    color?: 'blue' | 'green' | 'red' | 'yellow';
}

export function StatusWidget({ title, value, icon: Icon, color = 'blue', trend, trendUp }: StatusWidgetProps) {
    const colorStyles: any = {
        blue: 'text-accent bg-accent/20 border-accent/30 shadow-accent/10',
        green: 'text-success bg-success/20 border-success/30 shadow-success/10',
        red: 'text-error bg-error/20 border-error/30 shadow-error/10',
        yellow: 'text-warning bg-warning/20 border-warning/30 shadow-warning/10',
    };

    return (
        <motion.div 
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="group relative bg-card/80 backdrop-blur-3xl border border-border/50 rounded-2xl p-6 transition-all shadow-2xl hover:border-accent/30"
        >
            {/* Subtle inner glow based on status color */}
            <div className={`absolute top-0 left-0 w-1 h-12 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-xl ${colorStyles[color].split(' ')[0]}`} />

            <div className="flex flex-col gap-6 relative z-10">
                <div className={twMerge("w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:neon-glow", colorStyles[color])}>
                    <Icon size={20} />
                </div>
                
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] opacity-70 group-hover:opacity-100 transition-opacity">
                        {title}
                    </p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-white tracking-tighter italic">
                            {value}
                        </p>
                        {trend && (
                            <span className={clsx("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ml-auto",
                                trendUp ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                            )}>
                                {trend}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
