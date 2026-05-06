import { useState, useEffect, useRef } from 'react';
import { trpc } from '../utils/trpc';
import { Search, Laptop, User, MapPin, Users, X, Command } from 'lucide-react';

export function GlobalSearch() {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const { data: results, isLoading } = trpc.search.globalSearch.useQuery(
        { query },
        { enabled: query.length >= 2, placeholderData: { devices: [], users: [], locations: [], departments: [] } }
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const hasResults = results && (
        results.devices.length > 0 ||
        results.users.length > 0 ||
        results.locations.length > 0 ||
        results.departments.length > 0
    );

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 bg-card/50 border border-border px-4 py-2 rounded-xl text-secondary hover:text-main transition-all group"
            >
                <Search className="w-4 h-4 group-hover:text-accent transition-colors" />
                <span className="text-xs font-medium pr-12">Busca global...</span>
                <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-border rounded border border-border text-[8px] font-bold text-secondary">
                    <Command className="w-2 h-2" /> K
                </kbd>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-start justify-center pt-20 p-4">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Modal */}
                    <div className="relative w-full max-w-xl bg-page border border-border rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-accent/10">
                        <div className="p-6 border-b border-border flex items-center gap-4 bg-card/30">
                            <Search className="w-6 h-6 text-accent" />
                            <input
                                autoFocus
                                placeholder="Nome, IP, Departamento, Unidade..."
                                className="flex-1 bg-transparent border-none outline-none text-main placeholder:text-secondary/50 font-medium text-lg"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-page rounded-xl transition-all"
                            >
                                <X className="w-5 h-5 text-secondary hover:text-main" />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                            {isLoading && query.length >= 2 && (
                                <div className="p-12 text-center text-secondary italic text-sm">Buscando na rede...</div>
                            )}

                            {!isLoading && query.length >= 2 && !hasResults && (
                                <div className="p-12 text-center text-secondary italic text-sm">Nenhum resultado encontrado.</div>
                            )}

                            {query.length < 2 && (
                                <div className="p-12 text-center text-secondary/60 text-xs font-bold uppercase tracking-widest">
                                    Digite pelo menos 2 caracteres para pesquisar...
                                </div>
                            )}

                            {results && (
                                <div className="space-y-6 px-2">
                                    <SearchSection title="Dispositivos" items={results.devices} icon={Laptop} />
                                    <SearchSection title="Localidades" items={results.locations} icon={MapPin} />
                                    <SearchSection title="Departamentos" items={results.departments} icon={Users} />
                                    <SearchSection title="Usuários" items={results.users} icon={User} />
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-border bg-card/50 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                            <span className="text-secondary/40">IronGrid Intelligence</span>
                            <div className="flex gap-4">
                                <span className="text-secondary italic flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 bg-page border border-border rounded text-[8px]">ESC</span>
                                    fechar
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

function SearchSection({ title, items, icon: Icon }: any) {
    if (!items || items.length === 0) return null;

    return (
        <div className="space-y-1">
            <h4 className="px-2 text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Icon className="w-3 h-3" /> {title}
            </h4>
            <div className="space-y-0.5">
                {items.map((item: any) => (
                    <button
                        key={item.id}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 dark:hover:bg-slate-900 transition-colors group flex items-start flex-col"
                        onClick={() => {
                            // TODO: Implementar navegação ou foco no item
                            console.log('Selecionado:', item);
                        }}
                    >
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-accent dark:group-hover:text-accent transition-colors">{item.name}</span>
                        {item.ipAddress && <span className="text-[10px] font-mono text-secondary leading-none">{item.ipAddress}</span>}
                        {item.location && <span className="text-[9px] text-accent dark:text-accent leading-none font-bold italic">{item.location.name}</span>}
                        {item.department && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 leading-none font-bold italic">{item.location?.name} › {item.department.name}</span>}
                    </button>
                ))}
            </div>
        </div>
    );
}
