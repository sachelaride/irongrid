import { 
    AlignLeft, AlignCenter, AlignRight, 
    AlignVerticalSpaceAround, AlignHorizontalSpaceAround,
    ArrowUp, ArrowDown,
    LayoutPanelTop, LayoutPanelLeft
} from 'lucide-react';
import { ActionButton } from '../ui/DesignSystem';

interface AlignmentToolbarProps {
    onAlign: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
    onDistribute: (type: 'horizontal' | 'vertical') => void;
    onLayer: (type: 'front' | 'back') => void;
    visible: boolean;
}

export function AlignmentToolbar({ onAlign, onDistribute, onLayer, visible }: AlignmentToolbarProps) {
    if (!visible) return null;

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl z-[200]">
            <div className="flex items-center gap-1 px-1 border-r border-slate-700 mr-1">
                <ActionButton 
                    icon={AlignLeft} 
                    onClick={() => onAlign('left')} 
                    tooltip="Alinhar à Esquerda" 
                    variant="secondary" 
                    size="sm" 
                />
                <ActionButton 
                    icon={LayoutPanelLeft} 
                    onClick={() => onAlign('center')} 
                    tooltip="Alinhar ao Centro (Vertical)" 
                    variant="secondary" 
                    size="sm" 
                />
                <ActionButton 
                    icon={AlignRight} 
                    onClick={() => onAlign('right')} 
                    tooltip="Alinhar à Direita" 
                    variant="secondary" 
                    size="sm" 
                />
            </div>

            <div className="flex items-center gap-1 px-1 border-r border-slate-700 mr-1">
                <ActionButton 
                    icon={LayoutPanelTop} 
                    onClick={() => onAlign('top')} 
                    tooltip="Alinhar ao Topo" 
                    variant="secondary" 
                    size="sm" 
                />
                <ActionButton 
                    icon={AlignCenter} 
                    onClick={() => onAlign('middle')} 
                    tooltip="Alinhar ao Meio (Horizontal)" 
                    variant="secondary" 
                    size="sm" 
                />
                <ActionButton 
                    icon={AlignRight} 
                    onClick={() => onAlign('bottom')} 
                    tooltip="Alinhar à Base" 
                    variant="secondary" 
                    size="sm" 
                />
            </div>

            <div className="flex items-center gap-1 px-1 border-r border-slate-700 mr-1">
                <ActionButton 
                    icon={AlignHorizontalSpaceAround} 
                    onClick={() => onDistribute('horizontal')} 
                    tooltip="Distribuir Horizontalmente" 
                    variant="secondary" 
                    size="sm" 
                />
                <ActionButton 
                    icon={AlignVerticalSpaceAround} 
                    onClick={() => onDistribute('vertical')} 
                    tooltip="Distribuir Verticalmente" 
                    variant="secondary" 
                    size="sm" 
                />
            </div>

            <div className="flex items-center gap-1 px-1">
                <ActionButton 
                    icon={ArrowUp} 
                    onClick={() => onLayer('front')} 
                    tooltip="Trazer para Frente" 
                    variant="secondary" 
                    size="sm" 
                />
                <ActionButton 
                    icon={ArrowDown} 
                    onClick={() => onLayer('back')} 
                    tooltip="Recuar para Trás" 
                    variant="secondary" 
                    size="sm" 
                />
            </div>
        </div>
    );
}
