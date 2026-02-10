'use client';

import { useMarketStore } from '@/lib/store';
import { useMemo, useState, useEffect } from 'react';

const EMPTY_ARRAY: any[] = [];

export function useChartOHLC(symbol: string | undefined, interval: string | undefined, source: string | undefined) {
    const normSymbol = useMemo(() => {
        if (!symbol) return '';
        return symbol.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol;
    }, [symbol]);

    const key = useMemo(() => {
        if (!normSymbol || !interval || !source) return '';
        return `${source}:${normSymbol}:${interval}`;
    }, [normSymbol, interval, source]);

    const tickerKey = useMemo(() => {
        if (!symbol || !source) return '';
        return `${source}:${normSymbol}`;
    }, [symbol, source, normSymbol]);

    const tickerPrice = useMarketStore((state) => tickerKey ? (state.tickers[tickerKey]?.price || state.tickers[normSymbol]?.price) : undefined);
    const candles = useMarketStore((state) => key ? (state.candleData[key] || EMPTY_ARRAY) : EMPTY_ARRAY);

    // ⚡ PERFORMANCE: We use window events for crosshair updates to avoid React re-renders of the whole chart UI
    const [crosshairTime, setCrosshairTime] = useState<number | null>(null);

    useEffect(() => {
        const handler = (e: any) => {
            if (e.detail?.time !== crosshairTime) {
                setCrosshairTime(e.detail?.time);
            }
        };
        window.addEventListener('chart-crosshair', handler);
        return () => window.removeEventListener('chart-crosshair', handler);
    }, [crosshairTime]);


    return useMemo(() => {
        if (!symbol || !interval || !source || candles.length === 0) return null;

        // Optimized Binary Search for crosshair index
        let activeIndex = candles.length - 1;
        if (crosshairTime) {
            let low = 0;
            let high = candles.length - 1;
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const midTime = typeof candles[mid].time === 'object'
                    ? (candles[mid].time as any).timestamp
                    : Number(candles[mid].time);

                if (midTime === crosshairTime) {
                    activeIndex = mid;
                    break;
                } else if (midTime < crosshairTime) {
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
        }

        const activeCandle = candles[activeIndex];
        const lastCandle = candles[candles.length - 1];
        const lastT = typeof lastCandle.time === 'object'
            ? (lastCandle.time as any).timestamp
            : Number(lastCandle.time);

        const isLive = !crosshairTime || crosshairTime === lastT;

        // Determine price and changes
        let open = activeCandle.open;
        let high = activeCandle.high;
        let low = activeCandle.low;
        let close = activeCandle.close;

        if (isLive && tickerPrice) {
            close = tickerPrice;
            if (close > high) high = close;
            if (close < low) low = close;
        }

        // Calculate the change relative to the candle's open (OHLC Change)
        const changeValue = close - open;
        const change = open !== 0 ? (changeValue / open * 100) : 0;

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
    }, [symbol, interval, source, tickerPrice, candles, crosshairTime]);

}
