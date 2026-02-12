import { Candle } from '@/lib/store/types';
import { calculateEMA, calculateSMA, calculateRSI, calculateMACD, calculateHullMA, calculateHeikinAshi } from '../../chart/utils/indicator-math';
import { Indicator } from '../types';

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
                const results = calculateHeikinAshi(candles);
                if (indicator.field === "open") return results.map((r: any) => r.ha_open);
                if (indicator.field === "high") return results.map((r: any) => r.ha_high);
                if (indicator.field === "low") return results.map((r: any) => r.ha_low);
                return results.map((r: any) => r.ha_close);
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
