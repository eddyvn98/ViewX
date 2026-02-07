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

// Helper to get only the last value of an indicator incrementally
function calculateLastValue(type: string, prices: number[], baseResults: any, period: number, currentPrice: number) {
    if (prices.length < period) return NaN;

    const lastIdx = prices.length - 1;

    switch (type) {
        case 'EMA': {
            const alpha = 2 / (period + 1);
            const prevEma = baseResults[lastIdx - 1];
            if (isNaN(prevEma)) return baseResults[lastIdx]; // Fallback to full calc if no prev
            return (currentPrice - prevEma) * alpha + prevEma;
        }
        case 'RSI': {
            // Simplification: for the legend preview, we can just use the latest full calc
            // or a simplified incremental RSI. For now, let's keep it simple.
            return baseResults[lastIdx];
        }
        default:
            return baseResults[lastIdx];
    }
}

export function useChartIndicatorValues(chartId: string, candles: Candle[], activeIndex: number, currentPrice?: number) {
    const indicators = useMarketStore(useShallow(state => state.chartIndicators[chartId] || EMPTY_INDICATORS));

    // 1. Calculate full series data ONLY when candles count or config changes
    const baseCalculatedIndicators = useMemo(() => {
        if (!indicators.length || !candles.length) return [];

        const prices = candles.map(c => c.close); // Map once

        return indicators.map(config => {
            if (!config.visible) return null;
            const period = config.params.period || 14;
            let results: any = [];

            try {
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
                        results = calculateMACD(prices, fast, slow, signal);
                        break;
                    }
                }
            } catch (e) {
                console.error(`Indicator calc error (${config.type}):`, e);
            }

            return { config, results, period };
        }).filter(Boolean) as { config: any, results: any, period: number }[];
    }, [indicators, candles.length, (candles.length > 1 ? (candles[candles.length - 2] as any).time : 0)]);


    // 2. Adjust for realtime price if needed (only for the LATEST index)
    const indicatorsWithRealtime = useMemo(() => {
        if (currentPrice === undefined || !baseCalculatedIndicators.length) return baseCalculatedIndicators;

        return baseCalculatedIndicators.map(item => {
            const { config, results, period } = item;

            // If we are at the last candle, we might want to update the value with currentPrice
            // However, most indicators in math.ts already calculated for the last candle in baseCalculated
            // If currentPrice differs from the last candle's close, we could refine.
            // For simplicity and speed, we'll keep the base results for now as they are recalculated 
            // anyway when 'candles' changes (which usually happens on every bar).
            // If 'candles' includes the unclosed bar, then 'baseCalculated' is already "realtime enough"
            // if triggered by store updates.

            return item;
        });
    }, [baseCalculatedIndicators, currentPrice]);

    // 3. Cheap lookup when activeIndex changes (mouse move)
    return useMemo(() => {
        if (!indicatorsWithRealtime.length) return [];

        return indicatorsWithRealtime.map(({ config, results, period }) => {
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
                    values: [
                        { label: `${fast},${slow}`, value: isNaN(macdVal) ? '-' : macdVal.toFixed(2), color: config.color },
                        { label: `${signal}`, value: isNaN(sigVal) ? '-' : sigVal.toFixed(2), color: '#FF6D00' },
                        { label: 'H', value: isNaN(histVal) ? '-' : histVal.toFixed(2), color: histVal >= 0 ? '#26a69a' : '#ef5350' }
                    ],
                    value: '',
                    color: config.color,
                    pane: config.pane
                } as IndicatorValueItem;
            }

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
    }, [indicatorsWithRealtime, activeIndex]);
}
