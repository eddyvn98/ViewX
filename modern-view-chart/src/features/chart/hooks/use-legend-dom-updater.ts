'use client';

import { useEffect, useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { calculateIndicators, IndicatorCache } from '../logic/indicator-calculations';
import { getOHLCRefs, getIndicatorRefs, renderOHLC, renderStatus, renderIndicators, OHLCRefs } from '../logic/legend-renderer';
import { calculateHeikinAshi } from '../utils/indicator-math';
import { toSec } from './use-chart-history';
import { normalizeSymbol } from '@/lib/utils/symbol';


interface LegendDOMUpdaterProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
    chartType?: string;
}

// ⚡ Helper to get FRESH candles from store (avoids stale closure)
const getFreshCandles = (
    symbol: string, interval: string, source: string, chartType: string
): { raw: Candle[]; display: any[] } => {
    const normSym = normalizeSymbol(symbol);
    const key = `${source}:${normSym}:${interval}`;
    const rawCandles = useMarketStore.getState().candleData[key] || [];

    if (chartType === 'heikin_ashi' && rawCandles.length > 0) {
        const haData = calculateHeikinAshi(rawCandles);
        return {
            raw: rawCandles,
            display: haData.map(c => ({
                ...c,
                open: c.ha_open, high: c.ha_high,
                low: c.ha_low, close: c.ha_close
            }))
        };
    }

    return { raw: rawCandles, display: rawCandles };
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

    return Math.max(0, Math.min(high, candlesArray.length - 1));
};

export function useLegendDOMUpdater(
    containerRef: React.RefObject<HTMLDivElement | null>,
    { chartId, symbol, interval, source, candles, chartType = 'candles' }: LegendDOMUpdaterProps
) {
    const indicatorCacheRef = useRef<IndicatorCache[]>([]);
    const crosshairRafRef = useRef<number | null>(null);
    const tickerRafRef = useRef<number | null>(null);
    const isCrosshairActiveRef = useRef(false);
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cache DOM refs
    const ohlcRefsRef = useRef<OHLCRefs | null>(null);
    const indicatorRefsRef = useRef<Map<string, { container: HTMLElement, value: HTMLElement, spans?: NodeListOf<HTMLSpanElement> }>>(new Map());

    // Performance limiting
    const lastUpdateAtRef = useRef(0);
    const lastIsLiveRef = useRef<boolean | null>(null);

    // Refresh indicator cache + DOM refs when candles change
    useEffect(() => {
        if (!candles.length || !containerRef.current) return;

        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        indicatorCacheRef.current = calculateIndicators(candles, indicators);
        indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);

        // Update legend to latest candle ONLY if not hovering historical
        if (!isCrosshairActiveRef.current) {
            const fresh = getFreshCandles(symbol!, interval!, source!, chartType);
            const price = useMarketStore.getState().tickers[symbol!]?.price;
            updateLegendDirect(
                fresh.raw.length - 1, true, price,
                fresh.raw, fresh.display, indicatorCacheRef.current,
                ohlcRefsRef.current, lastUpdateAtRef, lastIsLiveRef,
                chartType, chartId, indicatorRefsRef.current
            );
        }
    }, [candles, chartId]);

    // Main setup effect — NO candles in dependency
    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        ohlcRefsRef.current = getOHLCRefs(containerRef.current);
        indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);

        const normSym = normalizeSymbol(symbol);
        const tickerKey = `${source}:${normSym}`;

        const handleCrosshair = (e: CustomEvent) => {
            const { time, sourceId } = e.detail || {};

            // ⚡ FIX: Set flag SYNCHRONOUSLY before RAF to prevent ticker overwrite
            if (sourceId === chartId && time) {
                isCrosshairActiveRef.current = true;
                if (resetTimeoutRef.current) {
                    clearTimeout(resetTimeoutRef.current);
                    resetTimeoutRef.current = null;
                }
            }

            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            crosshairRafRef.current = requestAnimationFrame(() => {
                const fresh = getFreshCandles(symbol, interval, source, chartType);

                if (sourceId !== chartId || !time) {
                    if (!resetTimeoutRef.current && isCrosshairActiveRef.current) {
                        resetTimeoutRef.current = setTimeout(() => {
                            isCrosshairActiveRef.current = false;
                            resetTimeoutRef.current = null;
                            const freshNow = getFreshCandles(symbol, interval, source, chartType);
                            const currentIndicators = useMarketStore.getState().chartIndicators[chartId] || [];
                            updateLegendDirect(
                                freshNow.raw.length - 1, true,
                                useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
                                freshNow.raw, freshNow.display,
                                calculateIndicators(freshNow.raw, currentIndicators),
                                ohlcRefsRef.current, lastUpdateAtRef, lastIsLiveRef,
                                chartType, chartId, indicatorRefsRef.current
                            );
                        }, 50);
                    }
                    return;
                }

                const activeIndex = findCandleIndex(time, fresh.raw);
                const isLastCandle = activeIndex === fresh.raw.length - 1;
                const currentIndicators = calculateIndicators(
                    fresh.raw,
                    useMarketStore.getState().chartIndicators[chartId] || []
                );
                updateLegendDirect(
                    activeIndex, isLastCandle,
                    isLastCandle ? (useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price) : undefined,
                    fresh.raw, fresh.display, currentIndicators,
                    ohlcRefsRef.current, lastUpdateAtRef, lastIsLiveRef,
                    chartType, chartId, indicatorRefsRef.current
                );
            });
        };

        // Initial render
        const initialFresh = getFreshCandles(symbol, interval, source, chartType);
        if (initialFresh.raw.length > 0) {
            const currentIndicators = calculateIndicators(
                initialFresh.raw,
                useMarketStore.getState().chartIndicators[chartId] || []
            );
            updateLegendDirect(
                initialFresh.raw.length - 1, true,
                useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
                initialFresh.raw, initialFresh.display, currentIndicators,
                ohlcRefsRef.current, lastUpdateAtRef, lastIsLiveRef,
                chartType, chartId, indicatorRefsRef.current
            );
        }

        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);

        // Ticker subscription — only updates when NOT hovering
        const unsubTicker = useMarketStore.subscribe(
            state => state.tickers[tickerKey]?.price || state.tickers[normSym]?.price,
            (price) => {
                if (isCrosshairActiveRef.current) return;
                if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
                tickerRafRef.current = requestAnimationFrame(() => {
                    if (isCrosshairActiveRef.current) return; // Double-check inside RAF
                    const fresh = getFreshCandles(symbol, interval, source, chartType);
                    const currentIndicators = calculateIndicators(
                        fresh.raw,
                        useMarketStore.getState().chartIndicators[chartId] || []
                    );
                    updateLegendDirect(
                        fresh.raw.length - 1, true, price,
                        fresh.raw, fresh.display, currentIndicators,
                        ohlcRefsRef.current, lastUpdateAtRef, lastIsLiveRef,
                        chartType, chartId, indicatorRefsRef.current
                    );
                });
            }
        );

        // ⚡ FIX: Subscribe to indicator config changes to refresh DOM refs
        const unsubIndicators = useMarketStore.subscribe(
            state => state.chartIndicators[chartId],
            (newIndicators) => {
                const fresh = getFreshCandles(symbol, interval, source, chartType);
                indicatorCacheRef.current = calculateIndicators(fresh.raw, newIndicators || []);
                indicatorRefsRef.current = getIndicatorRefs(containerRef.current!, indicatorCacheRef.current);

                if (!isCrosshairActiveRef.current) {
                    updateLegendDirect(
                        fresh.raw.length - 1, true,
                        useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
                        fresh.raw, fresh.display, indicatorCacheRef.current,
                        ohlcRefsRef.current, lastUpdateAtRef, lastIsLiveRef,
                        chartType, chartId, indicatorRefsRef.current
                    );
                }
            }
        );

        return () => {
            window.removeEventListener('chart-crosshair', handleCrosshair as EventListener);
            unsubTicker();
            unsubIndicators();
            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
            if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
        };
    }, [chartId, symbol, interval, source, chartType, containerRef]);
}

