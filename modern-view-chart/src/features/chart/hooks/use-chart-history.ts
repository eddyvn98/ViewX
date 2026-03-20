import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const INITIAL_RENDER_CANDLES = 160;
const FULL_BACKFILL_CANDLES = 300;
const SCROLL_BACKFILL_STEP = 300;
const LEFT_EDGE_TRIGGER_BARS = 25;
const MAX_SCROLL_BACKFILL_CANDLES = 6000;

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
    const applyDataRafRef = useRef<number | null>(null);
    const stagedFullRenderRafRef = useRef<number | null>(null);
    const stagedFullRenderTokenRef = useRef(0);
    const autoFitProgressRef = useRef<{ key: string; count: number } | null>(null);
    const clearedForKeyRef = useRef<string | null>(null);
    const requestedHistoryCountRef = useRef(FULL_BACKFILL_CANDLES);
    const pendingScrollBackfillRef = useRef(false);
    const backfillLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastVisibleRangeRef = useRef<{ from: number; to: number } | null>(null);
    const initialHistoryRequestedKeyRef = useRef<string | null>(null);
    const emptyHistoryRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const emptyHistoryRetryCountRef = useRef(0);
    const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);

    const { sendMessage } = useWebSocket();
    const isConnected = useMarketStore(state => state.isConnected);
    const normSymbol = getNormalizedSymbol(symbol);
    const intervalCandidates = useMemo(() => buildIntervalCandidates(interval), [interval]);

    const key = useMarketStore((state) => resolveCandles(state, source, normSymbol, intervalCandidates).key);
    const candlesCount = useMarketStore((state) => resolveCandles(state, source, normSymbol, intervalCandidates).candles.length);

    const getCandles = useCallback(
        () => resolveCandles(useMarketStore.getState(), source, normSymbol, intervalCandidates).candles,
        [source, normSymbol, intervalCandidates]
    );
    const { handleSwitch } = useSeriesSwitcher({ chartRef, seriesRef, chartType });
    const requestHistory = useCallback((count = FULL_BACKFILL_CANDLES, reason?: string) => {
        if (!symbol || !interval) return;
        const sourceText = String(source || '').toUpperCase();
        if (sourceText === 'BINANCE') {
            const nowSec = Math.floor(Date.now() / 1000);
            const secondsPerBar = parseIntervalSeconds(interval);
            sendMessage({
                topic: "get_binance_candles",
                symbol,
                interval,
                count: Math.max(60, count),
                fromTimestamp: nowSec - secondsPerBar * Math.max(60, count),
                toTimestamp: nowSec,
                reason,
            });
            return;
        }

        sendMessage({ topic: "mt5_command", command: "get_candles", symbol, interval, count: Math.max(60, count), reason });
        sendMessage({ topic: "mt5_command", command: "get_symbol_info", symbol });
    }, [symbol, interval, source, sendMessage]);

    useEffect(() => {
        if (!isReady || !symbol || !interval || !isConnected || !key) return;
        if (initialHistoryRequestedKeyRef.current === key) return;

        initialHistoryRequestedKeyRef.current = key;
        requestHistory(FULL_BACKFILL_CANDLES, 'chart_first_paint');
    }, [interval, isConnected, isReady, key, requestHistory, symbol]);

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
            requestedHistoryCountRef.current = FULL_BACKFILL_CANDLES;
            pendingScrollBackfillRef.current = false;
            lastVisibleRangeRef.current = null;
            emptyHistoryRetryCountRef.current = 0;
            requestAnimationFrame(() => setIsLoadingOlderHistory(false));
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
                const previousLength = lastDataLength.current;
                stagedFullRenderTokenRef.current += 1;
                const stagedToken = stagedFullRenderTokenRef.current;
                if (stagedFullRenderRafRef.current !== null) {
                    cancelAnimationFrame(stagedFullRenderRafRef.current);
                    stagedFullRenderRafRef.current = null;
                }

                if (lastKeyRef.current !== nextKey) {
                    return;
                }

                handleSwitch(isContextChange, previousChartType);
                lastChartTypeRef.current = nextChartType;

                const formatted = formatCandleData(nextCandles, nextChartType, nextTheme);
                const shouldStageFirstPaint = isContextChange && formatted.length > INITIAL_RENDER_CANDLES;
                const firstPaintData = shouldStageFirstPaint
                    ? formatted.slice(-INITIAL_RENDER_CANDLES)
                    : formatted;

                if (seriesRef.current) {
                    seriesRef.current.setData(firstPaintData);
                    markerSeriesRef.current?.setData(firstPaintData);
                    const first = firstPaintData[0];
                    const last = firstPaintData[firstPaintData.length - 1];
                    const firstPrice = first ? `${first.open}/${first.high}/${first.low}/${first.close}` : '-';
                    const lastPrice = last ? `${last.open}/${last.high}/${last.low}/${last.close}` : '-';
                    debugLog('[ChartHistory][setData]', {
                        len: firstPaintData.length,
                        staged: shouldStageFirstPaint,
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
                    updateSyncData(firstPaintData, subSyncRef, timescaleSyncRef);

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

                if (shouldStageFirstPaint) {
                    stagedFullRenderRafRef.current = requestAnimationFrame(() => {
                        stagedFullRenderRafRef.current = null;
                        if (stagedToken !== stagedFullRenderTokenRef.current) return;
                        if (lastKeyRef.current !== nextKey) return;
                        if (!seriesRef.current) return;

                        seriesRef.current.setData(formatted);
                        markerSeriesRef.current?.setData(formatted);
                        updateSyncData(formatted, subSyncRef, timescaleSyncRef);
                    });
                }

                lastDataLength.current = nextCandles.length;
                if (pendingScrollBackfillRef.current && nextCandles.length > previousLength) {
                    pendingScrollBackfillRef.current = false;
                    setIsLoadingOlderHistory(false);
                    if (backfillLoadingTimerRef.current) {
                        clearTimeout(backfillLoadingTimerRef.current);
                        backfillLoadingTimerRef.current = null;
                    }
                }
            });
        }
    }, [isReady, candlesCount, key, chartType]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (emptyHistoryRetryTimerRef.current) {
            clearTimeout(emptyHistoryRetryTimerRef.current);
            emptyHistoryRetryTimerRef.current = null;
        }

        if (!isReady || !symbol || !interval || !isConnected || !key) return;

        const currentCandles = getCandles();
        if (currentCandles.length > 0) {
            emptyHistoryRetryCountRef.current = 0;
            return;
        }

        if (emptyHistoryRetryCountRef.current >= 3) return;

        emptyHistoryRetryTimerRef.current = setTimeout(() => {
            emptyHistoryRetryTimerRef.current = null;
            emptyHistoryRetryCountRef.current += 1;
            requestHistory(requestedHistoryCountRef.current, 'chart_empty_retry');
        }, 1500);

        return () => {
            if (emptyHistoryRetryTimerRef.current) {
                clearTimeout(emptyHistoryRetryTimerRef.current);
                emptyHistoryRetryTimerRef.current = null;
            }
        };
    }, [getCandles, interval, isConnected, isReady, key, requestHistory, symbol]);

    useEffect(() => {
        if (!isReady || !symbol || !interval || !isConnected) return;

        const maybeRequestBackfill = (range: { from: number; to: number } | null) => {
            if (!range || pendingScrollBackfillRef.current) return;
            if (!Number.isFinite(range.from) || !Number.isFinite(range.to)) return;
            const previousRange = lastVisibleRangeRef.current;
            lastVisibleRangeRef.current = { from: range.from, to: range.to };
            if (!previousRange) return;

            const movedLeft = range.from < (previousRange.from - 0.25);
            if (!movedLeft) return;
            if (range.from > LEFT_EDGE_TRIGGER_BARS) return;

            const loaded = getCandles().length;
            const requested = requestedHistoryCountRef.current;
            // Wait for previous request to settle before requesting more.
            if (loaded + 30 < requested) return;

            const nextCount = Math.min(MAX_SCROLL_BACKFILL_CANDLES, requested + SCROLL_BACKFILL_STEP);
            if (nextCount <= requested) return;

            requestedHistoryCountRef.current = nextCount;
            pendingScrollBackfillRef.current = true;
            setIsLoadingOlderHistory(true);
            if (backfillLoadingTimerRef.current) {
                clearTimeout(backfillLoadingTimerRef.current);
            }
            backfillLoadingTimerRef.current = setTimeout(() => {
                pendingScrollBackfillRef.current = false;
                setIsLoadingOlderHistory(false);
                backfillLoadingTimerRef.current = null;
            }, 6000);
            requestHistory(nextCount, 'chart_scroll_backfill');
        };

        let detach: (() => void) | null = null;
        const bindIfReady = () => {
            if (detach) return;
            const chart = chartRef.current;
            if (!chart) return;

            const onVisibleRangeChanged = (range: { from: number; to: number } | null) => {
                maybeRequestBackfill(range);
            };

            chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChanged);

            detach = () => {
                chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChanged);
            };
        };

        bindIfReady();
        const bindTimer = setInterval(bindIfReady, 250);

        return () => {
            clearInterval(bindTimer);
            detach?.();
        };
    }, [chartRef, getCandles, interval, isConnected, isReady, requestHistory, symbol]);

    useEffect(() => {
        return () => {
            if (applyDataRafRef.current !== null) {
                cancelAnimationFrame(applyDataRafRef.current);
                applyDataRafRef.current = null;
            }
            if (stagedFullRenderRafRef.current !== null) {
                cancelAnimationFrame(stagedFullRenderRafRef.current);
                stagedFullRenderRafRef.current = null;
            }
            if (backfillLoadingTimerRef.current) {
                clearTimeout(backfillLoadingTimerRef.current);
                backfillLoadingTimerRef.current = null;
            }
            if (emptyHistoryRetryTimerRef.current) {
                clearTimeout(emptyHistoryRetryTimerRef.current);
                emptyHistoryRetryTimerRef.current = null;
            }
        };
    }, []);

    return {
        candles: getCandles(),
        isLoadingOlderHistory,
        latestHHPrice: undefined,
        latestLLPrice: undefined,
    };
}
export { toSec };
