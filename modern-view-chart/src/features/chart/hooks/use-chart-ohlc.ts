'use client';

import { useMarketStore } from '@/lib/store';
import { useMemo } from 'react';

export function useChartOHLC(symbol: string | undefined, interval: string | undefined, source: string | undefined) {
    const tickers = useMarketStore((state) => state.tickers);
    const candleData = useMarketStore((state) => state.candleData);
    const crosshairPoint = useMarketStore((state) => state.crosshairPoint);

    return useMemo(() => {
        if (!symbol || !interval || !source) return null;

        const key = `${source}:${symbol}:${interval}`;
        const candles = candleData[key] || [];
        if (candles.length === 0) return null;

        let activeCandle = candles[candles.length - 1];
        let isLive = true;

        // If crosshair is active, find the corresponding candle
        if (crosshairPoint?.time) {
            const found = candles.find(c => c.time === crosshairPoint.time);
            if (found) {
                activeCandle = found;
                isLive = found.time === candles[candles.length - 1].time;
            }
        }

        const ticker = tickers[symbol];

        // Determine price and changes
        // If live, use ticker price for "close", otherwise use candle close
        const close = (isLive && ticker?.price) ? ticker.price : activeCandle.close;

        // Calculate the change relative to the candle's open (OHLC Change)
        const changeValue = close - activeCandle.open;
        const change = activeCandle.open !== 0 ? (changeValue / activeCandle.open * 100) : 0;

        // Find index for indicators
        const activeIndex = crosshairPoint?.time
            ? candles.findIndex(c => c.time === crosshairPoint.time)
            : candles.length - 1;

        return {
            open: activeCandle.open,
            high: activeCandle.high,
            low: activeCandle.low,
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
