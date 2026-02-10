'use client';

import { useEffect, useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { calculateIndicators, IndicatorCache } from '../logic/indicator-calculations';
import { getIndicatorRefs, renderIndicators } from '../logic/legend-renderer';
import { calculateEMA, calculateRSI, calculateHullMA, calculateMACD } from '../utils/indicator-math';

interface SubchartLegendDOMUpdaterProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
}

export function useSubchartLegendDOMUpdater(
    containerRef: React.RefObject<HTMLDivElement | null>,
    { chartId, symbol, interval, source, candles }: SubchartLegendDOMUpdaterProps
) {
    const indicatorCacheRef = useRef<IndicatorCache[]>([]);
    const rafIdRef = useRef<number | null>(null);
    const isCrosshairActiveRef = useRef(false);

    // Cache DOM refs
    const indicatorRefsRef = useRef<Map<string, { container: HTMLElement, value: HTMLElement, spans?: NodeListOf<HTMLSpanElement> }>>(new Map());

    // Performance limiting
    const lastUpdateAtRef = useRef(0);

    // Refresh indicator calculations ONLY when a new candle is added
    const lastCalcLengthRef = useRef(0);
    useEffect(() => {
        if (!candles.length) return;

        // ⚡ PERFORMANCE: Only recalculate full series on new bar
        if (candles.length !== lastCalcLengthRef.current) {
            const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
            indicatorCacheRef.current = calculateIndicators(candles, indicators);
            lastCalcLengthRef.current = candles.length;
        }
    }, [candles.length, chartId]); // Depend on length, not the array reference

    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        const container = containerRef.current;

        // Initial setup of indicator refs
        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        // We need a way to refresh these refs if indicators change
        indicatorRefsRef.current = getIndicatorRefs(container, indicatorCacheRef.current);

        const updateLegend = (activeIndex: number, isLive: boolean, currentPrice?: number) => {
            if (!candles.length) return;

            const now = Date.now();
            // Throttle to ~30fps for live updates if in live mode
            if (isLive && (now - lastUpdateAtRef.current < 32)) return;
            lastUpdateAtRef.current = now;

            let displayIndicators = indicatorCacheRef.current;

            // ⚡ REAL-TIME UPDATE LOGIC
            // If we are looking at the latest candle (live), we must perform a lightweight recalculation
            // using the current price, because `indicatorCacheRef` only contains values based on `candles` prop
            // which might be stale (reference from start of component render).
            if (isLive && currentPrice && displayIndicators.length > 0) {
                // Ensure we have the prices for calculation context
                // We don't need the whole array, just enough for the lookback
                const prices = candles.map(c => c.close);
                // Update the last price to current
                if (prices.length > 0) {
                    prices[prices.length - 1] = currentPrice;
                }

                // Map results to new array to avoid mutating cache
                displayIndicators = displayIndicators.map(ind => {
                    // Check if this indicator needs update
                    // We only support common ones for now: RSI, EMA, MACD
                    // Complex ones might just show static value
                    try {
                        let newResults = ind.results;

                        if (ind.type === 'RSI') {
                            const period = ind.period || 14;
                            // Recalc RSI for last point
                            // We slice enough context (2x period is minimal safe, 4x better)
                            const slice = prices.slice(-(period * 5));
                            const rsiSlice = calculateRSI(slice, period);
                            const newVal = rsiSlice[rsiSlice.length - 1];

                            const resArr = [...(ind.results as number[])];
                            resArr[resArr.length - 1] = newVal;
                            newResults = resArr;
                        } else if (ind.type === 'MACD') {
                            const { fast = 12, slow = 26, signal = 9 } = ind.params || {};
                            const slice = prices.slice(-(slow + signal) * 3);
                            const macdSlice = calculateMACD(slice, fast, slow, signal);

                            const oldRes = ind.results as { macd: number[], signal: number[], histogram: number[] };
                            const newRes = {
                                macd: [...oldRes.macd],
                                signal: [...oldRes.signal],
                                histogram: [...oldRes.histogram]
                            };

                            newRes.macd[newRes.macd.length - 1] = macdSlice.macd[macdSlice.macd.length - 1];
                            newRes.signal[newRes.signal.length - 1] = macdSlice.signal[macdSlice.signal.length - 1];
                            newRes.histogram[newRes.histogram.length - 1] = macdSlice.histogram[macdSlice.histogram.length - 1];
                            newResults = newRes;
                        }
                        // For EMA/SMA, similar logic applies, but user specifically mentioned RSI/MACD subcharts
                        // We can add others later if needed.

                        return {
                            ...ind,
                            results: newResults
                        };
                    } catch (e) {
                        return ind;
                    }
                });
            }

            renderIndicators(activeIndex, displayIndicators, indicatorRefsRef.current, 'subchart');
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

        const lastPosRef = { time: null as number | null, sourceId: null as string | null };

        const handleCrosshair = (e: CustomEvent) => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = requestAnimationFrame(() => {
                const { time, sourceId } = e.detail || {};
                const tickerKey = `${source}:${symbol}`;

                // ⚡ PERFORMANCE: Skip if same position
                if (time === lastPosRef.time && sourceId === lastPosRef.sourceId) return;
                lastPosRef.time = time;
                lastPosRef.sourceId = sourceId;

                // ⚡ PERFORMANCE: If this crosshair event is for another chart AND we are already in live mode, skip!
                if (!time || sourceId !== chartId) {
                    if (!isCrosshairActiveRef.current) return;
                    isCrosshairActiveRef.current = false;
                    updateLegend(candles.length - 1, true, useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[symbol!]?.price);
                    return;
                }

                const activeIndex = findCandleIndex(time);
                isCrosshairActiveRef.current = true;
                updateLegend(activeIndex, false);
            });
        };

        // Initial render
        const tickerKey = `${source}:${symbol}`;
        updateLegend(candles.length - 1, true, useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[symbol!]?.price);

        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);

        const unsubTicker = useMarketStore.subscribe(
            state => state.tickers[tickerKey]?.price || state.tickers[symbol!]?.price,
            (price) => {
                if (!isCrosshairActiveRef.current) {
                    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = requestAnimationFrame(() => {
                        updateLegend(candles.length - 1, true, price);
                    });
                }
            }
        );

        // Subscribe to indicator changes to refresh refs
        const unsubIndicators = useMarketStore.subscribe(
            state => state.chartIndicators[chartId],
            (newIndicators) => {
                // Refresh cache and refs when config changes
                indicatorCacheRef.current = calculateIndicators(candles, newIndicators || []);
                indicatorRefsRef.current = getIndicatorRefs(container, indicatorCacheRef.current);
                updateLegend(candles.length - 1, true);
            }
        );

        return () => {
            window.removeEventListener('chart-crosshair', handleCrosshair as EventListener);
            unsubTicker();
            unsubIndicators();
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [chartId, symbol, interval, source, candles, containerRef]);
}
