import { useCallback, useEffect, useRef, useState } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { useWebSocket } from '@/hooks/use-websocket';
import { toSec } from '@/features/chart/utils/time-utils';
import { formatCandleData } from '@/features/chart/utils/format-candle-data';
import { useSeriesSwitcher } from './use-series-switcher';
import { ChartInstance } from '@/lib/store/types';
import {
    buildIntervalCandidates,
    getNormalizedSymbol,
    parseIntervalSeconds,
    resolveCandles,
    updateSyncData,
} from './use-chart-history.helpers';
import type { Candle } from '@/lib/store/types';
import { bumpChartPerfCounter } from '../testing/chart-perf-counters';
import {
    buildHistoryRequestKey,
    completeHistoryRequest,
    tryStartHistoryRequest,
} from './history-request-gate';
import { loadCachedCandles } from '../cache/candle-history-cache';
import { getIncrementalHistoryCount, INITIAL_HISTORY_COUNT } from './history-sync';
import { buildMt5AuthFields, normalizeMt5AccountScope, resolveChartIdentityDataSource } from '@/lib/mt5/account-scope';
const MIN_CANDLES_THRESHOLD = 150;
const AUTO_FIT_GROWTH_STEP = 24;

interface UseChartHistoryProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    mt5Identity: {
        accountLogin?: string | null;
        terminalId?: string | null;
        broker?: string | null;
    };
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles';
    chartRef: React.RefObject<IChartApi | null>;
    subchartRef: React.RefObject<IChartApi | null>;
    seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
    markerSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
    subSyncRef: React.RefObject<ISeriesApi<'Line'> | null>;
    timescaleSyncRef: React.RefObject<ISeriesApi<'Line'> | null>;
    isReady: boolean;
    theme: string;
    candleUpColor: string;
    candleDownColor: string;
    contextKey?: string;
    isAutoScrollEnabledRef?: React.RefObject<boolean>;
    onHistoryLoaded: (lastCandle: Candle) => void;
}

