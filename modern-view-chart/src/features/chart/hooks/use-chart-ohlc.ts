'use client';

import { useMarketStore } from '@/lib/store';
import { useMemo } from 'react';

export function useChartOHLC(symbol: string | undefined, interval: string | undefined, source: string | undefined) {
    const tickers = useMarketStore((state) => state.tickers);
    const candleData = useMarketStore((state) => state.candleData);
    const crosshairPoint = useMarketStore((state) => state.crosshairPoint);

    return useMemo(() => {
        if (!symbol || !interval || !source) return null;

        const normSymbol = symbol.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol;
        const key = `${source}:${normSymbol}:${interval}`;
        const candles = candleData[key] || [];
        if (candles.length === 0) return null;

        let activeCandle = candles[candles.length - 1];
        let isLive = true;

        // If crosshair is active, find the corresponding candle
        if (crosshairPoint?.time) {
            const found = candles.find(c => {
                const t = typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time);
                return t === crosshairPoint.time;
            });
            if (found) {
                activeCandle = found;
                const lastT = typeof candles[candles.length - 1].time === 'object'
                    ? (candles[candles.length - 1].time as any).timestamp
                    : Number(candles[candles.length - 1].time);
                isLive = crosshairPoint.time === lastT;
            }
        }

        const ticker = tickers[symbol];

        // Determine price and changes
        let open = activeCandle.open;
        let high = activeCandle.high;
        let low = activeCandle.low;
        let close = activeCandle.close;

        if (isLive && ticker?.price) {
            close = ticker.price;
            if (close > high) high = close;
            if (close < low) low = close;
        }

        // Calculate the change relative to the candle's open (OHLC Change)
        const changeValue = close - open;
        const change = open !== 0 ? (changeValue / open * 100) : 0;

        // Find index for indicators
        const activeIndex = crosshairPoint?.time
            ? candles.findIndex(c => {
                const t = typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time);
                return t === crosshairPoint.time;
            })
            : candles.length - 1;

        return {
            open,
            high,
            low,
            close,
            change,
            changeValue,
            symbol,
            interval,
            source,
            isLive,
            activeIndex
        };
    }, [symbol, interval, source, tickers, candleData, crosshairPoint]);
}
