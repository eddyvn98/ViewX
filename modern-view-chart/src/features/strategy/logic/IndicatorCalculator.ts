import { Candle } from '@/lib/store/types';
import { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateHullMA, calculateHeikinAshi, calculateATR, calculateSuperTrend, calculateVWAP, calculateIchimoku, calculateADX } from '../../chart/utils/indicator-math';
import { Indicator } from '../types';

type HACandleResult = {
    ha_open: number;
    ha_high: number;
    ha_low: number;
    ha_close: number;
};

export class IndicatorCalculator {
    static getValues(indicator: Indicator, candles: Candle[]): number[] {
        const prices = candles.map(c => c.close);

        switch (indicator.type) {
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
            case "ATR":
                return calculateATR(candles, indicator.params[0] || 14);
            case "SuperTrend": {
                const res = calculateSuperTrend(candles, indicator.params[0] || 10, indicator.params[1] || 3);
                return res.superTrend;
            }
            case "VWAP":
                return calculateVWAP(candles);
            case "Ichimoku": {
                const res = calculateIchimoku(candles, indicator.params[0] || 9, indicator.params[1] || 26, indicator.params[2] || 52, indicator.params[3] || 26);
                return res.kijun; // Default to kijun for strategy single line
            }
            case "ADX": {
                const res = calculateADX(candles, indicator.params[0] || 14);
                return res.adx;
            }
            case "OrderBlock":
                return new Array(candles.length).fill(NaN);
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
