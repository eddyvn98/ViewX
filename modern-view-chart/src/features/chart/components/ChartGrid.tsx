import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { ChartItem } from './ChartItem';
import { debugLog } from '@/lib/debug';

export const ChartGrid = memo(function ChartGrid() {
    const [isPortraitMobile, setIsPortraitMobile] = useState(false);
    const [enteringChartIds, setEnteringChartIds] = useState<string[]>([]);
    const previousVisibleIdsRef = useRef<string[]>([]);
    const setLayoutMode = useMarketStore((state) => state.setLayoutMode);

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

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updateViewportMode = () => {
            const source = window.visualViewport;
            const width = Math.round(source?.width ?? window.innerWidth);
            const height = Math.round(source?.height ?? window.innerHeight);
            setIsPortraitMobile(width < 768 && height >= width);
        };

        updateViewportMode();
        window.addEventListener('resize', updateViewportMode);
        window.addEventListener('orientationchange', updateViewportMode);
        window.visualViewport?.addEventListener('resize', updateViewportMode);

        return () => {
            window.removeEventListener('resize', updateViewportMode);
            window.removeEventListener('orientationchange', updateViewportMode);
            window.visualViewport?.removeEventListener('resize', updateViewportMode);
        };
    }, []);

    const activeTab = useMarketStore((state) => state.tabs[state.activeTabId]);
    const charts = activeTab?.charts;
    const rows = activeTab?.rows ?? 1;
    const cols = activeTab?.cols ?? 1;
    const chartCount = charts ? Object.keys(charts).length : 0;
    const expectedCount = Math.max(1, (Number(rows) || 1) * (Number(cols) || 1));
    const activeChartId = activeTab?.activeChartId ?? null;
    const maximizedChartId = activeTab?.maximizedChartId ?? null;
    const chartList = useMemo(() => (charts ? Object.values(charts) : []), [charts]);

    useEffect(() => {
        if (!activeTab) return;
        if (!charts || chartCount === 0) return;
        if (chartCount >= expectedCount) return;

        debugLog('[ChartGrid][repair-missing-charts]', {
            tabId: activeTab.id,
            layoutMode: activeTab.layoutMode,
            chartCount,
            expectedCount,
        });

        setLayoutMode(activeTab.layoutMode || `${rows}x${cols}`, rows, cols);
    }, [activeTab, chartCount, charts, cols, expectedCount, rows, setLayoutMode]);

    const hasRenderableCharts = !!activeTab && !!charts && chartList.length > 0;

    const desktopRows = Number.isFinite(Number(rows)) && Number(rows) > 0 ? Number(rows) : 1;
    const desktopCols = Number.isFinite(Number(cols)) && Number(cols) > 0 ? Number(cols) : 1;
    const safeRows = isPortraitMobile ? 1 : desktopRows;
    const safeCols = isPortraitMobile ? 1 : desktopCols;

    const visibleCharts = useMemo(
        () =>
            !hasRenderableCharts
                ? []
                : (maximizedChartId ? [charts![maximizedChartId]].filter(Boolean) :
                    (isPortraitMobile || (safeRows === 1 && safeCols === 1)
                        ? (activeChartId ? [charts![activeChartId]].filter(Boolean) : chartList.slice(0, 1))
                        : chartList.slice(0, safeRows * safeCols))),
        [activeChartId, chartList, charts, hasRenderableCharts, isPortraitMobile, maximizedChartId, safeCols, safeRows]
    );

    useEffect(() => {
        if (!hasRenderableCharts) return;
        const nextVisibleIds = visibleCharts.map((chart) => chart.id);
        const prevVisibleIds = previousVisibleIdsRef.current;
        const addedIds = nextVisibleIds.filter((id) => !prevVisibleIds.includes(id));

        if (addedIds.length > 0) {
            setEnteringChartIds((current) => Array.from(new Set([...current, ...addedIds])));
            const timeoutId = window.setTimeout(() => {
                setEnteringChartIds((current) => current.filter((id) => !addedIds.includes(id)));
            }, 360);

            previousVisibleIdsRef.current = nextVisibleIds;
            return () => window.clearTimeout(timeoutId);
        }

        previousVisibleIdsRef.current = nextVisibleIds;
    }, [hasRenderableCharts, visibleCharts]);

    if (!activeTab || !charts || chartList.length === 0) return null;

    debugLog('[ChartGrid][render]', {
        tabId: activeTab.id,
        layoutMode: activeTab.layoutMode,
        rows,
        cols,
        chartIds: chartList.map((chart) => chart.id),
        activeChartId,
        visibleChartIds: visibleCharts.map((chart) => chart.id),
        visibleCount: visibleCharts.length,
    });

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
                    isEntering={enteringChartIds.includes(chart.id)}
                />
            ))}
        </div>
    );
});
