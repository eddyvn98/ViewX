import React, { memo } from 'react';
import { useMarketStore } from '@/lib/store';
import { ChartItem } from './ChartItem';

export const ChartGrid = memo(function ChartGrid() {
    const activeTab = useMarketStore((state) => state.tabs[state.activeTabId]);
    if (!activeTab) return null;

    const { charts, activeChartId, maximizedChartId, rows, cols } = activeTab;
    const chartList = Object.values(charts);

    const visibleCharts = maximizedChartId ? [charts[maximizedChartId]].filter(Boolean) :
        (rows === 1 && cols === 1 ? (activeChartId ? [charts[activeChartId]].filter(Boolean) : chartList.slice(0, 1)) : chartList.slice(0, rows * cols));

    return (
        <div
            className="flex-1 min-h-0 grid gap-1 p-1 bg-secondary/5"
            style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
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
