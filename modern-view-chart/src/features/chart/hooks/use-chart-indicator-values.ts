'use client';

import { useMemo } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { calculateEMA, calculateRSI, calculateHullMA } from '../utils/indicator-math';

const EMPTY_INDICATORS: any[] = [];

export function useChartIndicatorValues(chartId: string, candles: Candle[], activeIndex: number) {
    const indicators = useMarketStore(useShallow(state => state.chartIndicators[chartId] || EMPTY_INDICATORS));

    // 1. Calculate full series data only when candles or indicators config change
    const calculatedIndicators = useMemo(() => {
        if (!indicators.length || !candles.length) return [];

        return indicators.map(config => {
            if (!config.visible) return null;
            const period = config.params.period || 14;
            let results: (number | null)[] = [];

            try {
                const prices = candles.map(c => c.close);
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
                }
            } catch (e) {
                console.error(`Indicator calc error (${config.type}):`, e);
            }

            return { config, results, period };
        }).filter(Boolean) as { config: any, results: (number | null)[], period: number }[];
    }, [indicators, candles]);

    // 2. Cheap lookup when activeIndex changes (mouse move)
    return useMemo(() => {
        if (activeIndex < 0 || !calculatedIndicators.length) return [];

        return calculatedIndicators.map(({ config, results, period }) => {
            const value = results[activeIndex] ?? NaN;
            return {
                id: config.id,
                type: config.type,
                name: `${config.type} ${period}`,
                value,
                color: config.color,
                pane: config.pane
            };
        });
    }, [calculatedIndicators, activeIndex]);
}
