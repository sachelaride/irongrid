import { useState } from 'react';
import { 
    Download, Monitor, Shield, Terminal, Copy, Check, 
    ArrowRight, AlertCircle, Info, Server, Cpu, Globe
} from 'lucide-react';

export function AgentManager() {
    const [serverIp, setServerIp] = useState(window.location.hostname || 'localhost');
    const [community, setCommunity] = useState('IronGrid');
    const [copied, setCopied] = useState<string | null>(null);

    const safeServerIp = serverIp.trim();
    const safeCommunity = community.trim() || 'IronGrid';

    const winCommand = `Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; $env:IRONGRID_SERVERIP='${safeServerIp}'; $env:IRONGRID_COMMUNITY='${safeCommunity}'; iex ((New-Object System.Net.WebClient).DownloadString('http://${safeServerIp}:3001/downloads/install_agent.ps1'))`;
    const winParamCommand = winCommand;
    
    const linuxCommand = `curl -sSL http://${safeServerIp}:3001/downloads/install_agent.sh | sudo bash -s -- "${safeServerIp}" "${safeCommunity}"`;

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border border-border p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Download size={120} className="text-main" />
                </div>
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
                        <Download className="w-8 h-8 text-main" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-main italic tracking-tight">Agentes & Downloads</h2>
                        <p className="text-secondary text-[10px] font-black uppercase tracking-[0.3em] mt-1 opacity-70">Central de Distribuição e Monitoramento</p>
                    </div>
                </div>
            </div>

            {/* Quick Config */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border p-6 rounded-[2rem] shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <Server className="text-main" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-widest text-main">Configuração Rápida</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">IP do Servidor IronGrid</label>
                            <input 
                                type="text"
                                value={serverIp}
                                onChange={(e) => setServerIp(e.target.value)}
                                className="w-full bg-page/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                placeholder="ex: 192.168.1.10"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Comunidade SNMP</label>
                            <input 
                                type="text"
                                value={community}
                                onChange={(e) => setCommunity(e.target.value)}
                                className="w-full bg-page/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                placeholder="ex: IronGrid"
                            />
                        </div>
                    </div>
                    <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-start gap-3">
                        <Info size={16} className="text-main shrink-0 mt-0.5" />
                        <p className="text-[10px] text-secondary leading-relaxed font-bold">
                            Altere os valores acima para que os comandos de instalação abaixo sejam gerados automaticamente com suas configurações.
                        </p>
                    </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 p-6 rounded-[2rem] flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-3 text-main">
                        <Shield size={24} />
                        <h3 className="text-lg font-black italic">Instalação Segura</h3>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed font-medium">
                        Nossos scripts de instalação automatizam a configuração do serviço SNMP v2c, 
                        ajustam as permissões de firewall e registram o agente no servidor central 
                        de forma segura e otimizada.
                    </p>
                </div>
            </div>

            {/* Platform Selection */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Windows Card */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 ml-2">
                        <Monitor className="text-accent" size={24} />
                        <h3 className="text-xl font-black italic text-main">Microsoft Windows</h3>
                    </div>
                    
                    <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm space-y-6">
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-main">Instalação Automática (Recomendado)</h4>
                            <p className="text-xs text-secondary font-medium">Copie e cole este comando no PowerShell (Executar como Administrador):</p>
                            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-1">Use o IP/hostname correto do servidor IronGrid; não deixe '...' ou espaços extras.</p>
                            
                            <div className="relative group">
                                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 font-mono text-[11px] text-emerald-400 break-all leading-relaxed shadow-inner">
                                    {winParamCommand}
                                </div>
                                <button 
                                    onClick={() => handleCopy(winParamCommand, 'win')}
                                    className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all backdrop-blur-md"
                                >
                                    {copied === 'win' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <a 
                                href={`http://${serverIp}:3001/downloads/IronGridAgentSetup.exe`}
                                className="flex items-center justify-between p-4 bg-page/50 border border-border rounded-[1.5rem] hover:border-primary/50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <Download size={18} className="text-secondary group-hover:text-main" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-main">Baixar .EXE</span>
                                </div>
                                <ArrowRight size={14} className="text-border group-hover:text-main transition-all group-hover:translate-x-1" />
                            </a>
                            <a 
                                href={`http://${serverIp}:3001/downloads/install_agent.ps1`}
                                className="flex items-center justify-between p-4 bg-page/50 border border-border rounded-[1.5rem] hover:border-primary/50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <Terminal size={18} className="text-secondary group-hover:text-main" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-main">Script .PS1</span>
                                </div>
                                <ArrowRight size={14} className="text-border group-hover:text-main transition-all group-hover:translate-x-1" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Linux Card */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 ml-2">
                        <Cpu className="text-orange-500" size={24} />
                        <h3 className="text-xl font-black italic text-main">Linux / Unix</h3>
                    </div>
                    
                    <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm space-y-6">
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-main">Instalação via Terminal</h4>
                            <p className="text-xs text-secondary font-medium">Copie e execute o comando abaixo com privilégios de ROOT:</p>
                            
                            <div className="relative group">
                                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 font-mono text-[11px] text-orange-400 break-all leading-relaxed shadow-inner">
                                    {linuxCommand}
                                </div>
                                <button 
                                    onClick={() => handleCopy(linuxCommand, 'linux')}
                                    className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all backdrop-blur-md"
                                >
                                    {copied === 'linux' ? <Check size={16} className="text-orange-400" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-border/50 space-y-4">
                            <a 
                                href={`http://${serverIp}:3001/downloads/install_agent.sh`}
                                className="flex items-center justify-between p-4 bg-page/50 border border-border rounded-[1.5rem] hover:border-primary/50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <Terminal size={18} className="text-secondary group-hover:text-main" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-main">Baixar Script .SH</span>
                                </div>
                                <ArrowRight size={14} className="text-border group-hover:text-main transition-all group-hover:translate-x-1" />
                            </a>
                            
                            <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                <AlertCircle size={18} className="text-amber-500" />
                                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-widest leading-relaxed">
                                    Suporte para Debian, Ubuntu e CentOS via comando nativo.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Technical Details Footer */}
            <div className="bg-card border border-border p-8 rounded-[2.5rem] flex flex-wrap gap-12">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                        <Check size={20} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-secondary uppercase tracking-widest">Protocolo</p>
                        <p className="text-xs font-black text-main italic">SNMP v2c / WebSocket</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                        <Globe size={20} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-secondary uppercase tracking-widest">Portas Utilizadas</p>
                        <p className="text-xs font-black text-main italic">161/UDP, 3001/TCP</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-main">
                        <Monitor size={20} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-secondary uppercase tracking-widest">Status</p>
                        <p className="text-xs font-black text-main italic">Monitoramento Híbrido Ativo</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
