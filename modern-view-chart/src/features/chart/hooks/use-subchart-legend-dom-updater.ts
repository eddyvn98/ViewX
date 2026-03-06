'use client';

import { useEffect, useRef } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { calculateIndicators, IndicatorCache } from '../logic/indicator-calculations';
import { getIndicatorRefs, renderIndicators } from '../logic/legend-renderer';
import { toSec } from './use-chart-history';
import { normalizeSymbol } from '@/lib/utils/symbol';

interface SubchartLegendDOMUpdaterProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    candles: Candle[];
}

function buildIndicatorSeeds(indicators: any[]): IndicatorCache[] {
    return indicators
        .filter((config: any) => config.visible)
        .map((config: any) => ({
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
    const indicatorCacheRef = useRef<IndicatorCache[]>([]);
    const indicatorCacheLengthRef = useRef(0);
    const crosshairRafRef = useRef<number | null>(null);
    const tickerRafRef = useRef<number | null>(null);
    const isCrosshairActiveRef = useRef(false);
    const indicatorRefsRef = useRef<Map<string, { container: HTMLElement, value: HTMLElement, spans?: NodeListOf<HTMLSpanElement> }>>(new Map());
    const lastUpdateAtRef = useRef(0);

    const lastCalcLengthRef = useRef(0);
    useEffect(() => {
        if (!candles.length) return;

        if (candles.length !== lastCalcLengthRef.current) {
            const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
            indicatorCacheRef.current = calculateIndicators(candles, indicators);
            indicatorCacheLengthRef.current = candles.length;
            if (containerRef.current) {
                const refSource = indicatorCacheRef.current.length
                    ? indicatorCacheRef.current
                    : buildIndicatorSeeds(indicators);
                indicatorRefsRef.current = getIndicatorRefs(containerRef.current, refSource);
            }
            lastCalcLengthRef.current = candles.length;
        }
    }, [candles.length, chartId, containerRef]);

    const getFreshCandles = () => {
        if (!symbol || !interval || !source) return [];
        const normSym = normalizeSymbol(symbol);
        const key = `${source}:${normSym}:${interval}`;
        return useMarketStore.getState().candleData[key] || [];
    };

    useEffect(() => {
        if (!containerRef.current || !symbol || !interval || !source) return;

        const container = containerRef.current;
        const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
        const initialCandles = getFreshCandles();
        indicatorCacheRef.current = calculateIndicators(initialCandles, indicators);
        indicatorCacheLengthRef.current = initialCandles.length;
        const initialRefSource = indicatorCacheRef.current.length
            ? indicatorCacheRef.current
            : buildIndicatorSeeds(indicators);
        indicatorRefsRef.current = getIndicatorRefs(container, initialRefSource);

        const getIndicatorsFor = (rawCandles: Candle[]) => {
            if (rawCandles.length !== indicatorCacheLengthRef.current) {
                const latestIndicators = useMarketStore.getState().chartIndicators[chartId] || [];
                indicatorCacheRef.current = calculateIndicators(rawCandles, latestIndicators);
                indicatorCacheLengthRef.current = rawCandles.length;
                const refSource = indicatorCacheRef.current.length
                    ? indicatorCacheRef.current
                    : buildIndicatorSeeds(latestIndicators);
                indicatorRefsRef.current = getIndicatorRefs(container, refSource);
            }
            return indicatorCacheRef.current;
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

            void currentPrice;
            renderIndicators(activeIndex, currentIndicators, indicatorRefsRef.current, 'subchart');
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

        const normSym = normalizeSymbol(symbol);
        const tickerKey = `${source}:${normSym}`;
        const lastPosRef = { time: null as number | null, sourceId: null as string | null };

        const handleCrosshair = (e: CustomEvent) => {
            const { time, sourceId } = e.detail || {};

            if (sourceId === chartId && time) {
                isCrosshairActiveRef.current = true;
            }

            if (crosshairRafRef.current) cancelAnimationFrame(crosshairRafRef.current);
            crosshairRafRef.current = requestAnimationFrame(() => {
                if (time === lastPosRef.time && sourceId === lastPosRef.sourceId) return;
                lastPosRef.time = time;
                lastPosRef.sourceId = sourceId;

                const freshCandles = getFreshCandles();

                if (!time || sourceId !== chartId) {
                    if (!isCrosshairActiveRef.current) return;
                    isCrosshairActiveRef.current = false;
                    updateLegend(
                        freshCandles.length - 1,
                        true,
                        useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
                        freshCandles,
                        getIndicatorsFor(freshCandles)
                    );
                    return;
                }

                const activeIndex = findCandleIndex(time, freshCandles);
                const isLastCandle = activeIndex === freshCandles.length - 1;
                updateLegend(
                    activeIndex,
                    isLastCandle,
                    isLastCandle ? (useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price) : undefined,
                    freshCandles,
                    getIndicatorsFor(freshCandles)
                );
            });
        };

        const initialFresh = getFreshCandles();
        updateLegend(
            initialFresh.length - 1,
            true,
            useMarketStore.getState().tickers[tickerKey]?.price || useMarketStore.getState().tickers[normSym]?.price,
            initialFresh,
            getIndicatorsFor(initialFresh)
        );

        window.addEventListener('chart-crosshair', handleCrosshair as EventListener);

        const unsubTicker = useMarketStore.subscribe(
            state => state.tickers[tickerKey]?.price || state.tickers[normSym]?.price,
            (price) => {
                if (isCrosshairActiveRef.current) return;
                if (tickerRafRef.current) cancelAnimationFrame(tickerRafRef.current);
                tickerRafRef.current = requestAnimationFrame(() => {
                    if (isCrosshairActiveRef.current) return;
                    const freshCandles = getFreshCandles();
                    updateLegend(
                        freshCandles.length - 1,
                        true,
                        price,
                        freshCandles,
                        getIndicatorsFor(freshCandles)
                    );
                });
            }
        );

        const unsubIndicators = useMarketStore.subscribe(
            state => state.chartIndicators[chartId],
            (newIndicators) => {
                const fresh = getFreshCandles();
                indicatorCacheRef.current = calculateIndicators(fresh, newIndicators || []);
                indicatorCacheLengthRef.current = fresh.length;
                const refSource = indicatorCacheRef.current.length
                    ? indicatorCacheRef.current
                    : buildIndicatorSeeds(newIndicators || []);
                indicatorRefsRef.current = getIndicatorRefs(container, refSource);

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
