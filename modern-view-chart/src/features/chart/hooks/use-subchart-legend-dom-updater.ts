'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { IndicatorCache, calculateIndicators } from '../logic/indicator-calculations';
import { getIndicatorRefs, renderIndicators } from '../logic/legend-renderer';
import { toSec } from './use-chart-history';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { IndicatorConfig } from '@/lib/store/types';
import { buildLiveCandle } from './indicators/indicator-candle-utils';

interface SubchartLegendDOMUpdaterProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
}

function buildIndicatorSeeds(indicators: IndicatorConfig[]): IndicatorCache[] {
    return indicators
        .filter((config) => config.visible && config.pane === 'subchart')
        .map((config) => ({
            type: config.type,
            id: config.id,
            period: Number(config.params?.period || 14),
            color: config.color,
            pane: config.pane,
            results: config.type === 'MACD'
                ? { macd: [], signal: [], histogram: [] }
                : [],
            params: config.params
        }));
}

export function useSubchartLegendDOMUpdater(
    containerRef: React.RefObject<HTMLDivElement | null>,
    { chartId, symbol, interval, source, candles }: SubchartLegendDOMUpdaterProps
) {
    const indicatorRefsRef = useRef<Map<string, { container: HTMLElement, value: HTMLElement, spans?: NodeListOf<HTMLSpanElement> }>>(new Map());
    const crosshairRafRef = useRef<number | null>(null);
    const tickerRafRef = useRef<number | null>(null);
    const isCrosshairActiveRef = useRef(false);
    const lastUpdateAtRef = useRef(0);
    const lastCrosshairTimeRef = useRef<number | null>(null);

    const getFreshCandles = useCallback(() => {
        if (!symbol || !interval || !source) return candles || [];
        const normSym = normalizeSymbol(symbol);
        const key = `${source}:${normSym}:${interval}`;
        const storeCandles = useMarketStore.getState().candleData[key] || [];
        return storeCandles.length > 0 ? storeCandles : (candles || []);
    }, [symbol, interval, source, candles]);

    const getRuntimeIndicators = useCallback(() => {
        const runtime = useMarketStore.getState().chartIndicatorRuntime[chartId] || [];
        if (runtime.length > 0) return runtime;
        const configs = useMarketStore.getState().chartIndicators[chartId] || [];
        return buildIndicatorSeeds(configs);
    }, [chartId]);

    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        const container = containerRef.current;
        const normSym = normalizeSymbol(symbol);
        const tickerKey = `${source}:${normSym}`;
        const lastPosRef = { time: null as number | null, sourceId: null as string | null };

        const refreshRefs = () => {
            const sourceIndicators = getRuntimeIndicators();
            indicatorRefsRef.current = getIndicatorRefs(container, sourceIndicators);
            return sourceIndicators;
        };

        const updateLegend = (
            activeIndex: number,
            isLive: boolean,
            currentPrice: number | undefined,
            currentRawCandles: Candle[],
            currentIndicators: IndicatorCache[]
        ) => {
            if (!currentRawCandles.length) return;

            const now = Date.now();
            if (isLive && (now - lastUpdateAtRef.current < 32)) return;
            lastUpdateAtRef.current = now;

            let indicatorsToRender = currentIndicators;
            const isLastCandle = activeIndex === currentRawCandles.length - 1;

            // Keep instant feedback for the latest bar while still sharing baseline results from runtime cache.
            if (isLive && isLastCandle && typeof currentPrice === 'number' && Number.isFinite(currentPrice)) {
                const projected = [...currentRawCandles];
                const baseLast = projected[projected.length - 1];
                if (baseLast) {
                    projected[projected.length - 1] = buildLiveCandle(baseLast, Number(currentPrice), interval);
                    const latestConfigs = useMarketStore.getState().chartIndicators[chartId] || [];
                    indicatorsToRender = calculateIndicators(projected, latestConfigs);
                }
            }

            renderIndicators(activeIndex, indicatorsToRender, indicatorRefsRef.current, 'subchart');
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

        const renderAtLatest = (price?: number) => {
            const freshCandles = getFreshCandles();
            const runtimeIndicators = refreshRefs();
            updateLegend(freshCandles.length - 1, true, price, freshCandles, runtimeIndicators);
        };

        renderAtLatest(useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price);

        const handleCrosshair = (e: Event) => {
            const detail = (e as CustomEvent<{ time?: number; sourceId?: string }>).detail;
            const { time, sourceId } = detail || {};

            if (sourceId === chartId && time) isCrosshairActiveRef.current = true;

            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            crosshairRafRef.current = requestAnimationFrame(() => {
                if (time === lastPosRef.time && sourceId === lastPosRef.sourceId) return;
                lastPosRef.time = time ?? null;
                lastPosRef.sourceId = sourceId ?? null;

                const freshCandles = getFreshCandles();
                const runtimeIndicators = refreshRefs();

                if (!time || sourceId !== chartId) {
                    if (!isCrosshairActiveRef.current) return;
                    isCrosshairActiveRef.current = false;
                    lastCrosshairTimeRef.current = null;
                    updateLegend(
                        freshCandles.length - 1,
                        true,
                        useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
                        freshCandles,
                        runtimeIndicators
                    );
                    return;
                }

                const activeIndex = findCandleIndex(time, freshCandles);
                const isLastCandle = activeIndex === freshCandles.length - 1;
                if (lastCrosshairTimeRef.current === time && !isLastCandle) return;
                lastCrosshairTimeRef.current = time;
                updateLegend(
                    activeIndex,
                    isLastCandle,
                    isLastCandle ? (useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price) : undefined,
                    freshCandles,
                    runtimeIndicators
                );
            });
        };

        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);

        const unsubTicker = useMarketStore.subscribe(
            state => state.tickers[tickerKey]?.price || state.tickers[normSym]?.price,
            (price) => {
                if (isCrosshairActiveRef.current) return;
                if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
                tickerRafRef.current = requestAnimationFrame(() => {
                    if (isCrosshairActiveRef.current) return;
                    renderAtLatest(price);
                });
            }
        );

        const unsubRuntime = useMarketStore.subscribe(
            state => state.chartIndicatorRuntime[chartId],
            () => {
                renderAtLatest(useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price);
            }
        );

        const unsubIndicators = useMarketStore.subscribe(
            state => state.chartIndicators[chartId],
            () => {
                const runtimeIndicators = refreshRefs();
                const fresh = getFreshCandles();
                updateLegend(
                    fresh.length - 1,
                    true,
                    useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
                    fresh,
                    runtimeIndicators
                );
            }
        );

        return () => {
            window.removeEventListener('chart-crosshair', handleCrosshair as EventListener);
            unsubTicker();
            unsubRuntime();
            unsubIndicators();
            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
        };
    }, [chartId, symbol, interval, source, containerRef, getFreshCandles, getRuntimeIndicators]);
}
