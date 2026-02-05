import { useMemo } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { calculateEMA, calculateRSI, calculateHullMA, calculateMACD } from '../utils/indicator-math';

const EMPTY_INDICATORS: any[] = [];

export interface IndicatorValueItem {
    id: string;
    type: string;
    name: string;
    value: string | number; // Support formatted string or raw number
    color: string;
    pane: string;
    values?: { label: string; value: string; color?: string }[]; // For Multi-value indicators like MACD
}

export function useChartIndicatorValues(chartId: string, candles: Candle[], activeIndex: number, currentPrice?: number) {
    const indicators = useMarketStore(useShallow(state => state.chartIndicators[chartId] || EMPTY_INDICATORS));

    // 1. Calculate full series data only when candles, indicators config, or currentPrice change
    const calculatedIndicators = useMemo(() => {
        if (!indicators.length || !candles.length) return [];

        // Helper: Construct candles with the LATEST `currentPrice` if available
        let effectiveCandles = candles;
        if (currentPrice !== undefined && candles.length > 0) {
            const lastIdx = candles.length - 1;
            const lastCandle = candles[lastIdx];
            // Create a new array ONLY if we actually update the last candle
            const updatedLastCandle = {
                ...lastCandle,
                close: currentPrice,
                high: Math.max(lastCandle.high, currentPrice),
                low: Math.min(lastCandle.low, currentPrice),
            };

            // This is 'expensive' in theory but necessary for correct realtime calculation
            effectiveCandles = [...candles.slice(0, lastIdx), updatedLastCandle];
        }

        return indicators.map(config => {
            if (!config.visible) return null;
            const period = config.params.period || 14;
            let results: any = [];

            try {
                const prices = effectiveCandles.map(c => c.close);
                switch (config.type) {
                    case 'EMA':
                        results = calculateEMA(prices, period);
                        break;
                    case 'HMA':
                        results = calculateHullMA(prices, period);
                        break;
                    case 'RSI':
                        results = calculateRSI(prices, period);
                        break;
                    case 'MACD': {
                        const { fast = 12, slow = 26, signal = 9 } = config.params;
                        // Returns { macd, signal, histogram } each is number[]
                        results = calculateMACD(prices, fast, slow, signal);
                        break;
                    }
                }
            } catch (e) {
                console.error(`Indicator calc error (${config.type}):`, e);
            }

            return { config, results, period };
        }).filter(Boolean) as { config: any, results: any, period: number }[];
    }, [indicators, candles, currentPrice]);

    // 2. Cheap lookup when activeIndex changes (mouse move)
    return useMemo(() => {
        if (!calculatedIndicators.length) return [];

        return calculatedIndicators.map(({ config, results, period }) => {
            // Logic: if activeIndex is invalid (e.g. -1 for mouse out), use the LAST VALID index (realtime)
            // But checking results length validity
            const len = Array.isArray(results) ? results.length : (results.macd?.length || 0);
            let idx = activeIndex;

            if (idx < 0 || idx >= len) {
                idx = len - 1;
            }

            if (config.type === 'MACD') {
                const macdVal = results.macd[idx];
                const sigVal = results.signal[idx];
                const histVal = results.histogram[idx];
                const { fast = 12, slow = 26, signal = 9 } = config.params;

                return {
                    id: config.id,
                    type: config.type,
                    name: `MACD`,
                    // We construct a composite value display
                    values: [
                        { label: `${fast},${slow}`, value: isNaN(macdVal) ? '-' : macdVal.toFixed(2), color: config.color }, // MACD Line
                        { label: `${signal}`, value: isNaN(sigVal) ? '-' : sigVal.toFixed(2), color: '#FF6D00' }, // Signal Line
                        { label: 'H', value: isNaN(histVal) ? '-' : histVal.toFixed(2), color: histVal >= 0 ? '#26a69a' : '#ef5350' } // Histogram
                    ],
                    value: '', // unused for MACD
                    color: config.color,
                    pane: config.pane
                } as IndicatorValueItem;
            }

            // Standard Single Value Indicators
            const val = results[idx] ?? NaN;
            return {
                id: config.id,
                type: config.type,
                name: `${config.type} ${period}`,
                value: isNaN(val) ? '···' : val.toFixed(2),
                color: config.color,
                pane: config.pane
            } as IndicatorValueItem;
        });
    }, [calculatedIndicators, activeIndex]);
}
