'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { ChartContainer } from '@/features/chart/ChartContainer';
import { useWebSocket } from '@/hooks/use-websocket';
import { useMarketStore } from '@/lib/store';
import { useEffect } from 'react';
import { useCrossWindowSync } from '@/hooks/use-cross-window-sync';

export default function StandaloneChartPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const chartId = params.id as string;

    // Extract initial config from URL
    const symbol = searchParams.get('symbol') || 'XAUUSDm';
    const interval = searchParams.get('interval') || '1';
    const source = (searchParams.get('source') || 'MT5') as any;

    const chart = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            if (tab.charts[chartId]) return tab.charts[chartId];
        }
        return null;
    });

    const activeSymbol = chart?.symbol || symbol;
    const activeInterval = chart?.interval || interval;
    const activeSource = chart?.source || source;

    // Update document title dynamically
    useEffect(() => {
        if (activeSymbol) {
            document.title = `${activeSymbol} • ${activeInterval}m | vivutrade Chart`;
        }
    }, [activeSymbol, activeInterval]);

    // Initialize standalone chart
    useEffect(() => {
        // Find if any tab has this chart
        const state = useMarketStore.getState();
        let found = false;
        for (const tab of Object.values(state.tabs)) {
            if (tab.charts[chartId]) {
                found = true;
                break;
            }
        }

        if (!found) {
            // Add chart to a default tab in this window's store
            useMarketStore.setState((s) => ({
                tabs: {
                    ...s.tabs,
                    'standalone-tab': {
                        id: 'standalone-tab',
                        name: 'Standalone',
                        charts: {
                            ...s.tabs['standalone-tab']?.charts,
                            [chartId]: { id: chartId, symbol: activeSymbol, interval: activeInterval, source: activeSource, group: 'A', chartType: 'candles' }
                        },
                        activeChartId: chartId,
                        maximizedChartId: null,
                        layoutMode: '1x1',
                        rows: 1,
                        cols: 1
                    }
                }
            }));
        }
    }, [chartId, activeSymbol, activeInterval, activeSource]);

    // Connect WebSocket
    useWebSocket();

    return (
        <div className="h-screen w-screen bg-zinc-950 overflow-hidden flex flex-col">
            {/* Premium Header */}
            <div className="px-4 py-2.5 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5 flex justify-between items-center shrink-0 shadow-2xl relative z-50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-md border border-white/10">
                        <span className="text-xs font-black text-primary uppercase tracking-wider">
                            {activeSymbol}
                        </span>
                        <div className="w-[1px] h-3 bg-white/10" />
                        <span className="text-[10px] font-bold text-zinc-400">
                            {activeInterval}m
                        </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest hidden sm:inline">
                        {activeSource} Engine
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">Live Sync Active</span>
                    </div>
                    <div className="text-[10px] text-zinc-600 font-mono hidden md:block">
                        CHART_ID: {chartId.split('-')[0]}...
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative">
                {/* Subtle Glow Effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent z-10" />
                <ChartContainer chartId={chartId} />
            </div>
        </div>
    );
}
