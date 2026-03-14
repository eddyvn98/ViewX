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
import { createSyncLine, createSyncTimeLabel } from '../logic/chart-sync';
import { setupCrosshairListeners } from './init/setup-crosshair-listeners';
import { ChartInstance } from '@/lib/store/types';
import { readPersistedViewportForChart } from './init/chart-init-helpers';
import { setupChartSyncRuntime } from './init/setup-chart-sync-runtime';

export function useChartInit(
    priceContainerRef: React.RefObject<HTMLDivElement | null>,
    subchartContainerRef: React.RefObject<HTMLDivElement | null>,
    timescaleContainerRef: React.RefObject<HTMLDivElement | null>,
    chartId: string,
    theme: string = 'dark',
    timezone: string = 'Asia/Ho_Chi_Minh',
    currentContextKey?: string,
) {
    const [isReady, setIsReady] = useState(false);
    const priceChartRef = useRef<IChartApi | null>(null);
    const subchartChartRef = useRef<IChartApi | null>(null);
    const timescaleChartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<any> | null>(null);
    const markerSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const subSyncRef = useRef<ISeriesApi<'Line'> | null>(null);
    const timescaleSyncRef = useRef<ISeriesApi<'Line'> | null>(null);
    const isAutoScrollEnabledRef = useRef(true);
    const viewportSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const persistedViewportRef = useRef<ChartInstance['viewport'] | undefined>(undefined);
    const currentContextKeyRef = useRef(currentContextKey);
    const themeColor = useMarketStore(state => state.themeColor);
    const updateChart = useMarketStore(state => state.updateChart);

    const getPersistedViewport = useCallback((): ChartInstance['viewport'] | undefined => {
        return readPersistedViewportForChart(useMarketStore.getState().tabs as any, chartId);
    }, [chartId]);

    useEffect(() => {
        currentContextKeyRef.current = currentContextKey;
    }, [currentContextKey]);

    useEffect(() => {
        persistedViewportRef.current = getPersistedViewport();
        const unsubscribe = useMarketStore.subscribe(
            (state) => readPersistedViewportForChart(state.tabs as any, chartId),
            (viewport) => {
                persistedViewportRef.current = viewport;
            }
        );
        return () => unsubscribe();
    }, [chartId, getPersistedViewport]);

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
    }, [theme, themeColor, isReady, priceContainerRef, subchartContainerRef, timescaleContainerRef]);

    const currentSymbol = useMarketStore(state => {
        const activeTab = state.tabs[state.activeTabId];
        return activeTab?.charts[chartId]?.symbol;
    });
    const symbolInfo = useMarketStore(state => state.symbolInfo[currentSymbol || '']);

    useEffect(() => {
        if (!isReady || !seriesRef.current || !symbolInfo) return;

        const digits = symbolInfo.digits ?? 2;
        const minMove = 1 / Math.pow(10, digits);

        seriesRef.current.applyOptions({
            priceFormat: { type: 'price', precision: digits, minMove },
        });

        if (markerSeriesRef.current) {
            markerSeriesRef.current.applyOptions({
                priceFormat: { type: 'price', precision: digits, minMove },
            });
        }
    }, [isReady, symbolInfo, chartId]);

    useEffect(() => {
        if (!priceContainerRef.current || !subchartContainerRef.current || !timescaleContainerRef.current) return;
<<<<<<< HEAD

        const priceContainer = priceContainerRef.current;
        const subchartContainer = subchartContainerRef.current;
        const timescaleContainer = timescaleContainerRef.current;

        const priceChart = createChart(
            priceContainer,
            getPriceChartOptions(
                Math.max(1, Math.round(priceContainer.clientWidth || 1)),
                Math.max(1, Math.round(priceContainer.clientHeight || 1)),
                theme,
                themeColor
            )
        );
        const subchartChart = createChart(
            subchartContainer,
            getSubChartOptions(
                Math.max(1, Math.round(subchartContainer.clientWidth || 1)),
                Math.max(1, Math.round(subchartContainer.clientHeight || 1)),
                theme,
                themeColor
            )
        );
        const timescaleChart = createChart(
            timescaleContainer,
            getTimescaleOptions(
                Math.max(1, Math.round(timescaleContainer.clientWidth || 1)),
                Math.max(1, Math.round(timescaleContainer.clientHeight || 1)),
                theme,
                themeColor
            )
        );
=======
        let isDisposed = false;
        const applyTouchAction = (container: HTMLDivElement | null) => {
            if (!container) return;
            container.style.touchAction = 'none';
            Array.from(container.querySelectorAll<HTMLElement>('*')).forEach((el) => {
                el.style.touchAction = 'none';
            });
        };
        const createTouchObserver = (container: HTMLDivElement | null) => {
            if (!container) return null;
            const observer = new MutationObserver(() => applyTouchAction(container));
            observer.observe(container, { childList: true, subtree: true, attributes: true });
            return observer;
        };
        const priceWidth = Math.max(1, Math.round(priceContainerRef.current.clientWidth || 1));
        const priceHeight = Math.max(1, Math.round(priceContainerRef.current.clientHeight || 1));
        const subWidth = Math.max(1, Math.round(subchartContainerRef.current.clientWidth || 1));
        const subHeight = Math.max(1, Math.round(subchartContainerRef.current.clientHeight || 1));
        const timeWidth = Math.max(1, Math.round(timescaleContainerRef.current.clientWidth || 1));
        const timeHeight = Math.max(1, Math.round(timescaleContainerRef.current.clientHeight || 1));

        const priceChart = createChart(priceContainerRef.current, getPriceChartOptions(priceWidth, priceHeight, theme, themeColor));
        const subchartChart = createChart(subchartContainerRef.current, getSubChartOptions(subWidth, subHeight, theme, themeColor));
        const timescaleChart = createChart(timescaleContainerRef.current, getTimescaleOptions(timeWidth, timeHeight, theme, themeColor));
        applyTouchAction(priceContainerRef.current);
        applyTouchAction(subchartContainerRef.current);
        applyTouchAction(timescaleContainerRef.current);
        const priceTouchObserver = createTouchObserver(priceContainerRef.current);
        const subchartTouchObserver = createTouchObserver(subchartContainerRef.current);
        const timescaleTouchObserver = createTouchObserver(timescaleContainerRef.current);
>>>>>>> f8b69ef6165f3770b79b16ef423037c2f5e7a664

        const candleSeries = priceChart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            priceLineVisible: true,
            priceLineWidth: 1,
            priceLineStyle: 2,
        });
        const subSyncSeries = subchartChart.addSeries(LineSeries as any, { visible: false });
        const footSyncSeries = timescaleChart.addSeries(LineSeries as any, { visible: false });
        const markerSeries = priceChart.addSeries(CandlestickSeries, {
            visible: true,
            wickVisible: false,
            borderVisible: false,
            upColor: 'transparent',
            downColor: 'transparent',
            priceLineVisible: false,
            lastValueVisible: false,
        });

        const priceLineEl = createSyncLine(priceContainer);
        const subLineEl = createSyncLine(subchartContainer);
        const footLineEl = createSyncLine(timescaleContainer);
        const footTimeLabelEl = createSyncTimeLabel(timescaleContainer);
        const formatTimeLabel = (timestampSec: number) =>
            new Intl.DateTimeFormat('en-GB', {
                timeZone: timezone,
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(timestampSec * 1000).replace(',', '');

        const cleanupCrosshair = setupCrosshairListeners({
            priceChart,
            subchartChart,
            timescaleChart,
            chartId,
            candleSeries,
            subSyncSeries,
            footSyncSeries,
            markerSeries,
            priceLineEl,
            subLineEl,
            footLineEl,
            footTimeLabelEl,
            seriesRef,
            formatTimeLabel,
        });

        const runtime = setupChartSyncRuntime({
            priceChart,
            subchartChart,
            timescaleChart,
            priceContainer,
            subchartContainer,
            timescaleContainer,
            chartId,
            seriesRef,
            persistedViewportRef,
            currentContextKeyRef,
            viewportSaveTimeoutRef,
            isAutoScrollEnabledRef,
            initialMinW,
            updateChart,
        });

        const resizeObserver = new ResizeObserver(() => runtime.syncChartSizes());
        resizeObserver.observe(priceContainer);
        resizeObserver.observe(subchartContainer);
        resizeObserver.observe(timescaleContainer);

        window.addEventListener('resize', runtime.syncChartSizes);
        window.visualViewport?.addEventListener('resize', runtime.syncChartSizes);

<<<<<<< HEAD
        runtime.syncChartSizes();
        const initRafId = requestAnimationFrame(runtime.syncChartSizes);
        const initTimeoutId = setTimeout(runtime.syncChartSizes, 80);
        const restoreTimeoutId = setTimeout(runtime.restorePersistedViewport, 220);
=======
            if (logicalRange) nextViewport.logicalRange = logicalRange;
            if (mainPriceRange) nextViewport.mainPriceRange = mainPriceRange;
            if (subPriceRange) nextViewport.subPriceRange = subPriceRange;

            const nextSnapshot = JSON.stringify(nextViewport);
            if (nextSnapshot === lastViewportSnapshot) return;

            lastViewportSnapshot = nextSnapshot;
            updateChart(chartId, { viewport: nextViewport });
        };

        const scheduleViewportPersist = () => {
            if (viewportSaveTimeoutRef.current) clearTimeout(viewportSaveTimeoutRef.current);
            viewportSaveTimeoutRef.current = setTimeout(() => {
                viewportSaveTimeoutRef.current = null;
                persistViewport();
            }, 180);
        };

        let syncing = false;
        const syncTime = (range: any) => {
            if (!range || syncing) return;
            syncing = true;
            priceTS.setVisibleLogicalRange(range);
            subTS.setVisibleLogicalRange(range);
            footTS.setVisibleLogicalRange(range);
            syncing = false;
            scheduleViewportPersist();
        };

        priceTS.subscribeVisibleLogicalRangeChange(syncTime);
        subTS.subscribeVisibleLogicalRangeChange(syncTime);
        footTS.subscribeVisibleLogicalRangeChange(syncTime);

        const handleScrollPosition = (range: any) => {
            if (!range) return;
            const dataCount = seriesRef.current?.data().length || 0;
            if (dataCount === 0) return;
            isAutoScrollEnabledRef.current = range.to >= dataCount - 2;
        };
        priceTS.subscribeVisibleLogicalRangeChange(handleScrollPosition);

        let syncRequestId: number | null = null;
        let lastMaxW = initialMinW;
        let isPointerInteracting = false;
        let hasPendingAutoSync = false;
        let lockedScaleWidth: number | null = null;
        const handleAutoSync = () => {
            if (isDisposed) return;
            if (isPointerInteracting) {
                hasPendingAutoSync = true;
                return;
            }
            autoSyncLayout(
                priceChart,
                subchartChart,
                timescaleChart,
                priceContainerRef.current,
                subchartContainerRef.current,
                initialMinW,
                lastMaxW,
                syncRequestId,
                (id) => { syncRequestId = id; },
                (w) => { lastMaxW = w; },
            );
        };

        const flushPendingAutoSync = () => {
            if (isDisposed || !hasPendingAutoSync) return;
            hasPendingAutoSync = false;
            handleAutoSync();
        };

        const lockScaleWidthDuringPan = () => {
            try {
                const priceScale = priceChart.priceScale('right');
                const subScale = subchartChart.priceScale('right');
                const width = Math.max(priceScale.width(), subScale.width(), initialMinW);
                if (!Number.isFinite(width) || width <= 0) return;
                lockedScaleWidth = width;
                const opt = { rightPriceScale: { minimumWidth: width } };
                priceChart.applyOptions(opt);
                subchartChart.applyOptions(opt);
                timescaleChart.applyOptions(opt);
            } catch {
                // Ignore transient resize/teardown errors.
            }
        };

        const handlePointerDown = () => {
            if (isPointerInteracting) return;
            isPointerInteracting = true;
            lockScaleWidthDuringPan();
        };

        const handlePointerUp = () => {
            if (!isPointerInteracting) return;
            isPointerInteracting = false;
            lockedScaleWidth = null;
            flushPendingAutoSync();
            scheduleViewportPersist();
        };

        priceTS.subscribeVisibleLogicalRangeChange(handleAutoSync);
        subTS.subscribeVisibleLogicalRangeChange(handleAutoSync);
        priceTS.subscribeVisibleLogicalRangeChange(scheduleViewportPersist);
        subTS.subscribeVisibleLogicalRangeChange(scheduleViewportPersist);
        priceContainerRef.current?.addEventListener('pointerdown', handlePointerDown, true);
        subchartContainerRef.current?.addEventListener('pointerdown', handlePointerDown, true);
        timescaleContainerRef.current?.addEventListener('pointerdown', handlePointerDown, true);
        priceContainerRef.current?.addEventListener('mousedown', handlePointerDown, true);
        subchartContainerRef.current?.addEventListener('mousedown', handlePointerDown, true);
        timescaleContainerRef.current?.addEventListener('mousedown', handlePointerDown, true);
        priceContainerRef.current?.addEventListener('touchstart', handlePointerDown, true);
        subchartContainerRef.current?.addEventListener('touchstart', handlePointerDown, true);
        timescaleContainerRef.current?.addEventListener('touchstart', handlePointerDown, true);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
        window.addEventListener('mouseup', handlePointerUp);
        window.addEventListener('touchend', handlePointerUp);
        window.addEventListener('touchcancel', handlePointerUp);
        setTimeout(handleAutoSync, 50);

        const restorePersistedViewport = () => {
            try {
                const logicalRange = sanitizeRange(persistedViewportRef.current?.logicalRange);
                const mainPriceRange = sanitizeRange(persistedViewportRef.current?.mainPriceRange);
                const subPriceRange = sanitizeRange(persistedViewportRef.current?.subPriceRange);

                if (logicalRange) {
                    priceTS.setVisibleLogicalRange(logicalRange);
                    subTS.setVisibleLogicalRange(logicalRange);
                    footTS.setVisibleLogicalRange(logicalRange);
                }
                if (mainPriceRange) {
                    (priceChart.priceScale('right') as any)?.setVisibleRange?.(mainPriceRange);
                }
                if (subPriceRange) {
                    (subchartChart.priceScale('right') as any)?.setVisibleRange?.(subPriceRange);
                }
            } catch {
                // Ignore restore races while charts are still initializing.
            }
        };

        const syncChartSizes = () => {
            if (isDisposed) return;
            applyTouchAction(priceContainerRef.current);
            applyTouchAction(subchartContainerRef.current);
            applyTouchAction(timescaleContainerRef.current);
            if (priceContainerRef.current && priceContainerRef.current.clientWidth > 0 && priceContainerRef.current.clientHeight > 0) {
                const w = Math.max(1, Math.round(priceContainerRef.current.clientWidth));
                const h = Math.max(1, Math.round(priceContainerRef.current.clientHeight));
                priceChart.resize(w, h, true);
            }
            if (subchartContainerRef.current && subchartContainerRef.current.clientWidth > 0 && subchartContainerRef.current.clientHeight > 0) {
                const w = Math.max(1, Math.round(subchartContainerRef.current.clientWidth));
                const h = Math.max(1, Math.round(subchartContainerRef.current.clientHeight));
                subchartChart.resize(w, h, true);
            }
            if (timescaleContainerRef.current && timescaleContainerRef.current.clientWidth > 0 && timescaleContainerRef.current.clientHeight > 0) {
                const w = Math.max(1, Math.round(timescaleContainerRef.current.clientWidth));
                const h = Math.max(1, Math.round(timescaleContainerRef.current.clientHeight));
                timescaleChart.resize(w, h, true);
            }
            handleAutoSync();
        };

        const resizeObserver = new ResizeObserver(() => syncChartSizes());
        if (priceContainerRef.current) resizeObserver.observe(priceContainerRef.current);
        if (subchartContainerRef.current) resizeObserver.observe(subchartContainerRef.current);
        if (timescaleContainerRef.current) resizeObserver.observe(timescaleContainerRef.current);

        window.addEventListener('resize', syncChartSizes);
        window.visualViewport?.addEventListener('resize', syncChartSizes);

        // Force an initial size sync because ResizeObserver can miss the first paint
        // when the container is absolutely positioned during mount.
        syncChartSizes();
        const initRafId = requestAnimationFrame(syncChartSizes);
        const initTimeoutId = setTimeout(syncChartSizes, 80);
        const restoreTimeoutId = setTimeout(() => {
            restorePersistedViewport();
            scheduleViewportPersist();
        }, 220);
>>>>>>> f8b69ef6165f3770b79b16ef423037c2f5e7a664

        priceChartRef.current = priceChart;
        subchartChartRef.current = subchartChart;
        timescaleChartRef.current = timescaleChart;
        seriesRef.current = candleSeries;
        markerSeriesRef.current = markerSeries as any;
        subSyncRef.current = subSyncSeries as any;
        timescaleSyncRef.current = footSyncSeries as any;

        setIsReady(true);

        return () => {
            setIsReady(false);
            cleanupCrosshair();
            clearTimeout(initTimeoutId);
            clearTimeout(restoreTimeoutId);
            cancelAnimationFrame(initRafId);
            if (viewportSaveTimeoutRef.current) clearTimeout(viewportSaveTimeoutRef.current);
            resizeObserver.disconnect();
<<<<<<< HEAD
            window.removeEventListener('resize', runtime.syncChartSizes);
            window.visualViewport?.removeEventListener('resize', runtime.syncChartSizes);
            runtime.cleanup();
=======
            priceTouchObserver?.disconnect();
            subchartTouchObserver?.disconnect();
            timescaleTouchObserver?.disconnect();
            window.removeEventListener('resize', syncChartSizes);
            window.visualViewport?.removeEventListener('resize', syncChartSizes);
            priceContainerRef.current?.removeEventListener('pointerdown', handlePointerDown, true);
            subchartContainerRef.current?.removeEventListener('pointerdown', handlePointerDown, true);
            timescaleContainerRef.current?.removeEventListener('pointerdown', handlePointerDown, true);
            priceContainerRef.current?.removeEventListener('mousedown', handlePointerDown, true);
            subchartContainerRef.current?.removeEventListener('mousedown', handlePointerDown, true);
            timescaleContainerRef.current?.removeEventListener('mousedown', handlePointerDown, true);
            priceContainerRef.current?.removeEventListener('touchstart', handlePointerDown, true);
            subchartContainerRef.current?.removeEventListener('touchstart', handlePointerDown, true);
            timescaleContainerRef.current?.removeEventListener('touchstart', handlePointerDown, true);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            window.removeEventListener('mouseup', handlePointerUp);
            window.removeEventListener('touchend', handlePointerUp);
            window.removeEventListener('touchcancel', handlePointerUp);
>>>>>>> f8b69ef6165f3770b79b16ef423037c2f5e7a664
            if (priceLineEl?.parentNode) priceLineEl.parentNode.removeChild(priceLineEl);
            if (subLineEl?.parentNode) subLineEl.parentNode.removeChild(subLineEl);
            if (footLineEl?.parentNode) footLineEl.parentNode.removeChild(footLineEl);
            if (footTimeLabelEl?.parentNode) footTimeLabelEl.parentNode.removeChild(footTimeLabelEl);
            priceChart.remove();
            subchartChart.remove();
            timescaleChart.remove();
            priceChartRef.current = null;
            subchartChartRef.current = null;
            timescaleChartRef.current = null;
            seriesRef.current = null;
            markerSeriesRef.current = null;
            subSyncRef.current = null;
            timescaleSyncRef.current = null;
        };
    }, [chartId, timezone, theme, themeColor, updateChart, priceContainerRef, subchartContainerRef, timescaleContainerRef, currentContextKey]);

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
        markerSeriesRef,
        subSyncRef,
        timescaleSyncRef,
        syncRange,
        isAutoScrollEnabledRef,
    }), [isReady, syncRange]);
}
