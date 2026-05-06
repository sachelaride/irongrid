import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
    time: string;
    value: number;
}

interface MetricChartProps {
    data: DataPoint[];
    color?: string;
    unit?: string;
    title?: string;
}

export function MetricChart({ data, color = '#3b82f6', unit = '', title }: MetricChartProps) {
    return (
        <div className="w-full h-full flex flex-col">
            {title && <h4 className="text-secondary/70 text-sm font-medium mb-2">{title}</h4>}
            <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id={`color-${color}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis
                            dataKey="time"
                            tick={{ fill: '#ffffff', fontSize: 10, fontWeight: '900' }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            tick={{ fill: '#ffffff', fontSize: 10, fontWeight: '900' }}
                            tickLine={false}
                            axisLine={false}
                            unit={unit}
                        />
                        <Tooltip
                            contentStyle={{ 
                                backgroundColor: 'rgba(10, 11, 16, 0.9)', 
                                border: `1px solid ${color}`,
                                borderRadius: '16px',
                                fontSize: '11px',
                                fontWeight: '900',
                                backdropFilter: 'blur(10px)',
                                boxShadow: `0 0 15px ${color}33`,
                                textTransform: 'uppercase'
                            }}
                            itemStyle={{ color: color }}
                            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill={`url(#color-${color})`}
                            filter="url(#glow)"
                            animationDuration={1000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
