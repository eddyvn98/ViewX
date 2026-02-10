'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { calculateIndicators, IndicatorCache } from '../logic/indicator-calculations';
import { getOHLCRefs, getIndicatorRefs, renderOHLC, renderStatus, renderIndicators, OHLCRefs } from '../logic/legend-renderer';
import { calculateHeikinAshi } from '../utils/indicator-math';

interface LegendDOMUpdaterProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
    chartType?: string;
}

export function useLegendDOMUpdater(
    containerRef: React.RefObject<HTMLDivElement | null>,
    { chartId, symbol, interval, source, candles, chartType = 'candles' }: LegendDOMUpdaterProps
) {
    const indicatorCacheRef = useRef<IndicatorCache[]>([]);
    const rafIdRef = useRef<number | null>(null);
    const isCrosshairActiveRef = useRef(false);

    // Cache DOM refs
    const ohlcRefsRef = useRef<OHLCRefs | null>(null);
    const indicatorRefsRef = useRef<Map<string, { container: HTMLElement, value: HTMLElement, spans?: NodeListOf<HTMLSpanElement> }>>(new Map());

    // Performance limiting
    const lastUpdateAtRef = useRef(0);
    const lastIsLiveRef = useRef<boolean | null>(null);

    // Memoize display candles (HA vs Raw)
    const displayCandles = useMemo(() => {
        if (!candles.length) return [];
        if (chartType === 'heikin_ashi') {
            const haData = calculateHeikinAshi(candles);
            return haData.map(c => ({
                ...c,
                open: c.ha_open,
                high: c.ha_high,
                low: c.ha_low,
                close: c.ha_close
            }));
        }
        return candles;
    }, [candles, chartType]);

    // Refresh indicator calculations when candles change - ALWAYS use raw candles for math
    useEffect(() => {
        if (!candles.length) return;
        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        indicatorCacheRef.current = calculateIndicators(candles, indicators);
    }, [candles, chartId]);

    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        const container = containerRef.current;
        ohlcRefsRef.current = getOHLCRefs(container);
        indicatorRefsRef.current = getIndicatorRefs(container, indicatorCacheRef.current);

        const updateLegend = (activeIndex: number, isLive: boolean, currentPrice?: number) => {
            if (!candles.length || !ohlcRefsRef.current) return;

            const now = Date.now();
            if (isLive && (now - lastUpdateAtRef.current < 32)) return;
            lastUpdateAtRef.current = now;

            // Use displayCandles for base values (OHLC display)
            const candle = displayCandles[activeIndex] || displayCandles[displayCandles.length - 1];
            if (!candle) return;

            let { open, high, low, close } = candle;

            // Real-time update logic for OHLC
            if (isLive && currentPrice) {
                if (chartType === 'heikin_ashi') {
                    const rawCandle = candles[activeIndex] || candles[candles.length - 1];
                    const haOpen = Number(candle.open);
                    const rawClose = Number(currentPrice);
                    const rawHigh = Math.max(Number(rawCandle.high), rawClose);
                    const rawLow = Math.min(Number(rawCandle.low), rawClose);
                    const rawOpen = Number(rawCandle.open);

                    const haClose = (rawOpen + rawHigh + rawLow + rawClose) / 4;
                    const haHigh = Math.max(rawHigh, haOpen, haClose);
                    const haLow = Math.min(rawLow, haOpen, haClose);

                    open = haOpen;
                    high = haHigh;
                    low = haLow;
                    close = haClose;
                } else {
                    close = currentPrice;
                    if (close > high) high = close;
                    if (close < low) low = close;
                }
            }

            renderOHLC(ohlcRefsRef.current, open, high, low, close);

            if (lastIsLiveRef.current !== isLive) {
                lastIsLiveRef.current = isLive;
                renderStatus(ohlcRefsRef.current, isLive);
            }

            // Real-time update for Indicators on Legend
            if (isLive && currentPrice && activeIndex === candles.length - 1) {
                const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
                const updatedCandles = candles.map((c, idx) =>
                    idx === candles.length - 1 ? { ...c, close: currentPrice } : c
                );

                // Recalculate ALL indicators for the final tick ONCE
                const recalculated = calculateIndicators(updatedCandles, indicators);

                const tempCaches = indicatorCacheRef.current.map(cache => {
                    const match = recalculated.find(r => r.id === cache.id);
                    if (!match) return cache;

                    const res = match.results;
                    const lastValue = Array.isArray(res)
                        ? res[res.length - 1]
                        : (res as any).macd?.[(res as any).macd.length - 1];

                    return {
                        ...cache,
                        results: [...(Array.isArray(cache.results) ? cache.results.slice(0, -1) : []), lastValue]
                    };
                });
                renderIndicators(activeIndex, tempCaches as any, indicatorRefsRef.current);
            } else {
                renderIndicators(activeIndex, indicatorCacheRef.current, indicatorRefsRef.current);
            }
        };

        const findCandleIndex = (targetTime: number): number => {
            let low = 0;
            let high = candles.length - 1;
            while (low <= high) {
                const mid = (low + high) >> 1;
                const midTime = typeof candles[mid].time === 'object'
                    ? (candles[mid].time as any).timestamp
                    : Number(candles[mid].time);

                if (midTime === targetTime) return mid;
                if (midTime < targetTime) low = mid + 1;
                else high = mid - 1;
            }
            return candles.length - 1;
        };

        const handleCrosshair = (e: CustomEvent) => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = requestAnimationFrame(() => {
                const { time, sourceId } = e.detail || {};
                if (!time || sourceId !== chartId) {
                    isCrosshairActiveRef.current = false;
                    updateLegend(candles.length - 1, true, useMarketStore.getState().tickers[symbol]?.price);
                    return;
                }
                const activeIndex = findCandleIndex(time);
                isCrosshairActiveRef.current = true;
                updateLegend(activeIndex, false);
            });
        };

        // Initial render
        updateLegend(candles.length - 1, true, useMarketStore.getState().tickers[symbol]?.price);

        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);

        const unsubTicker = useMarketStore.subscribe(
            state => state.tickers[symbol]?.price,
            (price) => {
                if (!isCrosshairActiveRef.current) {
                    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = requestAnimationFrame(() => {
                        updateLegend(candles.length - 1, true, price);
                    });
                }
            }
        );

        return () => {
            window.removeEventListener('chart-crosshair', handleCrosshair as EventListener);
            unsubTicker();
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [chartId, symbol, interval, source, candles, displayCandles, chartType, containerRef]);
}
