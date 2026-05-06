import { trpc } from '../utils/trpc';
// import { Calendar, Hash, Type, CheckSquare, List } from 'lucide-react';

interface CustomFieldsRendererProps {
    category?: string;
    ticketId?: string;
    values: any[]; // { fieldId: string, value: string }
    onChange?: (values: any[]) => void;
    readOnly?: boolean;
}

export function CustomFieldsRenderer({ category, values, onChange, readOnly }: CustomFieldsRendererProps) {
    const { data: allFields = [], isLoading } = (trpc as any).customFields.listAll.useQuery({
        category: category as any,
        enabledOnly: true
    });

    // Filtra campos aplicáveis à categoria
    const fields = allFields.filter((f: any) => !f.category || f.category === category);

    const handleFieldChange = (fieldId: string, value: string) => {
        if (!onChange) return;
        const newValues = [...values];
        const index = newValues.findIndex(v => v.fieldId === fieldId);
        if (index >= 0) {
            newValues[index] = { fieldId, value };
        } else {
            newValues.push({ fieldId, value });
        }
        onChange(newValues);
    };

    if (isLoading) return <div className="animate-pulse text-[10px] text-secondary uppercase font-black">Carregando campos extras...</div>;
    if (fields.length === 0) return null;

    return (
        <div className="space-y-4 pt-4 border-t border-slate-800/50">
            <h5 className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2">
                Informações Adicionais (Específicas do Chamado)
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((field: any) => {
                    const val = values.find(v => v.fieldId === field.id)?.value || '';
                    return (
                        <div key={field.id} className="space-y-1.5">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest ml-1 flex items-center gap-1">
                                {field.label}
                                {field.required && <span className="text-red-500">*</span>}
                            </label>

                            <FieldInput
                                field={field}
                                value={val}
                                onChange={(v) => handleFieldChange(field.id, v)}
                                readOnly={readOnly}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function FieldInput({ field, value, onChange, readOnly }: { field: any, value: string, onChange: (v: string) => void, readOnly?: boolean }) {
    if (readOnly) {
        return (
            <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3 text-sm text-secondary/70 font-medium">
                {field.type === 'SELECT' ? (
                    field.options?.find((o: string) => o === value) || value || '-'
                ) : field.type === 'CHECKBOX' ? (
                    value === 'true' ? 'Sim' : 'Não'
                ) : (
                    value || '-'
                )}
            </div>
        );
    }

    switch (field.type) {
        case 'TEXTAREA':
            return (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-accent outline-none min-h-[80px] resize-none"
                />
            );

        case 'NUMBER':
            return (
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-accent outline-none"
                />
            );

        case 'DATE':
            return (
                <input
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-accent outline-none"
                />
            );

        case 'SELECT':
            return (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-accent outline-none"
                >
                    <option value="">Selecione...</option>
                    {(field.options as string[] || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            );

        case 'CHECKBOX':
            return (
                <label className="flex items-center gap-3 cursor-pointer group p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition-all">
                    <div
                        onClick={() => onChange(value === 'true' ? 'false' : 'true')}
                        className={`w-10 h-5 rounded-full relative transition-all ${value === 'true' ? 'bg-emerald-500' : 'bg-slate-800'}`}
                    >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${value === 'true' ? 'left-5.5' : 'left-0.5'}`} />
                    </div>
                    <span className="text-[10px] font-black text-secondary uppercase tracking-widest group-hover:text-white transition-colors">
                        {value === 'true' ? 'Sim / Habilitado' : 'Não / Desabilitado'}
                    </span>
                </label>
            );

        default:
            return (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-accent outline-none"
                />
            );
    }
}
