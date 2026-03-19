import { Candle } from '@/lib/store/types';
import {
    calculateEMA,
    calculateSMA,
    calculateRSI,
    calculateMACD,
    calculateHullMA,
    calculateHeikinAshi,
    calculateATR,
    calculateSuperTrend,
    calculateVWAP,
    calculateIchimoku,
    calculateADX,
    calculateBollingerBands,
    calculateStochastic,
    calculateSAR
} from '../../chart/utils/indicator-math';
import { Indicator } from '../types';

type HACandleResult = {
    ha_open: number;
    ha_high: number;
    ha_low: number;
    ha_close: number;
};

export class IndicatorCalculator {
    static getKey(indicator: Indicator): string {
        return `${indicator.type}-${indicator.params?.join('-') || ''}-${indicator.field || ''}`;
    }

    static normalizeType(rawType: string): string {
        switch (rawType) {
            case 'BOLLINGER_BANDS': return 'BollingerBands';
            case 'STOCHASTIC': return 'Stochastic';
            case 'SUPERTREND': return 'SuperTrend';
            case 'ICHIMOKU': return 'Ichimoku';
            case 'BREAKOUT_RAYS': return 'BreakoutRays';
            case 'TREND_LINES': return 'TrendLines';
            case 'MARKET_STRUCTURE': return 'MarketStructure';
            case 'FIBONACCI': return 'Fibonacci';
            case 'FIBONACCI_EXTENSION': return 'FibonacciExtension';
            default: return rawType;
        }
    }

    static getValues(indicator: Indicator, candles: Candle[]): number[] {
        const prices = candles.map(c => c.close);
        const type = this.normalizeType(indicator.type);

        switch (type) {
            case "Price":
                if (indicator.field === 'open') return candles.map((c) => Number(c.open));
                if (indicator.field === 'high') return candles.map((c) => Number(c.high));
                if (indicator.field === 'low') return candles.map((c) => Number(c.low));
                return prices;
            case "RSI":
                return calculateRSI(prices, indicator.params[0] || 14);
            case "EMA":
                return calculateEMA(prices, indicator.params[0] || 25);
            case "SMA":
                return calculateSMA(prices, indicator.params[0] || 25);
            case "HMA":
                return calculateHullMA(prices, indicator.params[0] || 25);
            case "HA": {
                const results = calculateHeikinAshi(candles) as HACandleResult[];
                if (indicator.field === "open") return results.map((r) => r.ha_open);
                if (indicator.field === "high") return results.map((r) => r.ha_high);
                if (indicator.field === "low") return results.map((r) => r.ha_low);
                return results.map((r) => r.ha_close);
            }
            case "MACD": {
                const result = calculateMACD(
                    prices,
                    indicator.params[0] || 12,
                    indicator.params[1] || 26,
                    indicator.params[2] || 9
                );
                if (indicator.field === "signal") return result.signal;
                if (indicator.field === "histogram") return result.histogram;
                return result.macd;
            }
            case "BollingerBands": {
                const result = calculateBollingerBands(prices, indicator.params[0] || 20, indicator.params[1] || 2);
                if (indicator.field === 'upper') return result.upper;
                if (indicator.field === 'lower') return result.lower;
                return result.middle;
            }
            case "Stochastic": {
                const highs = candles.map((c) => Number(c.high));
                const lows = candles.map((c) => Number(c.low));
                const result = calculateStochastic(highs, lows, prices, indicator.params[0] || 14, indicator.params[1] || 3, indicator.params[2] || 3);
                if (indicator.field === 'd') return result.d;
                return result.k;
            }
            case "ATR":
                return calculateATR(candles, indicator.params[0] || 14);
            case "SuperTrend": {
                const res = calculateSuperTrend(candles, indicator.params[0] || 10, indicator.params[1] || 3);
                if (indicator.field === 'trend') return res.trend;
                return res.superTrend;
            }
            case "VWAP":
                return calculateVWAP(candles);
            case "Ichimoku": {
                const res = calculateIchimoku(candles, indicator.params[0] || 9, indicator.params[1] || 26, indicator.params[2] || 52, indicator.params[3] || 26);
                if (indicator.field === 'tenkan') return res.tenkan;
                if (indicator.field === 'spanA') return res.spanA;
                if (indicator.field === 'spanB') return res.spanB;
                if (indicator.field === 'chikou') return res.chikou;
                return res.kijun;
            }
            case "ADX": {
                const res = calculateADX(candles, indicator.params[0] || 14);
                if (indicator.field === 'plusDI') return res.plusDI;
                if (indicator.field === 'minusDI') return res.minusDI;
                return res.adx;
            }
            case "SAR":
                return calculateSAR(candles, indicator.params[0] || 0.02, indicator.params[1] || 0.02, indicator.params[2] || 0.2);
            case "BreakoutRays":
            case "TrendLines":
            case "MarketStructure":
            case "Fibonacci":
            case "FibonacciExtension":
            case "OrderBlock":
            case "FVG":
                return new Array(candles.length).fill(NaN);
            case "SIGNALS":
            case "Signals": {
                // Return RSI14 values for SignalIndicator to use as 'calculatedValues'
                return calculateRSI(prices, 14);
            }
            default:
                return new Array(candles.length).fill(NaN);
        }
    }

    static getLastValue(indicator: Indicator, candles: Candle[]): number {
        const values = this.getValues(indicator, candles);
        return values[values.length - 1];
    }

    static getPreviousValue(indicator: Indicator, candles: Candle[]): number {
        const values = this.getValues(indicator, candles);
        return values[values.length - 2];
    }
}
