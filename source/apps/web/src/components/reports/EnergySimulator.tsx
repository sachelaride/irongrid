import { Zap, Leaf, TrendingUp, CreditCard } from 'lucide-react';

interface EnergySimulatorProps {
    totalWatts: number;
    monthlyKwh: number;
    monthlyCost: number;
    savings: number;
}

export function EnergySimulator({ totalWatts, monthlyKwh, monthlyCost, savings }: EnergySimulatorProps) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const metrics = [
        { label: 'Carga Total', value: `${totalWatts.toFixed(0)}W`, sub: 'Consumo instantâneo', icon: Zap, color: 'text-amber-500' },
        { label: 'Consumo Mensal', value: `${monthlyKwh.toFixed(1)} kWh`, sub: 'Estimativa baseada em 24h', icon: TrendingUp, color: 'text-accent' },
        { label: 'Custo Mensal', value: formatCurrency(monthlyCost), sub: 'Tarifa média R$ 0,85/kWh', icon: CreditCard, color: 'text-rose-500' },
        { label: 'Potencial Economia', value: formatCurrency(savings), sub: 'Meta de redução (15%)', icon: Leaf, color: 'text-emerald-500' },
    ];

    return (
        <div className="bg-page/50 border border-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <Zap className="w-48 h-48 text-amber-500" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-amber-500/10 rounded-2xl">
                        <Leaf className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-main italic uppercase tracking-tighter">Sustentabilidade Energética</h3>
                        <p className="text-sm text-secondary font-medium">Análise de eficiência e impacto ambiental do parque computacional</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {metrics.map((m, idx) => {
                        const Icon = m.icon;
                        return (
                            <div key={idx} className="bg-card border border-border p-6 rounded-2xl shadow-lg group hover:scale-[1.05] transition-all">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-xl bg-current/10 ${m.color}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] font-black text-secondary/70 uppercase tracking-widest italic">{m.label}</span>
                                </div>
                                <p className="text-2xl font-black text-main italic mb-1">{m.value}</p>
                                <p className="text-[10px] font-medium text-secondary italic">{m.sub}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 bg-accent/5 dark:bg-accent/5 border border-accent/10 dark:border-accent/10 rounded-2xl">
                    <div className="flex items-start gap-4">
                        <TrendingUp className="w-6 h-6 text-accent shrink-0 mt-1" />
                        <div>
                            <p className="text-sm font-black text-main mb-2 italic uppercase">Dica de Eficiência</p>
                            <p className="text-xs text-secondary leading-relaxed font-medium">
                                A substituição de dispositivos com mais de 5 anos por novos modelos com certificação ENERGY STAR pode reduzir o consumo total em até <span className="text-emerald-500 font-black italic">22%</span>, com ROI financeiro estimado em <span className="text-emerald-500 font-black italic">14 meses</span> apenas na economia de energia.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
