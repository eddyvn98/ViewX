import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, SeriesMarker, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { useWebSocket } from '@/hooks/use-websocket';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { toSec } from '@/features/chart/utils/time-utils';
import { formatCandleData } from '@/features/chart/utils/format-candle-data';
import { useSeriesSwitcher } from './use-series-switcher';
import { calculateDynamicSwingPoints } from '@/features/chart/logic/candle-patterns';
import { ChartInstance } from '@/lib/store/types';

const EMPTY_CANDLES: any[] = [];
const MIN_CANDLES_THRESHOLD = 150;

type CandleLookup = { key: string; candles: any[] };

const parseIntervalSeconds = (interval: string): number => {
    const raw = String(interval || '').trim();
    if (!raw) return 60;
    if (/^\d+$/.test(raw)) return Number(raw) * 60;
    const m = raw.match(/^(\d+)\s*([mhd])$/i);
    if (!m) return 60;
    const value = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'm') return value * 60;
    if (unit === 'h') return value * 3600;
    if (unit === 'd') return value * 86400;
    return 60;
};

const resolveCandles = (
    state: ReturnType<typeof useMarketStore.getState>,
    source: string | undefined,
    normSymbol: string,
    intervalCandidates: string[]
): CandleLookup => {
    if (!source || !normSymbol || intervalCandidates.length === 0) {
        return { key: '', candles: EMPTY_CANDLES };
    }

    const exactSource = source.trim();
    const sourceVariants = Array.from(new Set([exactSource, exactSource.toUpperCase(), exactSource.toLowerCase()]));
    for (const src of sourceVariants) {
        for (const itv of intervalCandidates) {
            const key = `${src}:${normSymbol}:${itv}`;
            const arr = state.candleData[key];
            if (arr && arr.length > 0) {
                return { key, candles: arr };
            }
        }
    }

    const symbolLower = normSymbol.toLowerCase();
    const candidateSet = new Set(intervalCandidates.map((v) => String(v).toLowerCase()));
    for (const [k, arr] of Object.entries(state.candleData)) {
        if (!arr || arr.length === 0) continue;
        const parts = k.split(':');
        if (parts.length !== 3) continue;
        const [src, sym, itv] = parts;
        if (src.toLowerCase() !== exactSource.toLowerCase()) continue;
        if (sym.toLowerCase() !== symbolLower) continue;
        if (!candidateSet.has(itv.toLowerCase())) continue;
        return { key: k, candles: arr };
    }

    return { key: `${exactSource}:${normSymbol}:${intervalCandidates[0]}`, candles: EMPTY_CANDLES };
};

interface UseChartHistoryProps {
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles';
    chartRef: React.RefObject<IChartApi | null>;
    subchartRef: React.RefObject<IChartApi | null>;
    seriesRef: React.MutableRefObject<ISeriesApi<any> | null>;
    markerSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
    subSyncRef: React.RefObject<ISeriesApi<'Line'> | null>;
    timescaleSyncRef: React.RefObject<ISeriesApi<'Line'> | null>;
    isReady: boolean;
    theme: string;
    viewport?: ChartInstance['viewport'];
    onHistoryLoaded: (lastCandle: any) => void;
}

