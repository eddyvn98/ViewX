import { useMemo } from 'react';
import { useMarketStore, Candle, IndicatorConfig } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { calculateEMA, calculateRSI, calculateHullMA, calculateMACD } from '../utils/indicator-math';

const EMPTY_INDICATORS: IndicatorConfig[] = [];

export interface IndicatorValueItem {
    id: string;
    type: string;
    name: string;
    value: string | number;
    color: string;
    pane: string;
    values?: { label: string; value: string; color?: string }[];
}

type MacdSeries = { macd: number[]; signal: number[]; histogram: number[] };
type IndicatorSeries = number[] | MacdSeries;
type IndicatorCalcItem = { config: IndicatorConfig; results: IndicatorSeries; period: number };

const getNumberParam = (config: IndicatorConfig, key: string, fallback: number): number => {
    const raw = config.params[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
};

const isMacdSeries = (value: IndicatorSeries): value is MacdSeries => {
    return typeof value === 'object' && value !== null && 'macd' in value && 'signal' in value && 'histogram' in value;
};

export function useChartIndicatorValues(chartId: string, candles: Candle[], activeIndex: number, currentPrice?: number) {
    const indicators = useMarketStore(useShallow((state) => state.chartIndicators[chartId] || EMPTY_INDICATORS));

    const baseCalculatedIndicators = useMemo<IndicatorCalcItem[]>(() => {
        if (!indicators.length || !candles.length) return [];

        const prices = candles.map((candle) => candle.close);

        return indicators
            .map((config) => {
                if (!config.visible) return null;

                const period = getNumberParam(config, 'period', 14);
                let results: IndicatorSeries = [];

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
                            const fast = getNumberParam(config, 'fast', 12);
                            const slow = getNumberParam(config, 'slow', 26);
                            const signal = getNumberParam(config, 'signal', 9);
                            results = calculateMACD(prices, fast, slow, signal);
                            break;
                        }
                    }
                } catch (error) {
                    console.error(`Indicator calc error (${config.type}):`, error);
                }

                return { config, results, period };
            })
            .filter((item): item is IndicatorCalcItem => item !== null);
    }, [indicators, candles]);

    const indicatorsWithRealtime = useMemo<IndicatorCalcItem[]>(() => {
        if (!currentPrice || !baseCalculatedIndicators.length) return baseCalculatedIndicators;

        return baseCalculatedIndicators.map((item) => {
            const { config, results, period } = item;
            const prices = candles.map((candle) => candle.close);
            if (prices.length > 0) {
                prices[prices.length - 1] = currentPrice;
            }

            let realtimeResults: IndicatorSeries = results;
            try {
                switch (config.type) {
                    case 'EMA': {
                        if (!Array.isArray(results)) break;
                        const alpha = 2 / (period + 1);
                        const prevEma = results[results.length - 2];
                        if (!Number.isNaN(prevEma)) {
                            const newLast = (currentPrice - prevEma) * alpha + prevEma;
                            realtimeResults = [...results];
                            (realtimeResults as number[])[(realtimeResults as number[]).length - 1] = newLast;
                        }
                        break;
                    }
                    case 'RSI': {
                        if (!Array.isArray(results)) break;
                        const latestRSI = calculateRSI(prices.slice(-period * 2), period);
                        realtimeResults = [...results];
                        (realtimeResults as number[])[(realtimeResults as number[]).length - 1] = latestRSI[latestRSI.length - 1];
                        break;
                    }
                    case 'MACD': {
                        if (!isMacdSeries(results)) break;
                        const fast = getNumberParam(config, 'fast', 12);
                        const slow = getNumberParam(config, 'slow', 26);
                        const signal = getNumberParam(config, 'signal', 9);
                        const latestMACD = calculateMACD(prices.slice(-(slow + signal) * 2), fast, slow, signal);

                        realtimeResults = {
                            macd: [...results.macd],
                            signal: [...results.signal],
                            histogram: [...results.histogram],
                        };
                        realtimeResults.macd[realtimeResults.macd.length - 1] = latestMACD.macd[latestMACD.macd.length - 1];
                        realtimeResults.signal[realtimeResults.signal.length - 1] = latestMACD.signal[latestMACD.signal.length - 1];
                        realtimeResults.histogram[realtimeResults.histogram.length - 1] = latestMACD.histogram[latestMACD.histogram.length - 1];
                        break;
                    }
                }
            } catch {
                // Keep previous indicator values if realtime recomputation fails.
            }

            return { ...item, results: realtimeResults };
        });
    }, [baseCalculatedIndicators, currentPrice, candles]);

    return useMemo(() => {
        if (!indicatorsWithRealtime.length) return [];

        const state = useMarketStore.getState();
        const chartSymbol =
            Object.values(state.tabs)
                .flatMap((tab) => Object.values(tab.charts || {}))
                .find((chart) => chart.id === chartId)?.symbol || '';

        const symbolMeta =
            state.symbolInfo[chartSymbol] || Object.values(state.symbolInfo).find((symbolInfo) => chartSymbol && symbolInfo.symbol.includes(chartSymbol));
        const digits = symbolMeta?.digits || 2;

        return indicatorsWithRealtime.map(({ config, results, period }) => {
            if (config.type === 'MACD' && isMacdSeries(results)) {
                const len = results.macd.length || 0;
                let idx = activeIndex;
                if (idx < 0 || idx >= len) idx = len - 1;

                const macdVal = results.macd[idx];
                const sigVal = results.signal[idx];
                const histVal = results.histogram[idx];
                const fast = getNumberParam(config, 'fast', 12);
                const slow = getNumberParam(config, 'slow', 26);
                const signal = getNumberParam(config, 'signal', 9);

                return {
                    id: config.id,
                    type: config.type,
                    name: 'MACD',
                    values: [
                        { label: `${fast},${slow}`, value: Number.isNaN(macdVal) ? '-' : macdVal.toFixed(digits), color: config.color },
                        { label: `${signal}`, value: Number.isNaN(sigVal) ? '-' : sigVal.toFixed(digits), color: '#FF6D00' },
                        { label: 'H', value: Number.isNaN(histVal) ? '-' : histVal.toFixed(digits), color: histVal >= 0 ? '#26a69a' : '#ef5350' },
                    ],
                    value: '',
                    color: config.color,
                    pane: config.pane,
                } as IndicatorValueItem;
            }

            const numericResults = Array.isArray(results) ? results : [];
            const len = numericResults.length;
            let idx = activeIndex;
            if (idx < 0 || idx >= len) idx = len - 1;

            const value = numericResults[idx] ?? Number.NaN;
            return {
                id: config.id,
                type: config.type,
                name: `${config.type} ${period}`,
                value: Number.isNaN(value) ? '...' : value.toFixed(digits),
                color: config.color,
                pane: config.pane,
            } as IndicatorValueItem;
        });
    }, [indicatorsWithRealtime, activeIndex, chartId]);
}
