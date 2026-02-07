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
        time: c.time as any,
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

    useEffect(() => {
        if (!isReady || !priceChartRef.current || !subchartChartRef.current || !seriesRef.current || !symbol) return;

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

                // 2. Full Update (if new bar or config changed)
                if (isNewBar || configChanged) {
                    instance.update(stableCandlesRef.current, config);
                    instance._lastConfigJson = configJson;
                }
                // 3. Incremental Update (price tick)
                else if (currentPrice !== undefined && instance.updateLastPoint) {
                    const lastIdx = candles.length - 1;
                    if (lastIdx >= 0 && candles[lastIdx]) {
                        const lastCandle = {
                            ...candles[lastIdx],
                            close: currentPrice,
                            high: Math.max(candles[lastIdx].high || currentPrice, currentPrice),
                            low: Math.min(candles[lastIdx].low || currentPrice, currentPrice)
                        };
                        instance.updateLastPoint(lastCandle, candles);
                    }
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
        candles,
        symbol,
        priceChartRef,
        subchartChartRef,
        seriesRef,
        syncRange,
        currentPrice,
    ]);



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
