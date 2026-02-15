'use client';

import React, { memo } from 'react';
import { Menu, BarChart2, Zap, Layout } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { ThemeColorSwitcher } from './ThemeColorSwitcher';
import { RootState } from '@/lib/store';

export const MobileTopBar = memo(function MobileTopBar() {
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

    const updateChart = useMarketStore((state) => state.updateChart);
    const setChartType = useMarketStore((state) => state.setChartType);

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
        const types: any = { 'candles': 'heikin_ashi', 'heikin_ashi': 'smart_candles', 'smart_candles': 'candles' };
        const nextType = types[activeChart.chartType] || 'candles';
        setChartType(activeChart.id, nextType);
    };

    const getChartTypeLabel = (type: string | undefined) => {
        switch (type) {
            case 'heikin_ashi': return 'HA';
            case 'smart_candles': return 'SC';
            default: return 'C';
        }
    };

    return (
        <div className="md:hidden flex items-center justify-between px-4 h-12 shrink-0 bg-background/80 backdrop-blur-md border-b border-border z-50 sticky top-0 transition-all duration-300">
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
            <div className="flex items-center gap-3">
                <button
                    onClick={handleChartTypeClick}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 border",
                        activeChart?.chartType !== 'candles'
                            ? "text-primary border-primary/30 bg-primary/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                            : "text-muted-foreground border-border/50 bg-secondary/30"
                    )}
                >
                    <BarChart2 size={14} />
                    <span>{getChartTypeLabel(activeChart?.chartType)}</span>
                </button>

                <button
                    onClick={handleIndicatorsClick}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 border",
                        activeMobileTab === 'indicators'
                            ? "text-blue-500 border-blue-500/30 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                            : "text-muted-foreground border-border/50 bg-secondary/30"
                    )}
                >
                    <Zap size={14} />
                    <span>Fx</span>
                </button>
            </div>

            {/* Right: Theme Controls */}
            <div className="flex items-center gap-2">
                <div className="scale-90 origin-right">
                    <ThemeColorSwitcher />
                </div>
                <div className="scale-90 origin-right">
                    <ThemeToggle />
                </div>
            </div>
        </div>
    );
});
