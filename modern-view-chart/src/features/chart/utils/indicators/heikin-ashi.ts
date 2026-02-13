import { Candle } from '@/lib/store/types';
import { HACandle } from '@/features/strategy/types';

/**
 * Calculate Heikin Ashi Candles
 */
export function calculateHeikinAshi(candles: Candle[]): HACandle[] {
    if (candles.length === 0) return [];

    const result: HACandle[] = [];

    // Initial HA Open is regular Open
    let prevHaOpen = Number(candles[0].open);
    let prevHaClose = (Number(candles[0].open) + Number(candles[0].high) + Number(candles[0].low) + Number(candles[0].close)) / 4;

    result.push({
        ...candles[0],
        ha_open: prevHaOpen,
        ha_close: prevHaClose,
        ha_high: Number(candles[0].high),
        ha_low: Number(candles[0].low)
    });

    for (let i = 1; i < candles.length; i++) {
        const c = candles[i];
        const open = Number(c.open);
        const high = Number(c.high);
        const low = Number(c.low);
        const close = Number(c.close);

        const haClose = (open + high + low + close) / 4;
        const haOpen = (prevHaOpen + prevHaClose) / 2;
        const haHigh = Math.max(high, haOpen, haClose);
        const haLow = Math.min(low, haOpen, haClose);

        result.push({
            ...c,
            ha_open: haOpen,
            ha_close: haClose,
            ha_high: haHigh,
            ha_low: haLow
        });

        prevHaOpen = haOpen;
        prevHaClose = haClose;
    }

    return result;
}
