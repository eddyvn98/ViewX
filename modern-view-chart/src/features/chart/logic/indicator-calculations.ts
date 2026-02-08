import { calculateEMA, calculateRSI, calculateHullMA, calculateMACD } from '../utils/indicator-math';

export interface IndicatorCache {
    type: string;
    id: string;
    period: number;
    color: string;
    pane: string;
    results: number[] | { macd: number[]; signal: number[]; histogram: number[] };
    params?: any;
}

export const calculateIndicators = (candles: any[], indicators: any[]): IndicatorCache[] => {
    if (!candles.length || !indicators.length) return [];

    const prices = candles.map(c => c.close);

    return indicators
        .filter((config: any) => config.visible)
        .map((config: any) => {
            const period = config.params?.period || 14;
            let results: any = [];

            try {
                switch (config.type) {
                    case 'EMA': results = calculateEMA(prices, period); break;
                    case 'HMA': results = calculateHullMA(prices, period); break;
                    case 'RSI': results = calculateRSI(prices, period); break;
                    case 'MACD': {
                        const { fast = 12, slow = 26, signal = 9 } = config.params || {};
                        results = calculateMACD(prices, fast, slow, signal);
                        break;
                    }
                }
            } catch (e) {
                console.error(`Indicator calc error (${config.type}):`, e);
            }

            return {
                type: config.type,
                id: config.id,
                period,
                color: config.color,
                pane: config.pane,
                results,
                params: config.params
            };
        });
};
