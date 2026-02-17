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

    const addChart = useMarketStore((state) => state.addChart);
    const updateChart = useMarketStore((state) => state.updateChart);
    const { broadcastSymbolChange } = useCrossWindowSync();

    // Enable cross-window sync listening
    useCrossWindowSync();

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
                            [chartId]: { id: chartId, symbol, interval, source, group: 'A', chartType: 'candles' }
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
    }, [chartId, symbol, interval, source]);

    // Connect WebSocket
    useWebSocket();

    return (
        <div className="h-screen w-screen bg-zinc-950 overflow-hidden flex flex-col">
            <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-300 uppercase">
                        {symbol} • {interval}m ({source})
                    </span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                    STANDALONE MODE • ID: {chartId}
                </div>
            </div>
            <div className="flex-1 min-h-0">
                <ChartContainer chartId={chartId} />
            </div>
        </div>
    );
}
