import { useRef, useEffect } from 'react';
import { ISeriesApi, Time, IChartApi } from 'lightweight-charts';
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
    chartRef?: React.RefObject<IChartApi | null>;
    theme?: string;
    contextKey?: string;
}

export function useChartTicker({
    symbol, interval, source, seriesRef, chartType, lastCandleRef, isAutoScrollEnabledRef, chartRef, theme, contextKey,
}: UseChartTickerProps) {

    const realTimeCandleRef = useRef<any>(null);
    const lastBackfillRequestAtRef = useRef<Record<string, number>>({});
    const activeContextKeyRef = useRef(contextKey);

    const normSymbol = normalizeSymbol(symbol);
    const tickerKey = `${source}:${normSymbol}`;

    const getStoreCandles = () => {
        if (!source || !normSymbol || !interval) return [];
        const state = useMarketStore.getState();
        const intervalRaw = String(interval).trim();
        const intervalLower = intervalRaw.toLowerCase();
        const intervalCandidates = Array.from(new Set([
            intervalRaw,
            intervalLower,
            intervalLower.replace(/^m(\d+)$/, '$1'),
            /^\d+$/.test(intervalLower) ? `${intervalLower}m` : intervalLower,
            intervalLower.endsWith('m') ? intervalLower.slice(0, -1) : intervalLower,
        ]));
        const sourceVariants = Array.from(new Set([source, source.toUpperCase(), source.toLowerCase()]));
        for (const src of sourceVariants) {
            for (const itv of intervalCandidates) {
                const key = `${src}:${normSymbol}:${itv}`;
                const arr = state.candleData[key];
                if (arr && arr.length > 0) return arr;
            }
        }
        return [];
    };

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
        activeContextKeyRef.current = contextKey;
    }, [contextKey]);

    useEffect(() => {
        realTimeCandleRef.current = null;
    }, [symbol, interval, source, contextKey]);

    // Sync visualized candle with store (base truth)
    useEffect(() => {
        if (lastCandleRef.current) {
            realTimeCandleRef.current = { ...lastCandleRef.current };
        }
    }, [lastCandleRef.current, symbol]);

    // Ticker Subscription
    useEffect(() => {
        if (!symbol || !source || !seriesRef.current) return;

        const effectContextKey = contextKey;

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
            if (activeContextKeyRef.current !== effectContextKey) return;

            // 1. Get Base Candle
            const storeCandles = getStoreCandles();
            const lastStoreCandle = storeCandles.length ? storeCandles[storeCandles.length - 1] : null;

            let base = realTimeCandleRef.current;

            if (lastStoreCandle) {
                const storeTime = toSec(lastStoreCandle.time);
                const baseTime = base ? toSec(base.time) : 0;
                if (!base || storeTime >= baseTime) {
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
            const lagBars = Math.floor((now - lastCandleTime) / Math.max(1, intervalSec));

            const isHA = chartType === 'heikin_ashi';
            const isSmart = chartType === 'smart_candles';

            // TradingView-style guard:
            if (lagBars >= 2) {
                const backfillKey = `${source}:${normSymbol}:${interval}`;
                const nowMs = Date.now();
                const lastRequestedAt = lastBackfillRequestAtRef.current[backfillKey] || 0;
                if (nowMs - lastRequestedAt > 5000) {
                    lastBackfillRequestAtRef.current[backfillKey] = nowMs;
                    window.dispatchEvent(
                        new CustomEvent('chart-backfill-request', {
                            detail: {
                                source,
                                symbol,
                                interval,
                                count: 300,
                                reason: 'gap_detected',
                            },
                        }),
                    );
                }
                return;
            }

            // 3. Client-side New Bar Generation (single-bar step only)
            if (now >= nextBarTime) {
                const haOpen = isHA ? (base.open + base.close) / 2 : base.close;
                const newCandle = {
                    time: nextBarTime as Time,
                    open: isHA ? haOpen : base.close,
                    high: price, low: price, close: price,
                    rawOpen: base.rawClose || base.close,
                    rawHigh: price, rawLow: price, rawClose: price,
                    ha_open: isHA ? haOpen : undefined,
                    theme: theme as any
                };

                realTimeCandleRef.current = newCandle;
                lastSeriesUpdateTimeRef.current = nextBarTime;

                if (isHA) {
                    seriesRef.current?.update({
                        time: nextBarTime as Time,
                        open: haOpen, high: Math.max(price, haOpen),
                        low: Math.min(price, haOpen), close: ((base.rawClose || base.close) + price * 3) / 4,
                        theme: theme as any
                    });
                } else {
                    if (isSmart) {
                        const color = price >= (newCandle.open as number) ? '#00ff88' : '#ff3366';
                        seriesRef.current?.update({
                            ...newCandle,
                            candleColor: color,
                            theme: theme as any
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
                    low: Math.min(rLow, haOpen, haClose), close: haClose,
                    theme: theme as any
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
                    candleColor: color,
                    theme: theme as any
                });
            } else {
                base.open = rOpen; base.high = rHigh; base.low = rLow; base.close = rClose;

                const updateData: any = {
                    time: updateTime as Time,
                    open: base.open, high: base.high, low: base.low, close: base.close,
                    theme: theme as any
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
                const scheduledContextKey = effectContextKey;
                requestAnimationFrame(() => {
                    if (activeContextKeyRef.current !== scheduledContextKey) return;
                    handleTick(Number(ticker.price), ticker.serverTime);
                });
            }
        );

        return () => unsub();
    }, [symbol, source, interval, chartType, theme, contextKey]);

    return realTimeCandleRef;
}
