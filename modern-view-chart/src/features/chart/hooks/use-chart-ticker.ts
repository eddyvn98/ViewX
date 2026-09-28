import { useRef, useEffect, useCallback } from 'react';
import { ISeriesApi, Time, IChartApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { toSec } from './use-chart-history';
import { normalizeSymbol } from '@/lib/utils/symbol';
import type { Candle } from '@/lib/store/types';
import { bumpChartPerfCounter } from '../testing/chart-perf-counters';
import { resolveChartIdentityDataSource } from '@/lib/mt5/account-scope';

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
    mt5Identity: {
        accountLogin?: string | null;
        terminalId?: string | null;
        broker?: string | null;
    };
    seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles';
    isAutoScrollEnabledRef?: React.RefObject<boolean>;
    chartRef?: React.RefObject<IChartApi | null>;
    theme?: string;
    contextKey?: string;
    candleUpColor: string;
    candleDownColor: string;
}

export function useChartTicker({
    symbol, interval, source, mt5Identity, seriesRef, chartType, isAutoScrollEnabledRef, chartRef, contextKey, candleUpColor, candleDownColor,
}: UseChartTickerProps) {

    const realTimeCandleRef = useRef<RealtimeCandle | null>(null);
    const lastBackfillRequestAtRef = useRef<Record<string, number>>({});
    const activeContextKeyRef = useRef(contextKey);

    // BUG #4 fix: Keep always-current refs for interval and source so the tick handler
    // (which lives inside a long-lived subscription closure) never reads stale values
    // when the user switches symbol or timeframe faster than React can re-run the effect.
    const intervalRef = useRef(interval);
    const sourceRef = useRef(source);
    const dataSource = resolveChartIdentityDataSource(source, mt5Identity);

    const normSymbol = normalizeSymbol(symbol);
    const tickerKey = `${dataSource}:${normSymbol}`;

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
        const sourceVariants = Array.from(new Set([dataSource, dataSource.toUpperCase(), dataSource.toLowerCase()]));
        for (const src of sourceVariants) {
            for (const itv of intervalCandidates) {
                const key = `${src}:${normSymbol}:${itv}`;
                const arr = state.candleData[key];
                if (arr && arr.length > 0) return arr;
            }
        }
        return [];
    }, [source, dataSource, normSymbol, interval]);

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
    }, [symbol, interval, source, dataSource, contextKey]);

    // Seed visualized candle strictly from the CURRENT store context.
    // Never copy the shared ref on a context switch: that ref may still belong
    // to the previous symbol during the render/effect transition.
    useEffect(() => {
        const currentCandles = getStoreCandles();
        const currentLast = currentCandles[currentCandles.length - 1];
        realTimeCandleRef.current = currentLast ? { ...currentLast } : null;
    }, [getStoreCandles, symbol, interval, source, contextKey]);

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
            updateLastCandle(dataSource, symbol!, intervalRef.current ?? interval!, {
                time: toSec(candle.time),
                open: candle.rawOpen ?? candle.open,
                high: candle.rawHigh ?? candle.high,
                low: candle.rawLow ?? candle.low,
                close: candle.rawClose ?? candle.close,
            });
        };

        const handleTick = (price: number, serverTimeMs?: number, frameHigh = price, frameLow = price) => {
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
                const backfillKey = `${dataSource}:${normSymbol}:${interval}`;
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
                                accountLogin: mt5Identity.accountLogin,
                                terminalId: mt5Identity.terminalId,
                                broker: mt5Identity.broker,
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
                    high: Math.max(price, frameHigh), low: Math.min(price, frameLow), close: price,
                    rawOpen: base.rawClose || base.close,
                    rawHigh: Math.max(price, frameHigh), rawLow: Math.min(price, frameLow), rawClose: price,
                    ha_open: isHA ? haOpen : undefined,
                };

                realTimeCandleRef.current = newCandle;
                lastSeriesUpdateTimeRef.current = nextBarTime;

                if (isHA) {
                    bumpChartPerfCounter('realtimeSeriesUpdates');
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
                    bumpChartPerfCounter('realtimeSeriesUpdates');
                    if (isSmart) {
                        const smartCandle = {
                            ...seriesNewCandle,
                            candleColor: seriesNewCandle.close >= seriesNewCandle.open ? candleUpColor : candleDownColor,
                        };
                        seriesRef.current?.update(smartCandle);
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
            const rHigh = Math.max(base.rawHigh ?? base.high, frameHigh, price);
            const rLow = Math.min(base.rawLow ?? base.low, frameLow, price);
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
                bumpChartPerfCounter('realtimeSeriesUpdates');
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

                bumpChartPerfCounter('realtimeSeriesUpdates');
                if (isSmart) {
                    const smartUpdate = {
                        time: updateTime as Time,
                        open: updateData.open,
                        high: updateData.high,
                        low: updateData.low,
                        close: updateData.close,
                        candleColor: updateData.close >= updateData.open ? candleUpColor : candleDownColor,
                    };
                    seriesRef.current?.update(smartUpdate);
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
        type TickEnvelope = { price: number; high: number; low: number; serverTime: number };
        const pendingByBar = new Map<number, TickEnvelope>();

        const unsub = useMarketStore.subscribe(
            (state) => state.tickers[tickerKey] || state.tickers[normSymbol],
            (ticker) => {
                if (!ticker) return;
                bumpChartPerfCounter('tickerMessages');

                const price = Number(ticker.price);
                const serverTime = ticker.serverTime ?? Date.now();
                const intervalSec = getIntervalSeconds(intervalRef.current || interval || '1');
                const barKey = Math.floor(serverTime / 1000 / Math.max(1, intervalSec)) * intervalSec;
                const current = pendingByBar.get(barKey);
                pendingByBar.set(barKey, current
                    ? {
                        price,
                        high: Math.max(current.high, price),
                        low: Math.min(current.low, price),
                        serverTime,
                    }
                    : { price, high: price, low: price, serverTime });

                // Coalesce bursty ticker updates into one visual frame while retaining
                // the high/low envelope. If ticks cross a bar boundary inside one frame,
                // process at most one aggregate update per affected bar.
                if (tickRafId !== null) return;
                const scheduledContextKey = effectContextKey;
                tickRafId = requestAnimationFrame(() => {
                    tickRafId = null;
                    bumpChartPerfCounter('tickerFrames');
                    if (activeContextKeyRef.current !== scheduledContextKey) {
                        pendingByBar.clear();
                        return;
                    }

                    const envelopes = Array.from(pendingByBar.entries())
                        .sort((a, b) => a[0] - b[0])
                        .map(([, value]) => value);
                    pendingByBar.clear();
                    envelopes.forEach((nextTick) => {
                        handleTick(nextTick.price, nextTick.serverTime, nextTick.high, nextTick.low);
                    });
                });
            }
        );

        return () => {
            unsub();
            pendingByBar.clear();
            if (tickRafId !== null) cancelAnimationFrame(tickRafId);
        };
    }, [symbol, source, mt5Identity, dataSource, interval, chartType, contextKey, tickerKey, normSymbol, chartRef, isAutoScrollEnabledRef, getStoreCandles, seriesRef, candleUpColor, candleDownColor, isAtRealtimeEdge]);

    return realTimeCandleRef;
}
