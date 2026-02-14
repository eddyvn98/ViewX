'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    CandlestickSeries,
    LineSeries,
} from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { getPriceChartOptions, getSubChartOptions, getTimescaleOptions, initialMinW } from '../config/chart-options';
import { createSyncLine, syncVerticalLines, autoSyncLayout } from '../logic/chart-sync';

export function useChartInit(
    priceContainerRef: React.RefObject<HTMLDivElement | null>,
    subchartContainerRef: React.RefObject<HTMLDivElement | null>,
    timescaleContainerRef: React.RefObject<HTMLDivElement | null>,
    chartId: string,
    theme: string = 'dark'
) {
    const [isReady, setIsReady] = useState(false);
    const priceChartRef = useRef<IChartApi | null>(null);
    const subchartChartRef = useRef<IChartApi | null>(null);
    const timescaleChartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const subSyncRef = useRef<ISeriesApi<'Line'> | null>(null);
    const timescaleSyncRef = useRef<ISeriesApi<'Line'> | null>(null);
    const isAutoScrollEnabledRef = useRef(true);
    const themeColor = useMarketStore(state => state.themeColor);

    // Dynamic Theme Update
    useEffect(() => {
        if (!isReady) return;

        if (priceChartRef.current && priceContainerRef.current) {
            priceChartRef.current.applyOptions(getPriceChartOptions(priceContainerRef.current.clientWidth, priceContainerRef.current.clientHeight, theme, themeColor));
        }
        if (subchartChartRef.current && subchartContainerRef.current) {
            subchartChartRef.current.applyOptions(getSubChartOptions(subchartContainerRef.current.clientWidth, subchartContainerRef.current.clientHeight, theme, themeColor));
        }
        if (timescaleChartRef.current && timescaleContainerRef.current) {
            timescaleChartRef.current.applyOptions(getTimescaleOptions(timescaleContainerRef.current.clientWidth, timescaleContainerRef.current.clientHeight, theme, themeColor));
        }
    }, [theme, themeColor, isReady]);

    useEffect(() => {
        if (!priceContainerRef.current || !subchartContainerRef.current || !timescaleContainerRef.current) return;

        // 1. Wait for container to have dimensions (Mobile Fix)
        if (priceContainerRef.current.clientWidth === 0 || priceContainerRef.current.clientHeight === 0) {
            // console.log("[ChartInit] Waiting for dimensions...");
            const timer = setTimeout(() => {
                // Force a re-render to check again
                setIsReady(prev => !prev);
            }, 100);
            return () => clearTimeout(timer);
        }

        /* ================= PRICE CHART ================= */
        const priceChart = createChart(priceContainerRef.current, getPriceChartOptions(priceContainerRef.current.clientWidth, priceContainerRef.current.clientHeight, theme, themeColor));

        /* ================= RSI SUBCHART ================= */
        const subchartChart = createChart(subchartContainerRef.current, getSubChartOptions(subchartContainerRef.current.clientWidth, subchartContainerRef.current.clientHeight, theme, themeColor));

        /* ================= TIMESCALE FOOTER ================= */
        const timescaleChart = createChart(timescaleContainerRef.current, getTimescaleOptions(timescaleContainerRef.current.clientWidth, timescaleContainerRef.current.clientHeight, theme, themeColor));

        const candleSeries = priceChart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            priceLineVisible: true,
            priceLineWidth: 1,
            priceLineStyle: 2, // Dashed
        });

        // Add dummy series to force grid consistency with LineSeries behavior
        priceChart.addSeries(LineSeries as any, { visible: false });

        const subSyncSeries = subchartChart.addSeries(LineSeries as any, { visible: false });
        const footSyncSeries = timescaleChart.addSeries(LineSeries as any, { visible: false });

        /* ================= DOM-BASED CROSSHAIR SYNC ================= */
        const priceLineEl = createSyncLine(priceContainerRef.current);
        const subLineEl = createSyncLine(subchartContainerRef.current);
        const footLineEl = createSyncLine(timescaleContainerRef.current);

        const charts = { priceChart, subchartChart, timescaleChart };
        const elements = { priceLineEl, subLineEl, footLineEl };
        const series = { candleSeries, subSyncSeries, footSyncSeries };

        // Cache last sync values
        let lastSyncTime: number | null = null;
        let lastSyncX: number | null = null;
        let lastSyncY: number | null = null;
        let lastSideEffectsAt = 0;

        const handleCrosshairMove = (sourceChart: IChartApi, param: any, hasY: boolean) => {
            const logical = param.point ? sourceChart.timeScale().coordinateToLogical(param.point.x) : null;
            syncVerticalLines(sourceChart, charts, elements, series as any, param.point?.x ?? null, Number(param.time ?? 0), Number(logical ?? 0));

            if (param.time && param.point) {
                const curTime = Number(param.time);
                const curX = param.point.x;
                const curY = hasY ? param.point.y : 0;
                const now = Date.now();

                // THROTTLED SIDE EFFECTS
                if ((curTime !== lastSyncTime || curX !== lastSyncX || curY !== lastSyncY) && (now - lastSideEffectsAt > 32)) {
                    lastSyncTime = curTime;
                    lastSyncX = curX;
                    lastSyncY = curY;
                    lastSideEffectsAt = now;

                    const store = useMarketStore.getState();
                    const logical = sourceChart.timeScale().coordinateToLogical(curX);

                    const payload = {
                        time: curTime,
                        price: hasY ? Number(seriesRef.current?.coordinateToPrice(curY) ?? 0) : null,
                        sourceId: chartId,
                        point: { x: curX, y: curY },
                        logical: logical !== null ? Number(logical) : null
                    };

                    store.syncCrosshair(payload);
                    window.dispatchEvent(new CustomEvent('chart-crosshair', { detail: { ...payload, point: { x: curX, y: curY } } }));
                }
            } else if (!param.point && lastSyncTime !== null) {
                lastSyncTime = null;
                lastSyncX = null;
                lastSyncY = null;
                lastSideEffectsAt = 0;
                useMarketStore.getState().syncCrosshair(null);
                window.dispatchEvent(new CustomEvent('chart-crosshair', { detail: { time: null, sourceId: chartId } }));
            }
        };

        priceChart.subscribeCrosshairMove((p) => handleCrosshairMove(priceChart, p, true));
        subchartChart.subscribeCrosshairMove((p) => handleCrosshairMove(subchartChart, p, true));
        timescaleChart.subscribeCrosshairMove((p) => handleCrosshairMove(timescaleChart, p, false));

        /* ================= SYNC TIME RANGE ================= */
        const priceTS = priceChart.timeScale();
        const subTS = subchartChart.timeScale();
        const footTS = timescaleChart.timeScale();

        let syncing = false;
        const syncTime = (range: any) => {
            if (!range || syncing) return;
            syncing = true;
            priceTS.setVisibleLogicalRange(range);
            subTS.setVisibleLogicalRange(range);
            footTS.setVisibleLogicalRange(range);
            syncing = false;
        };

        priceTS.subscribeVisibleLogicalRangeChange(syncTime);
        subTS.subscribeVisibleLogicalRangeChange(syncTime);
        footTS.subscribeVisibleLogicalRangeChange(syncTime);

        // Auto-scroll management: Disable if user scrolls left, re-enable if user scrolls back to right edge
        const handleScrollPosition = (range: any) => {
            if (!range) return;
            const dataCount = seriesRef.current?.data().length || 0;
            if (dataCount === 0) return;

            // If the right edge of visibility is close to or beyond the last data point
            // We use a small buffer (e.g., 2 bars) to ensure it triggers correctly
            const isAtRightEdge = range.to >= dataCount - 2;
            isAutoScrollEnabledRef.current = isAtRightEdge;
        };

        priceTS.subscribeVisibleLogicalRangeChange(handleScrollPosition);

        /* ================= SYNC LAYOUT WIDTH ================= */
        let syncRequestId: number | null = null;
        let lastMaxW = initialMinW;

        const handleAutoSync = () => {
            autoSyncLayout(
                priceChart, subchartChart, timescaleChart,
                priceContainerRef.current, subchartContainerRef.current,
                initialMinW, lastMaxW, syncRequestId,
                (id) => { syncRequestId = id; },
                (w) => { lastMaxW = w; }
            );
        };

        priceTS.subscribeVisibleLogicalRangeChange(handleAutoSync);
        subTS.subscribeVisibleLogicalRangeChange(handleAutoSync);

        setTimeout(handleAutoSync, 50);

        const resizeObserver = new ResizeObserver((entries) => {
            // Mobile: Ensure we resize ALL charts
            if (priceContainerRef.current && priceContainerRef.current.clientWidth > 0 && priceContainerRef.current.clientHeight > 0) {
                priceChart.applyOptions({ width: priceContainerRef.current.clientWidth, height: priceContainerRef.current.clientHeight });
            }
            if (subchartContainerRef.current && subchartContainerRef.current.clientWidth > 0 && subchartContainerRef.current.clientHeight > 0) {
                subchartChart.applyOptions({ width: subchartContainerRef.current.clientWidth, height: subchartContainerRef.current.clientHeight });
            }
            if (timescaleContainerRef.current && timescaleContainerRef.current.clientWidth > 0 && timescaleContainerRef.current.clientHeight > 0) {
                timescaleChart.applyOptions({ width: timescaleContainerRef.current.clientWidth, height: timescaleContainerRef.current.clientHeight });
            }
            handleAutoSync();
        });

        if (priceContainerRef.current) resizeObserver.observe(priceContainerRef.current);
        // Also observe subchart container in case it changes independently
        if (subchartContainerRef.current) resizeObserver.observe(subchartContainerRef.current);

        priceChartRef.current = priceChart;
        subchartChartRef.current = subchartChart;
        timescaleChartRef.current = timescaleChart;
        seriesRef.current = candleSeries;
        subSyncRef.current = subSyncSeries as any;
        timescaleSyncRef.current = footSyncSeries as any;

        setIsReady(true);

        return () => {
            setIsReady(false);
            if (syncRequestId !== null) cancelAnimationFrame(syncRequestId);
            resizeObserver.disconnect();
            if (priceLineEl?.parentNode) priceLineEl.parentNode.removeChild(priceLineEl);
            if (subLineEl?.parentNode) subLineEl.parentNode.removeChild(subLineEl);
            if (footLineEl?.parentNode) footLineEl.parentNode.removeChild(footLineEl);
            priceChart.remove();
            subchartChart.remove();
            timescaleChart.remove();
        };
    }, [chartId]);

    const syncRange = useCallback(() => {
        const range = priceChartRef.current?.timeScale().getVisibleLogicalRange();
        if (range) {
            subchartChartRef.current?.timeScale().setVisibleLogicalRange(range);
            timescaleChartRef.current?.timeScale().setVisibleLogicalRange(range);
        }
    }, []);

    return useMemo(() => ({
        isReady,
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        seriesRef,
        subSyncRef,
        timescaleSyncRef,
        syncRange,
        isAutoScrollEnabledRef
    }), [isReady, syncRange]);
}
