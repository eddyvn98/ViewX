'use client';

import { useMemo } from 'react';
import { useMarketStore, Candle } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { calculateEMA, calculateRSI, calculateHullMA } from '../utils/indicator-math';

const EMPTY_INDICATORS: any[] = [];

export function useChartIndicatorValues(chartId: string, candles: Candle[], activeIndex: number) {
    const indicators = useMarketStore(useShallow(state => state.chartIndicators[chartId] || EMPTY_INDICATORS));

    return useMemo(() => {
        if (!indicators.length || !candles.length || activeIndex < 0) return [];

        return indicators.map(config => {
            if (!config.visible) return null;

            let value: number = NaN;
            const period = config.params.period || 14;

            try {
                switch (config.type) {
                    case 'EMA': {
                        const prices = candles.map(c => c.close);
                        const results = calculateEMA(prices, period);
                        value = results[activeIndex];
                        break;
                    }
                    case 'HMA': {
                        const prices = candles.map(c => c.close);
                        const results = calculateHullMA(prices, period);
                        value = results[activeIndex];
                        break;
                    }
                    case 'RSI': {
                        const prices = candles.map(c => c.close);
                        const results = calculateRSI(prices, period);
                        value = results[activeIndex];
                        break;
                    }
                }
            } catch (e) {
                console.error(`Indicator calc error (${config.type}):`, e);
            }

            return {
                id: config.id,
                type: config.type,
                name: `${config.type} ${period}`,
                value,
                color: config.color,
                pane: config.pane
            };
        }).filter(Boolean);
    }, [indicators, candles, activeIndex]);
}
