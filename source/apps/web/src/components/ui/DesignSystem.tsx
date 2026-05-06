import { ReactNode } from 'react';
import { LucideIcon, Loader2, X, Search } from 'lucide-react';

/**
 * Design System Components for IronGrid
 * Reusable UI components for consistent design across the application
 */

// ============================================================================
// FORM CARD - Standardized form container
// ============================================================================
interface FormCardProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    iconColor?: string;
    children: ReactNode;
    onClose?: () => void;
    className?: string;
}

export function FormCard({ title, subtitle, icon: Icon, iconColor = 'text-accent', children, onClose, className = '' }: FormCardProps) {
    return (
        <div className={`bg-page/50 border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden group ${className}`}>
            {Icon && (
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Icon className={`w-24 h-24 ${iconColor}`} />
                </div>
            )}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-black text-main italic">{title}</h3>
                    {subtitle && <p className="text-xs text-secondary font-medium mt-1">{subtitle}</p>}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-secondary hover:text-main dark:hover:text-white transition-colors p-2 hover:bg-white/10 dark:hover:bg-slate-800 rounded-xl"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

// ============================================================================
// LIST CARD - Standardized list item
// ============================================================================
interface ListCardProps {
    icon?: LucideIcon;
    iconColor?: string;
    iconBg?: string;
    title: string;
    subtitle?: string | ReactNode;
    badges?: ReactNode;
    actions?: ReactNode;
    stats?: { label: string; value: string | number }[];
    onClick?: () => void;
    className?: string;
}

export function ListCard({
    icon: Icon,
    iconColor = 'text-accent',
    iconBg = 'bg-accent/10',
    title,
    subtitle,
    badges,
    actions,
    stats,
    onClick,
    className = ''
}: ListCardProps) {
    return (
        <div
            className={`flex items-center justify-between p-5 bg-card border border-border rounded-3xl group hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-lg shadow-black/5 dark:shadow-black/20 ${onClick ? 'cursor-pointer hover:scale-[1.01]' : ''} ${className}`}
            onClick={onClick}
        >
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {Icon && (
                    <div className={`w-12 h-12 ${iconBg} rounded-2xl flex items-center justify-center ${iconColor} border border-current/10 shrink-0`}>
                        <Icon className="w-6 h-6" />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h4 className="text-main font-black italic truncate">{title}</h4>
                    {subtitle && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {typeof subtitle === 'string' ? (
                                <p className="text-xs text-secondary font-medium">{subtitle}</p>
                            ) : subtitle}
                        </div>
                    )}
                    {badges && <div className="flex items-center gap-2 mt-2 flex-wrap">{badges}</div>}
                </div>
            </div>

            {stats && (
                <div className="flex items-center gap-6 mx-6">
                    {stats.map((stat, idx) => (
                        <div key={idx} className="text-right">
                            <p className="text-[10px] font-black text-secondary/70 uppercase tracking-tighter italic">{stat.label}</p>
                            <p className="text-lg font-black text-accent">{stat.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {actions && (
                <div className="flex items-center gap-1 shrink-0">
                    {actions}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// ACTION BUTTON - Consistent action buttons
// ============================================================================
interface ActionButtonProps {
    icon: LucideIcon;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg';
    tooltip?: string;
    disabled?: boolean;
}

export function ActionButton({
    icon: Icon,
    onClick,
    variant = 'secondary',
    size = 'md',
    tooltip,
    disabled = false
}: ActionButtonProps) {
    const variants = {
        primary: 'text-accent hover:bg-accent/10 dark:hover:bg-accent/10',
        secondary: 'text-secondary/70 dark:text-slate-600 hover:text-main dark:hover:text-slate-300 hover:bg-white/5 dark:hover:bg-slate-800',
        danger: 'text-rose-600 dark:text-red-500 hover:bg-rose-600/10 dark:hover:bg-red-500/10',
        success: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/10 dark:hover:bg-emerald-400/10'
    };

    const sizes = {
        sm: 'p-2',
        md: 'p-3',
        lg: 'p-4'
    };

    const iconSizes = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={tooltip}
            className={`${sizes[size]} ${variants[variant]} rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 active:scale-95`}
        >
            <Icon className={iconSizes[size]} />
        </button>
    );
}

// ============================================================================
// STATUS BADGE - Status indicators
// ============================================================================
interface StatusBadgeProps {
    label: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'sm' | 'md';
}

export function StatusBadge({ label, variant = 'default', size = 'sm' }: StatusBadgeProps) {
    const variants = {
        default: 'bg-slate-600/10 text-secondary border-slate-600/20',
        primary: 'bg-accent/10 text-accent border-accent/20',
        success: 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20',
        warning: 'bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-600/20',
        danger: 'bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/20',
        info: 'bg-accent/10 text-accent dark:text-accent border-accent/20'
    };

    const sizes = {
        sm: 'text-[8px] px-1.5 py-0.5',
        md: 'text-[10px] px-2 py-1'
    };

    return (
        <span className={`${sizes[size]} ${variants[variant]} rounded-md uppercase font-black tracking-tighter border`}>
            {label}
        </span>
    );
}

// ============================================================================
// EMPTY STATE - Empty list placeholder
// ============================================================================
interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="text-center p-12 space-y-4">
            <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center mx-auto">
                <Icon className="w-8 h-8 text-secondary/70 dark:text-slate-600" />
            </div>
            <div>
                <h3 className="text-lg font-black text-main italic">{title}</h3>
                {description && <p className="text-sm text-secondary mt-2">{description}</p>}
            </div>
            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-4 px-6 py-3 bg-accent hover:bg-accent text-white font-black rounded-2xl shadow-lg shadow-accent/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

// ============================================================================
// SEARCH BAR - Unified search component
// ============================================================================
interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Buscar...', className = '' }: SearchBarProps) {
    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/70 dark:text-slate-600" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent border border-border rounded-2xl pl-11 pr-4 py-3 text-sm text-main placeholder:text-secondary/70 dark:placeholder:text-slate-700 outline-none focus:border-accent/50 transition-all shadow-inner"
            />
        </div>
    );
}

// ============================================================================
// LOADING STATE - Loading indicator
// ============================================================================
interface LoadingStateProps {
    message?: string;
}

export function LoadingState({ message = 'Carregando...' }: LoadingStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-sm text-secondary font-medium">{message}</p>
        </div>
    );
}

// ============================================================================
// PRIMARY BUTTON - Main action button
// ============================================================================
interface PrimaryButtonProps {
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'primary' | 'success' | 'danger';
    fullWidth?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function PrimaryButton({
    children,
    onClick,
    disabled = false,
    loading = false,
    variant = 'primary',
    fullWidth = false,
    size = 'md',
    className = ''
}: PrimaryButtonProps) {
    const variants = {
        primary: 'bg-accent hover:bg-accent disabled:bg-accent shadow-accent/20',
        success: 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 shadow-emerald-500/20',
        danger: 'bg-red-600 hover:bg-red-500 disabled:bg-red-800 shadow-red-500/20'
    };

    const sizes = {
        sm: 'py-2 px-4 text-[10px]',
        md: 'py-4 px-6 text-xs',
        lg: 'py-5 px-8 text-sm'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`${fullWidth ? 'w-full' : ''} ${sizes[size]} ${variants[variant]} disabled:opacity-50 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest flex items-center justify-center gap-2 ${className}`}
        >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
}
