import React, { memo } from 'react';
import { Bell, BarChart2, Settings, PanelRightClose } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { TabContainer } from './TabContainer';
import { cn } from '@/lib/utils';
import { MobileAccessButton } from '@/features/chart/components/MobileAccessButton';
import { ThemeToggle } from './ThemeToggle';
import { ThemeColorSwitcher } from './ThemeColorSwitcher';

export const Header = memo(function Header() {
    const isRightSidebarOpen = useMarketStore((state) => state.isRightSidebarOpen);
    const toggleRightSidebar = useMarketStore((state) => state.toggleRightSidebar);
    const isLeftSidebarOpen = useMarketStore((state) => state.isLeftSidebarOpen);
    const toggleLeftSidebar = useMarketStore((state) => state.toggleLeftSidebar);

    return (
        <header className="hidden md:flex h-8 border-b border-white/5 bg-background/40 backdrop-blur-2xl pl-20 pr-4 items-center justify-between shrink-0 sticky top-0 z-[100] transition-all">
            <div className="flex items-center h-full gap-4">
                <div className="hidden lg:block h-full border-r border-white/5 pr-4">
                    <TabContainer />
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Market List Toggle - Replaced Search */}
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
                    <MobileAccessButton />
                    <ThemeToggle />
                    <ThemeColorSwitcher />
                    <button className="h-7 w-7 flex items-center justify-center rounded-full bg-secondary dark:bg-white/[0.05] text-muted-foreground dark:text-white/40 hover:text-foreground dark:hover:text-white hover:bg-secondary/80 dark:hover:bg-white/10 transition-all relative group active:scale-90 border border-border dark:border-white/5">
                        <Bell size={14} />
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full border border-background shadow-[0_0_8px_var(--glow-primary)]" />
                    </button>
                    <button className="h-7 w-7 flex items-center justify-center rounded-full bg-secondary dark:bg-white/[0.05] text-muted-foreground dark:text-white/40 hover:text-foreground dark:hover:text-white hover:bg-secondary/80 dark:hover:bg-white/10 transition-all active:scale-90 border border-border dark:border-white/5">
                        <Settings size={14} />
                    </button>
                </div>

                <div className="flex items-center gap-2 pl-2 group cursor-pointer h-7">
                    <div className="hidden sm:flex flex-col items-end justify-center">
                        <span className="text-[9px] font-bold text-foreground dark:text-white group-hover:text-primary transition-colors tracking-tight leading-none">Alex</span>
                        <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded-full mt-0.5">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                            <span className="text-[7px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">PRO</span>
                        </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-secondary dark:bg-white/[0.05] border border-border dark:border-white/10 p-[1px] shadow-sm group-hover:border-primary/40 transition-all duration-500">
                        <div className="w-full h-full rounded-full bg-background/40" />
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
        </header>
    );
});
