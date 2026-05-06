import { useState } from 'react';
import { CustomMapsList } from './CustomMapsList';
import { CustomMapEditor } from './CustomMapEditor';
import { ArrowLeft } from 'lucide-react';

interface CustomMapsContainerProps {
    onBack: () => void;
}

export function CustomMapsContainer({ onBack }: CustomMapsContainerProps) {
    const [selectedMapId, setSelectedMapId] = useState<string | null>(null);

    return (
        <div className="h-full flex flex-col w-full relative">
            {!selectedMapId ? (
                <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-white/5 dark:hover:bg-slate-800 rounded-lg transition-colors text-secondary"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-main tracking-tight">
                                Mapas Personalizados
                            </h1>
                            <p className="text-sm text-secondary">
                                Crie e visualize topologias específicas com foco nos dispositivos essenciais.
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <CustomMapsList onSelectMap={setSelectedMapId} />
                    </div>
                </div>
            ) : (
                <CustomMapEditor 
                    mapId={selectedMapId} 
                    onBack={() => setSelectedMapId(null)} 
                />
            )}
        </div>
    );
}
