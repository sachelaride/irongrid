import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Play, Loader2, Monitor } from 'lucide-react';

/**
 * Componente de Varredura de Rede (Legado/Simples).
 * Permite realizar um escaneamento rápido de uma sub-rede CIDR e visualizar os dispositivos encontrados.
 */
export function NetworkScan() {
    const [subnet, setSubnet] = useState('192.168.1.0/24');
    const [snmpCommunity, setSnmpCommunity] = useState('irongrid');
    const utils = trpc.useUtils();

    // Mutação para disparar o escaneamento rápido via tRPC
    const scanMutation = trpc.scan.quickScan.useMutation({
        onSuccess: () => {
            // Atualiza a lista de dispositivos após o escaneamento encontrar novos ativos
            utils.scan.getDevices.invalidate();
        }
    });

    /**
     * Inicia o processo de varredura com os parâmetros fornecidos.
     */
    const handleScan = () => {
        scanMutation.mutate({ subnet, snmpCommunity });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-main">Varredura de Rede</h2>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={subnet}
                        onChange={(e) => setSubnet(e.target.value)}
                        className="bg-card border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-main outline-none focus:border-accent transition-all font-mono"
                        placeholder="CIDR (ex: 192.168.1.0/24)"
                    />
                    <input
                        type="text"
                        value={snmpCommunity}
                        onChange={(e) => setSnmpCommunity(e.target.value)}
                        className="bg-card border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-main w-36 outline-none focus:border-accent transition-all"
                        placeholder="Comunidade SNMP"
                    />
                    <button
                        onClick={handleScan}
                        disabled={scanMutation.isPending}
                        className="bg-accent hover:bg-accent text-white px-6 py-2 rounded-xl flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-accent/20 font-bold"
                    >
                        {scanMutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : <Play className="h-5 w-5" />}
                        Iniciar Scan
                    </button>
                </div>
            </div>

            {/* Exibição de erros caso ocorram na mutação */}
            {scanMutation.error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-2xl animate-in fade-in zoom-in duration-300">
                    Erro: {scanMutation.error.message}
                </div>
            )}

            {/* Lista de resultados do escaneamento */}
            {scanMutation.data && (
                <div className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-xl animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 border-b border-border bg-card/30/50 dark:bg-slate-800/50 flex justify-between items-center">
                        <div>
                            <h3 className="font-black italic text-main uppercase tracking-tight">Resultados da Varredura</h3>
                            <p className="text-xs text-secondary font-bold uppercase tracking-widest">{scanMutation.data.devices.length} dispositivos encontrados em {scanMutation.data.target}</p>
                        </div>
                        <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                            <Monitor className="h-5 w-5 text-accent" />
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {scanMutation.data.devices.map((device: any, idx: number) => (
                            <div key={idx} className="p-5 flex items-center justify-between hover:bg-card/30 dark:hover:bg-slate-800/30 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 bg-card rounded-2xl flex items-center justify-center text-secondary/70 group-hover:bg-accent/10 group-hover:text-accent transition-all border border-transparent group-hover:border-accent/20 shadow-inner">
                                        <Monitor className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="font-mono font-black text-main italic">{device.ip}</div>
                                        <div className="text-xs text-secondary font-bold bg-card px-2 py-0.5 rounded-lg w-fit mt-1">{device.hostname || 'Sem hostname'}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-secondary/70 uppercase tracking-widest mb-1">MAC / Fornecedor</div>
                                    <div className="text-xs text-slate-700 dark:text-slate-300 font-black italic">{device.mac || 'Desconhecido'}</div>
                                    <div className="text-[9px] text-secondary font-bold uppercase tracking-tight">{device.vendor || 'Fornecedor Desconhecido'}</div>
                                </div>
                            </div>
                        ))}

                        {/* Estado vazio caso nenhum dispositivo seja encontrado */}
                        {scanMutation.data.devices.length === 0 && (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-card rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-700">
                                    <Monitor className="h-8 w-8 text-slate-300" />
                                </div>
                                <p className="text-secondary font-black uppercase tracking-widest text-sm italic">Nenhum dispositivo ativo encontrado nesta faixa.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
