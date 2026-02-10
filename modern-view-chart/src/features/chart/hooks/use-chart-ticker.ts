import { useRef, useEffect } from 'react';
import { ISeriesApi, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { toSec } from './use-chart-history';

interface UseChartTickerProps {
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
    chartType: 'candles' | 'heikin_ashi';
    lastCandleRef: React.MutableRefObject<any>; // Reference to the latest COMMITTED candle (from store)
}

export function useChartTicker({
    symbol, interval, source, seriesRef, chartType, lastCandleRef
}: UseChartTickerProps) {

    // Store localized candle state (high/low/close) that might be newer than store
    const realTimeCandleRef = useRef<any>(null);



    const normSymbol = symbol ? (symbol.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol) : '';
    const tickerKey = `${source}:${normSymbol}`;

    // Helper: Parse interval to seconds
    const getIntervalSeconds = (intv: string) => {
        const unit = intv.slice(-1);
        const val = parseInt(intv);
        if (unit === 'm') return val * 60;
        if (unit === 'h' || unit === 'H') return val * 3600;
        if (unit === 'd' || unit === 'D') return val * 86400;
        if (!isNaN(Number(intv))) return Number(intv) * 60;
        return 60;
    };

    // Reset local state when context changes
    useEffect(() => {
        realTimeCandleRef.current = null;
    }, [symbol, interval, source]);

    // Sync Ref when store updates (History caught up)
    // Sync visualized candle with store (base truth)
    useEffect(() => {
        if (lastCandleRef.current) {
            // Validate timestamps if possible? 
            // We just trust the history hook provided the correct candle for this symbol
            realTimeCandleRef.current = { ...lastCandleRef.current };
        }
    }, [lastCandleRef.current, symbol]); // Trigger on object change or symbol

    // Ticker Subscription
    useEffect(() => {
        if (!symbol || !source || !seriesRef.current) return;

        const handleTick = (price: number) => {
            if (!price) return;

            // 1. Get Base Candle
            let base = realTimeCandleRef.current;

            // SECURITY: If we don't have a confirmed history candle for THIS symbol, abort.
            // This prevents "Phantom Candle" logic from using stale data from previous symbol.
            if (!base) return;

            // 2. Determine Current Time (Server Aligned)
            const intervalSec = getIntervalSeconds(interval || '1');

            // ... (rest of logic) ...

            const lastCandleTime = toSec(base.time);
            const nextBarTime = lastCandleTime + intervalSec;

            // 3. Client-side New Bar Generation (FIX for "Drawing Over" / "Vẽ Chồng Nến")
            const now = Math.floor(Date.now() / 1000);

            // Logic: strictly greater or equal.
            // We assume base.time is valid seconds.
            if (now >= nextBarTime) {
                // Create Phantom Candle
                const isHA = chartType === 'heikin_ashi';

                // For HA, the new Open is (Prev HA Open + Prev HA Close) / 2
                // base.open and base.close are HA values if coming from history or previous HA tick
                const haOpen = isHA ? (base.open + base.close) / 2 : base.close;

                const newCandle = {
                    time: nextBarTime as Time,
                    open: isHA ? haOpen : base.close,
                    high: price,
                    low: price,
                    close: price,
                    // If HA, keep track of raw data for future ticks
                    rawOpen: base.rawClose || base.close,
                    rawHigh: price,
                    rawLow: price,
                    rawClose: price,
                    ha_open: isHA ? haOpen : undefined
                };

                // Switch reference to new candle
                realTimeCandleRef.current = newCandle;

                // Visual Update (Append)
                if (isHA) {
                    const haData = {
                        time: nextBarTime as Time,
                        open: haOpen,
                        high: Math.max(price, haOpen),
                        low: Math.min(price, haOpen),
                        close: ((base.rawClose || base.close) + price + price + price) / 4
                    };
                    seriesRef.current?.update(haData);
                } else {
                    seriesRef.current?.update(newCandle);
                }
                return;
            }

            // 4. Update Current Candle visual logic (for the current time interval)
            let isDirty = false;

            const rOpen = base.rawOpen ?? base.open;
            const rHigh = Math.max(base.rawHigh ?? base.high, price);
            const rLow = Math.min(base.rawLow ?? base.low, price);
            const rClose = price;

            if (rHigh !== base.rawHigh) { base.rawHigh = rHigh; isDirty = true; }
            if (rLow !== base.rawLow) { base.rawLow = rLow; isDirty = true; }
            if (rClose !== base.rawClose) { base.rawClose = rClose; isDirty = true; }

            if (isDirty || true) { // Always update on price change for smoothness
                if (chartType === 'heikin_ashi') {
                    const haOpen = base.ha_open ?? base.open;
                    const haClose = (rOpen + rHigh + rLow + rClose) / 4;
                    const haData = {
                        time: toSec(base.time) as Time,
                        open: haOpen,
                        high: Math.max(rHigh, haOpen, haClose),
                        low: Math.min(rLow, haOpen, haClose),
                        close: haClose
                    };
                    // Update visual reference for future ticks in SAME interval
                    base.open = haOpen;
                    base.close = haClose;
                    base.high = haData.high;
                    base.low = haData.low;

                    seriesRef.current?.update(haData);
                } else {
                    base.open = rOpen;
                    base.high = rHigh;
                    base.low = rLow;
                    base.close = rClose;
                    seriesRef.current?.update({
                        time: toSec(base.time) as Time,
                        open: base.open,
                        high: base.high,
                        low: base.low,
                        close: base.close
                    });
                }
            }
        };

        const unsub = useMarketStore.subscribe(
            (state) => state.tickers[tickerKey]?.price || state.tickers[normSymbol]?.price,
            (price) => requestAnimationFrame(() => handleTick(Number(price)))
        );

        return () => unsub();
    }, [symbol, source, interval, chartType]);

    return realTimeCandleRef;
}