// Pure function — no closure dependency, all params explicit
function updateLegendDirect(
    activeIndex: number,
    isLive: boolean,
    currentPrice: number | undefined,
    rawCandles: Candle[],
    displayCandles: any[],
    indicators: IndicatorCache[],
    ohlcRefs: OHLCRefs | null,
    lastUpdateAtRef: React.MutableRefObject<number>,
    lastIsLiveRef: React.MutableRefObject<boolean | null>,
    chartType: string,
    chartId: string,
    indicatorRefs: Map<string, { container: HTMLElement, value: HTMLElement, spans?: NodeListOf<HTMLSpanElement> }>
) {
    if (!rawCandles.length || !ohlcRefs) return;

    const now = Date.now();
    if (isLive && (now - lastUpdateAtRef.current < 32)) return;
    lastUpdateAtRef.current = now;

    const candle = displayCandles[activeIndex] || displayCandles[displayCandles.length - 1];
    if (!candle) return;

    let { open, high, low, close } = candle;

    // Real-time OHLC with current price
    if (isLive && currentPrice) {
        if (chartType === 'heikin_ashi') {
            const rawCandle = rawCandles[activeIndex] || rawCandles[rawCandles.length - 1];
            const haOpen = Number(candle.open);
            const rawClose = Number(currentPrice);
            const rawHigh = Math.max(Number(rawCandle.high), rawClose);
            const rawLow = Math.min(Number(rawCandle.low), rawClose);
            const rawOpen = Number(rawCandle.open);

            const haClose = (rawOpen + rawHigh + rawLow + rawClose) / 4;
            open = haOpen;
            high = Math.max(rawHigh, haOpen, haClose);
            low = Math.min(rawLow, haOpen, haClose);
            close = haClose;
        } else {
            close = currentPrice;
            if (close > high) high = close;
            if (close < low) low = close;
        }
    }

    renderOHLC(ohlcRefs, open, high, low, close);

    if (lastIsLiveRef.current !== isLive) {
        lastIsLiveRef.current = isLive;
        renderStatus(ohlcRefs, isLive);
    }

    // Indicator legend: recalculate for live tick, use cache for historical
    if (isLive && currentPrice && activeIndex === rawCandles.length - 1) {
        const storeIndicators = useMarketStore.getState().chartIndicators[chartId] || [];
        const updatedCandles = rawCandles.map((c, idx) =>
            idx === rawCandles.length - 1 ? { ...c, close: currentPrice } : c
        );
        const recalculated = calculateIndicators(updatedCandles, storeIndicators);

        const tempCaches = indicators.map(cache => {
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
        renderIndicators(activeIndex, tempCaches as any, indicatorRefs);
    } else {
        renderIndicators(activeIndex, indicators, indicatorRefs);
    }
}
