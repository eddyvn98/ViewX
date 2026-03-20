import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { ChartItem } from './ChartItem';

export const ChartGrid = memo(function ChartGrid() {
    const [isPortraitMobile, setIsPortraitMobile] = useState(false);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const previousRectsRef = useRef<Record<string, DOMRect>>({});

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
    const charts = activeTab?.charts ?? {};
    const activeChartId = activeTab?.activeChartId ?? null;
    const maximizedChartId = activeTab?.maximizedChartId ?? null;
    const rows = activeTab?.rows ?? 1;
    const cols = activeTab?.cols ?? 1;
    const hasActiveTab = !!activeTab;
    const hasCharts = Object.keys(charts).length > 0;
    const desktopRows = Number.isFinite(Number(rows)) && Number(rows) > 0 ? Number(rows) : 1;
    const desktopCols = Number.isFinite(Number(cols)) && Number(cols) > 0 ? Number(cols) : 1;
    const safeRows = isPortraitMobile ? 1 : desktopRows;
    const safeCols = isPortraitMobile ? 1 : desktopCols;
    const chartList = Object.values(charts);

    const visibleCharts = maximizedChartId ? [charts[maximizedChartId]].filter(Boolean) :
        (isPortraitMobile || (safeRows === 1 && safeCols === 1)
            ? (activeChartId ? [charts[activeChartId]].filter(Boolean) : chartList.slice(0, 1))
            : chartList.slice(0, safeRows * safeCols));

    const effectiveGrid = useMemo(() => {
        const count = visibleCharts.length;
        if (count <= 1) return { rows: 1, cols: 1 };

        let bestRows = safeRows;
        let bestCols = safeCols;
        let bestWaste = Number.POSITIVE_INFINITY;
        let bestRatioDelta = Number.POSITIVE_INFINITY;
        const targetRatio = safeCols / safeRows;

        for (let r = 1; r <= safeRows; r++) {
            for (let c = 1; c <= safeCols; c++) {
                const capacity = r * c;
                if (capacity < count) continue;

                const waste = capacity - count;
                const ratioDelta = Math.abs((c / r) - targetRatio);
                if (
                    waste < bestWaste ||
                    (waste === bestWaste && ratioDelta < bestRatioDelta) ||
                    (waste === bestWaste && ratioDelta === bestRatioDelta && capacity < (bestRows * bestCols))
                ) {
                    bestRows = r;
                    bestCols = c;
                    bestWaste = waste;
                    bestRatioDelta = ratioDelta;
                }
            }
        }

        return { rows: bestRows, cols: bestCols };
    }, [safeRows, safeCols, visibleCharts.length]);

    useLayoutEffect(() => {
        if (!hasActiveTab || !hasCharts) return;

        const nextRects: Record<string, DOMRect> = {};
        for (const chart of visibleCharts) {
            const element = itemRefs.current[chart.id];
            if (!element) continue;
            const nextRect = element.getBoundingClientRect();
            nextRects[chart.id] = nextRect;

            const prevRect = previousRectsRef.current[chart.id];
            if (!prevRect) {
                element.animate(
                    [
                        { opacity: 0.75, transform: 'scale(0.985)' },
                        { opacity: 1, transform: 'scale(1)' }
                    ],
                    { duration: 220, easing: 'ease-out' }
                );
                continue;
            }

            const deltaX = prevRect.left - nextRect.left;
            const deltaY = prevRect.top - nextRect.top;
            const scaleX = prevRect.width > 0 ? prevRect.width / nextRect.width : 1;
            const scaleY = prevRect.height > 0 ? prevRect.height / nextRect.height : 1;

            if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5 && Math.abs(scaleX - 1) < 0.01 && Math.abs(scaleY - 1) < 0.01) {
                continue;
            }

            element.animate(
                [
                    { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})` },
                    { transform: 'translate(0px, 0px) scale(1, 1)' }
                ],
                { duration: 280, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
            );
        }

        previousRectsRef.current = nextRects;
    }, [effectiveGrid.cols, effectiveGrid.rows, hasActiveTab, hasCharts, visibleCharts]);

    if (!hasActiveTab || !hasCharts) return null;

    return (
        <div
            className="flex-1 min-h-0 grid gap-1 p-1 bg-secondary/5"
            style={{
                gridTemplateColumns: `repeat(${effectiveGrid.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${effectiveGrid.rows}, minmax(0, 1fr))`
            }}
        >
            {visibleCharts.map((chart) => (
                <div
                    key={chart.id}
                    ref={(node) => {
                        itemRefs.current[chart.id] = node;
                    }}
                    className="min-h-0 min-w-0 h-full w-full"
                >
                    <ChartItem
                        chart={chart}
                        isActive={activeChartId === chart.id}
                        isMaximized={!!maximizedChartId}
                        canClose={chartList.length > 1}
                    />
                </div>
            ))}
        </div>
    );
});
