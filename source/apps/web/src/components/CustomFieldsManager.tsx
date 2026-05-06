import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Settings2, Plus, Trash2, Edit2, Save, X, List, Hash, Calendar, CheckSquare, Type, ChevronDown } from 'lucide-react';

const FIELD_TYPES = [
    { value: 'TEXT', label: 'Texto Simples', icon: Type },
    { value: 'TEXTAREA', label: 'Texto Longo', icon: List },
    { value: 'NUMBER', label: 'Número', icon: Hash },
    { value: 'DATE', label: 'Data', icon: Calendar },
    { value: 'SELECT', label: 'Seleção (Dropdown)', icon: ChevronDown },
    { value: 'CHECKBOX', label: 'Caixa de Seleção', icon: CheckSquare },
];

const CATEGORIES = [
    { value: 'INCIDENT', label: 'Incidente' },
    { value: 'REQUEST', label: 'Requisição' },
    { value: 'PROBLEM', label: 'Problema' },
    { value: 'CHANGE', label: 'Mudança' },
];

export function CustomFieldsManager() {
    const utils = trpc.useContext();
    const { data: fields = [], isLoading } = (trpc as any).customFields.listAll.useQuery({ enabledOnly: false });
    const [isCreating, setIsCreating] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800">
                <div>
                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase flex items-center gap-3">
                        <Settings2 className="w-6 h-6 text-accent" />
                        Campos Customizáveis
                    </h3>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Configuração de formulários dinâmicos por categoria</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-accent hover:bg-accent text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Criar Novo Campo
                    </button>
                )}
            </div>

            {isCreating && (
                <FieldForm
                    onCancel={() => setIsCreating(false)}
                    onSuccess={() => {
                        setIsCreating(false);
                        (utils as any).customFields.listAll.invalidate();
                    }}
                />
            )}

            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center p-12 text-secondary animate-pulse">Carregando campos...</div>
                ) : fields.length === 0 && !isCreating ? (
                    <div className="p-12 border-2 border-dashed border-slate-800 rounded-[2rem] text-center">
                        <Settings2 className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
                        <p className="text-secondary font-medium italic">Nenhum campo customizável configurado.</p>
                    </div>
                ) : (
                    fields.map((field: any) => (
                        <FieldCard key={field.id} field={field} />
                    ))
                )}
            </div>
        </div>
    );
}

