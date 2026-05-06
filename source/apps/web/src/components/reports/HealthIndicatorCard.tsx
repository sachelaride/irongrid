import { LucideIcon } from 'lucide-react';

interface HealthIndicatorCardProps {
    title: string;
    value: number;
    icon: LucideIcon;
    color: string;
    description: string;
}

export function HealthIndicatorCard({ title, value, icon: Icon, color, description }: HealthIndicatorCardProps) {
    const percentage = Math.min(100, Math.max(0, value));

    return (
        <div className="bg-card border border-border rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all">
            <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
                <Icon className="w-24 h-24" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-xl ${color.replace('text-', 'bg-')}/10 ${color}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-black text-secondary uppercase tracking-tighter italic">{title}</h3>
                </div>

                <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-black text-main italic">{percentage}%</span>
                    <span className="text-xs font-medium text-secondary/70 mb-1">{description}</span>
                </div>

                <div className="w-full h-3 bg-card rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ease-out rounded-full ${color.replace('text-', 'bg-')}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                <div className="flex justify-between mt-2">
                    <span className="text-[10px] font-black text-secondary/70 italic">CONFORMIDADE</span>
                    <span className={`text-[10px] font-black italic ${percentage > 90 ? 'text-emerald-500' : percentage > 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {percentage > 90 ? 'EXCELENTE' : percentage > 70 ? 'ACEITÁVEL' : 'CRÍTICO'}
                    </span>
                </div>
            </div>
        </div>
    );
}
