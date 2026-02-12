import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { calculateHeikinAshi } from '../utils/indicator-math';
import { useWebSocket } from '@/hooks/use-websocket';
import { normalizeSymbol } from '@/lib/utils/symbol';

const EMPTY_CANDLES: any[] = [];

// Helper normalize time
export const toSec = (t: any): number => {
    const n = typeof t === 'object' ? (t as any).timestamp : Number(t);
    return n > 10000000000 ? Math.floor(n / 1000) : n;
};

interface UseChartHistoryProps {
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
    chartType: 'candles' | 'heikin_ashi';
    chartRef: React.RefObject<IChartApi | null>;
    subchartRef: React.RefObject<IChartApi | null>;
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
    subSyncRef: React.RefObject<ISeriesApi<'Line'> | null>;
    timescaleSyncRef: React.RefObject<ISeriesApi<'Line'> | null>;
    isReady: boolean;
    onHistoryLoaded: (lastCandle: any) => void;
}

export function useChartHistory({
    symbol, interval, source, chartType,
    chartRef, subchartRef, seriesRef, subSyncRef, timescaleSyncRef,
    isReady, onHistoryLoaded
}: UseChartHistoryProps) {
    const isInitialMount = useRef(true);
    const lastDataLength = useRef(0);
    const lastKeyRef = useRef('');
    const lastChartTypeRef = useRef<string>(chartType);

    const { sendMessage } = useWebSocket();
    const isConnected = useMarketStore(state => state.isConnected);

    const normSymbol = normalizeSymbol(symbol);
    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';

    // Subscribe to store length changes only
    const candlesCount = useMarketStore(state => (key ? (state.candleData[key]?.length || 0) : 0));
    const getCandles = () => (key ? (useMarketStore.getState().candleData[key] || EMPTY_CANDLES) : EMPTY_CANDLES);

    // Initial Fetch Guard
    const lastFetchRequestTimeRef = useRef(0);

    useEffect(() => {
        if (!isReady || !seriesRef.current || !symbol || !interval || !source) return;

        const currentCandles = getCandles();
        const isContextChange = key !== lastKeyRef.current;

        // 1. Reset & Fetch if Context Changed
        if (isContextChange) {
            seriesRef.current.setData([]);
            subSyncRef.current?.setData([]);
            timescaleSyncRef.current?.setData([]);
            lastKeyRef.current = key;
            isInitialMount.current = true;
            lastDataLength.current = 0;

            // Reset scale
            requestAnimationFrame(() => {
                chartRef.current?.timeScale().scrollToRealTime();
                chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                subchartRef.current?.priceScale('right').applyOptions({ autoScale: true });
            });
        }

        // 2. Fetch Data if Empty
        if (currentCandles.length === 0 && isConnected && source !== 'BINANCE') {
            const now = Date.now();
            if (now - lastFetchRequestTimeRef.current > 2000) {
                lastFetchRequestTimeRef.current = now;
                console.log(`📡 [FETCH] Requesting init candles for ${symbol}`);
                sendMessage({
                    topic: "mt5_command", command: "get_candles",
                    symbol, interval, count: 300, target: source
                });
                sendMessage({
                    topic: "mt5_command", command: "get_symbol_info",
                    symbol, target: source
                });
            }
            return;
        }

        // 3. Update Chart Data
        const isTypeChange = chartType !== lastChartTypeRef.current;
        if (isContextChange || currentCandles.length !== lastDataLength.current || isTypeChange) {
            lastChartTypeRef.current = chartType;
            let displayCandles = currentCandles;

            if (chartType === 'heikin_ashi') {
                const haData = calculateHeikinAshi(currentCandles);
                displayCandles = haData.map(c => ({
                    ...c,
                    open: c.ha_open, high: c.ha_high, low: c.ha_low, close: c.ha_close,
                    rawOpen: c.open, rawHigh: c.high, rawLow: c.low, rawClose: c.close
                }));
            }

            const formatted = displayCandles.map(c => ({
                time: toSec(c.time) as Time,
                open: Number(c.open), high: Number(c.high),
                low: Number(c.low), close: Number(c.close),
            }));

            // SET DATA
            seriesRef.current.setData(formatted);

            // Notify parent about the latest candle immediately
            if (formatted.length > 0) {
                onHistoryLoaded(displayCandles[displayCandles.length - 1]);
            }

            // Sync Objects (Subchart, Crosshair)
            const lastT = formatted.length > 0 ? Number(formatted[formatted.length - 1].time) : 0;
            let timeStep = 60;
            if (formatted.length > 1) {
                timeStep = lastT - Number(formatted[formatted.length - 2].time);
            }

            const futurePoints: any[] = [];
            for (let i = 1; i <= 50; i++) {
                futurePoints.push({ time: (lastT + timeStep * i) as Time, value: 0 });
            }
            const syncData = formatted.map(c => ({ time: c.time, value: 0 })).concat(futurePoints);

            subSyncRef.current?.setData(syncData);
            timescaleSyncRef.current?.setData(syncData);

            // Auto Fit on First Load
            if (isInitialMount.current && formatted.length > 0) {
                requestAnimationFrame(() => {
                    chartRef.current?.timeScale().setVisibleLogicalRange({
                        from: formatted.length - (window.innerWidth < 768 ? 50 : 100),
                        to: formatted.length + 5
                    });
                    // FIX: Force price scale reset on new symbol load
                    chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                    subchartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                });
                isInitialMount.current = false;
            }

            lastDataLength.current = currentCandles.length;
        }
    }, [isReady, candlesCount, key, chartType, isConnected]);

    return { candles: getCandles() };
}