function FieldCard({ field }: { field: any }) {
    const utils = trpc.useContext();
    const [isEditing, setIsEditing] = useState(false);

    const deleteMutation = (trpc as any).customFields.delete.useMutation({
        onSuccess: () => (utils as any).customFields.listAll.invalidate()
    });

    const toggleMutation = (trpc as any).customFields.update.useMutation({
        onSuccess: () => (utils as any).customFields.listAll.invalidate()
    });

    if (isEditing) {
        return (
            <FieldForm
                initialData={field}
                onCancel={() => setIsEditing(false)}
                onSuccess={() => {
                    setIsEditing(false);
                    (utils as any).customFields.listAll.invalidate();
                }}
            />
        );
    }

    const FieldIcon = FIELD_TYPES.find(t => t.value === field.type)?.icon || Type;

    return (
        <div className={`bg-slate-900 border ${field.enabled ? 'border-slate-800' : 'border-slate-800 opacity-60'} p-5 rounded-2xl flex items-center justify-between group transition-all hover:border-slate-700`}>
            <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 group-hover:border-accent/50 transition-colors">
                    <FieldIcon className="w-5 h-5 text-accent" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-white font-bold">{field.label}</h4>
                        <span className="text-[9px] font-black bg-slate-800 text-secondary/70 px-2 py-0.5 rounded uppercase tracking-widest">{field.name}</span>
                        {field.required && <span className="text-[9px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded uppercase tracking-widest">Obrigatório</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-secondary font-bold uppercase tracking-tighter">
                        <span>Tipo: {FIELD_TYPES.find(t => t.value === field.type)?.label}</span>
                        <span>•</span>
                        <span>Categoria: {field.category || 'Global'}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => toggleMutation.mutate({ id: field.id, enabled: !field.enabled })}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${field.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-secondary'}`}
                >
                    {field.enabled ? 'Ativo' : 'Inativo'}
                </button>
                <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-secondary/70 hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => { if (confirm('Excluir este campo permanentemente?')) deleteMutation.mutate({ id: field.id }); }}
                    className="p-2 text-secondary/70 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function FieldForm({ initialData, onCancel, onSuccess }: { initialData?: any, onCancel: () => void, onSuccess: () => void }) {
    const [name, setName] = useState(initialData?.name || '');
    const [label, setLabel] = useState(initialData?.label || '');
    const [type, setType] = useState(initialData?.type || 'TEXT');
    const [category, setCategory] = useState(initialData?.category || '');
    const [required, setRequired] = useState(initialData?.required || false);
    const [placeholder, setPlaceholder] = useState(initialData?.placeholder || '');
    const [options, setOptions] = useState<string[]>(initialData?.options || []);
    const [newOption, setNewOption] = useState('');

    const createMutation = (trpc as any).customFields.create.useMutation({ onSuccess });
    const updateMutation = (trpc as any).customFields.update.useMutation({ onSuccess });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = {
            name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            label,
            type,
            category: category || undefined,
            required,
            placeholder,
            options: type === 'SELECT' ? options : undefined
        };

        if (initialData) {
            updateMutation.mutate({ id: initialData.id, ...data });
        } else {
            createMutation.mutate(data);
        }
    };

    const addOption = () => {
        if (newOption && !options.includes(newOption)) {
            setOptions([...options, newOption]);
            setNewOption('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-lg font-black text-white italic uppercase tracking-tight">
                    {initialData ? 'Editar Campo' : 'Novo Campo Customizável'}
                </h4>
                <button type="button" onClick={onCancel} className="text-secondary hover:text-white"><X /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Label do Campo (Exibido no formulário)</label>
                        <input
                            value={label}
                            onChange={(e) => {
                                setLabel(e.target.value);
                                if (!initialData) setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-accent"
                            placeholder="Ex: Impacto Financeiro"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Nome Interno (slug)</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!!initialData}
                            className={`w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-accent ${!!initialData && 'opacity-50'}`}
                            placeholder="ex_impacto_financeiro"
                            required
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Tipo de Dado</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-accent"
                        >
                            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Categoria do Ticket</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-accent"
                        >
                            <option value="">Global (Todas)</option>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1">Placeholder (Texto de ajuda)</label>
                    <input
                        value={placeholder}
                        onChange={(e) => setPlaceholder(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-accent"
                        placeholder="Ex: Informe o valor estimado..."
                    />
                </div>
                <div className="flex items-end pb-1">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div
                            onClick={() => setRequired(!required)}
                            className={`w-12 h-6 rounded-full relative transition-all ${required ? 'bg-accent' : 'bg-slate-800'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${required ? 'left-7' : 'left-1'}`} />
                        </div>
                        <span className="text-[11px] font-black text-secondary/70 uppercase tracking-widest group-hover:text-white transition-colors">Campo Obrigatório</span>
                    </label>
                </div>
            </div>

            {type === 'SELECT' && (
                <div className="bg-slate-950 border border-slate-800 p-6 rounded-[2rem] space-y-4">
                    <label className="text-[10px] font-black text-accent uppercase tracking-widest">Opções do Dropdown</label>
                    <div className="flex gap-2">
                        <input
                            value={newOption}
                            onChange={(e) => setNewOption(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-accent"
                            placeholder="Nova opção..."
                        />
                        <button
                            type="button"
                            onClick={addOption}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-xl font-bold transition-all"
                        >
                            Adicionar
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {options.map((opt, i) => (
                            <span key={i} className="bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-800 flex items-center gap-2 group">
                                {opt}
                                <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))} className="text-slate-600 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-slate-800">
                <button type="button" onClick={onCancel} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-white transition-colors">Cancelar</button>
                <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex-[2] bg-accent hover:bg-accent text-white py-4 rounded-2xl shadow-xl shadow-accent/20 font-black text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                    {(createMutation.isPending || updateMutation.isPending) ? 'Processando...' : <><Save className="w-4 h-4" /> Salvar Configuração</>}
                </button>
            </div>
        </form>
    );
}
