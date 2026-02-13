'use client';

import { useEffect, useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { calculateIndicators, IndicatorCache } from '../logic/indicator-calculations';
import { getIndicatorRefs, renderIndicators } from '../logic/legend-renderer';
import { calculateEMA, calculateRSI, calculateHullMA, calculateMACD } from '../utils/indicator-math';
import { toSec } from './use-chart-history';
import { normalizeSymbol } from '@/lib/utils/symbol';

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
    const crosshairRafRef = useRef<number | null>(null);
    const tickerRafRef = useRef<number | null>(null);
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

    // ⚡ Helper to get FRESH candles from store (avoids stale closure)
    const getFreshCandles = () => {
        if (!symbol || !interval || !source) return [];
        const normSym = normalizeSymbol(symbol);
        const key = `${source}:${normSym}:${interval}`;
        return useMarketStore.getState().candleData[key] || [];
    };

    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        const container = containerRef.current;

        // Initial setup of indicator refs
        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        // We need a way to refresh these refs if indicators change
        indicatorRefsRef.current = getIndicatorRefs(container, indicatorCacheRef.current);

        const updateLegend = (
            activeIndex: number,
            isLive: boolean,
            currentPrice: number | undefined,
            currentRawCandles: Candle[],
            currentIndicators: IndicatorCache[]
        ) => {
            if (!currentRawCandles.length) return;

            const now = Date.now();
            // Throttle to ~30fps for live updates if in live mode
            if (isLive && (now - lastUpdateAtRef.current < 32)) return;
            lastUpdateAtRef.current = now;

            let displayIndicators = currentIndicators;

            // ⚡ REAL-TIME UPDATE LOGIC
            if (isLive && currentPrice && displayIndicators.length > 0) {
                const prices = currentRawCandles.map(c => c.close);
                // Update the last price to current
                if (prices.length > 0) {
                    prices[prices.length - 1] = currentPrice;
                }

                // Map results to new array to avoid mutating cache
                displayIndicators = displayIndicators.map(ind => {
                    try {
                        let newResults = ind.results;

                        if (ind.type === 'RSI') {
                            const period = ind.period || 14;
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

        const findCandleIndex = (targetTime: number, candlesArray: Candle[]): number => {
            if (!candlesArray.length) return 0;
            const target = toSec(targetTime);
            let low = 0;
            let high = candlesArray.length - 1;
            while (low <= high) {
                const mid = (low + high) >> 1;
                const midTime = toSec(candlesArray[mid].time);

                if (midTime === target) return mid;
                if (midTime < target) low = mid + 1;
                else high = mid - 1;
            }
            // No exact match: return closest candle (at or before target)
            return Math.max(0, Math.min(high, candlesArray.length - 1));
        };

        const normSym = normalizeSymbol(symbol);
        const tickerKey = `${source}:${normSym}`;
        const lastPosRef = { time: null as number | null, sourceId: null as string | null };

        const handleCrosshair = (e: CustomEvent) => {
            const { time, sourceId } = e.detail || {};

            // ⚡ FIX: Set flag SYNCHRONOUSLY before RAF to prevent ticker overwrite
            if (sourceId === chartId && time) {
                isCrosshairActiveRef.current = true;
            }

            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            crosshairRafRef.current = requestAnimationFrame(() => {
                // ⚡ PERFORMANCE: Skip if same position
                if (time === lastPosRef.time && sourceId === lastPosRef.sourceId) return;
                lastPosRef.time = time;
                lastPosRef.sourceId = sourceId;

                const freshCandles = getFreshCandles();

                if (!time || sourceId !== chartId) {
                    if (!isCrosshairActiveRef.current) return;
                    isCrosshairActiveRef.current = false;
                    const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
                    updateLegend(
                        freshCandles.length - 1,
                        true,
                        useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
                        freshCandles,
                        calculateIndicators(freshCandles, indicators)
                    );
                    return;
                }

                const activeIndex = findCandleIndex(time, freshCandles);
                const isLastCandle = activeIndex === freshCandles.length - 1;
                const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
                updateLegend(
                    activeIndex,
                    isLastCandle,
                    isLastCandle ? (useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price) : undefined,
                    freshCandles,
                    calculateIndicators(freshCandles, indicators)
                );
            });
        };

        // Initial render
        const initialFresh = getFreshCandles();
        const initialIndicators = useMarketStore.getState().chartIndicators[chartId] || [];
        updateLegend(
            initialFresh.length - 1,
            true,
            useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
            initialFresh,
            calculateIndicators(initialFresh, initialIndicators)
        );

        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);

        const unsubTicker = useMarketStore.subscribe(
            state => state.tickers[tickerKey]?.price || state.tickers[normSym]?.price,
            (price) => {
                if (isCrosshairActiveRef.current) return;
                if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
                tickerRafRef.current = requestAnimationFrame(() => {
                    if (isCrosshairActiveRef.current) return; // Double-check inside RAF
                    const freshCandles = getFreshCandles();
                    const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
                    updateLegend(
                        freshCandles.length - 1,
                        true,
                        price,
                        freshCandles,
                        calculateIndicators(freshCandles, indicators)
                    );
                });
            }
        );

        // Subscribe to indicator changes to refresh refs
        const unsubIndicators = useMarketStore.subscribe(
            state => state.chartIndicators[chartId],
            (newIndicators) => {
                // Refresh cache and refs when config changes
                const fresh = getFreshCandles();
                indicatorCacheRef.current = calculateIndicators(fresh, newIndicators || []);
                indicatorRefsRef.current = getIndicatorRefs(container, indicatorCacheRef.current);

                updateLegend(
                    fresh.length - 1,
                    true,
                    useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
                    fresh,
                    indicatorCacheRef.current
                );
            }
        );

        return () => {
            window.removeEventListener('chart-crosshair', handleCrosshair as EventListener);
            unsubTicker();
            unsubIndicators();
            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
        };
    }, [chartId, symbol, interval, source, containerRef]);

}
