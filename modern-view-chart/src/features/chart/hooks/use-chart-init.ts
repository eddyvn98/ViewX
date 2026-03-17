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
import type { ChartTab } from '@/lib/store/types';

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
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
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
        return readPersistedViewportForChart(useMarketStore.getState().tabs as Record<string, ChartTab>, chartId);
    }, [chartId]);

    useEffect(() => {
        currentContextKeyRef.current = currentContextKey;
    }, [currentContextKey]);

    useEffect(() => {
        persistedViewportRef.current = getPersistedViewport();
        const unsubscribe = useMarketStore.subscribe(
            (state) => readPersistedViewportForChart(state.tabs as Record<string, ChartTab>, chartId),
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
        const priceContainer = priceContainerRef.current;
        const subchartContainer = subchartContainerRef.current;
        const timescaleContainer = timescaleContainerRef.current;
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
        applyTouchAction(priceContainer);
        applyTouchAction(subchartContainer);
        applyTouchAction(timescaleContainer);
        const priceTouchObserver = createTouchObserver(priceContainer);
        const subchartTouchObserver = createTouchObserver(subchartContainer);
        const timescaleTouchObserver = createTouchObserver(timescaleContainer);

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
        const subSyncSeries = subchartChart.addSeries(LineSeries, { visible: false });
        const footSyncSeries = timescaleChart.addSeries(LineSeries, { visible: false });
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

        runtime.syncChartSizes();
        const initRafId = requestAnimationFrame(runtime.syncChartSizes);
        const initTimeoutId = setTimeout(runtime.syncChartSizes, 80);
        const restoreTimeoutId = setTimeout(runtime.restorePersistedViewport, 220);

        priceChartRef.current = priceChart;
        subchartChartRef.current = subchartChart;
        timescaleChartRef.current = timescaleChart;
        seriesRef.current = candleSeries;
        markerSeriesRef.current = markerSeries;
        subSyncRef.current = subSyncSeries;
        timescaleSyncRef.current = footSyncSeries;

        const readyTimeoutId = setTimeout(() => setIsReady(true), 0);
        const viewportTimer = viewportSaveTimeoutRef.current;

        return () => {
            clearTimeout(readyTimeoutId);
            setTimeout(() => setIsReady(false), 0);
            cleanupCrosshair();
            clearTimeout(initTimeoutId);
            clearTimeout(restoreTimeoutId);
            cancelAnimationFrame(initRafId);
            if (viewportTimer) clearTimeout(viewportTimer);
            resizeObserver.disconnect();
            window.removeEventListener('resize', runtime.syncChartSizes);
            window.visualViewport?.removeEventListener('resize', runtime.syncChartSizes);
            runtime.cleanup();
            priceTouchObserver?.disconnect();
            subchartTouchObserver?.disconnect();
            timescaleTouchObserver?.disconnect();
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
