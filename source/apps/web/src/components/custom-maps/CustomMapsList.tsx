import React, { useState } from 'react';
import { trpc } from '../../utils/trpc';
import { Plus, Trash2, MapIcon, Loader2, Edit2, Copy, Check } from 'lucide-react';

interface CustomMap {
    id: string;
    name: string;
    description: string | null;
    _count: { nodes: number };
}

interface CustomMapsListProps {
    onSelectMap: (id: string) => void;
}

export function CustomMapsList({ onSelectMap }: CustomMapsListProps) {
    const utils = trpc.useContext();
    // Use any as fallback if tRPC type is still not propagating correctly in the IDE/build
    const { data: maps, isLoading } = (trpc as any).customMaps.getAll.useQuery();
    
    const [isCreating, setIsCreating] = useState(false);
    const [newMapName, setNewMapName] = useState('');
    const [newMapDesc, setNewMapDesc] = useState('');
    
    const [editingMapId, setEditingMapId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');

    const createMap = (trpc as any).customMaps.create.useMutation({
        onSuccess: () => {
            (utils as any).customMaps.getAll.invalidate();
            setIsCreating(false);
            setNewMapName('');
            setNewMapDesc('');
        }
    });

    const deleteMap = (trpc as any).customMaps.delete.useMutation({
        onSuccess: () => {
            (utils as any).customMaps.getAll.invalidate();
        }
    });

    const updateMap = (trpc as any).customMaps.update.useMutation({
        onSuccess: () => {
            (utils as any).customMaps.getAll.invalidate();
            setEditingMapId(null);
        }
    });

    const duplicateMap = (trpc as any).customMaps.duplicate.useMutation({
        onSuccess: () => {
            (utils as any).customMaps.getAll.invalidate();
        }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMapName.trim()) return;
        createMap.mutate({ name: newMapName, description: newMapDesc });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Meus Mapas</h2>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent text-white rounded-lg transition-colors font-medium text-sm"
                >
                    <Plus size={16} />
                    <span>Novo Mapa</span>
                </button>
            </div>

            {isCreating && (
                <div className="glass-panel p-6 rounded-xl animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold mb-4 text-main">Criar Novo Mapa</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-secondary uppercase mb-1">Nome do Mapa</label>
                            <input
                                autoFocus
                                type="text"
                                value={newMapName}
                                onChange={e => setNewMapName(e.target.value)}
                                className="w-full bg-transparent border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent text-main"
                                placeholder="Ex: Datacenter Principal"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-secondary uppercase mb-1">Descrição (Opcional)</label>
                            <input
                                type="text"
                                value={newMapDesc}
                                onChange={e => setNewMapDesc(e.target.value)}
                                className="w-full bg-transparent border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-accent text-main"
                                placeholder="Visão geral dos links de internet"
                            />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-sm text-secondary hover:bg-white/5 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={createMap.isLoading || !newMapName.trim()}
                                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent disabled:opacity-50"
                            >
                                {createMap.isLoading ? 'Criando...' : 'Criar Mapa'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(maps as CustomMap[] | undefined)?.map(map => (
                    // Verifica se o ID deste mapa bate com o estado `editingMapId`.
                    // Se sim, transforma este Card num formulário Inline Edit em vez de um Card de leitura, mantendo sem reload
                    editingMapId === map.id ? (
                        <div 
                            key={`edit-${map.id}`}
                            className="glass-panel p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col border-2 border-accent/30"
                            // e.stopPropagation garante que ao clicar dentro do formulário e dos inputs,
                            // o React não borbulhe esse evento de clique ao `<div onClick>` e force entrar no mapa inadivertidamente
                            onClick={e => e.stopPropagation()} 
                        >
                            {/* Input para o Nome do mapa com autoFocus e estado temporário 'editName' */}
                            <input
                                autoFocus
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="w-full bg-transparent border border-white/10 rounded-lg p-2 text-sm font-bold text-main mb-2 outline-none focus:border-accent transition-colors"
                                placeholder="Nome do Mapa"
                            />
                            {/* Textarea flexível para a Descrição opcional */}
                            <textarea
                                value={editDesc}
                                onChange={e => setEditDesc(e.target.value)}
                                className="w-full flex-1 bg-transparent border border-white/10 rounded-lg p-2 text-sm text-secondary mb-4 resize-none outline-none focus:border-accent transition-colors"
                                placeholder="Descrição (Opcional)"
                                rows={2}
                            />
                            {/* Grupo de botões primários de formulário (Salvar x Cancelar) e feedback de isLoading */}
                            <div className="flex items-center justify-end gap-2 mt-auto">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingMapId(null); }}
                                    className="px-3 py-1.5 text-xs text-secondary hover:bg-white/5 rounded-lg transition-colors"
                                    type="button"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!editName.trim()) return;
                                        // Dispara a mutation de tRPC que roda a query prisma.update no banco de dados SQLite remoto
                                        updateMap.mutate({ id: map.id, name: editName, description: editDesc });
                                    }}
                                    disabled={updateMap.isLoading || !editName.trim()}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    type="button"
                                >
                                    {updateMap.isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    <span>Salvar</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            key={map.id}
                            /* O evento onClick principal entra definitivamente na view do Mapa via onSelectMap */
                            onClick={() => onSelectMap(map.id)}
                            className="glass-panel p-5 rounded-xl hover:shadow-lg hover:border-accent/30 cursor-pointer transition-all group relative overflow-hidden flex flex-col"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <MapIcon size={48} />
                            </div>
                            
                            <div className="relative z-10 flex-1">
                                <h3 className="text-lg font-bold text-main mb-1 group-hover:text-accent transition-colors pr-10">
                                    {map.name}
                                </h3>
                                {map.description && (
                                    <p className="text-sm text-secondary mb-4 line-clamp-2 pr-10">
                                        {map.description}
                                    </p>
                                )}
                            </div>
                                
                            <div className="relative z-10 flex items-center justify-between mt-4 text-xs font-medium">
                                <span className="bg-white/5 bg-card text-secondary px-2.5 py-1 rounded-md">
                                    {map._count.nodes} Dispositivos
                                </span>
                                
                                {/* Painel Flutuante Actions - Permanece com opacity-0 mas vira opacity-100 sob Hover sobre o grupo inteiro do card */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity dropdown">
                                    {/* Botão de cópia: Chama procedure backend 'duplicate' e desativa se is loading */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // OBRIGATÓRIO bloquear para não disparar clique no card de ir entrar no mapa
                                            duplicateMap.mutate({ id: map.id });
                                        }}
                                        disabled={duplicateMap.isLoading}
                                        className="p-1.5 text-secondary/70 hover:bg-emerald-50 hover:text-emerald-500 dark:hover:bg-emerald-500/10 rounded-md transition-colors"
                                        title="Duplicar Mapa"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    
                                    {/* Botão de editar: Troca a interface do respectivo map.id em tela por um Editor Inline injetando props antigas */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // OBRIGATÓRIO bloquear
                                            setEditingMapId(map.id);
                                            setEditName(map.name);
                                            setEditDesc(map.description || '');
                                        }}
                                        className="p-1.5 text-secondary/70 hover:bg-blue-50 hover:text-accent dark:hover:bg-accent/10 rounded-md transition-colors"
                                        title="Editar Informações"
                                    >
                                        <Edit2 size={16} />
                                    </button>

                                    {/* Delete Button Padrão C/ Confirmação de Segurança nativa UI Window */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // OBRIGATÓRIO bloquear
                                            if (confirm('Deseja realmente excluir este mapa?')) {
                                                deleteMap.mutate({ id: map.id });
                                            }
                                        }}
                                        className="p-1.5 text-secondary/70 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 rounded-md transition-colors"
                                        title="Excluir Mapa"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                ))}

                {maps?.length === 0 && !isCreating && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-dashed border-white/10 rounded-xl text-center">
                        <MapIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Nenhum mapa criado</h3>
                        <p className="text-sm text-secondary max-w-sm">
                            Crie mapas personalizados para monitorar as portas e a banda dos seus dispositivos mais críticos.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
