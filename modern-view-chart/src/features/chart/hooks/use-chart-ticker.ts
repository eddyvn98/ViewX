import { useRef, useEffect } from 'react';
import { ISeriesApi, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { toSec } from './use-chart-history';
import { normalizeSymbol } from '@/lib/utils/symbol';

interface UseChartTickerProps {
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
    chartType: 'candles' | 'heikin_ashi';
    lastCandleRef: React.MutableRefObject<any>;
}

export function useChartTicker({
    symbol, interval, source, seriesRef, chartType, lastCandleRef
}: UseChartTickerProps) {

    const realTimeCandleRef = useRef<any>(null);

    const normSymbol = normalizeSymbol(symbol);
    const tickerKey = `${source}:${normSymbol}`;

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

    // Sync visualized candle with store (base truth)
    useEffect(() => {
        if (lastCandleRef.current) {
            realTimeCandleRef.current = { ...lastCandleRef.current };
        }
    }, [lastCandleRef.current, symbol]);

    // Ticker Subscription
    useEffect(() => {
        if (!symbol || !source || !seriesRef.current) return;

        let lastStoreSync = 0;
        const { updateLastCandle } = useMarketStore.getState();

        // Throttled sync to store (for legend accuracy)
        const syncToStore = (candle: any, force = false) => {
            const now = Date.now();
            if (!force && now - lastStoreSync < 250) return;
            lastStoreSync = now;
            updateLastCandle(source!, symbol!, interval!, {
                time: toSec(candle.time),
                open: candle.rawOpen ?? candle.open,
                high: candle.rawHigh ?? candle.high,
                low: candle.rawLow ?? candle.low,
                close: candle.rawClose ?? candle.close,
            });
        };

        const handleTick = (price: number) => {
            if (!price) return;

            // 1. Get Base Candle (with store fallback)
            let base = realTimeCandleRef.current;

            if (!base) {
                const storeKey = `${source}:${normSymbol}:${interval}`;
                const storeCandles = useMarketStore.getState().candleData[storeKey];
                if (storeCandles?.length) {
                    base = { ...storeCandles[storeCandles.length - 1] };
                    realTimeCandleRef.current = base;
                } else {
                    return;
                }
            }

            // 2. Determine Current Time (Server Aligned)
            const intervalSec = getIntervalSeconds(interval || '1');
            const lastCandleTime = toSec(base.time);
            const nextBarTime = lastCandleTime + intervalSec;

            // 3. Client-side New Bar Generation
            const now = Math.floor(Date.now() / 1000);

            if (now >= nextBarTime) {
                const isHA = chartType === 'heikin_ashi';
                const haOpen = isHA ? (base.open + base.close) / 2 : base.close;

                const newCandle = {
                    time: nextBarTime as Time,
                    open: isHA ? haOpen : base.close,
                    high: price,
                    low: price,
                    close: price,
                    rawOpen: base.rawClose || base.close,
                    rawHigh: price,
                    rawLow: price,
                    rawClose: price,
                    ha_open: isHA ? haOpen : undefined
                };

                realTimeCandleRef.current = newCandle;

                // Visual Update
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

                // ⚡ Sync phantom candle to store (force = new candle)
                syncToStore(newCandle, true);
                return;
            }

            // 4. Update Current Candle
            const rOpen = base.rawOpen ?? base.open;
            const rHigh = Math.max(base.rawHigh ?? base.high, price);
            const rLow = Math.min(base.rawLow ?? base.low, price);
            const rClose = price;

            if (rHigh !== base.rawHigh) { base.rawHigh = rHigh; }
            if (rLow !== base.rawLow) { base.rawLow = rLow; }
            base.rawClose = rClose;

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

            // ⚡ Throttled sync to store (for legend accuracy)
            syncToStore(base);
        };

        const unsub = useMarketStore.subscribe(
            (state) => state.tickers[tickerKey]?.price || state.tickers[normSymbol]?.price,
            (price) => requestAnimationFrame(() => handleTick(Number(price)))
        );

        return () => unsub();
    }, [symbol, source, interval, chartType]);

    return realTimeCandleRef;
}
