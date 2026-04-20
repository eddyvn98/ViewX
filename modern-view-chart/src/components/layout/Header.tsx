import React, { memo } from 'react';
import Link from 'next/link';
import { Bell, BarChart2, Settings, PanelRightClose, LogOut, Volume2 } from 'lucide-react';
import { HeartHandshake } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMarketStore } from '@/lib/store';
import { TabContainer } from './TabContainer';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { ThemeColorSwitcher } from './ThemeColorSwitcher';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { TelegramLinkDialog } from './TelegramLinkDialog';
import { AlertEditDialog } from '@/features/chart/components/AlertEditDialog';
import { useWebSocket } from '@/hooks/use-websocket';
import { voiceNotifier } from '@/features/notifications/voice';

type UserSetupSyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

type UserSetupSyncStatusDetail = {
    status: UserSetupSyncStatus;
    lastSavedAt: number | null;
};

type MembershipTier = 'free' | 'pro' | 'ai';

type MembershipUi = {
    badgeClassName: string;
    dotClassName: string;
    avatarBorderClassName: string;
    avatarInnerClassName: string;
};

const MEMBERSHIP_UI: Record<MembershipTier, MembershipUi> = {
    free: {
        badgeClassName: 'bg-slate-500/10 border border-slate-500/30 text-slate-700 dark:text-slate-300',
        dotClassName: 'bg-slate-500',
        avatarBorderClassName: 'border-slate-400/50 dark:border-slate-500/60',
        avatarInnerClassName: 'bg-slate-100 dark:bg-slate-800/80',
    },
    pro: {
        badgeClassName: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
        dotClassName: 'bg-emerald-500',
        avatarBorderClassName: 'border-emerald-500/50 dark:border-emerald-400/70',
        avatarInnerClassName: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    ai: {
        badgeClassName: 'bg-amber-500/10 border border-amber-500/35 text-amber-700 dark:text-amber-300',
        dotClassName: 'bg-amber-500',
        avatarBorderClassName: 'border-amber-500/60 dark:border-amber-400/75',
        avatarInnerClassName: 'bg-amber-50 dark:bg-amber-950/35',
    },
};

function normalizeMembershipTier(rawPlan: unknown): MembershipTier {
    const plan = String(rawPlan || '').trim().toLowerCase();
    if (plan === 'pro') return 'pro';
    if (plan === 'pro_plus' || plan === 'ai') return 'ai';
    return 'free';
}

function getMembershipLabel(tier: MembershipTier, locale: string): string {
    const isVi = locale.toLowerCase().startsWith('vi');
    if (!isVi) {
        if (tier === 'pro') return 'PRO';
        if (tier === 'ai') return 'AI';
        return 'FREE';
    }

    if (tier === 'pro') return 'N\u00e2ng cao';
    if (tier === 'ai') return 'Cao c\u1ea5p';
    return 'Mi\u1ec5n ph\u00ed';
}

export const Header = memo(function Header() {
    const tNotifications = useTranslations('Header.notifications');
    const locale = useLocale();
    const isRightSidebarOpen = useMarketStore((state) => state.isRightSidebarOpen);
    const toggleRightSidebar = useMarketStore((state) => state.toggleRightSidebar);
    const isLeftSidebarOpen = useMarketStore((state) => state.isLeftSidebarOpen);
    const toggleLeftSidebar = useMarketStore((state) => state.toggleLeftSidebar);
    const [displayName, setDisplayName] = React.useState("Guest");
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);
    const [membershipTier, setMembershipTier] = React.useState<MembershipTier>('free');
    const [isAvatarMenuOpen, setIsAvatarMenuOpen] = React.useState(false);
    const [isTelegramDialogOpen, setIsTelegramDialogOpen] = React.useState(false);
    const [isNotificationMenuOpen, setIsNotificationMenuOpen] = React.useState(false);
    const [editingAlert, setEditingAlert] = React.useState<{ id: string; symbol: string; price: number } | null>(null);
    const [syncStatus, setSyncStatus] = React.useState<UserSetupSyncStatus>('idle');
    const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
    const avatarMenuRef = React.useRef<HTMLDivElement | null>(null);
    const notificationMenuRef = React.useRef<HTMLDivElement | null>(null);
    const notificationHistory = useMarketStore((state) => state.notificationHistory);
    const clearNotificationHistory = useMarketStore((state) => state.clearNotificationHistory);
    const markAllNotificationsAsRead = useMarketStore((state) => state.markAllNotificationsAsRead);
    const alerts = useMarketStore((state) => state.alerts);
    const removeAlert = useMarketStore((state) => state.removeAlert);
    const updateAlert = useMarketStore((state) => state.updateAlert);
    const voiceAlertsEnabled = useMarketStore((state) => state.voiceAlertsEnabled);
    const setVoiceAlertsEnabled = useMarketStore((state) => state.setVoiceAlertsEnabled);
    const voiceAlertsUsePreGeneratedAudio = useMarketStore((state) => state.voiceAlertsUsePreGeneratedAudio);
    const setVoiceAlertsUsePreGeneratedAudio = useMarketStore((state) => state.setVoiceAlertsUsePreGeneratedAudio);
    const { sendMessage } = useWebSocket();
    const syncUiPreferences = useMarketStore((state) => state.syncUiPreferences);
    const unreadCount = React.useMemo(() => notificationHistory.filter((item) => !item.readAt).length, [notificationHistory]);

    React.useEffect(() => {
        if (isAuthenticated) {
            syncUiPreferences();
        }
    }, [isAuthenticated, syncUiPreferences]);

    React.useEffect(() => {
        voiceNotifier.setEnabled(voiceAlertsEnabled);
        voiceNotifier.setPreferPreGeneratedAudio(voiceAlertsUsePreGeneratedAudio);
    }, [voiceAlertsEnabled, voiceAlertsUsePreGeneratedAudio]);

    const handleTestVoice = React.useCallback(() => {
        voiceNotifier.notify({
            symbol: 'VIVUTRADE',
            price: 8888,
            message: 'Đây là âm thanh thông báo thử nghiệm từ Vivutrade.'
        });
    }, []);

    React.useEffect(() => {
        if (typeof window === "undefined") return;

        const applyUser = () => {
            const raw = localStorage.getItem("auth_user") || "";
            const token = (localStorage.getItem("auth_access_token") || "").trim();
            setIsAuthenticated(Boolean(token));
            if (!raw) {
                setDisplayName("Guest");
                setMembershipTier('free');
                return;
            }
            try {
                const parsed = JSON.parse(raw);
                const name = String(parsed?.display_name || parsed?.username || "").trim();
                setMembershipTier(normalizeMembershipTier(parsed?.subscription?.plan || parsed?.plan));
                if (!name) {
                    setDisplayName("Guest");
                    return;
                }
                setDisplayName(name.split("@")[0]);
            } catch {
                setDisplayName("Guest");
                setMembershipTier('free');
            }
        };

        applyUser();
        window.addEventListener("storage", applyUser);
        window.addEventListener("focus", applyUser);
        window.addEventListener("auth-changed", applyUser);
        window.addEventListener("auth-state-changed", applyUser);
        document.addEventListener("visibilitychange", applyUser);
        return () => {
            window.removeEventListener("storage", applyUser);
            window.removeEventListener("focus", applyUser);
            window.removeEventListener("auth-changed", applyUser);
            window.removeEventListener("auth-state-changed", applyUser);
            document.removeEventListener("visibilitychange", applyUser);
        };
    }, []);

    React.useEffect(() => {
        if (typeof window === "undefined") return;

        const handleSyncStatus = (event: Event) => {
            const detail = (event as CustomEvent<UserSetupSyncStatusDetail>).detail;
            if (!detail) return;
            setSyncStatus(detail.status || 'idle');
            setLastSavedAt(typeof detail.lastSavedAt === 'number' ? detail.lastSavedAt : null);
        };

        window.addEventListener("user-setup-sync-status", handleSyncStatus as EventListener);
        return () => window.removeEventListener("user-setup-sync-status", handleSyncStatus as EventListener);
    }, []);

    const syncLabel = React.useMemo(() => {
        if (!isAuthenticated) return '';
        if (syncStatus === 'loading') return 'Loading latest workspace...';
        if (syncStatus === 'saving') return 'Saving...';
        if (syncStatus === 'error') return 'Sync issue';
        if (syncStatus === 'saved' && lastSavedAt) {
            return `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        }
        return 'Workspace synced';
    }, [isAuthenticated, lastSavedAt, syncStatus]);

    React.useEffect(() => {
        if (!isAvatarMenuOpen) return;
        const onClickOutside = (event: MouseEvent) => {
            if (!avatarMenuRef.current) return;
            const target = event.target as Node | null;
            if (target && !avatarMenuRef.current.contains(target)) {
                setIsAvatarMenuOpen(false);
            }
        };
        window.addEventListener("mousedown", onClickOutside);
        return () => window.removeEventListener("mousedown", onClickOutside);
    }, [isAvatarMenuOpen]);

    React.useEffect(() => {
        if (!isNotificationMenuOpen) return;
        const onClickOutside = (event: MouseEvent) => {
            if (!notificationMenuRef.current) return;
            const target = event.target as Node | null;
            if (target && !notificationMenuRef.current.contains(target)) {
                setIsNotificationMenuOpen(false);
            }
        };
        window.addEventListener("mousedown", onClickOutside);
        return () => window.removeEventListener("mousedown", onClickOutside);
    }, [isNotificationMenuOpen]);

    const membershipUi = MEMBERSHIP_UI[membershipTier];
    const membershipLabel = React.useMemo(
        () => getMembershipLabel(membershipTier, locale),
        [locale, membershipTier]
    );

    const handleLogout = React.useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({}),
            });
        } catch {
            // Ignore API failures and clear local session anyway.
        } finally {
            if (typeof window !== "undefined") {
                localStorage.removeItem("auth_access_token");
                localStorage.removeItem("auth_user");
                window.dispatchEvent(new Event("auth-changed"));
                const localeMatch = window.location.pathname.match(/^\/(vi|en)(?:\/|$)/i);
                const locale = localeMatch?.[1]?.toLowerCase();
                window.location.href = locale ? `/${locale}` : "/";
            }
        }
    }, []);

    const handleAlertSavePrice = React.useCallback((newPrice: number) => {
        if (!editingAlert) return;
        updateAlert(editingAlert.id, { price: newPrice, active: true });
        sendMessage({
            topic: 'alert_command',
            command: 'update',
            id: editingAlert.id,
            updates: { price: newPrice, active: true }
        });
    }, [editingAlert, sendMessage, updateAlert]);

    const handleRemoveAlert = React.useCallback((id: string) => {
        removeAlert(id);
        sendMessage({
            topic: 'alert_command',
            command: 'remove',
            id
        });
    }, [removeAlert, sendMessage]);

    return (
        <header className="hidden md:flex h-8 border-b border-white/5 bg-background/40 backdrop-blur-2xl pl-20 pr-4 items-center justify-between shrink-0 sticky top-0 z-[100] transition-all">
            <div className="flex items-center h-full gap-4">
                <div className="hidden lg:block h-full border-r border-white/5 pr-4">
                    <TabContainer />
                </div>
                {isAuthenticated ? (
                    <div className={cn(
                        "hidden lg:flex items-center h-5 px-2 rounded-full border text-[11px] font-semibold tracking-wide",
                        syncStatus === 'error'
                            ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
                            : syncStatus === 'saving' || syncStatus === 'loading'
                                ? "text-sky-300 border-sky-500/30 bg-sky-500/10"
                                : "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                    )}>
                        {syncLabel}
                    </div>
                ) : null}
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={toggleLeftSidebar}
                    className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90 border",
                        isLeftSidebarOpen
                            ? "text-primary bg-primary/10 border-primary/20 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                            : "text-muted-foreground dark:text-white/40 hover:text-foreground dark:hover:text-white hover:bg-secondary/80 dark:hover:bg-white/10 border-border dark:border-white/5 bg-secondary/40"
                    )}
                    title="Toggle Market List"
                >
                    <BarChart2 size={14} className={cn(isLeftSidebarOpen && "text-primary")} />
                </button>

                <div className="flex items-center gap-2 border-r border-border dark:border-white/5 pr-3 h-7">
                    <div className="relative" ref={notificationMenuRef}>
                        <button
                            onClick={() => {
                                setIsNotificationMenuOpen((prev) => !prev);
                                markAllNotificationsAsRead();
                            }}
                            className="h-7 w-7 flex items-center justify-center rounded-full bg-secondary dark:bg-white/[0.05] text-muted-foreground dark:text-white/40 hover:text-foreground dark:hover:text-white hover:bg-secondary/80 dark:hover:bg-white/10 transition-all relative group active:scale-90 border border-border dark:border-white/5"
                            title={tNotifications('buttonTitle')}
                        >
                            <Bell size={14} />
                            {unreadCount > 0 ? (
                                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-primary text-[11px] leading-[14px] text-primary-foreground font-semibold text-center">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            ) : null}
                        </button>
                        {isNotificationMenuOpen ? (
                            <div className="absolute right-0 top-8 w-[360px] max-h-[70vh] overflow-y-auto rounded-md border border-border dark:border-white/10 bg-background/95 backdrop-blur p-2 shadow-lg z-[160]">
                                <div className="flex items-center justify-between px-1 pb-2 border-b border-border dark:border-white/10">
                                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{tNotifications('title')}</span>
                                    <button
                                        onClick={clearNotificationHistory}
                                        className="text-[11px] text-muted-foreground hover:text-foreground"
                                    >
                                        {tNotifications('clearHistory')}
                                    </button>
                                </div>

                                <div className="pt-2">
                                    <div className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">{tNotifications('toastHistory')}</div>
                                    {notificationHistory.length === 0 ? (
                                        <div className="px-1 py-2 text-xs text-muted-foreground">{tNotifications('noNotificationsYet')}</div>
                                    ) : (
                                        <div className="space-y-1 mt-1">
                                            {[...notificationHistory].reverse().map((item) => (
                                                <div key={item.id} className="rounded border border-border dark:border-white/10 p-2">
                                                    <div className="text-xs text-foreground dark:text-white">{item.message}</div>
                                                    <div className="text-[11px] text-muted-foreground mt-1">
                                                        {new Date(item.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-3">
                                    <div className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">{tNotifications('priceAlertsOnChart')}</div>
                                    {alerts.length === 0 ? (
                                        <div className="px-1 py-2 text-xs text-muted-foreground">{tNotifications('noPriceAlerts')}</div>
                                    ) : (
                                        <div className="space-y-1 mt-1">
                                            {alerts.map((alert) => (
                                                <div key={alert.id} className="rounded border border-border dark:border-white/10 p-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <div className="text-xs text-foreground dark:text-white">{alert.symbol} @ {alert.price}</div>
                                                            <div className="text-[11px] text-muted-foreground">
                                                                {alert.active ? tNotifications('active') : tNotifications('triggeredInactive')}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => setEditingAlert({ id: alert.id, symbol: alert.symbol, price: alert.price })}
                                                                className="px-2 h-6 rounded text-[11px] bg-secondary hover:bg-secondary/80 text-foreground"
                                                            >
                                                                {tNotifications('edit')}
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoveAlert(alert.id)}
                                                                className="px-2 h-6 rounded text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-500"
                                                            >
                                                                {tNotifications('remove')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-2 pl-2 group cursor-pointer h-7">
                    <Link
                        href={`/${locale}/pricing`}
                        className="hidden sm:flex h-7 w-7 items-center justify-center rounded-full border border-amber-300 bg-amber-500 text-slate-950 shadow-[0_0_14px_rgba(245,158,11,0.35)] transition-all hover:bg-amber-400 active:scale-90"
                        title="Ủng hộ Vivutrade"
                    >
                        <HeartHandshake size={14} />
                    </Link>

                    {!isAuthenticated ? (
                        <GoogleSignInButton
                            className="mr-1"
                            text="signin_with"
                            size="small"
                            width={170}
                            redirectTo="/chart"
                        />
                    ) : null}

                    {isAuthenticated ? (
                        <>
                            <div className="hidden sm:flex flex-col items-end justify-center">
                                <span className="text-[10px] font-bold text-foreground dark:text-white group-hover:text-primary transition-colors tracking-tight leading-none">{displayName}</span>
                                <div className={cn("flex items-center gap-1 px-1 py-[1px] rounded-full mt-[2px]", membershipUi.badgeClassName)}>
                                    <span className={cn("w-[3px] h-[3px] rounded-full", membershipUi.dotClassName)} />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.04em] leading-none">{membershipLabel}</span>
                                </div>
                            </div>

                            <div className="relative" ref={avatarMenuRef}>
                                <button
                                    onClick={() => setIsAvatarMenuOpen((prev) => !prev)}
                                    className={cn(
                                        "w-7 h-7 rounded-full bg-secondary dark:bg-white/[0.05] border p-[1px] shadow-sm transition-all duration-500",
                                        membershipUi.avatarBorderClassName
                                    )}
                                    title="Account menu"
                                >
                                    <div className={cn("w-full h-full rounded-full", membershipUi.avatarInnerClassName)} />
                                </button>
                                {isAvatarMenuOpen ? (
                                    <div className="absolute right-0 top-8 w-44 rounded-md border border-border dark:border-white/10 bg-background/95 backdrop-blur p-1 shadow-lg z-[140]">
                                        <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Quick Controls</div>
                                        <div className="px-2 py-1.5 flex items-center justify-between rounded hover:bg-secondary/60 dark:hover:bg-white/10">
                                            <span className="text-xs text-foreground dark:text-white">Dark Mode</span>
                                            <ThemeToggle />
                                        </div>
                                        <div className="px-2 py-1.5 flex items-center justify-between rounded hover:bg-secondary/60 dark:hover:bg-white/10">
                                            <span className="text-xs text-foreground dark:text-white">Theme Color</span>
                                            <ThemeColorSwitcher />
                                        </div>
                                        <div className="px-2 py-1.5 flex items-center justify-between rounded hover:bg-secondary/60 dark:hover:bg-white/10">
                                            <span className="text-xs text-foreground dark:text-white">Voice Alerts</span>
                                            <button
                                                onClick={() => setVoiceAlertsEnabled(!voiceAlertsEnabled)}
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
                                        </div>
                                        <div className="px-2 py-1.5 flex items-center justify-between rounded hover:bg-secondary/60 dark:hover:bg-white/10">
                                            <span className="text-xs text-foreground dark:text-white">Pre-generated Audio</span>
                                            <button
                                                onClick={() => setVoiceAlertsUsePreGeneratedAudio(!voiceAlertsUsePreGeneratedAudio)}
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
                                        </div>
                                        <div className="px-2 py-1.5 flex items-center justify-between rounded hover:bg-secondary/60 dark:hover:bg-white/10">
                                            <span className="text-xs text-foreground dark:text-white">Test Voice Notification</span>
                                            <button
                                                onClick={handleTestVoice}
                                                className="p-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors active:scale-90"
                                                title="Click to test voice notification"
                                            >
                                                <Volume2 size={16} />
                                            </button>
                                        </div>
                                        <div className="my-1 h-px bg-border dark:bg-white/10" />
                                    <button
                                        onClick={() => {
                                            setIsAvatarMenuOpen(false);
                                            setIsTelegramDialogOpen(true);
                                        }}
                                        className="w-full h-8 px-2 rounded text-xs flex items-center gap-2 text-foreground dark:text-white hover:bg-secondary/80 dark:hover:bg-white/10"
                                    >
                                        <Bell size={13} />
                                        <span>Telegram Alerts</span>
                                    </button>
                                        <button
                                            onClick={() => {
                                                setIsAvatarMenuOpen(false);
                                                toggleRightSidebar();
                                            }}
                                            className="w-full h-8 px-2 rounded text-xs flex items-center gap-2 text-foreground dark:text-white hover:bg-secondary/80 dark:hover:bg-white/10"
                                        >
                                            <Settings size={13} />
                                            <span>Settings</span>
                                        </button>
                                        <button
                                        onClick={() => {
                                            setIsAvatarMenuOpen(false);
                                            void handleLogout();
                                        }}
                                        className="w-full h-8 px-2 rounded text-xs flex items-center gap-2 text-red-500 hover:bg-red-500/10"
                                    >
                                        <LogOut size={13} />
                                        <span>Logout</span>
                                    </button>
                                    </div>
                                ) : null}
                            </div>
                        </>
                    ) : null}

                    <button
                        onClick={toggleRightSidebar}
                        className={cn(
                            "w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-90 border",
                            isRightSidebarOpen
                                ? "text-primary bg-primary/10 border-primary/20"
                                : "text-muted-foreground dark:text-white/30 hover:text-foreground dark:hover:text-white hover:bg-secondary dark:hover:bg-white/5 border-border dark:border-transparent mt-0"
                        )}
                    >
                        <PanelRightClose size={14} />
                    </button>
                </div>
            </div>
            <TelegramLinkDialog
                open={isTelegramDialogOpen}
                onClose={() => setIsTelegramDialogOpen(false)}
            />
            {editingAlert ? (
                <AlertEditDialog
                    alertId={editingAlert.id}
                    symbol={editingAlert.symbol}
                    currentPrice={editingAlert.price}
                    onSave={handleAlertSavePrice}
                    onClose={() => setEditingAlert(null)}
                />
            ) : null}
        </header>
    );
});