export function useChartHistory(props: UseChartHistoryProps) {
    const { symbol, interval, source, chartType, chartRef, subchartRef, seriesRef, markerSeriesRef, subSyncRef, timescaleSyncRef, isReady, theme, viewport, onHistoryLoaded } = props;
    const isInitialMount = useRef(true);
    const lastDataLength = useRef(0);
    const lastKeyRef = useRef('');
    const lastChartTypeRef = useRef<string>(chartType);
    const chartStateRef = useRef<'idle' | 'loading' | 'ready'>('idle');
    const lastFetchRequestTimeRef = useRef(0);
    const latestHHRef = useRef<number | undefined>(undefined);
    const latestLLRef = useRef<number | undefined>(undefined);

    const { sendMessage } = useWebSocket();
    const isConnected = useMarketStore(state => state.isConnected);
    const normSymbol = normalizeSymbol(symbol);
    const intervalCandidates = (() => {
        const raw = String(interval || '').trim();
        if (!raw) return [] as string[];
        const out = new Set<string>([raw]);

        const lower = raw.toLowerCase();
        const m = lower.match(/^(\d+)m$/);
        if (m) out.add(m[1]);
        if (/^\d+$/.test(lower)) out.add(`${lower}m`);

        const mt5 = lower.match(/^m(\d+)$/);
        if (mt5) {
            out.add(mt5[1]);
            out.add(`${mt5[1]}m`);
        }
        return Array.from(out);
    })();

    const key = useMarketStore((state) => resolveCandles(state, source, normSymbol, intervalCandidates).key);
    const candlesCount = useMarketStore((state) => resolveCandles(state, source, normSymbol, intervalCandidates).candles.length);

    const getCandles = () => resolveCandles(useMarketStore.getState(), source, normSymbol, intervalCandidates).candles;
    const { handleSwitch } = useSeriesSwitcher({ chartRef, seriesRef, chartType });
    const requestHistory = () => {
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
    };

    useEffect(() => {
        if (!isReady || !symbol || !interval || !isConnected) return;
        if (candlesCount >= MIN_CANDLES_THRESHOLD) return;

        requestHistory();
        const timer = setInterval(requestHistory, 2500);
        return () => clearInterval(timer);
    }, [isReady, symbol, interval, source, isConnected, candlesCount, sendMessage]);

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

        if (isContextChange) {
            chartStateRef.current = 'loading';
            seriesRef.current.setData([]);
            markerSeriesRef.current?.setData([]);
            subSyncRef.current?.setData([]);
            timescaleSyncRef.current?.setData([]);
            lastKeyRef.current = key;
            isInitialMount.current = true;
            lastDataLength.current = 0;
        }

        if (currentCandles.length < MIN_CANDLES_THRESHOLD && isConnected) {
            const now = Date.now();
            if (now - lastFetchRequestTimeRef.current > 2000) {
                lastFetchRequestTimeRef.current = now;
                requestHistory();
            }
        }

        const isTypeChange = chartType !== lastChartTypeRef.current;
        if (isContextChange || currentCandles.length !== lastDataLength.current || isTypeChange) {
            handleSwitch(isContextChange, lastChartTypeRef.current);
            lastChartTypeRef.current = chartType;

            const formatted = formatCandleData(currentCandles, chartType, theme);

            // Fix: Re-check seriesRef.current after potential switch
            if (seriesRef.current) {
                seriesRef.current.setData(formatted);
                markerSeriesRef.current?.setData(formatted); // Sync timeline for markers
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
                    seriesType: (seriesRef.current as any)?.seriesType?.(),
                });
            }

            if (formatted.length > 0) {
                onHistoryLoaded(currentCandles[currentCandles.length - 1]);
                updateSyncData(formatted, subSyncRef, timescaleSyncRef);

                // Ensure first paint is focused on available bars after symbol/timeframe switch.
                if (isContextChange || isInitialMount.current) {
                    handleAutoFit();
                }

                // Only mark as ready once we have enough data to fit properly
                // OR if it's been loading for a while and we only have a few bars (new symbol)
                if (formatted.length >= MIN_CANDLES_THRESHOLD) {
                    chartStateRef.current = 'ready';
                } else {
                    // Call autofit again as more data flows in during the "loading" stage
                    handleAutoFit();
                }
            }
            lastDataLength.current = currentCandles.length;
        }
    }, [isReady, candlesCount, key, chartType, isConnected]);

    const updateSyncData = (formatted: any[], subRef: any, timeRef: any) => {
        const lastT = Number(formatted[formatted.length - 1].time);
        const timeStep = formatted.length > 1 ? lastT - Number(formatted[formatted.length - 2].time) : 60;
        const syncData = formatted.map(c => ({ time: c.time, value: 0 }))
            .concat(Array.from({ length: 50 }, (_, i) => ({ time: (lastT + timeStep * (i + 1)) as Time, value: 0 })));
        subRef.current?.setData(syncData);
        timeRef.current?.setData(syncData);
    };

    const handleAutoFit = () => {
        const candles = getCandles();
        if (candles.length === 0) return;

        requestAnimationFrame(() => {
            try {
                const persistedRange = viewport?.logicalRange;
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
            } catch (e) {
                // Ignore transient errors during init
            }
        });
        isInitialMount.current = false;
    };

    const currentCandles = getCandles();

    return {
        candles: currentCandles,
        latestHHPrice: latestHHRef.current,
        latestLLPrice: latestLLRef.current
    };
}
export { toSec };
