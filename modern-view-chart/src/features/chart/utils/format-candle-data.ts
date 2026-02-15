import { Time } from 'lightweight-charts';
import { calculateHeikinAshi, calculateRSI, calculateEMA } from './indicator-math';
import { toSec } from './time-utils';

export interface FormattedCandle {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    candleColor?: string;
}

export function formatCandleData(
    candles: any[],
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles'
): FormattedCandle[] {
    if (!candles || candles.length === 0) return [];

    let displayCandles = candles;

    if (chartType === 'heikin_ashi') {
        const haData = calculateHeikinAshi(candles);
        displayCandles = haData.map(c => ({
            ...c,
            open: c.ha_open,
            high: c.ha_high,
            low: c.ha_low,
            close: c.ha_close,
            candleColor: c.ha_close >= c.ha_open ? '#00ff88' : '#ff3366',
        }));
    } else if (chartType === 'smart_candles') {
        displayCandles = candles.map((c) => {
            const open = Number(c.open);
            const close = Number(c.close);
            const color = close >= open ? '#00ff88' : '#ff3366';
            return { ...c, candleColor: color };
        });
    }

    return displayCandles
        .map(c => ({
            time: toSec(c.time) as Time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            candleColor: (c as any).candleColor || (c as any).color
        }))
        .sort((a, b) => (Number(a.time) - Number(b.time)))
        .filter((item, index, array) => !index || item.time !== array[index - 1].time);
}

