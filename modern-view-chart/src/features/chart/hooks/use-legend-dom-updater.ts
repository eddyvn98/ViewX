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

    // Refresh indicator calculations when candles change (Use displayCandles for indicators?)
    // Usually indicators are calculated on standard candles, but some prefer HA.
    // TradingView calculates indicators on HA candles if HA is selected? 
    // Usually yes because the visual chart is HA.
    useEffect(() => {
        if (!displayCandles.length) return;
        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        indicatorCacheRef.current = calculateIndicators(displayCandles, indicators);
    }, [displayCandles, chartId]);

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

            // Use displayCandles for base values
            const candle = displayCandles[activeIndex] || displayCandles[displayCandles.length - 1];
            if (!candle) return;

            let { open, high, low, close } = candle;

            // Real-time update logic
            if (isLive && currentPrice) {
                if (chartType === 'heikin_ashi') {
                    // For HA, we need to recalculate based on RAW Price Update
                    const rawCandle = candles[activeIndex] || candles[candles.length - 1];
                    const haOpen = Number(candle.open); // Fixed for this candle (HA Open)

                    let rawClose = Number(currentPrice);
                    let rawHigh = Math.max(Number(rawCandle.high), rawClose);
                    let rawLow = Math.min(Number(rawCandle.low), rawClose);
                    let rawOpen = Number(rawCandle.open);

                    // HA Recalc
                    const haClose = (rawOpen + rawHigh + rawLow + rawClose) / 4;
                    const haHigh = Math.max(rawHigh, haOpen, haClose);
                    const haLow = Math.min(rawLow, haOpen, haClose);

                    open = haOpen;
                    high = haHigh;
                    low = haLow;
                    close = haClose;
                } else {
                    // Standard Candles
                    close = currentPrice;
                    if (close > high) high = close;
                    if (close < low) low = close;
                }
            }

            renderOHLC(ohlcRefsRef.current, open, high, low, close);

            // Update status styles ONLY if changed
            if (lastIsLiveRef.current !== isLive) {
                lastIsLiveRef.current = isLive;
                renderStatus(ohlcRefsRef.current, isLive);
            }

            renderIndicators(activeIndex, indicatorCacheRef.current, indicatorRefsRef.current);
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
