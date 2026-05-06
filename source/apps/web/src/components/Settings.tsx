import { Settings as SettingsIcon, Bell } from 'lucide-react';
import { NotificationChannelManager } from './NotificationChannelManager';
import { MailCollectorSettings } from './MailCollectorSettings';

export function Settings() {
    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-4xl font-black text-main italic tracking-tighter uppercase flex items-center gap-4">
                        <div className="p-3 bg-accent/10 rounded-2xl">
                            <SettingsIcon className="w-8 h-8 text-accent" />
                        </div>
                        Configurações Gerais
                    </h2>
                    <p className="text-secondary font-bold uppercase tracking-widest mt-2 ml-16">Customização e Integrações do Ecossistema</p>
                </div>
            </div>

            {/* Gerenciador de Canais */}
            <section className="bg-card border border-border rounded-[3rem] p-10 shadow-2xl backdrop-blur-md">
                <NotificationChannelManager />
            </section>

            {/* Mail Collector */}
            <section className="bg-card border border-border rounded-[3rem] p-10 shadow-2xl backdrop-blur-md">
                <MailCollectorSettings />
            </section>

            {/* Info Box */}
            <div className="bg-accent/5 border border-accent/10 rounded-[2rem] p-8 flex gap-6 items-center">
                <div className="p-4 bg-accent/10 rounded-2xl">
                    <Bell className="w-8 h-8 text-accent" />
                </div>
                <div>
                    <h4 className="text-lg font-black text-main italic uppercase tracking-tight">Notificações Inteligentes</h4>
                    <p className="text-xs text-secondary font-medium leading-relaxed max-w-2xl mt-1">
                        Configure múltiplos canais para redundância de alertas. O IronGrid suporta Webhooks, Telegram, Slack e E-mail.
                        As notificações de chamados técnicos são enviadas automaticamente através do canal de e-mail habilitado.
                    </p>
                </div>
            </div>
        </div>
    );
}
