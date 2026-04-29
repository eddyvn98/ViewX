import React from 'react';
import { Settings, User, LogOut, HelpCircle, FileText, Bell, Monitor, ChevronRight, House, Palette, MoonStar, Volume2 } from 'lucide-react';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from './ThemeToggle';
import { ThemeColorSwitcher } from './ThemeColorSwitcher';
import { useMarketStore } from '@/lib/store';
import { voiceNotifier } from '@/features/notifications/voice';

interface MobileMenuProps {
    compact?: boolean;
}

const SUPPORT_TELEGRAM_URL = 'https://t.me/htt711';
const SUPPORT_ZALO_URL = 'https://zalo.me/84932690949';

export function MobileMenu({ compact = false }: MobileMenuProps) {
    const t = useTranslations('MobileMenu');
    const voiceAlertsEnabled = useMarketStore((state) => state.voiceAlertsEnabled);
    const setVoiceAlertsEnabled = useMarketStore((state) => state.setVoiceAlertsEnabled);
    const voiceAlertsUsePreGeneratedAudio = useMarketStore((state) => state.voiceAlertsUsePreGeneratedAudio);
    const setVoiceAlertsUsePreGeneratedAudio = useMarketStore((state) => state.setVoiceAlertsUsePreGeneratedAudio);
    const [user, setUser] = React.useState({
        name: t('guest'),
        email: 'guest@vivutrade.io.vn',
        balance: 24500.0,
    });
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);

    const handleTestVoice = React.useCallback(async () => {
        console.log('[MobileMenu] handleTestVoice clicked');
        // Synchronous unlock to preserve user gesture
        voiceNotifier.syncUnlock();
        
        await voiceNotifier.unlock();
        voiceNotifier.notify({
            symbol: 'VIVUTRADE',
            price: 8888,
            message: 'Đây là âm thanh thông báo thử nghiệm từ Vivutrade.'
        });
    }, []);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const applyUser = () => {
            const raw = localStorage.getItem('auth_user') || '';
            const token = (localStorage.getItem('auth_access_token') || '').trim();
            setIsAuthenticated(Boolean(token));
            if (!raw) {
                setUser((prev) => ({ ...prev, name: t('guest'), email: 'guest@vivutrade.io.vn' }));
                return;
            }
            try {
                const parsed = JSON.parse(raw);
                const email = String(parsed?.username || '').trim() || 'guest@vivutrade.io.vn';
                const name = String(parsed?.display_name || '').trim() || email.split('@')[0] || t('guest');
                setUser((prev) => ({ ...prev, name, email }));
            } catch {
                setUser((prev) => ({ ...prev, name: t('guest'), email: 'guest@vivutrade.io.vn' }));
            }
        };

        applyUser();
        window.addEventListener('storage', applyUser);
        window.addEventListener('focus', applyUser);
        window.addEventListener('auth-changed', applyUser);
        window.addEventListener('auth-state-changed', applyUser);
        document.addEventListener('visibilitychange', applyUser);
        return () => {
            window.removeEventListener('storage', applyUser);
            window.removeEventListener('focus', applyUser);
            window.removeEventListener('auth-changed', applyUser);
            window.removeEventListener('auth-state-changed', applyUser);
            document.removeEventListener('visibilitychange', applyUser);
        };
    }, [t]);

    const handleLogout = React.useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({}),
            });
        } catch {
            // Ignore logout API errors and still clear local session.
        } finally {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('auth_access_token');
                localStorage.removeItem('auth_user');
                window.dispatchEvent(new Event('auth-state-changed'));
                window.location.href = '/';
            }
        }
    }, []);

    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            <div className={cn('bg-secondary/20 border-b border-border flex items-center', compact ? 'p-4 gap-3' : 'p-6 gap-4')}>
                <div
                    className={cn(
                        'rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/20',
                        compact ? 'w-11 h-11 text-lg' : 'w-14 h-14 text-xl'
                    )}
                >
                    {user.name.charAt(0)}
                </div>
                <div className="flex-1">
                    <h2 className={cn('font-bold text-foreground leading-tight', compact ? 'text-sm' : 'text-base')}>{user.name}</h2>
                    <p className="text-[11px] text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{t('live')}</span>
                        <p className={cn('font-mono font-bold text-green-400', compact ? 'text-xs' : 'text-sm')}>
                            ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            <div className={cn('flex-1 overflow-y-auto space-y-1', compact ? 'p-3' : 'p-4')}>
                <MenuItem compact={compact} icon={House} label={t('home')} onClick={() => { window.location.href = '/'; }} />
                <MenuItem compact={compact} icon={User} label={t('accountProfile')} />
                <MenuItem compact={compact} icon={Bell} label={t('notifications')} badge="3" />
                <MenuRow compact={compact} icon={MoonStar} label="Dark Mode">
                    <ThemeToggle />
                </MenuRow>
                <MenuRow compact={compact} icon={Palette} label="Theme Color">
                    <ThemeColorSwitcher />
                </MenuRow>
                <MenuRow compact={compact} icon={Bell} label="Voice Alerts">
                    <button
                        onClick={() => {
                            setVoiceAlertsEnabled(!voiceAlertsEnabled);
                            void voiceNotifier.unlock();
                        }}
                        className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            voiceAlertsEnabled ? "bg-primary" : "bg-muted"
                        )}
                        title="Toggle voice alerts"
                    >
                        <span
                            className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                voiceAlertsEnabled ? "translate-x-4" : "translate-x-1"
                            )}
                        />
                    </button>
                </MenuRow>
                <MenuRow compact={compact} icon={Monitor} label="Pre-generated Audio">
                    <button
                        onClick={() => {
                            setVoiceAlertsUsePreGeneratedAudio(!voiceAlertsUsePreGeneratedAudio);
                            void voiceNotifier.unlock();
                        }}
                        className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            voiceAlertsUsePreGeneratedAudio ? "bg-primary" : "bg-muted"
                        )}
                        title="Toggle pre-generated alert audio"
                    >
                        <span
                            className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                voiceAlertsUsePreGeneratedAudio ? "translate-x-4" : "translate-x-1"
                            )}
                        />
                    </button>
                </MenuRow>
                <MenuRow compact={compact} icon={Volume2} label="Test Voice Notification">
                    <button
                        onClick={handleTestVoice}
                        className="p-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors active:scale-90 border border-primary/20"
                        title="Click to test voice notification"
                    >
                        <Volume2 size={16} />
                    </button>
                </MenuRow>
                <MenuItem compact={compact} icon={Monitor} label={t('displaySettings')} />

                <div className="h-px bg-border/60 my-3 mx-2" />

                <MenuItem compact={compact} icon={Settings} label={t('appSettings')} />
                <MenuItem compact={compact} icon={HelpCircle} label="Hỗ trợ Telegram" onClick={() => { window.open(SUPPORT_TELEGRAM_URL, '_blank', 'noopener,noreferrer'); }} />
                <MenuItem compact={compact} icon={HelpCircle} label="Hỗ trợ Zalo" onClick={() => { window.open(SUPPORT_ZALO_URL, '_blank', 'noopener,noreferrer'); }} />
                <MenuItem compact={compact} icon={FileText} label={t('termsOfService')} />
            </div>

            <div className={cn('border-t border-border bg-secondary/10', compact ? 'p-3' : 'p-4')}>
                {!isAuthenticated ? (
                    <GoogleSignInButton className="mb-3" text="signin_with" size="large" width={compact ? 240 : 280} redirectTo="/chart" />
                ) : (
                    <button
                        onClick={handleLogout}
                        className={cn('flex items-center gap-3 w-full rounded-lg text-red-500 hover:bg-red-500/10 transition-colors group', compact ? 'p-2.5' : 'p-3')}
                    >
                        <LogOut size={compact ? 18 : 20} className="group-hover:translate-x-1 transition-transform" />
                        <span className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>{t('signOut')}</span>
                    </button>
                )}
                <div className={cn('text-center text-[10px] text-muted-foreground font-mono', compact ? 'mt-3' : 'mt-4')}>
                    {t('version')}
                </div>
            </div>
        </div>
    );
}

