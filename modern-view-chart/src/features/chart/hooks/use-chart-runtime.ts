import { useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { useChartInit } from './use-chart-init';
import { useChartData } from './use-chart-data';

const EMPTY_CANDLES: unknown[] = [];
const DEFAULT_CANDLE_UP_COLOR = '#22c55e';
const DEFAULT_CANDLE_DOWN_COLOR = '#ef4444';

export function useChartRuntime(chartId: string) {
    const { theme = 'dark' } = useTheme();
    const positions = useMarketStore((state) => state.positions);
    const orders = useMarketStore((state) => state.orders);

    const symbol = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            const chart = tab.charts[chartId];
            if (chart) return chart.symbol;
        }
        return undefined;
    });
    const interval = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            const chart = tab.charts[chartId];
            if (chart) return chart.interval;
        }
        return undefined;
    });
    const source = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            const chart = tab.charts[chartId];
            if (chart) return chart.source;
        }
        return undefined;
    });
    const timezone = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            const chart = tab.charts[chartId];
            if (chart) return chart.timezone || 'Asia/Ho_Chi_Minh';
        }
        return 'Asia/Ho_Chi_Minh';
    });
    const chartType = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            const chart = tab.charts[chartId];
            if (chart) return chart.chartType || 'candles';
        }
        return 'candles';
    });
    const candleUpColor = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            const chart = tab.charts[chartId];
            if (chart) {
                const palette = chart.candleColors?.[chartType];
                return palette?.up || chart.candleUpColor || DEFAULT_CANDLE_UP_COLOR;
            }
        }
        return DEFAULT_CANDLE_UP_COLOR;
    });
    const candleDownColor = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            const chart = tab.charts[chartId];
            if (chart) {
                const palette = chart.candleColors?.[chartType];
                return palette?.down || chart.candleDownColor || DEFAULT_CANDLE_DOWN_COLOR;
            }
        }
        return DEFAULT_CANDLE_DOWN_COLOR;
    });

    const normSymbol = normalizeSymbol(symbol);
    const key = source && normSymbol && interval ? `${source}:${normSymbol}:${interval}` : '';

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
    } = useChartInit(
        priceContainerRef,
        subchartContainerRef,
        timescaleContainerRef,
        chartId,
        theme,
        timezone,
        candleUpColor,
        candleDownColor,
        key
    );

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
        theme,
        candleUpColor,
        candleDownColor,
        key
    );

    const filteredPositions = useMemo(
        () => positions.filter(p => !source || ((p as { source?: string }).source || 'MT5') === source),
        [positions, source]
    );
    const filteredOrders = useMemo(
        () => orders.filter(o => !source || ((o as { source?: string }).source || 'MT5') === source),
        [orders, source]
    );

    const chartInstance = useMemo(() => {
        if (!symbol || !interval || !source) return null;
        return {
            id: chartId,
            symbol,
            interval,
            source,
            timezone,
            chartType,
            candleUpColor,
            candleDownColor,
        };
    }, [chartId, symbol, interval, source, timezone, chartType, candleUpColor, candleDownColor]);

    return {
        chartInstance,
        symbol,
        interval,
        source,
        timezone,
        chartType,
        candleUpColor,
        candleDownColor,
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
