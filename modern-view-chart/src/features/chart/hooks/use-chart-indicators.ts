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
    const source = useMarketStore.getState().tabs[Object.keys(useMarketStore.getState().tabs)[0]]?.charts[chartId]?.source || 'MT5';
    const interval = useMarketStore.getState().tabs[Object.keys(useMarketStore.getState().tabs)[0]]?.charts[chartId]?.interval || '1m';
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

    useEffect(() => {
        if (!isReady || !priceChartRef.current || !subchartChartRef.current || !seriesRef.current || !symbol) return;

        // ⚡ RESET ON SYMBOL/INTERVAL CHANGE
        if (key !== lastKeyRef.current) {
            lastKeyRef.current = key;
            lastBarTimeRef.current = 0;
            stableCandlesRef.current = [];

            // ⚡ CRITICAL: Destroy all existing indicator instances and clear them
            // This ensures all old series are removed from the chart and we start fresh
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
            // Map bars as stable base
            stableCandlesRef.current = formatCandles(candles);
        }

        const currentIds = new Set(indicators.map(i => i.id));

        // Cleanup old instances
        Object.keys(instancesRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                instancesRef.current[id].destroy();
                delete instancesRef.current[id];
            }
        });

        indicators.forEach(config => {
            if (!config.visible) return;

            let instance = instancesRef.current[config.id];

            // 1. Create instance if missing
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
                    // Initial full update
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
        if (indicators.some(i => i.pane === 'subchart')) {
            requestAnimationFrame(() => syncRange());
        }
    }, [
        isReady,
        chartId,
        indicators,
        candles.length, // ⚡ DRAW on load or new bar only
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
        if (!isReady || !symbol) return;

        const normSymbol = (symbol || '').toLowerCase().endsWith('m') ? symbol!.replace(/[mM]$/, 'm') : symbol;
        let lastUpdate = 0;
        let rafId: number;

        const unsub = useMarketStore.subscribe(
            state => state.tickers[normSymbol]?.price,
            (price) => {
                if (!price) return;
                const now = Date.now();
                // Limit real-time indicator updates to ~5fps (200ms) to save CPU
                // Most indicators don't need to update at 60fps
                if (now - lastUpdate < 200) return;
                lastUpdate = now;

                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    Object.values(instancesRef.current).forEach(instance => {
                        if (instance.updateLastPoint) {
                            const currentCandles = getCandles();
                            const lastIdx = currentCandles.length - 1;
                            if (lastIdx >= 0 && currentCandles[lastIdx]) {
                                const lastCandle = {
                                    ...currentCandles[lastIdx],
                                    close: price,
                                    high: Math.max(currentCandles[lastIdx].high || price, price),
                                    low: Math.min(currentCandles[lastIdx].low || price, price)
                                };
                                instance.updateLastPoint(lastCandle, currentCandles);
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
    }, [isReady, symbol, chartId]);



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
