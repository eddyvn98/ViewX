'use client';

import React, { memo } from 'react';
import { Menu, BarChart2, Zap, Pencil } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { ThemeColorSwitcher } from './ThemeColorSwitcher';
import { RootState } from '@/lib/store';

interface MobileTopBarProps {
    className?: string;
    compact?: boolean;
    mini?: boolean;
}

export const MobileTopBar = memo(function MobileTopBar({ className, compact = false, mini = false }: MobileTopBarProps) {
    const {
        activeMobileTab,
        setActiveMobileTab,
        activeChart
    } = useMarketStore(useShallow((state: RootState) => {
        const activeTab = state.activeTabId ? state.tabs[state.activeTabId] : null;
        const activeChartId = activeTab?.activeChartId;
        const activeChart = activeChartId ? activeTab.charts[activeChartId] : null;
        return {
            activeMobileTab: state.activeMobileTab,
            setActiveMobileTab: state.setActiveMobileTab,
            activeChart
        };
    }));

    const setChartType = useMarketStore((state) => state.setChartType);
    const isDrawingToolbarVisible = useMarketStore((state) => state.isDrawingToolbarVisible);
    const toggleDrawingToolbar = useMarketStore((state) => state.toggleDrawingToolbar);

    const handleMenuClick = () => {
        if (activeMobileTab === 'menu') {
            setActiveMobileTab('chart');
        } else {
            setActiveMobileTab('menu');
        }
    };

    const handleIndicatorsClick = () => {
        if (activeMobileTab === 'indicators') {
            setActiveMobileTab('chart');
        } else {
            setActiveMobileTab('indicators');
        }
    };

    const handleChartTypeClick = () => {
        if (!activeChart) return;
        // Cycle: candles -> heikin_ashi -> smart_candles -> candles
        const types: Record<'candles' | 'heikin_ashi' | 'smart_candles', 'candles' | 'heikin_ashi' | 'smart_candles'> = {
            candles: 'heikin_ashi',
            heikin_ashi: 'smart_candles',
            smart_candles: 'candles',
        };
        const nextType = types[activeChart.chartType] || 'candles';
        setChartType(activeChart.id, nextType);
    };

    const handleDrawingClick = () => {
        if (activeMobileTab !== 'chart') setActiveMobileTab('chart');
        toggleDrawingToolbar();
    };

    const getChartTypeLabel = (type: string | undefined) => {
        switch (type) {
            case 'heikin_ashi': return 'HA';
            case 'smart_candles': return 'SC';
            default: return 'C';
        }
    };

    return (
        <div className={cn(
            "flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-md border-b border-border z-50 sticky top-0 transition-all duration-300",
            mini ? "px-2 h-8" : compact ? "px-2 h-10" : "px-4 h-12",
            className
        )}>
            {/* Left: Menu */}
            <button
                onClick={handleMenuClick}
                className={cn(
                    "p-2 -ml-2 rounded-full transition-colors active:scale-95",
                    activeMobileTab === 'menu' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                )}
            >
                <Menu size={20} />
            </button>

            {/* Center: Chart Controls */}
            <div className={cn("flex items-center", mini ? "gap-1" : compact ? "gap-1.5" : "gap-3")}>
                <button
                    onClick={handleChartTypeClick}
                    className={cn(
                        "flex items-center rounded-full text-xs font-bold transition-all active:scale-95 border",
                        compact ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5",
                        activeChart?.chartType !== 'candles'
                            ? "text-primary border-primary/30 bg-primary/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                            : "text-muted-foreground border-border/50 bg-secondary/30"
                    )}
                >
                    <BarChart2 size={14} />
                    {!mini && <span>{getChartTypeLabel(activeChart?.chartType)}</span>}
                </button>

                <button
                    onClick={handleIndicatorsClick}
                    className={cn(
                        "flex items-center rounded-full text-xs font-bold transition-all active:scale-95 border",
                        compact ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5",
                        activeMobileTab === 'indicators'
                            ? "text-blue-500 border-blue-500/30 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                            : "text-muted-foreground border-border/50 bg-secondary/30"
                    )}
                >
                    <Zap size={14} />
                    {!mini && <span>Fx</span>}
                </button>

                <button
                    onClick={handleDrawingClick}
                    className={cn(
                        "flex items-center rounded-full text-xs font-bold transition-all active:scale-95 border",
                        compact ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5",
                        isDrawingToolbarVisible
                            ? "text-primary border-primary/30 bg-primary/10 shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                            : "text-muted-foreground border-border/50 bg-secondary/30"
                    )}
                    title="Toggle Drawing Toolbar"
                >
                    <Pencil size={14} />
                    {!compact && !mini && <span>Draw</span>}
                </button>
            </div>

            {/* Right: Theme Controls */}
            <div className={cn("flex items-center", compact ? "gap-1" : "gap-2")}>
                <div className={cn("origin-right", compact ? "scale-75" : "scale-90")}>
                    <ThemeColorSwitcher />
                </div>
                <div className={cn("origin-right", compact ? "scale-75" : "scale-90")}>
                    <ThemeToggle />
                </div>
            </div>
        </div>
    );
});
