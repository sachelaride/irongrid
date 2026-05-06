import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Shield, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from './Logo';

interface LoginPageProps {
    onLoginSuccess: (user: any) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const loginMutation = trpc.auth.login.useMutation({
        onSuccess: (data) => {
            // Store token in local storage as backup to cookie
            localStorage.setItem('irongrid_token', data.token);
            onLoginSuccess(data.user);
        },
        onError: (err) => {
            setError(err.message || 'Erro ao realizar login');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username || !password) {
            setError('Preencha todos os campos');
            return;
        }
        loginMutation.mutate({ username, password });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-tron-grid relative overflow-hidden font-body">
            {/* TRON GRID SYSTEM */}
            <div className="tron-grid-ceiling opacity-50" />
            <div className="tron-grid-floor opacity-50" />
            
            {/* Soft Glow Core */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-accent/5 blur-[120px] rounded-full" />
            </div>

            <div className="w-full max-w-md relative z-10 animate-slide-up">
                <div className="cyber-panel rounded-[2.5rem] p-12 shadow-2xl backdrop-blur-md">
                    <div className="flex flex-col items-center mb-10">
                        <Logo className="mb-2" size={100} />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] ml-4">Usuário</label>
                            <div className="relative group">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary group-focus-within:text-accent transition-colors z-10" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="your_user"
                                    className="w-full bg-black/20 border border-white/5 rounded-full py-4 pl-14 pr-6 text-main placeholder:text-secondary/40 focus:outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/5 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] ml-4">Senha</label>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary group-focus-within:text-accent transition-colors z-10" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-black/20 border border-white/5 rounded-full py-4 pl-14 pr-6 text-main placeholder:text-secondary/40 focus:outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/5 transition-all font-medium"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs animate-in fade-in">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span className="font-bold uppercase tracking-tight">{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loginMutation.isPending}
                            className="w-full bg-accent hover:bg-accent/80 disabled:opacity-50 text-white font-black py-4 rounded-full shadow-lg shadow-accent/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-xs relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                            {loginMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span className="relative z-10">Entrar no Terminal</span>
                                    <Shield className="w-4 h-4 relative z-10" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-12 text-center border-t border-white/5 pt-8">
                        <p className="text-[9px] font-bold text-accent uppercase tracking-[0.4em] mb-1 opacity-60">System Architect</p>
                        <p className="text-sm text-main font-black tracking-widest uppercase italic">German Sachelaride</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
