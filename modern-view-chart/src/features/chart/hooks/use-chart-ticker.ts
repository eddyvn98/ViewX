import { useRef, useEffect, useCallback } from 'react';
import { ISeriesApi, Time, IChartApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { toSec } from './use-chart-history';
import { normalizeSymbol } from '@/lib/utils/symbol';
import type { Candle } from '@/lib/store/types';

type RealtimeCandle = Candle & {
    rawOpen?: number;
    rawHigh?: number;
    rawLow?: number;
    rawClose?: number;
    ha_open?: number;
    candleColor?: string;
};

interface UseChartTickerProps {
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles';
    lastCandleRef: React.MutableRefObject<Candle | null>;
    isAutoScrollEnabledRef?: React.RefObject<boolean>;
    chartRef?: React.RefObject<IChartApi | null>;
    theme?: string;
    contextKey?: string;
    candleUpColor: string;
    candleDownColor: string;
}

export function useChartTicker({
    symbol, interval, source, seriesRef, chartType, lastCandleRef, isAutoScrollEnabledRef, chartRef, contextKey, candleUpColor, candleDownColor,
}: UseChartTickerProps) {

    const realTimeCandleRef = useRef<RealtimeCandle | null>(null);
    const lastBackfillRequestAtRef = useRef<Record<string, number>>({});
    const activeContextKeyRef = useRef(contextKey);

    // BUG #4 fix: Keep always-current refs for interval and source so the tick handler
    // (which lives inside a long-lived subscription closure) never reads stale values
    // when the user switches symbol or timeframe faster than React can re-run the effect.
    const intervalRef = useRef(interval);
    const sourceRef = useRef(source);

    const normSymbol = normalizeSymbol(symbol);
    const tickerKey = `${source}:${normSymbol}`;

    const getStoreCandles = useCallback(() => {
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
    }, [source, normSymbol, interval]);

    const getIntervalSeconds = (intv: string) => {
        const raw = String(intv || '').trim();
        if (!raw) return 60;
        if (/^\d+$/.test(raw)) return Number(raw) * 60;

        const m = raw.match(/^(\d+)?\s*([mhdw])$/i);
        if (!m) return 60;

        const unit = m[2].toLowerCase();
        const value = m[1] ? Number(m[1]) : 1;
        if (!Number.isFinite(value) || value <= 0) return 60;

        if (unit === 'm') return value * 60;
        if (unit === 'h') return value * 3600;
        if (unit === 'd') return value * 86400;
        if (unit === 'w') return value * 604800;
        return 60;
    };

    const isAtRealtimeEdge = useCallback(() => {
        const chart = chartRef?.current;
        const dataCount = seriesRef.current?.data().length ?? 0;
        if (!chart || dataCount <= 0) return false;
        const range = chart.timeScale().getVisibleLogicalRange();
        if (!range) return false;
        const RIGHT_EDGE_TOLERANCE_BARS = 1.5;
        return range.to >= (dataCount - 1 - RIGHT_EDGE_TOLERANCE_BARS);
    }, [chartRef, seriesRef]);

    // BUG #4 fix: Keep interval/source refs always in sync with latest prop values.
    // These are read inside the subscription closure to avoid stale interval captures.
    // Run on every render (no deps array) so ref is ALWAYS current.
    useEffect(() => {
        intervalRef.current = interval;
        sourceRef.current = source;
    });

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
    }, [lastCandleRef, symbol, interval, source, contextKey]);

    // Ticker Subscription
    useEffect(() => {
        if (!symbol || !source || !seriesRef.current) return;

        const effectContextKey = contextKey;

        let lastStoreSync = 0;
        const lastSeriesUpdateTimeRef = { current: null as number | null };
        const { updateLastCandle } = useMarketStore.getState();

        // Throttled sync to store (for legend accuracy)
        const syncToStore = (candle: RealtimeCandle, force = false) => {
            const now = Date.now();
            if (!force && now - lastStoreSync < 250) return;
            lastStoreSync = now;
            // BUG #4 fix: use sourceRef.current to get the always-current source value
            updateLastCandle(sourceRef.current ?? source!, symbol!, intervalRef.current ?? interval!, {
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

            // BUG #4 fix: Read interval from the always-current ref instead of the
            // closure-captured value. If the user switches timeframe faster than React
            // re-runs this effect, the closure would carry the OLD interval, making
            // intervalSec wrong and nextBarTime incorrect — causing candles to be appended
            // at stale timestamps (the "stretched/wrong candle" visual artifact).
            const currentInterval = intervalRef.current || interval || '1';
            const intervalSec = getIntervalSeconds(currentInterval);
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
                    time: nextBarTime,
                    open: isHA ? haOpen : base.close,
                    high: price, low: price, close: price,
                    rawOpen: base.rawClose || base.close,
                    rawHigh: price, rawLow: price, rawClose: price,
                    ha_open: isHA ? haOpen : undefined,
                };

                realTimeCandleRef.current = newCandle;
                lastSeriesUpdateTimeRef.current = nextBarTime;

                if (isHA) {
                    seriesRef.current?.update({
                        time: nextBarTime as Time,
                        open: haOpen, high: Math.max(price, haOpen),
                        low: Math.min(price, haOpen), close: ((base.rawClose || base.close) + price * 3) / 4,
                    });
                } else {
                    const seriesNewCandle = {
                        time: nextBarTime as Time,
                        open: newCandle.open,
                        high: newCandle.high,
                        low: newCandle.low,
                        close: newCandle.close,
                    };
                    if (isSmart) {
                        seriesRef.current?.update({
                            ...seriesNewCandle,
                            candleColor: seriesNewCandle.close >= seriesNewCandle.open ? candleUpColor : candleDownColor,
                        } as any);
                    } else {
                        seriesRef.current?.update(seriesNewCandle);
                    }
                }

                syncToStore(newCandle, true);
                if (isAutoScrollEnabledRef && chartRef?.current) {
                    const shouldFollowNow = isAutoScrollEnabledRef.current && isAtRealtimeEdge();
                    if (shouldFollowNow) {
                        chartRef.current.timeScale().scrollToRealTime();
                    } else {
                        isAutoScrollEnabledRef.current = false;
                    }
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
                };
                base.open = haOpen; base.close = haClose;
                base.high = haData.high; base.low = haData.low;
                seriesRef.current?.update(haData);

                // Keep base state updated with raw values for syncing/legend,
                // but do NOT call series update again with raw candle data.
                base.open = rOpen; base.high = rHigh; base.low = rLow; base.close = rClose;
            } else {
                base.open = rOpen; base.high = rHigh; base.low = rLow; base.close = rClose;

                const updateData: RealtimeCandle = {
                    time: updateTime,
                    open: base.open, high: base.high, low: base.low, close: base.close,
                };

                if (isSmart) {
                    seriesRef.current?.update({
                        time: updateTime as Time,
                        open: updateData.open,
                        high: updateData.high,
                        low: updateData.low,
                        close: updateData.close,
                        candleColor: updateData.close >= updateData.open ? candleUpColor : candleDownColor,
                    } as any);
                } else {
                    seriesRef.current?.update({
                        time: updateTime as Time,
                        open: updateData.open,
                        high: updateData.high,
                        low: updateData.low,
                        close: updateData.close,
                    });
                }
            }

            syncToStore(base);
        };

        let tickRafId: number | null = null;
        let pendingTick: { price: number; serverTime?: number } | null = null;

        const unsub = useMarketStore.subscribe(
            (state) => state.tickers[tickerKey] || state.tickers[normSymbol],
            (ticker) => {
                if (!ticker) return;

                pendingTick = {
                    price: Number(ticker.price),
                    serverTime: ticker.serverTime,
                };

                // Coalesce bursty ticker updates into one visual update per frame.
                // The latest tick wins, which keeps latency low without queueing RAF callbacks.
                if (tickRafId !== null) return;
                const scheduledContextKey = effectContextKey;
                tickRafId = requestAnimationFrame(() => {
                    tickRafId = null;
                    const nextTick = pendingTick;
                    pendingTick = null;
                    if (!nextTick) return;
                    if (activeContextKeyRef.current !== scheduledContextKey) return;
                    handleTick(nextTick.price, nextTick.serverTime);
                });
            }
        );

        return () => {
            unsub();
            pendingTick = null;
            if (tickRafId !== null) cancelAnimationFrame(tickRafId);
        };
    }, [symbol, source, interval, chartType, contextKey, tickerKey, normSymbol, chartRef, isAutoScrollEnabledRef, lastCandleRef, getStoreCandles, seriesRef, candleUpColor, candleDownColor, isAtRealtimeEdge]);

    return realTimeCandleRef;
}
