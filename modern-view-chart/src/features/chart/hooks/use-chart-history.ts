import { useCallback, useEffect, useRef } from 'react';
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
const MIN_CANDLES_THRESHOLD = 150;
const AUTO_FIT_GROWTH_STEP = 24;

interface UseChartHistoryProps {
    chartId: string;
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles';
    chartRef: React.RefObject<IChartApi | null>;
    subchartRef: React.RefObject<IChartApi | null>;
    seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
    markerSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
    subSyncRef: React.RefObject<ISeriesApi<'Line'> | null>;
    timescaleSyncRef: React.RefObject<ISeriesApi<'Line'> | null>;
    isReady: boolean;
    theme: string;
    contextKey?: string;
    onHistoryLoaded: (lastCandle: Candle) => void;
}

export function useChartHistory(props: UseChartHistoryProps) {
    const { chartId, symbol, interval, source, chartType, chartRef, seriesRef, markerSeriesRef, subSyncRef, timescaleSyncRef, isReady, theme, contextKey, onHistoryLoaded } = props;
    const isInitialMount = useRef(true);
    const lastDataLength = useRef(0);
    const lastKeyRef = useRef('');
    const lastChartTypeRef = useRef<string>(chartType);
    const chartStateRef = useRef<'idle' | 'loading' | 'ready'>('idle');
    const lastFetchRequestTimeRef = useRef(0);
    const applyDataRafRef = useRef<number | null>(null);
    const autoFitProgressRef = useRef<{ key: string; count: number } | null>(null);
    const clearedForKeyRef = useRef<string | null>(null);
    const leftBackfillRef = useRef<{ key: string; requestedOldestTime: number; requestedAt: number } | null>(null);

    const { sendMessage } = useWebSocket();
    const isConnected = useMarketStore(state => state.isConnected);
    const normSymbol = getNormalizedSymbol(symbol);
    const intervalCandidates = buildIntervalCandidates(interval);

    const key = useMarketStore((state) => resolveCandles(state, source, normSymbol, intervalCandidates).key);
    const candlesCount = useMarketStore((state) => resolveCandles(state, source, normSymbol, intervalCandidates).candles.length);

    const getCandles = () => resolveCandles(useMarketStore.getState(), source, normSymbol, intervalCandidates).candles;
    const { handleSwitch } = useSeriesSwitcher({ chartRef, seriesRef, chartType });
    const requestHistory = useCallback(() => {
        if (!symbol || !interval) return;
        const sourceText = String(source || '').toUpperCase();
        if (sourceText === 'BINANCE') {
            const nowSec = Math.floor(Date.now() / 1000);
            const secondsPerBar = parseIntervalSeconds(interval);
            sendMessage({
                topic: "get_binance_candles",
                symbol,
                interval,
                fromTimestamp: nowSec - secondsPerBar * 300,
                toTimestamp: nowSec,
            });
            return;
        }

        sendMessage({ topic: "mt5_command", command: "get_candles", symbol, interval, count: 300 });
        sendMessage({ topic: "mt5_command", command: "get_symbol_info", symbol });
    }, [symbol, interval, source, sendMessage]);

    useEffect(() => {
        if (!isReady || !symbol || !interval || !isConnected) return;
        if (candlesCount >= MIN_CANDLES_THRESHOLD) return;

        requestHistory();
        const timer = setInterval(requestHistory, 2500);
        return () => clearInterval(timer);
    }, [isReady, symbol, interval, source, isConnected, candlesCount, sendMessage, requestHistory]);

    useEffect(() => {
        if (!isReady || !chartRef.current || !symbol || !interval || !source) return;
        const timeScale = chartRef.current.timeScale();
        const LEFT_EDGE_TRIGGER_BARS = 12;
        const SCROLL_BACKFILL_COOLDOWN_MS = 2500;

        const requestOlderIfNeeded = (range: { from: number; to: number } | null) => {
            if (!range || !Number.isFinite(range.from)) return;
            if (range.from > LEFT_EDGE_TRIGGER_BARS) return;

            const candles = getCandles();
            if (candles.length === 0) return;
            const oldestTime = toSec(candles[0].time);
            if (!Number.isFinite(oldestTime)) return;

            const now = Date.now();
            const state = leftBackfillRef.current;
            if (
                state &&
                state.key === key &&
                state.requestedOldestTime === oldestTime &&
                now - state.requestedAt < SCROLL_BACKFILL_COOLDOWN_MS
            ) {
                return;
            }

            leftBackfillRef.current = {
                key,
                requestedOldestTime: oldestTime,
                requestedAt: now,
            };

            window.dispatchEvent(
                new CustomEvent('chart-backfill-request', {
                    detail: {
                        source,
                        symbol,
                        interval,
                        count: 300,
                        direction: 'older',
                        anchorTimeSec: oldestTime,
                        reason: 'left_edge_scroll',
                    },
                }),
            );
        };

        timeScale.subscribeVisibleLogicalRangeChange(requestOlderIfNeeded);
        return () => {
            timeScale.unsubscribeVisibleLogicalRangeChange(requestOlderIfNeeded);
        };
    }, [isReady, chartRef, symbol, interval, source, key, getCandles]);

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
                // Ensure the chart is following the END of the data
                    chartRef.current?.timeScale().setVisibleLogicalRange({
                        from: candles.length - (window.innerWidth < 768 ? 40 : 80),
                        to: candles.length + 5
                    });
                }

                chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
            } catch {
                // Ignore transient errors during init
            }
        });
        isInitialMount.current = false;
    };

    useEffect(() => {
        if (!isReady || !symbol || !interval || !seriesRef.current) return;

        const currentCandles = getCandles();
        debugLog('[ChartHistory][candles]', {
            symbol,
            interval,
            source,
            intervalCandidates,
            count: currentCandles.length,
        });
        const isContextChange = key !== lastKeyRef.current;

        if (currentCandles.length < MIN_CANDLES_THRESHOLD && isConnected) {
            const now = Date.now();
            if (now - lastFetchRequestTimeRef.current > 2000) {
                lastFetchRequestTimeRef.current = now;
                requestHistory();
            }
        }

        if (isContextChange && currentCandles.length === 0) {
            chartStateRef.current = 'loading';
            if (clearedForKeyRef.current !== key) {
                clearedForKeyRef.current = key;
                try {
                    seriesRef.current?.setData([]);
                    markerSeriesRef.current?.setData([]);
                    updateSyncData([], subSyncRef, timescaleSyncRef);
                } catch {
                    // Ignore transient teardown races while the chart is rebuilding.
                }
            }
            return;
        }

        if (isContextChange) {
            chartStateRef.current = 'loading';
            lastKeyRef.current = key;
            isInitialMount.current = true;
            lastDataLength.current = 0;
            autoFitProgressRef.current = null;
            clearedForKeyRef.current = null;
        }

        const isTypeChange = chartType !== lastChartTypeRef.current;
        if (isContextChange || currentCandles.length !== lastDataLength.current || isTypeChange) {
            if (applyDataRafRef.current !== null) {
                cancelAnimationFrame(applyDataRafRef.current);
                applyDataRafRef.current = null;
            }

            const nextKey = key;
            const nextCandles = currentCandles;
            const previousChartType = lastChartTypeRef.current;
            const nextChartType = chartType;
            const nextTheme = theme;

            applyDataRafRef.current = requestAnimationFrame(() => {
                applyDataRafRef.current = null;

                if (lastKeyRef.current !== nextKey) {
                    return;
                }

                handleSwitch(isContextChange, previousChartType);
                lastChartTypeRef.current = nextChartType;

                const formatted = formatCandleData(nextCandles, nextChartType, nextTheme);

                if (seriesRef.current) {
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
                    const shouldAutoFitOnContextEntry = isContextChange || isInitialMount.current || autoFitState?.key !== nextKey;
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
            });
        }
    }, [isReady, candlesCount, key, chartType, isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

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
