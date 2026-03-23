import { useCallback, useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { Candle, IndicatorConfig, useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { chartWorkerClient } from '@/workers/worker-client';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { DEFAULT_CHART_INDICATORS } from './indicators/default-indicators';
import { formatCandles, buildLiveCandle } from './indicators/indicator-candle-utils';
import { createIndicatorInstance } from './indicators/sync-indicator-series';
import { IndicatorCache } from '../logic/indicator-calculations';

const EMPTY_INDICATORS: IndicatorConfig[] = [];
type BatchResult = { id: string; values: unknown };
type IndicatorInstance = {
    update: (candles: Candle[], config: IndicatorConfig, values?: unknown) => void;
    updateLastPoint?: (candle: Candle, candles: Candle[]) => void;
    destroy: () => void;
    _lastConfigJson?: string;
};

export function useChartIndicators(
    chartId: string,
    priceChartRef: React.RefObject<IChartApi | null>,
    subchartChartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    markerSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    candles: Candle[],
    symbol: string | undefined,
    interval: string | undefined,
    source: string | undefined,
    timezone: string | undefined,
    syncRange: () => void,
    currentPrice?: number,
    isReady?: boolean,
) {
    void timezone;
    void currentPrice;

    const indicators = useMarketStore(useShallow(state => state.chartIndicators[chartId] || EMPTY_INDICATORS));
    const addIndicators = useMarketStore(state => state.addIndicators);
    const setChartIndicatorRuntime = useMarketStore(state => state.setChartIndicatorRuntime);
    const clearChartIndicatorRuntime = useMarketStore(state => state.clearChartIndicatorRuntime);

    const instancesRef = useRef<Record<string, IndicatorInstance>>({});
    const defaultsAppliedRef = useRef(false);
    const batchVersionRef = useRef(0);
    const runtimeByIdRef = useRef<Record<string, IndicatorCache>>({});

    const normSymbol = normalizeSymbol(symbol);
    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';
    const getCandles = useCallback(() => (key ? (useMarketStore.getState().candleData[key] || []) : []), [key]);

    useEffect(() => {
        if (!symbol || defaultsAppliedRef.current || indicators.length > 0) return;
        addIndicators(chartId, DEFAULT_CHART_INDICATORS);
        defaultsAppliedRef.current = true;
    }, [chartId, symbol, indicators.length, addIndicators]);

    const lastBarTimeRef = useRef<number>(0);
    const lastCandlesLengthRef = useRef<number>(0);
    const stableCandlesRef = useRef<Candle[]>([]);
    const lastKeyRef = useRef<string>('');

    useEffect(() => {
        if (!isReady || !symbol) return;
        if (key !== lastKeyRef.current) {
            lastKeyRef.current = key;
            batchVersionRef.current += 1;
            lastBarTimeRef.current = 0;
            lastCandlesLengthRef.current = 0;
            stableCandlesRef.current = [];
            runtimeByIdRef.current = {};
            clearChartIndicatorRuntime(chartId);
            Object.keys(instancesRef.current).forEach(id => {
                try { instancesRef.current[id]?.destroy?.(); } catch { }
            });
            instancesRef.current = {};
        }
    }, [key, isReady, chartId, symbol, clearChartIndicatorRuntime]);

    const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        if (!isReady || !priceChartRef.current || !subchartChartRef.current || !seriesRef.current || !markerSeriesRef.current || !symbol) return;
        if (candles.length === 0) return;

        updateTimeoutRef.current = setTimeout(() => {
            const lastBar = candles[candles.length - 1];
            if (!lastBar) return;

            const lastTime = (typeof lastBar.time === 'object'
                ? Number((lastBar.time as { timestamp?: number }).timestamp ?? 0)
                : Number(lastBar.time)) || 0;
            const isNewBar = lastTime !== lastBarTimeRef.current;
            const hasLengthChanged = candles.length !== lastCandlesLengthRef.current;

            // Rebuild stable candles whenever dataset length changes (e.g. left-side backfill)
            // or when a new realtime bar starts.
            if (isNewBar || hasLengthChanged || stableCandlesRef.current.length === 0) {
                lastBarTimeRef.current = lastTime;
                lastCandlesLengthRef.current = candles.length;
                stableCandlesRef.current = formatCandles(candles);
            }

            const currentIds = new Set(indicators.map(i => i.id));
            Object.keys(instancesRef.current).forEach(id => {
                const config = indicators.find(i => i.id === id);
                if (!currentIds.has(id) || (config && !config.visible)) {
                    instancesRef.current[id].destroy();
                    delete instancesRef.current[id];
                    delete runtimeByIdRef.current[id];
                }
            });

            const visibleIndicators = indicators.filter(i => i.visible);
            // Force full indicator recomputation when history was prepended/appended.
            const needsUpdate = isNewBar || hasLengthChanged || stableCandlesRef.current.length === candles.length;
            const indicatorsToCalculate: IndicatorConfig[] = [];

            visibleIndicators.forEach(config => {
                let instance: IndicatorInstance | null = instancesRef.current[config.id] ?? null;
                if (!instance) {
                        instance = createIndicatorInstance(config, {
                            priceChart: priceChartRef.current!,
                            subchartChart: subchartChartRef.current!,
                            series: seriesRef.current!,
                            markerSeries: markerSeriesRef.current!,
                        }) as IndicatorInstance | null;
                    if (instance) {
                        instancesRef.current[config.id] = instance;
                        instance._lastConfigJson = JSON.stringify(config);
                    }
                }

                if (instance) {
                    const configJson = JSON.stringify(config);
                    const configChanged = instance._lastConfigJson !== configJson;
                    if (needsUpdate || configChanged) {
                        indicatorsToCalculate.push(config);
                        instance._lastConfigJson = configJson;
                    }
                }
            });

            if (indicatorsToCalculate.length > 0) {
                const batchVersion = batchVersionRef.current;
                const batchKey = key;
                const batchCandles = stableCandlesRef.current;

                chartWorkerClient.calculateBatch(indicatorsToCalculate, batchCandles)
                    .then((results) => {
                        if (batchVersion !== batchVersionRef.current || batchKey !== lastKeyRef.current) return;
                        if (!Array.isArray(results)) return;
                        const typedResults = results as BatchResult[];
                        const resultsMap = new Map(typedResults.map((result) => [result.id, result.values]));
                        indicatorsToCalculate.forEach(config => {
                            const instance = instancesRef.current[config.id];
                            const values = resultsMap.get(config.id);
                            if (instance) instance.update(batchCandles, config, values);
                            runtimeByIdRef.current[config.id] = {
                                type: config.type,
                                id: config.id,
                                period: Number(config.params?.period || 14),
                                color: config.color,
                                pane: config.pane,
                                results: (values as IndicatorCache['results']) ?? (config.type === 'MACD'
                                    ? { macd: [], signal: [], histogram: [] }
                                    : []),
                                params: config.params
                            };
                        });

                        const visibleRuntime = visibleIndicators
                            .map((config) => runtimeByIdRef.current[config.id])
                            .filter((item): item is IndicatorCache => Boolean(item));
                        setChartIndicatorRuntime(chartId, visibleRuntime);
                    })
                    .catch(() => {
                        if (batchVersion !== batchVersionRef.current || batchKey !== lastKeyRef.current) return;
                        indicatorsToCalculate.forEach(config => {
                            const instance = instancesRef.current[config.id];
                            if (instance) instance.update(batchCandles, config);
                        });
                    });
            }

            if (indicators.some(i => i.pane === 'subchart' && i.visible)) requestAnimationFrame(() => syncRange());
        }, 100);

        return () => {
            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        };
    }, [isReady, candles, key, indicators, symbol, interval, priceChartRef, subchartChartRef, seriesRef, markerSeriesRef, syncRange, chartId, setChartIndicatorRuntime]);

    const chartInstance = useMarketStore(useShallow(state => {
        for (const tab of Object.values(state.tabs)) {
            if (tab.charts[chartId]) return tab.charts[chartId];
        }
        return null;
    }));

    const chartSource = chartInstance?.source || 'MT5';
    const tickerKey = symbol ? `${chartSource}:${normSymbol}` : '';

    useEffect(() => {
        if (!isReady || !symbol || !tickerKey) return;

        let lastUpdate = 0;
        let rafId: number;

        const unsub = useMarketStore.subscribe(
            state => state.tickers[tickerKey]?.price || state.tickers[normSymbol]?.price,
            (price) => {
                if (!price) return;
                const now = Date.now();
                if (now - lastUpdate < 200) return;
                lastUpdate = now;

                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    Object.values(instancesRef.current).forEach(instance => {
                        if (!instance.updateLastPoint) return;
                        const currentCandles = getCandles();
                        const lastIdx = currentCandles.length - 1;
                        if (lastIdx < 0 || !currentCandles[lastIdx]) return;

                        const baseCandle = currentCandles[lastIdx];
                        const currentLivePrice = Number(price);
                        const candleToUpdate = buildLiveCandle(baseCandle, currentLivePrice, interval);
                        instance.updateLastPoint(candleToUpdate, currentCandles);
                    });
                });
            }
        );

        return () => {
            unsub();
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [isReady, symbol, tickerKey, chartId, interval, getCandles, normSymbol]);

    useEffect(() => {
        return () => {
            batchVersionRef.current += 1;
            clearChartIndicatorRuntime(chartId);
            Object.values(instancesRef.current).forEach(inst => {
                try { inst?.destroy?.(); } catch { }
            });
            instancesRef.current = {};
        };
    }, [chartId, clearChartIndicatorRuntime]);
}