export function useChartHistory(props: UseChartHistoryProps) {
    const { chartId, symbol, interval, source, mt5Identity, chartType, chartRef, seriesRef, markerSeriesRef, subSyncRef, timescaleSyncRef, isReady, theme, candleUpColor, candleDownColor, contextKey, isAutoScrollEnabledRef, onHistoryLoaded } = props;
    const isInitialMount = useRef(true);
    const lastDataLength = useRef(0);
    const lastKeyRef = useRef('');
    const lastChartTypeRef = useRef<string>(chartType);
    const chartStateRef = useRef<'idle' | 'loading' | 'ready'>('idle');
    const lastFetchRequestTimeRef = useRef(0);
    const applyDataRafRef = useRef<number | null>(null);
    const autoFitProgressRef = useRef<{ key: string; count: number } | null>(null);
    const clearedForKeyRef = useRef<string | null>(null);
    const lastHistoryRevisionRef = useRef(-1);
    const [hydratedCacheKey, setHydratedCacheKey] = useState('');
    // BUG #3 fix: generation counter to reject stale RAF callbacks on rapid symbol/timeframe switching.
    // Each context change bumps the generation; RAF callbacks that don't match are discarded.
    const applyDataGenerationRef = useRef(0);

    const { sendMessage } = useWebSocket();
    const isConnected = useMarketStore(state => state.isConnected);
    const dataSource = resolveChartIdentityDataSource(source, mt5Identity);
    const isVietnamGoldSource = String(source || '').toUpperCase() === 'VN_GOLD';
    const normSymbol = getNormalizedSymbol(symbol);
    const intervalCandidates = buildIntervalCandidates(interval);
    const historyRequestKey = buildHistoryRequestKey(dataSource, normSymbol, interval);
    const isCacheReady = hydratedCacheKey === historyRequestKey;

    const key = useMarketStore((state) => resolveCandles(state, dataSource, normSymbol, intervalCandidates).key);
    const candlesCount = useMarketStore((state) => resolveCandles(state, dataSource, normSymbol, intervalCandidates).candles.length);
    const historyRevision = useMarketStore((state) => state.candleHistoryRevision[key] || 0);
    const scopedContextKey = `${dataSource}|${key}`;

    const getCandles = () => resolveCandles(useMarketStore.getState(), dataSource, normSymbol, intervalCandidates).candles;
    const { handleSwitch } = useSeriesSwitcher({ chartRef, seriesRef, chartType, candleUpColor, candleDownColor });
    const requestHistory = useCallback(() => {
        if (!symbol || !interval || !isCacheReady) return;
        const sourceText = String(source || '').toUpperCase();
        const resolved = resolveCandles(
            useMarketStore.getState(),
            dataSource,
            normSymbol,
            intervalCandidates,
        );
        const cachedCandles = resolved.candles;
        const nowSec = Math.floor(Date.now() / 1000);
        const secondsPerBar = Math.max(60, parseIntervalSeconds(interval));

        let requestCount = INITIAL_HISTORY_COUNT;
        if (sourceText !== 'VN_GOLD' && cachedCandles.length >= MIN_CANDLES_THRESHOLD) {
            const lastTime = Number(cachedCandles[cachedCandles.length - 1]?.time);
            requestCount = getIncrementalHistoryCount(lastTime, nowSec, secondsPerBar);
            if (requestCount === 0) {
                completeHistoryRequest(historyRequestKey);
                return;
            }
        }

        if (sourceText !== 'VN_GOLD' && !tryStartHistoryRequest(historyRequestKey)) return;

        if (sourceText === 'BINANCE') {
            sendMessage({
                topic: "get_binance_candles",
                symbol,
                interval,
                fromTimestamp: Math.max(1, nowSec - secondsPerBar * requestCount),
                toTimestamp: nowSec,
            });
            return;
        }

        if (sourceText === 'VN_GOLD') {
            sendMessage({
                topic: "get_vn_gold_candles",
                symbol,
                interval,
                count: INITIAL_HISTORY_COUNT,
            });
            return;
        }

        const mt5Scope = normalizeMt5AccountScope({
            source: sourceText === 'MT5_PERSONAL' ? 'MT5_PERSONAL' : 'MT5',
            accountLogin: mt5Identity.accountLogin,
            terminalId: mt5Identity.terminalId,
            broker: mt5Identity.broker,
        });
        const authFields = buildMt5AuthFields(mt5Scope);
        sendMessage({
            topic: "mt5_command",
            command: "get_candles",
            symbol,
            interval,
            count: requestCount,
            ...authFields,
        });
        sendMessage({
            topic: "mt5_command",
            command: "get_symbol_info",
            symbol,
            ...authFields,
        });
    }, [
        symbol,
        interval,
        source,
        mt5Identity,
        dataSource,
        normSymbol,
        intervalCandidates,
        historyRequestKey,
        isCacheReady,
        sendMessage,
    ]);

    useEffect(() => {
        if (!source || !normSymbol || !interval) return;

        let cancelled = false;
        const targetKey = historyRequestKey;

        void loadCachedCandles(dataSource, normSymbol, interval).then((cached) => {
            if (cancelled) return;
            if (cached.length > 0) {
                useMarketStore.getState().setCandles(dataSource, normSymbol, interval, cached);
            }
            setHydratedCacheKey(targetKey);
        });

        return () => {
            cancelled = true;
        };
    }, [historyRequestKey, dataSource, source, normSymbol, interval]);

    useEffect(() => {
        if (isVietnamGoldSource) return;
        if (historyRevision > 0) completeHistoryRequest(historyRequestKey);
    }, [historyRevision, historyRequestKey, isVietnamGoldSource]);

    useEffect(() => {
        if (!isCacheReady || !isReady || !symbol || !interval || !isConnected) return;

        requestHistory();
        const timer = setInterval(requestHistory, isVietnamGoldSource ? 15_000 : 10_000);
        return () => clearInterval(timer);
    }, [
        isCacheReady,
        isReady,
        symbol,
        interval,
        source,
        isConnected,
        requestHistory,
        isVietnamGoldSource,
    ]);

    const getPersistedViewport = (): ChartInstance['viewport'] | undefined => {
        const state = useMarketStore.getState();
        for (const tab of Object.values(state.tabs)) {
            const chart = tab.charts[chartId];
            if (chart) return chart.viewport;
        }
        return undefined;
    };

    const handleAutoFit = () => {
        const candles = getCandles();
        if (candles.length === 0) return;

        requestAnimationFrame(() => {
            try {
                const persistedViewport = getPersistedViewport();
                const persistedRange = persistedViewport?.contextKey === contextKey
                    ? persistedViewport?.logicalRange
                    : undefined;
                if (
                    persistedRange &&
                    Number.isFinite(persistedRange.from) &&
                    Number.isFinite(persistedRange.to) &&
                    persistedRange.to > persistedRange.from
                ) {
                    chartRef.current?.timeScale().setVisibleLogicalRange({
                        from: persistedRange.from,
                        to: persistedRange.to
                    });
                } else {
                // Ensure the chart is following the END of the data, but also scroll
                // to realtime so the chart shows the ACTUAL current bar — not just the
                // last candle in the pre-loaded history batch.
                // Without scrollToRealTime(), if there's a gap between the last historical
                // candle and the current realtime bar (e.g. market moved several bars since
                // history loaded), the chart is stuck showing the old last historical candle
                // until the ticker fires. scrollToRealTime() positions the right edge at the
                // current server time, so the realtime bar fills in naturally when it arrives.
                    chartRef.current?.timeScale().setVisibleLogicalRange({
                        from: candles.length - (window.innerWidth < 768 ? 40 : 80),
                        to: candles.length + 5
                    });
                    chartRef.current?.timeScale().scrollToRealTime();
                }

                chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
            } catch {
                // Ignore transient errors during init
            }
        });
        isInitialMount.current = false;
    };

    useEffect(() => {
        if (!isCacheReady || !isReady || !symbol || !interval || !seriesRef.current) return;

        const currentCandles = getCandles();
        debugLog('[ChartHistory][candles]', {
            symbol,
            interval,
            source: dataSource,
            intervalCandidates,
            count: currentCandles.length,
        });
        const isContextChange = scopedContextKey !== lastKeyRef.current;

        if (isCacheReady && (isVietnamGoldSource || currentCandles.length < MIN_CANDLES_THRESHOLD) && isConnected) {
            const now = Date.now();
            if (now - lastFetchRequestTimeRef.current > 2000) {
                lastFetchRequestTimeRef.current = now;
                requestHistory();
            }
        }

        if (isContextChange) {
            // Invalidate the previous context BEFORE any early return. The old code
            // returned first when the destination had no cached candles, leaving the
            // previous key/generation active long enough for a stale RAF to repaint
            // symbol A after the UI had already switched to symbol B.
            if (applyDataRafRef.current !== null) {
                cancelAnimationFrame(applyDataRafRef.current);
                applyDataRafRef.current = null;
            }
            applyDataGenerationRef.current++;
            chartStateRef.current = 'loading';
            lastKeyRef.current = scopedContextKey;
            isInitialMount.current = true;
            lastDataLength.current = 0;
            autoFitProgressRef.current = null;
            clearedForKeyRef.current = null;
            lastHistoryRevisionRef.current = -1;
            if (isAutoScrollEnabledRef) isAutoScrollEnabledRef.current = true;
        }

        if (isContextChange && currentCandles.length === 0) {
            if (clearedForKeyRef.current !== scopedContextKey) {
                clearedForKeyRef.current = scopedContextKey;
                try {
                    bumpChartPerfCounter('historySetDataBatches');
                    seriesRef.current?.setData([]);
                    markerSeriesRef.current?.setData([]);
                    updateSyncData([], subSyncRef, timescaleSyncRef);
                    chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                } catch {
                    // Ignore transient teardown races while the chart is rebuilding.
                }
            }
            return;
        }

        const isTypeChange = chartType !== lastChartTypeRef.current;
        const hasStructuralHistoryChange = historyRevision !== lastHistoryRevisionRef.current;
        if (isContextChange || isTypeChange || hasStructuralHistoryChange) {
            if (applyDataRafRef.current !== null) {
                cancelAnimationFrame(applyDataRafRef.current);
                applyDataRafRef.current = null;
            }

            const nextKey = scopedContextKey;
            const nextCandles = currentCandles;
            const previousChartType = lastChartTypeRef.current;
            const nextChartType = chartType;
            const nextTheme = theme;
            // BUG #5 fix: Snapshot isInitialMount BEFORE the RAF so we capture the value
            // at schedule-time. If another context change fires between schedule and execution,
            // the flag may be reset to `true` for the new context, making us incorrectly
            // autofit for a stale (already-discarded) context.
            const wasInitialMount = isInitialMount.current;
            // BUG #3 fix: Snapshot generation at schedule-time. If a context switch fires
            // before this RAF executes, the generation is bumped and this callback self-discards.
            const myGeneration = applyDataGenerationRef.current;

            applyDataRafRef.current = requestAnimationFrame(() => {
                applyDataRafRef.current = null;

                // BUG #3 fix: Dual guard — key check AND generation check.
                // Generation is strictly monotonic per context switch, immune to key
                // collisions (e.g. same symbol different source/interval normalize edge cases).
                if (lastKeyRef.current !== nextKey || applyDataGenerationRef.current !== myGeneration) {
                    return;
                }

                handleSwitch(isContextChange, previousChartType);
                lastChartTypeRef.current = nextChartType;

                const formatted = formatCandleData(nextCandles, nextChartType, nextTheme, {
                    up: candleUpColor,
                    down: candleDownColor,
                });

                if (seriesRef.current) {
                    bumpChartPerfCounter('historySetDataBatches');
                    seriesRef.current.setData(formatted);
                    markerSeriesRef.current?.setData(formatted);
                    const first = formatted[0];
                    const last = formatted[formatted.length - 1];
                    const firstPrice = first ? `${first.open}/${first.high}/${first.low}/${first.close}` : '-';
                    const lastPrice = last ? `${last.open}/${last.high}/${last.low}/${last.close}` : '-';
                    debugLog('[ChartHistory][setData]', {
                        len: formatted.length,
                        firstTime: first?.time,
                        lastTime: last?.time,
                        firstPrice,
                        lastPrice,
                        seriesType: 'Candlestick',
                    });
                }

                if (formatted.length > 0) {
                    clearedForKeyRef.current = null;
                    onHistoryLoaded(nextCandles[nextCandles.length - 1]);
                    updateSyncData(formatted, subSyncRef, timescaleSyncRef);

                    const autoFitState = autoFitProgressRef.current;
                    // BUG #5 fix: Use snapshotted wasInitialMount (schedule-time value),
                    // not the live isInitialMount.current (which may have been reset by a
                    // subsequent context change before this RAF ran).
                    const shouldAutoFitOnContextEntry = isContextChange || wasInitialMount || autoFitState?.key !== nextKey;
                    const shouldAutoFitWhileLoading =
                        chartStateRef.current !== 'ready' &&
                        (!autoFitState || nextCandles.length - autoFitState.count >= AUTO_FIT_GROWTH_STEP);

                    if (shouldAutoFitOnContextEntry || shouldAutoFitWhileLoading) {
                        handleAutoFit();
                        autoFitProgressRef.current = { key: nextKey, count: nextCandles.length };
                    }

                    if (formatted.length >= MIN_CANDLES_THRESHOLD) {
                        chartStateRef.current = 'ready';
                    }
                }

                lastDataLength.current = nextCandles.length;
                lastHistoryRevisionRef.current = historyRevision;
            });
        }
    }, [isReady, candlesCount, historyRevision, key, scopedContextKey, dataSource, chartType, isConnected, candleUpColor, candleDownColor, isVietnamGoldSource, isCacheReady]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        return () => {
            if (applyDataRafRef.current !== null) {
                cancelAnimationFrame(applyDataRafRef.current);
                applyDataRafRef.current = null;
            }
        };
    }, []);

    return {
        candles: getCandles(),
        latestHHPrice: undefined,
        latestLLPrice: undefined,
    };
}
export { toSec };
