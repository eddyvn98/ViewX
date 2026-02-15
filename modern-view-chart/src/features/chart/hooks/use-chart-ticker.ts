import { useRef, useEffect } from 'react';
import { ISeriesApi, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { toSec } from './use-chart-history';
import { normalizeSymbol } from '@/lib/utils/symbol';

interface UseChartTickerProps {
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    seriesRef: React.MutableRefObject<ISeriesApi<any> | null>;
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles';
    lastCandleRef: React.MutableRefObject<any>;
    isAutoScrollEnabledRef?: React.RefObject<boolean>;
    chartRef?: React.RefObject<import('lightweight-charts').IChartApi | null>;
}

export function useChartTicker({
    symbol, interval, source, seriesRef, chartType, lastCandleRef, isAutoScrollEnabledRef, chartRef,
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
        const lastSeriesUpdateTimeRef = { current: null as number | null };
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

        const handleTick = (price: number, serverTimeMs?: number) => {
            if (!price) return;

            // 1. Get Base Candle
            const storeKey = `${source}:${normSymbol}:${interval}`;
            const storeCandles = useMarketStore.getState().candleData[storeKey] || [];
            const lastStoreCandle = storeCandles.length ? storeCandles[storeCandles.length - 1] : null;

            let base = realTimeCandleRef.current;

            if (lastStoreCandle) {
                const storeTime = toSec(lastStoreCandle.time);
                const baseTime = base ? toSec(base.time) : 0;
                if (!base || storeTime > baseTime) {
                    base = { ...lastStoreCandle };
                    realTimeCandleRef.current = base;
                }
            }
            if (!base) return;

            const intervalSec = getIntervalSeconds(interval || '1');
            const lastCandleTime = toSec(base.time);
            if (isNaN(lastCandleTime)) return;

            const nextBarTime = lastCandleTime + intervalSec;
            const now = serverTimeMs ? Math.floor(serverTimeMs / 1000) : Math.floor(Date.now() / 1000);

            const isHA = chartType === 'heikin_ashi';
            const isSmart = chartType === 'smart_candles';

            // 3. Client-side New Bar Generation
            if (now >= nextBarTime) {
                const haOpen = isHA ? (base.open + base.close) / 2 : base.close;
                const newCandle = {
                    time: nextBarTime as Time,
                    open: isHA ? haOpen : base.close,
                    high: price, low: price, close: price,
                    rawOpen: base.rawClose || base.close,
                    rawHigh: price, rawLow: price, rawClose: price,
                    ha_open: isHA ? haOpen : undefined
                };

                realTimeCandleRef.current = newCandle;
                lastSeriesUpdateTimeRef.current = nextBarTime;

                if (isHA) {
                    seriesRef.current?.update({
                        time: nextBarTime as Time,
                        open: haOpen, high: Math.max(price, haOpen),
                        low: Math.min(price, haOpen), close: ((base.rawClose || base.close) + price * 3) / 4
                    });
                } else {
                    if (isSmart) {
                        const color = price >= (newCandle.open as number) ? '#00ff88' : '#ff3366';
                        seriesRef.current?.update({
                            ...newCandle,
                            candleColor: color,
                        });
                    } else {
                        seriesRef.current?.update(newCandle);
                    }
                }

                syncToStore(newCandle, true);
                if (isAutoScrollEnabledRef?.current && chartRef?.current) {
                    chartRef.current.timeScale().scrollToRealTime();
                }
                return;
            }

            // 4. Update Current Candle
            const updateTime = lastCandleTime;
            if (lastSeriesUpdateTimeRef.current !== null && updateTime < lastSeriesUpdateTimeRef.current) return;
            lastSeriesUpdateTimeRef.current = updateTime;

            const rOpen = base.rawOpen ?? base.open;
            const rHigh = Math.max(base.rawHigh ?? base.high, price);
            const rLow = Math.min(base.rawLow ?? base.low, price);
            const rClose = price;

            base.rawHigh = rHigh;
            base.rawLow = rLow;
            base.rawClose = rClose;

            if (isHA) {
                const haOpen = base.ha_open ?? base.open;
                const haClose = (rOpen + rHigh + rLow + rClose) / 4;
                const haData = {
                    time: updateTime as Time,
                    open: haOpen, high: Math.max(rHigh, haOpen, haClose),
                    low: Math.min(rLow, haOpen, haClose), close: haClose
                };
                base.open = haOpen; base.close = haClose;
                base.high = haData.high; base.low = haData.low;
                seriesRef.current?.update(haData);
                // Simple Bullish/Bearish Coloring
                const color = rClose >= rOpen ? '#00ff88' : '#ff3366';

                base.open = rOpen; base.high = rHigh; base.low = rLow; base.close = rClose;

                seriesRef.current?.update({
                    time: updateTime as Time,
                    open: rOpen, high: rHigh, low: rLow, close: rClose,
                    candleColor: color
                });
            } else {
                base.open = rOpen; base.high = rHigh; base.low = rLow; base.close = rClose;

                const updateData: any = {
                    time: updateTime as Time,
                    open: base.open, high: base.high, low: base.low, close: base.close
                };

                if (isSmart) {
                    updateData.candleColor = base.close >= base.open ? '#00ff88' : '#ff3366';
                }

                seriesRef.current?.update(updateData);
            }

            syncToStore(base);
        };

        const unsub = useMarketStore.subscribe(
            (state) => state.tickers[tickerKey] || state.tickers[normSymbol],
            (ticker) => {
                if (!ticker) return;
                requestAnimationFrame(() => handleTick(Number(ticker.price), ticker.serverTime));
            }
        );

        return () => unsub();
    }, [symbol, source, interval, chartType]);

    return realTimeCandleRef;
}