type MenuItemProps = {
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    onClick?: () => void;
    badge?: string;
    compact?: boolean;
};

function MenuItem({ icon: Icon, label, onClick, badge, compact = false }: MenuItemProps) {
    return (
        <button
            onClick={onClick}
            className={cn('flex items-center gap-3 w-full rounded-lg hover:bg-secondary/60 active:bg-secondary transition-colors group', compact ? 'p-2.5' : 'p-3')}
        >
            <div className={cn('rounded-md bg-secondary text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors', compact ? 'p-1.5' : 'p-2')}>
                <Icon size={compact ? 16 : 18} />
            </div>
            <span className={cn('font-medium flex-1 text-left text-foreground', compact ? 'text-[13px]' : 'text-sm')}>{label}</span>
            {badge && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {badge}
                </span>
            )}
            <ChevronRight size={compact ? 12 : 14} className="text-muted-foreground group-hover:text-foreground" />
        </button>
    );
}

function MenuRow({
    icon: Icon,
    label,
    children,
    compact = false,
}: {
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    children: React.ReactNode;
    compact?: boolean;
}) {
    return (
        <div className={cn('flex items-center gap-3 w-full rounded-lg hover:bg-secondary/60 transition-colors', compact ? 'p-2.5' : 'p-3')}>
            <div className={cn('rounded-md bg-secondary text-muted-foreground', compact ? 'p-1.5' : 'p-2')}>
                <Icon size={compact ? 16 : 18} />
            </div>
            <span className={cn('font-medium flex-1 text-left text-foreground', compact ? 'text-[13px]' : 'text-sm')}>{label}</span>
            <div className="shrink-0">{children}</div>
        </div>
    );
}
