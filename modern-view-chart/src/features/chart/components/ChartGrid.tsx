import React, { memo, useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { ChartItem } from './ChartItem';

export const ChartGrid = memo(function ChartGrid() {
    useEffect(() => {
        const state = useMarketStore.getState();
        const activeTab = state.tabs[state.activeTabId];
        const hasUsableActiveTab = activeTab && activeTab.charts && Object.keys(activeTab.charts).length > 0;
        if (hasUsableActiveTab) return;

        useMarketStore.setState({
            tabs: {
                'default-tab': {
                    id: 'default-tab',
                    name: 'Workspace 1',
                    charts: {
                        default: {
                            id: 'default',
                            symbol: 'XAUUSDm',
                            interval: '1',
                            source: 'MT5',
                            group: 'A',
                            chartType: 'smart_candles',
                            timezone: 'Asia/Ho_Chi_Minh',
                        },
                    },
                    activeChartId: 'default',
                    maximizedChartId: null,
                    layoutMode: '1x1',
                    rows: 1,
                    cols: 1,
                },
            },
            activeTabId: 'default-tab',
        });
    }, []);

    const activeTab = useMarketStore((state) => state.tabs[state.activeTabId]);
    if (!activeTab) return null;

    const { charts, activeChartId, maximizedChartId, rows, cols } = activeTab;
    if (!charts || Object.keys(charts).length === 0) return null;
    const safeRows = Number.isFinite(Number(rows)) && Number(rows) > 0 ? Number(rows) : 1;
    const safeCols = Number.isFinite(Number(cols)) && Number(cols) > 0 ? Number(cols) : 1;
    const chartList = Object.values(charts);

    const visibleCharts = maximizedChartId ? [charts[maximizedChartId]].filter(Boolean) :
        (safeRows === 1 && safeCols === 1 ? (activeChartId ? [charts[activeChartId]].filter(Boolean) : chartList.slice(0, 1)) : chartList.slice(0, safeRows * safeCols));

    return (
        <div
            className="flex-1 min-h-0 grid gap-1 p-1 bg-secondary/5"
            style={{
                gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${safeRows}, minmax(0, 1fr))`
            }}
        >
            {visibleCharts.map((chart) => (
                <ChartItem
                    key={chart.id}
                    chart={chart}
                    isActive={activeChartId === chart.id}
                    isMaximized={!!maximizedChartId}
                    canClose={chartList.length > 1}
                />
            ))}
        </div>
    );
});
