'use client';
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RootState } from '@/lib/store';

import { Plus, Crosshair, Link, History as HistoryIcon, Pencil } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { TimeframeToolbar } from './TimeframeToolbar';
import { LayoutGridSelector } from './LayoutGridSelector';
import { ChartClock } from './ChartClock';
import { cn } from '@/lib/utils';

type ChartGroup = 'none' | 'A' | 'B' | 'C' | 'D';
type ChartType = 'candles' | 'heikin_ashi' | 'smart_candles';

const NEXT_GROUP: Record<ChartGroup, ChartGroup> = {
    none: 'A',
    A: 'B',
    B: 'C',
    C: 'D',
    D: 'none',
};

const NEXT_CHART_TYPE: Record<ChartType, ChartType> = {
    candles: 'heikin_ashi',
    heikin_ashi: 'smart_candles',
    smart_candles: 'candles',
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

    const setLayoutMode = useMarketStore((state) => state.setLayoutMode);
    const addChart = useMarketStore((state) => state.addChart);
    const updateChart = useMarketStore((state) => state.updateChart);
    const setCrosshairSync = useMarketStore((state) => state.setCrosshairSync);
    const isDrawingToolbarVisible = useMarketStore((state) => state.isDrawingToolbarVisible);
    const showHistoryMarkers = useStrategyStore((state) => state.showHistoryMarkers);

    const handleAddChart = () => {
        const state = useMarketStore.getState();
        const activeTab = state.tabs[state.activeTabId];
        const currentCount = Object.keys(activeTab?.charts || {}).length;
        addChart('BTCUSDm', '15', 'MT5');
        const newCount = currentCount + 1;
        if (newCount === 2) setLayoutMode('2x1');
        else if (newCount >= 3) setLayoutMode('2x2');
    };

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

                    <button
                        onClick={() => {
                            if (!activeChart) return;
                            const currentType = activeChart.chartType as ChartType;
                            const nextType = NEXT_CHART_TYPE[currentType] || 'candles';
                            useMarketStore.getState().setChartType(activeChart.id, nextType);
                        }}
                        className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-black uppercase transition-all active:scale-95 border",
                            activeChart?.chartType !== 'candles'
                                ? "text-primary border-primary/30 bg-primary/10"
                                : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary/40"
                        )}
                        title="Rotate Chart Type (Candles / HA / Smart)"
                    >
                        {activeChart?.chartType === 'heikin_ashi' ? 'HA' : activeChart?.chartType === 'smart_candles' ? 'SC' : 'C'}
                    </button>

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

                    <button onClick={handleAddChart} className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground hover:text-foreground transition-all uppercase tracking-wider"><Plus size={13} className="text-primary" /> Add Chart</button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <ChartClock />
            </div>
        </div>
    );
}
export const ChartsToolbarMemo = memo(ChartsToolbar);
