import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { Candle, useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { chartWorkerClient } from '@/workers/worker-client';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { DEFAULT_CHART_INDICATORS } from './indicators/default-indicators';
import { formatCandles, buildLiveCandle } from './indicators/indicator-candle-utils';
import { createIndicatorInstance } from './indicators/sync-indicator-series';

const EMPTY_INDICATORS: any[] = [];

export function useChartIndicators(
    chartId: string,
    priceChartRef: React.RefObject<IChartApi | null>,
    subchartChartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<any> | null>,
    markerSeriesRef: React.RefObject<ISeriesApi<any> | null>,
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

    const instancesRef = useRef<Record<string, any>>({});
    const defaultsAppliedRef = useRef(false);

    const normSymbol = normalizeSymbol(symbol);
    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';
    const getCandles = () => (key ? (useMarketStore.getState().candleData[key] || []) : []);

    useEffect(() => {
        if (!symbol || defaultsAppliedRef.current || indicators.length > 0) return;
        addIndicators(chartId, DEFAULT_CHART_INDICATORS as any);
        defaultsAppliedRef.current = true;
    }, [chartId, symbol, indicators.length, addIndicators]);

    const lastBarTimeRef = useRef<number>(0);
    const stableCandlesRef = useRef<any[]>([]);
    const lastKeyRef = useRef<string>('');

    useEffect(() => {
        if (!isReady || !symbol) return;
        if (key !== lastKeyRef.current) {
            lastKeyRef.current = key;
            lastBarTimeRef.current = 0;
            stableCandlesRef.current = [];
            Object.keys(instancesRef.current).forEach(id => {
                try { instancesRef.current[id]?.destroy?.(); } catch { }
            });
            instancesRef.current = {};
        }
    }, [key, isReady, chartId, symbol]);

    const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        if (!isReady || !priceChartRef.current || !subchartChartRef.current || !seriesRef.current || !markerSeriesRef.current || !symbol) return;
        if (candles.length === 0) return;

        updateTimeoutRef.current = setTimeout(() => {
            const lastBar = candles[candles.length - 1];
            if (!lastBar) return;

            const lastTime = (typeof lastBar.time === 'object' ? (lastBar.time as any).timestamp : Number(lastBar.time)) || 0;
            const isNewBar = lastTime !== lastBarTimeRef.current;

            if (isNewBar || stableCandlesRef.current.length === 0) {
                lastBarTimeRef.current = lastTime;
                stableCandlesRef.current = formatCandles(candles);
            }

            const currentIds = new Set(indicators.map(i => i.id));
            Object.keys(instancesRef.current).forEach(id => {
                const config = indicators.find(i => i.id === id);
                if (!currentIds.has(id) || (config && !config.visible)) {
                    instancesRef.current[id].destroy();
                    delete instancesRef.current[id];
                }
            });

            const visibleIndicators = indicators.filter(i => i.visible);
            const needsUpdate = isNewBar || stableCandlesRef.current.length === candles.length;
            const indicatorsToCalculate: any[] = [];

            visibleIndicators.forEach(config => {
                let instance = instancesRef.current[config.id];
                if (!instance) {
                    instance = createIndicatorInstance(config, {
                        priceChart: priceChartRef.current!,
                        subchartChart: subchartChartRef.current!,
                        series: seriesRef.current!,
                        markerSeries: markerSeriesRef.current!,
                    });
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
                chartWorkerClient.calculateBatch(indicatorsToCalculate, stableCandlesRef.current)
                    .then(results => {
                        const resultsMap = new Map(results.map((r: any) => [r.id, r.values]));
                        indicatorsToCalculate.forEach(config => {
                            const instance = instancesRef.current[config.id];
                            if (instance) instance.update(stableCandlesRef.current, config, resultsMap.get(config.id));
                        });
                    })
                    .catch(() => {
                        indicatorsToCalculate.forEach(config => {
                            const instance = instancesRef.current[config.id];
                            if (instance) instance.update(stableCandlesRef.current, config);
                        });
                    });
            }

            if (indicators.some(i => i.pane === 'subchart' && i.visible)) requestAnimationFrame(() => syncRange());
        }, 100);

        return () => {
            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        };
    }, [isReady, candles.length, key, indicators, symbol, interval, priceChartRef, subchartChartRef, seriesRef, markerSeriesRef, syncRange]);

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
    }, [isReady, symbol, tickerKey, chartId, interval]);

    useEffect(() => {
        return () => {
            Object.values(instancesRef.current).forEach(inst => {
                try { inst?.destroy?.(); } catch { }
            });
            instancesRef.current = {};
        };
    }, []);
}
