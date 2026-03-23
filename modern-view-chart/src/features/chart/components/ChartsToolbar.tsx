'use client';
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RootState } from '@/lib/store';

import { Crosshair, Link, History as HistoryIcon, Pencil } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { TimeframeToolbar } from './TimeframeToolbar';
import { LayoutGridSelector } from './LayoutGridSelector';
import { ChartClock } from './ChartClock';
import { cn } from '@/lib/utils';
import { CandleTypeToolbar } from './CandleTypeToolbar';

type ChartGroup = 'none' | 'A' | 'B' | 'C' | 'D';

const NEXT_GROUP: Record<ChartGroup, ChartGroup> = {
    none: 'A',
    A: 'B',
    B: 'C',
    C: 'D',
    D: 'none',
};

export function ChartsToolbar() {
    const { activeChart } = useMarketStore(useShallow((state: RootState) => {
        const activeTab = state.activeTabId ? state.tabs[state.activeTabId] : null;
        const activeChartId = activeTab?.activeChartId;
        const activeChart = activeChartId ? activeTab.charts[activeChartId] : null;
        return {
            activeChart
        };
    }));

    const { isCrosshairSyncEnabled } = useMarketStore(useShallow((state: RootState) => ({
        isCrosshairSyncEnabled: state.isCrosshairSyncEnabled
    })));

    const updateChart = useMarketStore((state) => state.updateChart);
    const setCrosshairSync = useMarketStore((state) => state.setCrosshairSync);
    const isDrawingToolbarVisible = useMarketStore((state) => state.isDrawingToolbarVisible);
    const showHistoryMarkers = useStrategyStore((state) => state.showHistoryMarkers);

    return (
        <div className="flex items-center justify-between px-2 py-0 shrink-0 bg-primary/5 backdrop-blur-sm border-b border-primary/10 transition-colors duration-300 relative z-50">
            <div className="flex items-center gap-2 h-full">
                {/* Timeframe Selector */}
                <div className="flex items-center gap-0.5 pr-2 h-full">
                    <TimeframeToolbar />
                </div>

                <div className="h-4 w-[1px] bg-border" />

                <div className="flex items-center gap-0.5 px-2">
                    <button
                        onClick={() => {
                            if (!activeChart) return;
                            const currentGroup = (activeChart.group || 'none') as ChartGroup;
                            updateChart(activeChart.id, { group: NEXT_GROUP[currentGroup] });
                        }}
                        className={cn(
                            "p-1 rounded transition-colors active:scale-95",
                            !activeChart?.group || activeChart.group === 'none'
                                ? "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                                : "text-primary bg-primary/10"
                        )}
                        title={`Symbol Link: ${activeChart?.group || 'None'}`}
                    >
                        <Link size={14} />
                    </button>

                    <CandleTypeToolbar />

                    <LayoutGridSelector />
                </div>

                <div className="h-4 w-[1px] bg-border" />

                <div className="flex items-center gap-2 pl-2">
                    <button
                        onClick={() => useMarketStore.getState().toggleDrawingToolbar()}
                        className={cn(
                            "p-1 rounded transition-all active:scale-95",
                            isDrawingToolbarVisible
                                ? "text-primary bg-primary/10 border border-primary/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                        )}
                        title="Toggle Drawing Toolbar"
                    >
                        <Pencil size={14} />
                    </button>

                    <button onClick={() => setCrosshairSync(!isCrosshairSyncEnabled)} className={cn("p-1 rounded transition-all", isCrosshairSyncEnabled ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40")} title="Crosshair Sync"><Crosshair size={14} /></button>

                    {/* Marker Toggle */}
                    <button
                        onClick={() => useStrategyStore.getState().toggleShowHistoryMarkers()}
                        className={cn(
                            "p-1 rounded transition-all active:scale-95",
                            showHistoryMarkers
                                ? "text-primary bg-primary/10"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        )}
                        title="Toggle Strategy Markers"
                    >
                        <HistoryIcon size={14} />
                    </button>

                </div>
            </div>

            <div className="flex items-center gap-3">
                <ChartClock />
            </div>
        </div>
    );
}
export const ChartsToolbarMemo = memo(ChartsToolbar);
