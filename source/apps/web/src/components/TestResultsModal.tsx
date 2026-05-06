import { X, CheckCircle, XCircle } from 'lucide-react';

interface TestResultsModalProps {
    results: any;
    onClose: () => void;
}

export function TestResultsModal({ results, onClose }: TestResultsModalProps) {
    if (!results) return null;

    const { type, results: testResults } = results;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white">
                        {type === 'ping' ? 'Resultados do Teste de Ping' : 'Resultados do Teste SNMP'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-secondary/70 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="space-y-3">
                        {testResults?.map((result: any, idx: number) => (
                            <div
                                key={idx}
                                className={`p-4 rounded-lg border ${result.success
                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                    : 'bg-red-500/10 border-red-500/30'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {result.success ? (
                                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-red-500" />
                                        )}
                                        <div>
                                            <p className="font-mono text-sm text-white">{result.ip}</p>
                                            {type === 'snmp' && result.sysName && (
                                                <p className="text-xs text-secondary/70 mt-1">{result.sysName}</p>
                                            )}
                                            {result.error && (
                                                <p className="text-xs text-red-400 mt-1">{result.error}</p>
                                            )}
                                        </div>
                                    </div>
                                    {type === 'ping' && result.latency && (
                                        <span className="text-xs font-mono text-emerald-400">
                                            {result.latency.toFixed(1)}ms
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-800 flex justify-between items-center">
                    <div className="text-sm text-secondary/70">
                        <span className="text-emerald-500 font-bold">
                            {testResults?.filter((r: any) => r.success).length}
                        </span>
                        {' '}sucesso, {' '}
                        <span className="text-red-500 font-bold">
                            {testResults?.filter((r: any) => !r.success).length}
                        </span>
                        {' '}falha
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-accent hover:bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
