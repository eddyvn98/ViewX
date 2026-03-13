'use client';

import { useEffect, useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { calculateIndicators, IndicatorCache } from '../logic/indicator-calculations';
import { getOHLCRefs, getIndicatorRefs, OHLCRefs } from '../logic/legend-renderer';
import { updateLegendDirect } from './legend-dom-updater.render';
import {
    CrosshairEventDetail,
    getFreshCandles,
    findCandleIndex,
    getTickerPrice,
    getSymbolDigits,
    getNormalizedSymbol
} from './legend-dom-updater.helpers';

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
    const indicatorCacheLengthRef = useRef(0);
    const crosshairRafRef = useRef<number | null>(null);
    const tickerRafRef = useRef<number | null>(null);
    const isCrosshairActiveRef = useRef(false);
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const ohlcRefsRef = useRef<OHLCRefs | null>(null);
    const indicatorRefsRef = useRef<Map<string, { container: HTMLElement; value: HTMLElement; spans?: NodeListOf<HTMLSpanElement> }>>(new Map());
    const lastUpdateAtRef = useRef(0);
    const lastIsLiveRef = useRef<boolean | null>(null);
    const lastCrosshairTimeRef = useRef<number | null>(null);
    const isTimescaleInteractingRef = useRef(false);

    useEffect(() => {
        if (!candles.length || !containerRef.current || !symbol || !interval || !source) return;

        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        indicatorCacheRef.current = calculateIndicators(candles, indicators);
        indicatorCacheLengthRef.current = candles.length;
        indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);

        if (isCrosshairActiveRef.current) return;

        const fresh = getFreshCandles(symbol, interval, source, chartType);
        const normalized = getNormalizedSymbol(symbol);
        const tickerKey = `${source}:${normalized}`;

        updateLegendDirect(
            fresh.raw.length - 1,
            true,
            getTickerPrice(tickerKey, normalized),
            fresh.raw,
            fresh.display,
            indicatorCacheRef.current,
            ohlcRefsRef.current,
            lastUpdateAtRef,
            lastIsLiveRef,
            chartType,
            chartId,
            indicatorRefsRef.current,
            getSymbolDigits(symbol),
            false
        );
    }, [candles, chartId]);

    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        ohlcRefsRef.current = getOHLCRefs(containerRef.current);
        indicatorRefsRef.current = getIndicatorRefs(containerRef.current, indicatorCacheRef.current);

        const normalizedSymbol = getNormalizedSymbol(symbol);
        const tickerKey = `${source}:${normalizedSymbol}`;
        const symbolDigits = getSymbolDigits(symbol);

        const renderLatest = (indicators: IndicatorCache[]) => {
            const fresh = getFreshCandles(symbol, interval, source, chartType);
            updateLegendDirect(
                fresh.raw.length - 1,
                true,
                getTickerPrice(tickerKey, normalizedSymbol),
                fresh.raw,
                fresh.display,
                indicators,
                ohlcRefsRef.current,
                lastUpdateAtRef,
                lastIsLiveRef,
                chartType,
                chartId,
                indicatorRefsRef.current,
                symbolDigits,
                false
            );
        };

        const getIndicatorsFor = (rawCandles: Candle[]) => {
            if (rawCandles.length !== indicatorCacheLengthRef.current) {
                const latestIndicators = useMarketStore.getState().chartIndicators[chartId] || [];
                indicatorCacheRef.current = calculateIndicators(rawCandles, latestIndicators);
                indicatorCacheLengthRef.current = rawCandles.length;
                indicatorRefsRef.current = getIndicatorRefs(containerRef.current!, indicatorCacheRef.current);
            }
            return indicatorCacheRef.current;
        };

        const handleCrosshair = (e: CustomEvent<CrosshairEventDetail>) => {
            if (isTimescaleInteractingRef.current) return;
            const { time, sourceId, point } = e.detail || {};
            void point;

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
                            lastCrosshairTimeRef.current = null;
                            resetTimeoutRef.current = null;
                            renderLatest(getIndicatorsFor(fresh.raw));
                        }, 50);
                    }
                    return;
                }

                const activeIndex = findCandleIndex(time, fresh.raw);
                const isLastCandle = activeIndex === fresh.raw.length - 1;
                const currentIndicators = getIndicatorsFor(fresh.raw);
                if (lastCrosshairTimeRef.current === time && !isLastCandle) return;
                lastCrosshairTimeRef.current = time;

                updateLegendDirect(
                    activeIndex,
                    isLastCandle,
                    isLastCandle ? getTickerPrice(tickerKey, normalizedSymbol) : undefined,
                    fresh.raw,
                    fresh.display,
                    currentIndicators,
                    ohlcRefsRef.current,
                    lastUpdateAtRef,
                    lastIsLiveRef,
                    chartType,
                    chartId,
                    indicatorRefsRef.current,
                    symbolDigits,
                    false
                );
            });
        };

        renderLatest(getIndicatorsFor(getFreshCandles(symbol, interval, source, chartType).raw));

        const handleTimescaleInteraction = (event: Event) => {
            const detail = (event as CustomEvent<{ chartId?: string; active?: boolean }>).detail;
            if (detail?.chartId !== chartId) return;
            isTimescaleInteractingRef.current = Boolean(detail.active);
            if (containerRef.current) {
                containerRef.current.style.opacity = detail.active ? '0.3' : '';
            }
            if (!detail.active) {
                renderLatest(getIndicatorsFor(getFreshCandles(symbol, interval, source, chartType).raw));
            }
        };

        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);
        window.addEventListener('chart-timescale-interaction', handleTimescaleInteraction as EventListener);

        const unsubTicker = useMarketStore.subscribe(
            state => state.tickers[tickerKey]?.price || state.tickers[normalizedSymbol]?.price,
            (price) => {
                if (isCrosshairActiveRef.current) return;
                if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
                tickerRafRef.current = requestAnimationFrame(() => {
                    if (isCrosshairActiveRef.current) return;
                    const fresh = getFreshCandles(symbol, interval, source, chartType);
                    const currentIndicators = getIndicatorsFor(fresh.raw);

                    updateLegendDirect(
                        fresh.raw.length - 1,
                        true,
                        price,
                        fresh.raw,
                        fresh.display,
                        currentIndicators,
                        ohlcRefsRef.current,
                        lastUpdateAtRef,
                        lastIsLiveRef,
                        chartType,
                        chartId,
                        indicatorRefsRef.current,
                        symbolDigits,
                        false
                    );
                });
            }
        );

        const unsubIndicators = useMarketStore.subscribe(
            state => state.chartIndicators[chartId],
            (newIndicators) => {
                const fresh = getFreshCandles(symbol, interval, source, chartType);
                indicatorCacheRef.current = calculateIndicators(fresh.raw, newIndicators || []);
                indicatorCacheLengthRef.current = fresh.raw.length;
                indicatorRefsRef.current = getIndicatorRefs(containerRef.current!, indicatorCacheRef.current);
                if (!isCrosshairActiveRef.current) {
                    renderLatest(indicatorCacheRef.current);
                }
            }
        );

        return () => {
            window.removeEventListener('chart-crosshair', handleCrosshair as EventListener);
            window.removeEventListener('chart-timescale-interaction', handleTimescaleInteraction as EventListener);
            unsubTicker();
            unsubIndicators();
            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
            if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
        };
    }, [chartId, symbol, interval, source, chartType, containerRef]);
}
