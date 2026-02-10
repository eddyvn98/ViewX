import { useEffect, useRef } from 'react';
import { IChartApi } from 'lightweight-charts';
import { Candle, useMarketStore, IndicatorConfig } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { EMAIndicator } from '../indicators/EMAIndicator';
import { HMAIndicator } from '../indicators/HMAIndicator';
import { RSIIndicator } from '../indicators/RSIIndicator';
import { SignalIndicator } from '../indicators/SignalIndicator';
import { MACDIndicator } from '../indicators/MACDIndicator';

const EMPTY_INDICATORS: any[] = [];

/* ❌ FIX 1: KHÔNG offset time lần nữa (đã offset ở data layer) */
const formatCandles = (candles: Candle[]) =>
    candles.map(c => ({
        ...c,
        time: (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time)) as any,
    }));

export function useChartIndicators(
    chartId: string,
    priceChartRef: React.RefObject<IChartApi | null>,
    subchartChartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<any>,
    candles: Candle[],
    symbol: string | undefined,
    interval: string | undefined,
    source: string | undefined,
    timezone: string | undefined,
    syncRange: () => void,
    currentPrice?: number,
    isReady?: boolean
) {
    const indicators = useMarketStore(
        useShallow(state => state.chartIndicators[chartId] || EMPTY_INDICATORS)
    );
    const addIndicators = useMarketStore(state => state.addIndicators);

    const instancesRef = useRef<Record<string, any>>({});
    const defaultsAppliedRef = useRef(false);

    const normSymbol = symbol ? (symbol.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol) : '';
    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';
    const getCandles = () => (key ? (useMarketStore.getState().candleData[key] || []) : []);

    /* ===== DEFAULT INDICATORS ===== */
    useEffect(() => {
        if (!symbol || defaultsAppliedRef.current || indicators.length > 0) return;

        addIndicators(chartId, [
            { type: 'EMA', params: { period: 25 }, color: '#9c27b0', visible: true, lineWidth: 1, pane: 'main' },
            { type: 'HMA', params: { period: 25 }, color: '#00bcd4', visible: true, lineWidth: 2, pane: 'main' },
            { type: 'RSI', params: { period: 14 }, color: '#f06292', visible: true, lineWidth: 2, pane: 'subchart' },
            { type: 'MACD', params: { fast: 12, slow: 26, signal: 9 }, color: '#2962FF', visible: false, lineWidth: 1, pane: 'subchart' },
            { type: 'Signals', params: { upperLimit: 60, lowerLimit: 40 }, color: '#22c55e', visible: true, lineWidth: 1, pane: 'main' },
        ]);

        defaultsAppliedRef.current = true;
    }, [chartId, symbol, indicators.length, addIndicators]);

    /* ===== UPDATE INDICATORS (OPTIMIZED) ===== */
    const lastBarTimeRef = useRef<number>(0);
    const stableCandlesRef = useRef<any[]>([]); // Cache for formatted closed candles
    const lastKeyRef = useRef<string>('');

    // ⚡ CRITICAL: Use the proper source for this specific chart
    // We can find it from the chartInstance in the store
    const chartInstance = useMarketStore(useShallow(state => {
        for (const tab of Object.values(state.tabs)) {
            if (tab.charts[chartId]) return tab.charts[chartId];
        }
        return null;
    }));

    const chartSource = chartInstance?.source || 'MT5';
    const chartInterval = chartInstance?.interval || '1m';
    const tickerKey = symbol ? `${chartSource}:${normSymbol}` : '';

    useEffect(() => {
        if (!isReady || !priceChartRef.current || !subchartChartRef.current || !seriesRef.current || !symbol) return;

        // ⚡ RESET ON SYMBOL/INTERVAL CHANGE
        if (key !== lastKeyRef.current) {
            lastKeyRef.current = key;
            lastBarTimeRef.current = 0;
            stableCandlesRef.current = [];

            // ⚡ CRITICAL: Destroy all existing indicator instances and clear them
            Object.values(instancesRef.current).forEach(instance => {
                try {
                    instance.destroy?.();
                } catch (err) {
                    console.warn('[Indicators] Cleanup failed during symbol change:', err);
                }
            });
            instancesRef.current = {};
        }

        const lastBar = candles[candles.length - 1];
        if (!lastBar) return; // Safety check

        const lastTime = (typeof lastBar.time === 'object' ? (lastBar.time as any).timestamp : Number(lastBar.time)) || 0;
        const isNewBar = lastTime !== lastBarTimeRef.current;

        // Update stable candles cache only on new bar or first load
        if (isNewBar || stableCandlesRef.current.length === 0) {
            lastBarTimeRef.current = lastTime;
            stableCandlesRef.current = formatCandles(candles);
        }

        const currentIds = new Set(indicators.map(i => i.id));

        // 1. Cleanup old OR hidden instances
        Object.keys(instancesRef.current).forEach(id => {
            const config = indicators.find(i => i.id === id);
            if (!currentIds.has(id) || (config && !config.visible)) {
                instancesRef.current[id].destroy();
                delete instancesRef.current[id];
            }
        });

        // 2. Create/Update visible indicators
        indicators.forEach(config => {
            if (!config.visible) return;

            let instance = instancesRef.current[config.id];

            // Create instance if missing
            if (!instance) {
                const isSubchart = config.pane === 'subchart';
                const targetChart = isSubchart ? subchartChartRef.current! : priceChartRef.current!;

                switch (config.type) {
                    case 'EMA': instance = new EMAIndicator(targetChart, config); break;
                    case 'HMA': instance = new HMAIndicator(targetChart, config); break;
                    case 'RSI': instance = new RSIIndicator(targetChart, config); break;
                    case 'MACD': instance = new MACDIndicator(targetChart, config); break;
                    case 'Signals': instance = new SignalIndicator(seriesRef.current, config); break;
                }
                if (instance) {
                    instancesRef.current[config.id] = instance;
                    instance._lastConfigJson = JSON.stringify(config);
                    instance.update(stableCandlesRef.current, config);
                }
            }

            if (instance) {
                const configJson = JSON.stringify(config);
                const configChanged = instance._lastConfigJson !== configJson;

                // ⚡ Force update if it's a new bar, config changed, or stableCandles just reset
                if (isNewBar || configChanged || stableCandlesRef.current.length === candles.length) {
                    instance.update(stableCandlesRef.current, config);
                    instance._lastConfigJson = configJson;
                }
            }
        });

        // Sync timescale if subchart exists
        if (indicators.some(i => i.pane === 'subchart' && i.visible)) {
            requestAnimationFrame(() => syncRange());
        }
    }, [
        isReady,
        chartId,
        indicators,
        candles.length,
        symbol,
        interval,
        key,
        priceChartRef,
        subchartChartRef,
        seriesRef,
        syncRange,
    ]);

    // ⚡ SEPARATE EFFECT FOR REAL-TIME PRICE UPDATES (OPTIMIZED & THROTTLED)
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
                        if (instance.updateLastPoint) {
                            const currentCandles = getCandles();
                            const lastIdx = currentCandles.length - 1;

                            if (lastIdx >= 0 && currentCandles[lastIdx]) {
                                const baseCandle = currentCandles[lastIdx];
                                const currentPrice = Number(price);

                                // Parse interval to calculate correct time
                                let intervalSeconds = 60;
                                if (interval) {
                                    const unit = interval.slice(-1);
                                    const val = parseInt(interval);
                                    if (unit === 'm') intervalSeconds = val * 60;
                                    else if (unit === 'h' || unit === 'H') intervalSeconds = val * 3600;
                                    else if (unit === 'd' || unit === 'D') intervalSeconds = val * 86400;
                                    else if (unit === 'w' || unit === 'W') intervalSeconds = val * 604800;
                                    else if (!isNaN(Number(interval))) intervalSeconds = Number(interval) * 60;
                                }

                                const lastCandleTime = typeof baseCandle.time === 'object' ? (baseCandle.time as any).timestamp : Number(baseCandle.time);

                                // Heuristic: If time > 10 billion, it's Milliseconds
                                const isMillis = lastCandleTime > 10000000000;
                                const lastCandleTimeSec = isMillis ? Math.floor(lastCandleTime / 1000) : lastCandleTime;

                                const nowSec = Math.floor(Date.now() / 1000);
                                const currentIntervalStartSec = Math.floor(nowSec / intervalSeconds) * intervalSeconds;

                                let candleToUpdate;

                                // ⚡ CLIENT-SIDE NEW BAR DETECTION FOR INDICATORS
                                if (currentIntervalStartSec > lastCandleTimeSec) {
                                    const newTime = isMillis ? currentIntervalStartSec * 1000 : currentIntervalStartSec;
                                    // New Bar Mode: projected candle
                                    candleToUpdate = {
                                        time: newTime as any,
                                        open: currentPrice,
                                        high: currentPrice,
                                        low: currentPrice,
                                        close: currentPrice,
                                        volume: 0
                                    };
                                } else {
                                    // Update Existing Mode
                                    candleToUpdate = {
                                        ...baseCandle,
                                        close: currentPrice,
                                        high: Math.max(baseCandle.high || currentPrice, currentPrice),
                                        low: Math.min(baseCandle.low || currentPrice, currentPrice)
                                    };
                                }

                                instance.updateLastPoint(candleToUpdate, currentCandles);
                            }
                        }
                    });
                });
            }
        );

        return () => {
            unsub();
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [isReady, symbol, tickerKey, chartId, interval]);



    /* ===== CLEANUP ===== */
    useEffect(() => {
        return () => {
            Object.values(instancesRef.current).forEach(inst => {
                try {
                    inst?.destroy?.();
                } catch { }
            });
            instancesRef.current = {};
        };
    }, []);
}
