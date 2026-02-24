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
    const lastCandleClose = candles.length > 0 ? candles[candles.length - 1].close : 0;

    // 1. Calculate full series data
    const baseCalculatedIndicators = useMemo(() => {
        if (!indicators.length || !candles.length) return [];

        const prices = candles.map(c => c.close); // Map once

        return indicators.map(config => {
            if (!config.visible) return null;
            const period = config.params.period || 14;
            let results: any = [];

            try {
                switch (config.type) {
                    case 'EMA': results = calculateEMA(prices, period); break;
                    case 'HMA': results = calculateHullMA(prices, period); break;
                    case 'RSI': results = calculateRSI(prices, period); break;
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
    }, [indicators, candles.length, lastCandleClose, chartId]);


    // 2. Adjust for realtime price if needed
    const indicatorsWithRealtime = useMemo(() => {
        if (!currentPrice || !baseCalculatedIndicators.length) return baseCalculatedIndicators;

        return baseCalculatedIndicators.map(item => {
            const { config, results, period } = item;

            // Recalculate ONLY the last point if we have a currentPrice
            // This ensures the legend jumps in real-time
            const prices = candles.map(c => c.close);
            if (prices.length > 0) {
                prices[prices.length - 1] = currentPrice;
            }

            let realtimeResults = results;
            try {
                switch (config.type) {
                    case 'EMA': {
                        const alpha = 2 / (period + 1);
                        const prevEma = results[results.length - 2];
                        if (!isNaN(prevEma)) {
                            const newLast = (currentPrice - prevEma) * alpha + prevEma;
                            realtimeResults = [...results];
                            realtimeResults[realtimeResults.length - 1] = newLast;
                        }
                        break;
                    }
                    case 'RSI': {
                        // For RSI, full recalculation of the last point is safest due to smoothing
                        const latestRSI = calculateRSI(prices.slice(-period * 2), period);
                        realtimeResults = [...results];
                        realtimeResults[realtimeResults.length - 1] = latestRSI[latestRSI.length - 1];
                        break;
                    }
                    case 'MACD': {
                        const { fast = 12, slow = 26, signal = 9 } = config.params;
                        const latestMACD = calculateMACD(prices.slice(-(slow + signal) * 2), fast, slow, signal);

                        realtimeResults = {
                            macd: [...results.macd],
                            signal: [...results.signal],
                            histogram: [...results.histogram]
                        };
                        realtimeResults.macd[realtimeResults.macd.length - 1] = latestMACD.macd[latestMACD.macd.length - 1];
                        realtimeResults.signal[realtimeResults.signal.length - 1] = latestMACD.signal[latestMACD.signal.length - 1];
                        realtimeResults.histogram[realtimeResults.histogram.length - 1] = latestMACD.histogram[latestMACD.histogram.length - 1];
                        break;
                    }
                }
            } catch (e) { }

            return { ...item, results: realtimeResults };
        });
    }, [baseCalculatedIndicators, currentPrice, candles.length]);

    // 3. Cheap lookup when activeIndex changes (mouse move)
    return useMemo(() => {
        if (!indicatorsWithRealtime.length) return [];

        const symbolMeta = useMarketStore.getState().symbolInfo[candles[0]?.symbol || ''] ||
            Object.values(useMarketStore.getState().symbolInfo).find(s => s.symbol.includes(candles[0]?.symbol || ''));
        const digits = symbolMeta?.digits || 2;

        return indicatorsWithRealtime.map(({ config, results, period }) => {
            const isMACD = config.type === 'MACD';
            const len = isMACD ? (results.macd?.length || 0) : results.length;
            let idx = activeIndex;

            if (idx < 0 || idx >= len) {
                idx = len - 1;
            }

            if (isMACD) {
                const macdVal = results.macd[idx];
                const sigVal = results.signal[idx];
                const histVal = results.histogram[idx];
                const { fast = 12, slow = 26, signal = 9 } = config.params;

                return {
                    id: config.id,
                    type: config.type,
                    name: `MACD`,
                    values: [
                        { label: `${fast},${slow}`, value: isNaN(macdVal) ? '-' : macdVal.toFixed(digits), color: config.color },
                        { label: `${signal}`, value: isNaN(sigVal) ? '-' : sigVal.toFixed(digits), color: '#FF6D00' },
                        { label: 'H', value: isNaN(histVal) ? '-' : histVal.toFixed(digits), color: histVal >= 0 ? '#26a69a' : '#ef5350' }
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
                value: isNaN(val) ? '···' : val.toFixed(digits),
                color: config.color,
                pane: config.pane
            } as IndicatorValueItem;
        });
    }, [indicatorsWithRealtime, activeIndex, candles]);
}
