import { useRef, useEffect } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { Candle } from '@/lib/store';
import { useChartHistory } from './use-chart-history';
import { useChartTicker } from './use-chart-ticker';

export function useChartData(
    id: string,
    symbol: string | undefined,
    interval: string | undefined,
    source: string | undefined,
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles',
    chartRef: React.RefObject<IChartApi | null>,
    subchartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    markerSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    subSyncRef: React.RefObject<ISeriesApi<'Line'> | null>,
    timescaleSyncRef: React.RefObject<ISeriesApi<'Line'> | null>,
    isReady: boolean,
    isAutoScrollEnabledRef: React.RefObject<boolean>,
    theme: string,
    candleUpColor: string,
    candleDownColor: string,
    contextKey?: string
) {
    // Shared reference to the trusted "Current Candle" (from Store/History).
    // It must never survive a symbol/source/timeframe switch: otherwise the
    // new symbol's ticker can reuse the previous symbol's OHLC as its base.
    const lastCandleRef = useRef<Candle | null>(null);
    const lastCandleContextRef = useRef(contextKey || `${source || ''}:${symbol || ''}:${interval || ''}`);
    const candleContext = contextKey || `${source || ''}:${symbol || ''}:${interval || ''}`;
    if (lastCandleContextRef.current !== candleContext) {
        lastCandleContextRef.current = candleContext;
        lastCandleRef.current = null;
    }

    // 1. History & Synchronization Hook
    // Manages initial load, chart resets, and full candle updates from Store
    const { candles } = useChartHistory({
        chartId: id,
        symbol, interval, source, chartType,
        chartRef, subchartRef, seriesRef, markerSeriesRef,
        subSyncRef, timescaleSyncRef,
        isReady,
        isAutoScrollEnabledRef,
        theme,
        candleUpColor,
        candleDownColor,
        contextKey,
        onHistoryLoaded: (last) => { lastCandleRef.current = last; }
    });

    // Sync ref when store updates (e.g. new candle arrived via WS)
    useEffect(() => {
        if (candles.length > 0) {
            lastCandleRef.current = candles[candles.length - 1];
        } else {
            lastCandleRef.current = null;
        }
    }, [candles, candleContext]);

    // 2. Real-time Ticker Hook
    // Manages high-frequency visual price updates (Tick-by-Tick)
    // Only updates the EXISTING candle visually to prevent timezone/offset bugs
    const realTimeCandleRef = useChartTicker({
        symbol, interval, source, seriesRef, chartType, lastCandleRef,
        isAutoScrollEnabledRef, chartRef, theme, contextKey, candleUpColor, candleDownColor
    });

    return { realTimeCandleRef };
}
