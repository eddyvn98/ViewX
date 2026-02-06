'use client';
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RootState } from '@/lib/store';

import { Plus, Crosshair, Link } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { TimeframeToolbar } from './TimeframeToolbar';
import { TimezoneSelector } from './TimezoneSelector';
import { LayoutGridSelector } from './LayoutGridSelector';
import { ChartClock } from './ChartClock';
import { cn } from '@/lib/utils';

export function ChartsToolbar() {
    const { layoutMode, activeChartId, activeChart } = useMarketStore(useShallow((state: RootState) => {
        const activeTab = state.activeTabId ? state.tabs[state.activeTabId] : null;
        const activeChartId = activeTab?.activeChartId;
        const activeChart = activeChartId ? activeTab.charts[activeChartId] : null;
        return {
            layoutMode: activeTab?.layoutMode || '1x1',
            activeChartId,
            activeChart
        };
    }));

    const { isConnected, isTerminalVisible, isCrosshairSyncEnabled } = useMarketStore(useShallow((state: RootState) => ({
        isConnected: state.isConnected,
        isTerminalVisible: state.isTerminalVisible,
        isCrosshairSyncEnabled: state.isCrosshairSyncEnabled
    })));

    const setLayoutMode = useMarketStore((state) => state.setLayoutMode);
    const addChart = useMarketStore((state) => state.addChart);
    const updateChart = useMarketStore((state) => state.updateChart);
    const setTerminalVisible = useMarketStore((state) => state.setTerminalVisible);
    const setCrosshairSync = useMarketStore((state) => state.setCrosshairSync);

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
        <div className="flex items-center justify-between px-2 py-0.5 shrink-0 bg-transparent border-b border-zinc-800/50">
            <div className="flex items-center gap-2 h-full">
                {/* Timeframe Selector */}
                <div className="flex items-center gap-0.5 pr-2 h-full">
                    <TimeframeToolbar />
                </div>

                <div className="h-4 w-[1px] bg-zinc-800" />

                <div className="flex items-center gap-0.5 px-2">
                    <button
                        onClick={() => {
                            if (!activeChart) return;
                            const groups: any = { 'none': 'A', 'A': 'B', 'B': 'C', 'C': 'D', 'D': 'none' };
                            updateChart(activeChart.id, { group: groups[activeChart.group || 'none'] });
                        }}
                        className={cn(
                            "p-1.5 rounded transition-colors active:scale-95",
                            !activeChart?.group || activeChart.group === 'none'
                                ? "text-zinc-500 hover:text-zinc-300"
                                : "text-blue-500 bg-blue-500/10"
                        )}
                        title={`Symbol Link: ${activeChart?.group || 'None'}`}
                    >
                        <Link size={15} />
                    </button>

                    <button
                        onClick={() => {
                            if (!activeChart) return;
                            const nextType = activeChart.chartType === 'heikin_ashi' ? 'candles' : 'heikin_ashi';
                            useMarketStore.getState().setChartType(activeChart.id, nextType);
                        }}
                        className={cn(
                            "px-2 py-1 rounded text-[10px] font-black uppercase transition-all active:scale-95 border",
                            activeChart?.chartType === 'heikin_ashi'
                                ? "text-orange-500 border-orange-500/30 bg-orange-500/10"
                                : "text-zinc-500 border-zinc-800 hover:text-zinc-300"
                        )}
                        title="Toggle Heikin Ashi"
                    >
                        HA
                    </button>

                    <TimezoneSelector />

                    <LayoutGridSelector />
                </div>

                <div className="h-4 w-[1px] bg-zinc-800" />

                <div className="flex items-center gap-3 pl-2">
                    <button onClick={() => setCrosshairSync(!isCrosshairSyncEnabled)} className={cn("p-1.5 rounded transition-all", isCrosshairSyncEnabled ? "text-purple-500 bg-purple-500/10" : "text-zinc-500 hover:text-zinc-300")} title="Crosshair Sync"><Crosshair size={15} /></button>
                    <button onClick={handleAddChart} className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 hover:text-white transition-all uppercase tracking-wider"><Plus size={14} className="text-blue-500" /> Add Chart</button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <ChartClock />
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-black/20 border border-zinc-800/50">
                    <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500")} />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">{isConnected ? 'Live' : 'Offline'}</span>
                </div>
                <button
                    onClick={() => setTerminalVisible(!isTerminalVisible)}
                    className={cn(
                        "text-[10px] px-3 py-1 rounded font-black uppercase tracking-widest transition-all active:scale-95",
                        isTerminalVisible
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    )}
                >
                    Terminal
                </button>
            </div>
        </div>
    );
}
export const ChartsToolbarMemo = memo(ChartsToolbar);
