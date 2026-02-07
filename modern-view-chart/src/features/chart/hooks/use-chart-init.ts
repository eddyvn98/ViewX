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

export function useChartInit(
    priceContainerRef: React.RefObject<HTMLDivElement | null>,
    subchartContainerRef: React.RefObject<HTMLDivElement | null>,
    timescaleContainerRef: React.RefObject<HTMLDivElement | null>,
    chartId: string
) {
    const [isReady, setIsReady] = useState(false);
    const priceChartRef = useRef<IChartApi | null>(null);
    const subchartChartRef = useRef<IChartApi | null>(null);
    const timescaleChartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const subSyncRef = useRef<ISeriesApi<'Line'> | null>(null);
    const timescaleSyncRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!priceContainerRef.current || !subchartContainerRef.current || !timescaleContainerRef.current) return;

        const initialMinW = window.innerWidth < 768 ? 50 : 60;

        const commonOptions = {
            layout: { background: { color: '#131722' }, textColor: '#d4d4d8' },
            grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
            crosshair: { mode: 0 }, // mode 0 = Normal (free movement), mode 1 = Magnet (snaps to data)
            timeScale: {
                rightOffset: 20, // Reduced from 40 for more space
                barSpacing: 10,
                fixLeftEdge: true,
                fixRightEdge: false,
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: false,
                borderVisible: false,
                borderColor: "#2B2B43",
                visible: true,
                timeVisible: true,
                secondsVisible: false,
                shiftVisibleRangeOnNewBar: true,
            },
        };

        /* ================= PRICE CHART ================= */
        const priceChart = createChart(priceContainerRef.current, {
            ...commonOptions,
            width: priceContainerRef.current.clientWidth,
            height: priceContainerRef.current.clientHeight,
            timeScale: { ...commonOptions.timeScale, visible: false },
            rightPriceScale: {
                visible: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
                borderVisible: true,
                minimumWidth: initialMinW,
            },
            handleScale: { mouseWheel: true, axisPressedMouseMove: { price: true, time: true } as any },
            handleScroll: true,
        });

        /* ================= RSI SUBCHART ================= */
        const subchartChart = createChart(subchartContainerRef.current, {
            ...commonOptions,
            layout: { ...commonOptions.layout, background: { color: 'transparent' } },
            width: subchartContainerRef.current.clientWidth,
            height: subchartContainerRef.current.clientHeight,
            timeScale: { ...commonOptions.timeScale, visible: false },
            crosshair: { mode: 0 }, // Explicit: Normal mode - no snap
            rightPriceScale: {
                visible: true,
                autoScale: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
                borderVisible: true,
                minimumWidth: initialMinW,
            },
            handleScale: { mouseWheel: false, axisPressedMouseMove: { price: true, time: true } as any },
            handleScroll: true,
        });

        /* ================= TIMESCALE FOOTER ================= */
        const timescaleChart = createChart(timescaleContainerRef.current, {
            ...commonOptions,
            layout: { background: { color: '#131722' }, textColor: '#d4d4d8', fontSize: 11 },
            grid: { vertLines: { visible: false }, horzLines: { visible: false } },
            width: timescaleContainerRef.current.clientWidth,
            height: timescaleContainerRef.current.clientHeight,
            timeScale: { ...commonOptions.timeScale, visible: true },
            rightPriceScale: { visible: true, borderVisible: false, ticksVisible: false, minimumWidth: initialMinW },
            leftPriceScale: { visible: false },
            crosshair: {
                mode: 0, // Normal mode - no snap
                vertLine: { visible: false, labelVisible: true },
                horzLine: { visible: false, labelVisible: false },
            },
            handleScale: { mouseWheel: true, axisPressedMouseMove: { time: true } as any },
            handleScroll: true,
        });

        const candleSeries = priceChart.addSeries(CandlestickSeries, {
            upColor: '#22c55e', downColor: '#ef4444', borderVisible: false,
            wickUpColor: '#22c55e', wickDownColor: '#ef4444',
        });

        const subSyncSeries = subchartChart.addSeries(LineSeries as any, { visible: false });
        const footSyncSeries = timescaleChart.addSeries(LineSeries as any, { visible: false });

        /* ================= DOM-BASED CROSSHAIR SYNC ================= */
        // Create custom vertical line elements for each chart
        const createSyncLine = (container: HTMLElement): HTMLDivElement => {
            const line = document.createElement('div');
            line.style.cssText = `
                position: absolute; top: 0; bottom: 0; width: 1px;
                background: #758696; pointer-events: none; z-index: 10;
                display: none; transform: translateX(-0.5px);
            `;
            container.style.position = 'relative';
            container.appendChild(line);
            return line;
        };

        const priceLineEl = createSyncLine(priceContainerRef.current);
        const subLineEl = createSyncLine(subchartContainerRef.current);
        const footLineEl = createSyncLine(timescaleContainerRef.current);

        // Sync all vertical lines using Logical coordinates (precise alignment)
        const syncVerticalLines = (sourceChart: IChartApi, x: number | null, sourceEl: HTMLDivElement) => {
            if (x !== null) {
                // 1. Convert source pixel x to fractional logical index
                const logical = sourceChart.timeScale().coordinateToLogical(x);
                if (logical === null) return;

                // 2. Sync to other charts by converting logical back to their specific pixel x
                [
                    { chart: priceChart, line: priceLineEl },
                    { chart: subchartChart, line: subLineEl },
                    { chart: timescaleChart, line: footLineEl }
                ].forEach(item => {
                    const targetX = item.chart.timeScale().logicalToCoordinate(logical);
                    if (targetX !== null) {
                        item.line.style.display = 'block';
                        item.line.style.left = `${targetX}px`;
                    }
                });
            } else {
                [priceLineEl, subLineEl, footLineEl].forEach(el => {
                    el.style.display = 'none';
                });
            }
        };

        // Cache last sync values to prevent redundant store updates
        let lastSyncTime: number | null = null;
        let lastSyncX: number | null = null;
        let lastSyncY: number | null = null;
        let lastSideEffectsAt = 0;  // Only throttle side effects

        priceChart.subscribeCrosshairMove((param) => {
            // Sync vertical lines to other charts (immediate, no throttle)
            if (param.point) {
                syncVerticalLines(priceChart, param.point.x, priceLineEl);
            } else {
                syncVerticalLines(priceChart, null, priceLineEl);
            }

            if (param.time && param.point) {
                const curTime = Number(param.time);
                const curX = param.point.x;
                const curY = param.point.y;

                // THROTTLED SIDE EFFECTS: Only update store/events at 30fps
                const now = Date.now();
                if ((curTime !== lastSyncTime || curX !== lastSyncX || curY !== lastSyncY) && (now - lastSideEffectsAt > 32)) {
                    lastSyncTime = curTime;
                    lastSyncX = curX;
                    lastSyncY = curY;
                    lastSideEffectsAt = now;

                    // Sync to global store
                    const store = useMarketStore.getState();
                    const logical = priceChart.timeScale().coordinateToLogical(curX);
                    store.syncCrosshair({
                        time: curTime,
                        price: Number(seriesRef.current?.coordinateToPrice(curY) ?? 0),
                        sourceId: chartId,
                        point: { x: curX, y: curY },
                        logical: logical !== null ? Number(logical) : null
                    });

                    // Emit custom event for DOM-based components (bypasses React)
                    window.dispatchEvent(new CustomEvent('chart-crosshair', {
                        detail: { time: curTime, sourceId: chartId, point: { x: curX, y: curY } }
                    }));
                }
            } else if (!param.time && lastSyncTime !== null) {
                lastSyncTime = null;
                lastSyncX = null;
                lastSyncY = null;
                lastSideEffectsAt = 0;

                // Crosshair clear disabled - each chart handles its own

                useMarketStore.getState().syncCrosshair(null);

                // Emit clear event for DOM-based components
                window.dispatchEvent(new CustomEvent('chart-crosshair', {
                    detail: { time: null, sourceId: chartId }
                }));
            }
        });

        subchartChart.subscribeCrosshairMove((param) => {
            // Sync vertical lines to other charts (immediate, no throttle)
            if (param.point) {
                syncVerticalLines(subchartChart, param.point.x, subLineEl);
            } else {
                syncVerticalLines(subchartChart, null, subLineEl);
            }

            if (param.time && param.point) {
                const curTime = Number(param.time);
                const curX = param.point.x;
                const curY = param.point.y;

                // THROTTLED SIDE EFFECTS: Only update store/events at 30fps
                const now = Date.now();
                if ((curTime !== lastSyncTime || curX !== lastSyncX || curY !== lastSyncY) && (now - lastSideEffectsAt > 32)) {
                    lastSyncTime = curTime;
                    lastSyncX = curX;
                    lastSyncY = curY;
                    lastSideEffectsAt = now;

                    // Sync to global store
                    const store = useMarketStore.getState();
                    const logical = subchartChart.timeScale().coordinateToLogical(curX);
                    store.syncCrosshair({
                        time: curTime,
                        price: null,
                        sourceId: chartId,
                        point: { x: curX, y: curY },
                        logical: logical !== null ? Number(logical) : null
                    });

                    // Emit custom event for DOM-based components (bypasses React)
                    window.dispatchEvent(new CustomEvent('chart-crosshair', {
                        detail: { time: curTime, sourceId: chartId, point: { x: curX, y: curY } }
                    }));
                }
            } else if (!param.time && lastSyncTime !== null) {
                lastSyncTime = null;
                lastSyncX = null;
                lastSyncY = null;
                lastSideEffectsAt = 0;

                // Crosshair clear disabled - each chart handles its own

                useMarketStore.getState().syncCrosshair(null);

                // Emit clear event for DOM-based components
                window.dispatchEvent(new CustomEvent('chart-crosshair', {
                    detail: { time: null, sourceId: chartId }
                }));
            }
        });

        // ⚡ TIMESCALE FOOTER: Also sync crosshair when hovering on footer
        timescaleChart.subscribeCrosshairMove((param) => {
            // Sync vertical lines to other charts (immediate, no throttle)
            if (param.point) {
                syncVerticalLines(timescaleChart, param.point.x, footLineEl);
            } else {
                syncVerticalLines(timescaleChart, null, footLineEl);
            }

            if (param.time && param.point) {

                // THROTTLED SIDE EFFECTS
                const curTime = Number(param.time);
                const curX = param.point.x;
                const now = Date.now();
                if ((curTime !== lastSyncTime || curX !== lastSyncX) && (now - lastSideEffectsAt > 32)) {
                    lastSyncTime = curTime;
                    lastSyncX = curX;
                    lastSideEffectsAt = now;

                    const store = useMarketStore.getState();
                    const logical = timescaleChart.timeScale().coordinateToLogical(curX);
                    store.syncCrosshair({
                        time: curTime,
                        price: null,
                        sourceId: chartId,
                        point: { x: curX, y: 0 },
                        logical: logical !== null ? Number(logical) : null
                    });

                    window.dispatchEvent(new CustomEvent('chart-crosshair', {
                        detail: { time: curTime, sourceId: chartId, point: { x: curX, y: 0 } }
                    }));
                }
            } else if (!param.time && lastSyncTime !== null) {
                lastSyncTime = null;
                lastSideEffectsAt = 0;

                // Crosshair clear disabled - each chart handles its own

                useMarketStore.getState().syncCrosshair(null);
                window.dispatchEvent(new CustomEvent('chart-crosshair', {
                    detail: { time: null, sourceId: chartId }
                }));
            }
        });

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

        /* ================= SYNC LAYOUT WIDTH ================= */
        let syncRequestId: number | null = null;
        let lastMaxW = initialMinW;

        const autoSyncLayout = () => {
            if (syncRequestId !== null) return;

            syncRequestId = requestAnimationFrame(() => {
                syncRequestId = null;
                if (!priceContainerRef.current || !subchartContainerRef.current) return;

                const priceW = priceChart.priceScale('right').width();
                const subW = subchartChart.priceScale('right').width();
                const maxW = Math.max(priceW, subW, initialMinW);

                if (Math.abs(maxW - lastMaxW) > 1) {
                    lastMaxW = maxW;
                    const opt = { rightPriceScale: { minimumWidth: maxW } };
                    priceChart.applyOptions(opt);
                    subchartChart.applyOptions(opt);
                    timescaleChart.applyOptions(opt);
                }
            });
        };

        priceTS.subscribeVisibleLogicalRangeChange(autoSyncLayout);
        subTS.subscribeVisibleLogicalRangeChange(autoSyncLayout);

        setTimeout(autoSyncLayout, 50);

        const resizeObserver = new ResizeObserver(() => {
            if (priceContainerRef.current) priceChart.applyOptions({ width: priceContainerRef.current.clientWidth, height: priceContainerRef.current.clientHeight });
            if (subchartContainerRef.current) subchartChart.applyOptions({ width: subchartContainerRef.current.clientWidth, height: subchartContainerRef.current.clientHeight });
            if (timescaleContainerRef.current) timescaleChart.applyOptions({ width: timescaleContainerRef.current.clientWidth, height: timescaleContainerRef.current.clientHeight });
            autoSyncLayout();
        });

        if (priceContainerRef.current) resizeObserver.observe(priceContainerRef.current);

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

            // Remove sync lines
            if (priceLineEl.parentNode) priceLineEl.parentNode.removeChild(priceLineEl);
            if (subLineEl.parentNode) subLineEl.parentNode.removeChild(subLineEl);
            if (footLineEl.parentNode) footLineEl.parentNode.removeChild(footLineEl);

            priceChart.remove();
            subchartChart.remove();
            timescaleChart.remove();
        };
    }, [chartId]); // Reduced dependencies to prevent full re-initialization

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
        syncRange
    }), [isReady, syncRange]);
}
