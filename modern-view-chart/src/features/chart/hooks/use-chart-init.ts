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
import { createSyncLine, autoSyncLayout } from '../logic/chart-sync';
import { setupCrosshairListeners } from './init/setup-crosshair-listeners';

export function useChartInit(
    priceContainerRef: React.RefObject<HTMLDivElement | null>,
    subchartContainerRef: React.RefObject<HTMLDivElement | null>,
    timescaleContainerRef: React.RefObject<HTMLDivElement | null>,
    chartId: string,
    theme: string = 'dark',
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
    const themeColor = useMarketStore(state => state.themeColor);

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
        let isDisposed = false;
        const priceWidth = Math.max(1, Math.round(priceContainerRef.current.clientWidth || 1));
        const priceHeight = Math.max(1, Math.round(priceContainerRef.current.clientHeight || 1));
        const subWidth = Math.max(1, Math.round(subchartContainerRef.current.clientWidth || 1));
        const subHeight = Math.max(1, Math.round(subchartContainerRef.current.clientHeight || 1));
        const timeWidth = Math.max(1, Math.round(timescaleContainerRef.current.clientWidth || 1));
        const timeHeight = Math.max(1, Math.round(timescaleContainerRef.current.clientHeight || 1));

        const priceChart = createChart(priceContainerRef.current, getPriceChartOptions(priceWidth, priceHeight, theme, themeColor));
        const subchartChart = createChart(subchartContainerRef.current, getSubChartOptions(subWidth, subHeight, theme, themeColor));
        const timescaleChart = createChart(timescaleContainerRef.current, getTimescaleOptions(timeWidth, timeHeight, theme, themeColor));

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

        const priceLineEl = createSyncLine(priceContainerRef.current);
        const subLineEl = createSyncLine(subchartContainerRef.current);
        const footLineEl = createSyncLine(timescaleContainerRef.current);

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
            seriesRef,
        });

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

        const handleScrollPosition = (range: any) => {
            if (!range) return;
            const dataCount = seriesRef.current?.data().length || 0;
            if (dataCount === 0) return;
            isAutoScrollEnabledRef.current = range.to >= dataCount - 2;
        };
        priceTS.subscribeVisibleLogicalRangeChange(handleScrollPosition);

        let syncRequestId: number | null = null;
        let lastMaxW = initialMinW;
        const handleAutoSync = () => {
            if (isDisposed) return;
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

        priceTS.subscribeVisibleLogicalRangeChange(handleAutoSync);
        subTS.subscribeVisibleLogicalRangeChange(handleAutoSync);
        setTimeout(handleAutoSync, 50);

        const syncChartSizes = () => {
            if (isDisposed) return;
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

        priceChartRef.current = priceChart;
        subchartChartRef.current = subchartChart;
        timescaleChartRef.current = timescaleChart;
        seriesRef.current = candleSeries;
        markerSeriesRef.current = markerSeries as any;
        subSyncRef.current = subSyncSeries as any;
        timescaleSyncRef.current = footSyncSeries as any;

        setIsReady(true);

        return () => {
            isDisposed = true;
            setIsReady(false);
            cleanupCrosshair();
            clearTimeout(initTimeoutId);
            cancelAnimationFrame(initRafId);
            if (syncRequestId !== null) cancelAnimationFrame(syncRequestId);
            resizeObserver.disconnect();
            window.removeEventListener('resize', syncChartSizes);
            window.visualViewport?.removeEventListener('resize', syncChartSizes);
            if (priceLineEl?.parentNode) priceLineEl.parentNode.removeChild(priceLineEl);
            if (subLineEl?.parentNode) subLineEl.parentNode.removeChild(subLineEl);
            if (footLineEl?.parentNode) footLineEl.parentNode.removeChild(footLineEl);
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
        markerSeriesRef,
        subSyncRef,
        timescaleSyncRef,
        syncRange,
        isAutoScrollEnabledRef,
    }), [isReady, syncRange]);
}
