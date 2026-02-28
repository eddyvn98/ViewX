import { useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { useChartInit } from './use-chart-init';
import { useChartData } from './use-chart-data';

const EMPTY_CANDLES: unknown[] = [];

export function useChartRuntime(chartId: string) {
    const { theme = 'dark' } = useTheme();
    const positions = useMarketStore((state) => state.positions);
    const orders = useMarketStore((state) => state.orders);

    const chartInstance = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            if (tab.charts[chartId]) return tab.charts[chartId];
        }
        return null;
    });

    const symbol = chartInstance?.symbol;
    const interval = chartInstance?.interval;
    const source = chartInstance?.source;
    const timezone = chartInstance?.timezone || 'Asia/Ho_Chi_Minh';
    const chartType = chartInstance?.chartType || 'candles';

    const normSymbol = normalizeSymbol(symbol);
    const key = `${source}:${normSymbol}:${interval}`;

    // Keep subscription by candle count to preserve current update behavior.
    const candlesCount = useMarketStore(state => (state.candleData[key] || EMPTY_CANDLES).length);
    void candlesCount;

    const candles = useMarketStore.getState().candleData[key] || EMPTY_CANDLES;

    const mainContainerRef = useRef<HTMLDivElement>(null);
    const priceContainerRef = useRef<HTMLDivElement>(null);
    const subchartContainerRef = useRef<HTMLDivElement>(null);
    const timescaleContainerRef = useRef<HTMLDivElement>(null);

    const {
        isReady,
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        seriesRef,
        markerSeriesRef,
        subSyncRef,
        timescaleSyncRef,
        syncRange,
        isAutoScrollEnabledRef
    } = useChartInit(priceContainerRef, subchartContainerRef, timescaleContainerRef, chartId, theme);

    const { sendMessage } = useWebSocket();
    const { realTimeCandleRef } = useChartData(
        chartId,
        symbol,
        interval,
        source,
        chartType,
        priceChartRef,
        subchartChartRef,
        seriesRef,
        markerSeriesRef,
        subSyncRef,
        timescaleSyncRef,
        isReady,
        isAutoScrollEnabledRef,
        theme
    );

    const filteredPositions = useMemo(
        () => positions.filter(p => !source || ((p as { source?: string }).source || 'MT5') === source),
        [positions, source]
    );
    const filteredOrders = useMemo(
        () => orders.filter(o => !source || ((o as { source?: string }).source || 'MT5') === source),
        [orders, source]
    );

    return {
        chartInstance,
        symbol,
        interval,
        source,
        timezone,
        chartType,
        candles,
        mainContainerRef,
        priceContainerRef,
        subchartContainerRef,
        timescaleContainerRef,
        isReady,
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        seriesRef,
        markerSeriesRef,
        syncRange,
        isAutoScrollEnabledRef,
        sendMessage,
        realTimeCandleRef,
        filteredPositions,
        filteredOrders
    };
}
