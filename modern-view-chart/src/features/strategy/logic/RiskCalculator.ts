import { SLTPConfig, LotConfig, IndicatorType } from '../types';
import { IndicatorCalculator } from './IndicatorCalculator';

export class RiskCalculator {
    static calculateLevel(
        config: number | SLTPConfig | undefined,
        type: 'sl' | 'tp',
        side: 'BUY' | 'SELL',
        candles: any[],
        currentPrice: number,
        pipSize: number,
        entryPrice?: number
    ): number {
        if (config === undefined) return 0;

        if (typeof config === 'number') {
            const offset = config * pipSize;
            if (type === 'sl') {
                return side === 'BUY' ? currentPrice - offset : currentPrice + offset;
            } else {
                return side === 'BUY' ? currentPrice + offset : currentPrice - offset;
            }
        }

        const { mode, value, candleOffset, candleField, indicator, offset = 0 } = config;
        let basePrice = currentPrice;

        switch (mode) {
            case 'fixed':
                const fixedOffset = (value || 0) * pipSize;
                if (type === 'sl') {
                    return side === 'BUY' ? currentPrice - fixedOffset : currentPrice + fixedOffset;
                } else {
                    return side === 'BUY' ? currentPrice + fixedOffset : currentPrice - fixedOffset;
                }

            case 'percentage':
                const pctOffset = currentPrice * ((value || 0) / 100);
                if (type === 'sl') {
                    return side === 'BUY' ? currentPrice - pctOffset : currentPrice + pctOffset;
                } else {
                    return side === 'BUY' ? currentPrice + pctOffset : currentPrice - pctOffset;
                }

            case 'amount':
                // Note: This is an approximation since lot size/margin isn't fully calculated here
                // For now, treat it similarly to points but can be expanded
                const amtOffset = (value || 0) * pipSize;
                if (type === 'sl') {
                    return side === 'BUY' ? currentPrice - amtOffset : currentPrice + amtOffset;
                } else {
                    return side === 'BUY' ? currentPrice + amtOffset : currentPrice - amtOffset;
                }

            case 'candle':
                if (!candles || candles.length === 0) return currentPrice;
                const lookback = candleOffset || 1;
                const targetCandle = candles[candles.length - 1 - lookback];
                if (!targetCandle) return currentPrice;

                const field = candleField || (type === 'sl' ? (side === 'BUY' ? 'low' : 'high') : (side === 'BUY' ? 'high' : 'low'));
                basePrice = targetCandle[field] || currentPrice;
                const finalOffset = offset * pipSize;
                return type === 'sl'
                    ? (side === 'BUY' ? basePrice - finalOffset : basePrice + finalOffset)
                    : (side === 'BUY' ? basePrice + finalOffset : basePrice - finalOffset);

            case 'indicator':
                if (!indicator || !candles || candles.length === 0) return currentPrice;
                const indValue = IndicatorCalculator.getLastValue(indicator, candles.slice(0, -1));
                if (indValue === null) return currentPrice;
                const indOffset = offset * pipSize;
                return type === 'sl'
                    ? (side === 'BUY' ? indValue - indOffset : indValue + indOffset)
                    : (side === 'BUY' ? indValue + indOffset : indValue - indOffset);

            case 'winrate':
                // This mode usually calculates TP based on SL
                // If it's SL, it should probably fallback to fixed or candle
                // For now, let's treat it as a multiplier for TP
                if (type === 'tp' && entryPrice) {
                    const slDistance = Math.abs(entryPrice - (typeof config === 'object' ? currentPrice : currentPrice)); // This needs the SL price
                    // We'll need to pass the calculated SL price if we want to support RR properly
                    // For now, fallback to a simple 1:2 calculation if no SL provided
                    const rr = value || 2;
                    const defaultSlDist = 200 * pipSize;
                    return side === 'BUY' ? entryPrice + (defaultSlDist * rr) : entryPrice - (defaultSlDist * rr);
                }
                return currentPrice;

            default:
                return currentPrice;
        }
    }

    static calculateLot(
        config: number | LotConfig,
        slPrice: number,
        entryPrice: number,
        accountBalance: number,
        symbol: string
    ): number {
        const val = typeof config === 'number' ? { mode: 'fixed' as const, value: config } : config;

        if (val.mode === 'fixed') return val.value;

        // Risk-based calculation
        if (slPrice === 0 || entryPrice === slPrice) return 0.01;

        const riskAmount = val.mode === 'percentage'
            ? (accountBalance * (val.value / 100))
            : val.value;

        const slDistance = Math.abs(entryPrice - slPrice);

        // Approximation logic for lot sizing
        // For Forex: 1 Lot = 100,000 value. 1 Pip = 0.0001 (or 0.01 for JPY)
        // For Gold: 1 Lot = 100 oz. 1 Point = 0.1
        const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD');
        const isJpy = symbol.toUpperCase().includes('JPY');

        // Simple multiplier for different asset classes to get approximate USD risk per point per lot
        const riskPerPointPerLot = isGold ? 100 : (isJpy ? 1000 : 100000);

        let lot = riskAmount / (slDistance * riskPerPointPerLot);

        // Normalize to 2 decimal places and ensure minimum lot size
        lot = Math.max(0.01, Math.round(lot * 100) / 100);

        // Safety cap (e.g., max 100 lots)
        lot = Math.min(lot, 100);

        return lot;
    }
}
