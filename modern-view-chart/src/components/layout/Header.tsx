import React, { memo } from 'react';
import { Bell, BarChart2, Settings, PanelRightClose, LogOut } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { TabContainer } from './TabContainer';
import { cn } from '@/lib/utils';
import { MobileAccessButton } from '@/features/chart/components/MobileAccessButton';
import { ThemeToggle } from './ThemeToggle';
import { ThemeColorSwitcher } from './ThemeColorSwitcher';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { TelegramLinkDialog } from './TelegramLinkDialog';

export const Header = memo(function Header() {
    const isRightSidebarOpen = useMarketStore((state) => state.isRightSidebarOpen);
    const toggleRightSidebar = useMarketStore((state) => state.toggleRightSidebar);
    const isLeftSidebarOpen = useMarketStore((state) => state.isLeftSidebarOpen);
    const toggleLeftSidebar = useMarketStore((state) => state.toggleLeftSidebar);
    const [displayName, setDisplayName] = React.useState("Guest");
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);
    const [isAvatarMenuOpen, setIsAvatarMenuOpen] = React.useState(false);
    const [isTelegramDialogOpen, setIsTelegramDialogOpen] = React.useState(false);
    const avatarMenuRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (typeof window === "undefined") return;

        const applyUser = () => {
            const raw = localStorage.getItem("auth_user") || "";
            const token = (localStorage.getItem("auth_access_token") || "").trim();
            setIsAuthenticated(Boolean(token));
            if (!raw) {
                setDisplayName("Guest");
                return;
            }
            try {
                const parsed = JSON.parse(raw);
                const name = String(parsed?.display_name || parsed?.username || "").trim();
                if (!name) {
                    setDisplayName("Guest");
                    return;
                }
                setDisplayName(name.split("@")[0]);
            } catch {
                setDisplayName("Guest");
            }
        };

        applyUser();
        window.addEventListener("storage", applyUser);
        return () => window.removeEventListener("storage", applyUser);
    }, []);

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

    return (
        <header className="hidden md:flex h-8 border-b border-white/5 bg-background/40 backdrop-blur-2xl pl-20 pr-4 items-center justify-between shrink-0 sticky top-0 z-[100] transition-all">
            <div className="flex items-center h-full gap-4">
                <div className="hidden lg:block h-full border-r border-white/5 pr-4">
                    <TabContainer />
                </div>
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
                    <button className="h-7 w-7 flex items-center justify-center rounded-full bg-secondary dark:bg-white/[0.05] text-muted-foreground dark:text-white/40 hover:text-foreground dark:hover:text-white hover:bg-secondary/80 dark:hover:bg-white/10 transition-all relative group active:scale-90 border border-border dark:border-white/5">
                        <Bell size={14} />
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full border border-background shadow-[0_0_8px_var(--glow-primary)]" />
                    </button>
                </div>

                <div className="flex items-center gap-2 pl-2 group cursor-pointer h-7">
                    {!isAuthenticated ? (
                        <GoogleSignInButton
                            className="mr-1"
                            text="signin_with"
                            size="small"
                            width={170}
                            redirectTo="/chart"
                        />
                    ) : null}

                    <div className="hidden sm:flex flex-col items-end justify-center">
                        <span className="text-[9px] font-bold text-foreground dark:text-white group-hover:text-primary transition-colors tracking-tight leading-none">{displayName}</span>
                        <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded-full mt-0.5">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                            <span className="text-[7px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">{isAuthenticated ? "PRO" : "GUEST"}</span>
                        </div>
                    </div>

                    <div className="relative" ref={avatarMenuRef}>
                        <button
                            onClick={() => setIsAvatarMenuOpen((prev) => !prev)}
                            className="w-7 h-7 rounded-full bg-secondary dark:bg-white/[0.05] border border-border dark:border-white/10 p-[1px] shadow-sm group-hover:border-primary/40 transition-all duration-500"
                            title="Account menu"
                        >
                            <div className="w-full h-full rounded-full bg-background/40" />
                        </button>
                        {isAvatarMenuOpen ? (
                            <div className="absolute right-0 top-8 w-44 rounded-md border border-border dark:border-white/10 bg-background/95 backdrop-blur p-1 shadow-lg z-[140]">
                                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Quick Controls</div>
                                <div className="px-2 py-1.5 flex items-center justify-between rounded hover:bg-secondary/60 dark:hover:bg-white/10">
                                    <span className="text-xs text-foreground dark:text-white">Mobile Access</span>
                                    <MobileAccessButton />
                                </div>
                                <div className="px-2 py-1.5 flex items-center justify-between rounded hover:bg-secondary/60 dark:hover:bg-white/10">
                                    <span className="text-xs text-foreground dark:text-white">Dark Mode</span>
                                    <ThemeToggle />
                                </div>
                                <div className="px-2 py-1.5 flex items-center justify-between rounded hover:bg-secondary/60 dark:hover:bg-white/10">
                                    <span className="text-xs text-foreground dark:text-white">Theme Color</span>
                                    <ThemeColorSwitcher />
                                </div>
                                <div className="my-1 h-px bg-border dark:bg-white/10" />
                                {isAuthenticated ? (
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
                                ) : null}
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
                                {isAuthenticated ? (
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
                                ) : null}
                            </div>
                        ) : null}
                    </div>

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
        </header>
    );
});
