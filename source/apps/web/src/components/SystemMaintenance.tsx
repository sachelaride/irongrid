/**
 * Componente SystemMaintenance - Painel de Controle e Manutenção do Sistema
 * 
 * Este componente centraliza as ferramentas de administração do backend do IronGrid,
 * permitindo gerenciar o ciclo de vida dos dados, backups e integridade do banco.
 * 
 * Funcionalidades:
 * - Configuração de Retenção: Define por quantos dias logs e métricas são mantidos.
 * - Limpeza Manual: Permite disparar faxinas seletivas no PostgreSQL e InfluxDB.
 * - Gestão de Backups: Criação, listagem, exclusão e restauração (Restore) de backups.
 * - Monitoramento de Saúde: Exibe contagem de registros e tamanho ocupado em disco pelos bancos.
 * - Zona de Perigo: Opções destrutivas como limpar todos os dados do InfluxDB.
 * 
 * @module components/SystemMaintenance
 */

/**
 * Componente SystemMaintenance - Painel de Controle e Manutenção do Sistema
 * 
 * Reorganizado em abas para melhor usabilidade.
 */

import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Settings, Clock, Database, Archive, Trash2 } from 'lucide-react';
import { RetentionPolicy } from './maintenance/RetentionPolicy';
import { BackupManager } from './maintenance/BackupManager';
import { SystemCleanup } from './maintenance/SystemCleanup';

type Tab = 'retention' | 'backups' | 'cleanup';

export function SystemMaintenance() {

    // Consultas globais de status
    const { data: status, isLoading } = (trpc as any).system.getMaintenanceStatus.useQuery();
    // const { data: logSources } = (trpc as any).syslog.getLogSources.useQuery(undefined, { refetchInterval: 10000 }); // Removed

    const [activeTab, setActiveTab] = useState<Tab>('backups');

    if (isLoading) return <div className="p-8 text-center text-secondary/70">Carregando status da manutenção...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Settings className="h-7 w-7 text-purple-400" />
                        Manutenção do Sistema
                    </h2>
                    <p className="text-secondary/70 mt-1">
                        Gerenciamento de retenção, backups e integridade dos dados
                    </p>
                </div>
                {/* Badge da última execução automática */}
                {status?.settings.lastRun && (
                    <div className="bg-slate-800 px-4 py-2 rounded-lg flex items-center gap-2 border border-slate-700">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-slate-300">
                            Última Limpeza: {new Date(status.settings.lastRun).toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Navegação por Abas */}
            {/* Navegação por Abas */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 mb-6 overflow-x-auto">
                <TabButton
                    active={activeTab === 'backups'}
                    onClick={() => setActiveTab('backups')}
                    icon={<Archive className="w-4 h-4" />}
                    label="Backups & Config"
                />
                <TabButton
                    active={activeTab === 'retention'}
                    onClick={() => setActiveTab('retention')}
                    icon={<Database className="w-4 h-4" />}
                    label="Políticas de Retenção"
                />
                <TabButton
                    active={activeTab === 'cleanup'}
                    onClick={() => setActiveTab('cleanup')}
                    icon={<Trash2 className="w-4 h-4" />}
                    label="Limpeza & Reset"
                />
            </div>

            {/* Conteúdo das Abas */}
            {/* Conteúdo das Abas */}
            <div className="min-h-[400px]">
                {activeTab === 'retention' && <RetentionPolicy status={status} />}
                {activeTab === 'backups' && <BackupManager />}
                {activeTab === 'cleanup' && <SystemCleanup status={status} />}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${active
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-secondary/70 hover:text-slate-200 hover:bg-slate-800/50'}
            `}
        >
            {icon}
            {label}
        </button>
    );
}
