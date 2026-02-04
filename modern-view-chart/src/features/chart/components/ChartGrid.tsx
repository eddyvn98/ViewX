'use client';

import { useMarketStore } from '@/lib/store';
import { ChartItem } from './ChartItem';

export function ChartGrid() {
    const activeTab = useMarketStore((state) => state.tabs[state.activeTabId]);
    if (!activeTab) return null;

    const { charts, activeChartId, maximizedChartId, layoutMode } = activeTab;
    const chartList = Object.values(charts);

    const visibleCharts = maximizedChartId ? [charts[maximizedChartId]].filter(Boolean) :
        (layoutMode === '1x1' ? (activeChartId ? [charts[activeChartId]].filter(Boolean) : chartList.slice(0, 1)) : chartList);

    const getGridClass = () => {
        switch (layoutMode) {
            case '2x1': return 'grid-cols-1 grid-rows-2';
            case '2x2': return 'grid-cols-2 grid-rows-2';
            case '3x2': return 'grid-cols-3 grid-rows-2';
            default: return 'grid-cols-1 grid-rows-1';
        }
    };

    return (
        <div className={`flex-1 min-h-0 grid gap-2 ${getGridClass()}`}>
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
}
