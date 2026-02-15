import { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, SeriesMarker, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { toSec } from '@/features/chart/utils/time-utils';
import { formatCandleData } from '@/features/chart/utils/format-candle-data';
import { useSeriesSwitcher } from './use-series-switcher';
import { calculateDynamicSwingPoints } from '@/features/chart/logic/candle-patterns';

const EMPTY_CANDLES: any[] = [];
const MIN_CANDLES_THRESHOLD = 50;

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
    onHistoryLoaded: (lastCandle: any) => void;
}

export function useChartHistory(props: UseChartHistoryProps) {
    const { symbol, interval, source, chartType, chartRef, subchartRef, seriesRef, markerSeriesRef, subSyncRef, timescaleSyncRef, isReady, onHistoryLoaded } = props;
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
    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';

    const candlesCount = useMarketStore(state => (key ? (state.candleData[key]?.length || 0) : 0));
    const getCandles = () => (key ? (useMarketStore.getState().candleData[key] || EMPTY_CANDLES) : EMPTY_CANDLES);
    const { handleSwitch } = useSeriesSwitcher({ chartRef, seriesRef, chartType });

    useEffect(() => {
        if (!isReady || !symbol || !interval || !seriesRef.current) return;

        const currentCandles = getCandles();
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
                sendMessage({ topic: "mt5_command", command: "get_candles", symbol, interval: interval, count: 300 });
                sendMessage({ topic: "mt5_command", command: "get_symbol_info", symbol });
            }
        }

        const isTypeChange = chartType !== lastChartTypeRef.current;
        if (isContextChange || currentCandles.length !== lastDataLength.current || isTypeChange) {
            handleSwitch(isContextChange, lastChartTypeRef.current);
            lastChartTypeRef.current = chartType;

            const formatted = formatCandleData(currentCandles, chartType);

            // Fix: Re-check seriesRef.current after potential switch
            if (seriesRef.current) {
                seriesRef.current.setData(formatted);
                markerSeriesRef.current?.setData(formatted); // Sync timeline for markers
            }

            if (formatted.length > 0) {
                onHistoryLoaded(currentCandles[currentCandles.length - 1]);
                updateSyncData(formatted, subSyncRef, timescaleSyncRef);
                if (chartStateRef.current === 'loading') handleAutoFit();
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
        requestAnimationFrame(() => {
            try {
                chartRef.current?.timeScale().setVisibleLogicalRange({
                    from: candles.length - (window.innerWidth < 768 ? 50 : 100),
                    to: candles.length + 5
                });
                chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                subchartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                chartStateRef.current = 'ready';
            } catch (e) {
                chartStateRef.current = 'ready';
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
