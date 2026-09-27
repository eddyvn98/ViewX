'use client';

import { useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import type { Candle, ChartInstance, DrawingTool, IndicatorConfig } from '@/lib/store/types';
import {
    getChartPerfCounters,
    resetChartPerfCounters,
    type ChartPerfCounters,
} from './chart-perf-counters';

type IndicatorState = {
    configured: Array<{ id: string; type: string; visible: boolean; params: Record<string, unknown> }>;
    runtime: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
};

type DrawingState = {
    count: number;
    isDrawing: boolean;
    currentTool: DrawingTool;
    tempPoints: number;
    selectedDrawingId: string | null;
};

type E2EBridge = {
    seed: () => void;
    getChartState: () => { id: string; symbol: string; interval: string; source: string } | null;
    setChartSymbol: (symbol: string, source?: ChartInstance['source']) => void;
    setChartTimeframe: (interval: string) => void;
    burstTicks: (count?: number) => void;
    getLastCandle: () => Candle | null;
    getPerfCounters: () => ChartPerfCounters;
    resetPerfCounters: () => void;
    addDrawingFixture: () => void;
    addIndicator: (type: string, pane?: IndicatorConfig['pane']) => void;
    clearIndicators: () => void;
    updateFirstIndicatorParams: (params: Record<string, unknown>) => void;
    getIndicatorState: () => IndicatorState;
    startDrawing: (tool: DrawingTool) => void;
    clearDrawings: () => void;
    moveFirstDrawing: (timeDelta?: number, priceDelta?: number) => void;
    resizeFirstDrawing: (timeDelta?: number, priceDelta?: number) => void;
    deleteFirstDrawing: () => void;
    getDrawingState: () => DrawingState;
};

declare global {
    interface Window {
        __VIEWX_E2E__?: E2EBridge;
    }
}

const SYMBOLS = ['XAUUSDm', 'BTCUSDm', 'EURUSDm'] as const;
const INTERVALS = ['1', '5', '15', '60', '240'] as const;

function intervalSeconds(interval: string): number {
    const minutes = Number(interval);
    return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : 60;
}

function basePrice(symbol: string): number {
    if (symbol.startsWith('BTC')) return 65000;
    if (symbol.startsWith('EUR')) return 1.085;
    return 2300;
}

function buildCandles(symbol: string, interval: string, count = 320): Candle[] {
    const step = intervalSeconds(interval);
    const end = Math.floor(Date.now() / 1000 / step) * step;
    const start = end - (count - 1) * step;
    const base = basePrice(symbol);
    const amplitude = symbol.startsWith('EUR') ? 0.002 : symbol.startsWith('BTC') ? 500 : 18;

    return Array.from({ length: count }, (_, index) => {
        const wave = Math.sin(index / 8) * amplitude;
        const drift = index * amplitude * 0.002;
        const open = base + wave + drift;
        const close = open + Math.sin(index / 3) * amplitude * 0.08;
        const high = Math.max(open, close) + amplitude * 0.06;
        const low = Math.min(open, close) - amplitude * 0.06;
        return {
            time: start + index * step,
            open,
            high,
            low,
            close,
            volume: 100 + index,
        };
    });
}

function activeChart() {
    const state = useMarketStore.getState();
    const tab = state.tabs[state.activeTabId];
    if (!tab?.activeChartId) return null;
    return tab.charts[tab.activeChartId] || null;
}

function activeCandles(): Candle[] {
    const chart = activeChart();
    if (!chart) return [];
    const key = `${chart.source}:${chart.symbol}:${chart.interval}`.toLowerCase();
    return Object.entries(useMarketStore.getState().candleData)
        .find(([candidate]) => candidate.toLowerCase() === key)?.[1] || [];
}

function indicatorDefaults(type: string, pane?: IndicatorConfig['pane']): Omit<IndicatorConfig, 'id'> {
    const normalized = type.toUpperCase();
    const isSubchart = ['RSI', 'MACD', 'ATR', 'STOCHASTIC', 'ADX'].includes(normalized);
    const params: Record<string, unknown> =
        normalized === 'MACD'
            ? { fast: 12, slow: 26, signal: 9 }
            : normalized === 'BOLLINGERBANDS' || normalized === 'BOLLINGER_BANDS'
                ? { period: 20, stdDev: 2 }
                : { period: 14 };

    return {
        type,
        params,
        color: '#ffffff',
        visible: true,
        lineWidth: 2,
        pane: pane ?? (isSubchart ? 'subchart' : 'main'),
    };
}

function seed() {
    useMarketStore.setState({
        activeTabId: 'e2e-tab',
        tabs: {
            'e2e-tab': {
                id: 'e2e-tab',
                name: 'E2E',
                charts: {
                    'e2e-chart': {
                        id: 'e2e-chart',
                        symbol: 'XAUUSDm',
                        interval: '1',
                        source: 'MT5',
                        group: 'none',
                        timezone: 'Asia/Ho_Chi_Minh',
                        chartType: 'candles',
                        candleUpColor: '#22c55e',
                        candleDownColor: '#ef4444',
                        isSubchartVisible: true,
                        subchartHeightPct: 25,
                    },
                },
                activeChartId: 'e2e-chart',
                maximizedChartId: null,
                layoutMode: '1x1',
                rows: 1,
                cols: 1,
            },
        },
        isConnected: false,
        isBridgeOnline: false,
        watchlist: [...SYMBOLS],
        chartIndicators: {},
        chartIndicatorRuntime: {},
        chartDrawings: {},
        activeIndicatorId: null,
        activeDrawingId: null,
        selectedDrawingId: null,
        currentDrawingTool: 'none',
        isDrawing: false,
        tempPoints: [],
        candleHistoryRevision: {},
    });
    resetChartPerfCounters();

    const state = useMarketStore.getState();
    state.updateTickers({
        XAUUSDm: { symbol: 'XAUUSDm', price: 2300, change: 0, changeValue: 0, volume: 1, source: 'MT5' },
        BTCUSDm: { symbol: 'BTCUSDm', price: 65000, change: 0, changeValue: 0, volume: 1, source: 'MT5' },
        EURUSDm: { symbol: 'EURUSDm', price: 1.085, change: 0, changeValue: 0, volume: 1, source: 'MT5' },
    });

    for (const symbol of SYMBOLS) {
        state.setSymbolInfo({
            symbol,
            contract_size: 1,
            tick_value: 1,
            tick_size: symbol.startsWith('EUR') ? 0.00001 : 0.01,
            digits: symbol.startsWith('EUR') ? 5 : 2,
            swap_long: 0,
            swap_short: 0,
            currency_profit: 'USD',
            currency_margin: 'USD',
        });
        for (const interval of INTERVALS) {
            state.setCandles('MT5', symbol, interval, buildCandles(symbol, interval));
        }
    }
}

export function ChartE2EBridge() {
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_E2E !== '1') return;

        const api: E2EBridge = {
            seed,
            getChartState: () => {
                const chart = activeChart();
                return chart
                    ? { id: chart.id, symbol: chart.symbol, interval: chart.interval, source: chart.source }
                    : null;
            },
            setChartSymbol: (symbol, source = 'MT5') => {
                const chart = activeChart();
                if (chart) useMarketStore.getState().setChartSymbol(chart.id, symbol, source);
            },
            setChartTimeframe: (interval) => {
                const chart = activeChart();
                if (chart) useMarketStore.getState().setChartTimeframe(chart.id, interval);
            },
            burstTicks: (count = 250) => {
                const chart = activeChart();
                if (!chart) return;
                const state = useMarketStore.getState();
                const candles = activeCandles();
                const last = candles[candles.length - 1];
                const start = Number(last?.close ?? basePrice(chart.symbol));
                const lastTime = Number(last?.time ?? Math.floor(Date.now() / 1000));
                const sameBarTimeMs = (lastTime + Math.max(1, Math.floor(intervalSeconds(chart.interval) / 2))) * 1000;

                for (let index = 0; index < count; index += 1) {
                    state.updateTicker(chart.symbol, {
                        symbol: chart.symbol,
                        source: chart.source,
                        price: start + Math.sin(index / 5) * (start * 0.0005),
                        serverTime: sameBarTimeMs,
                    });
                }
            },
            getLastCandle: () => {
                const chart = activeChart();
                if (!chart) return null;
                const candles = activeCandles();
                return candles.length ? { ...candles[candles.length - 1] } : null;
            },
            getPerfCounters: getChartPerfCounters,
            resetPerfCounters: resetChartPerfCounters,
            addDrawingFixture: () => {
                const chart = activeChart();
                const candles = activeCandles();
                if (!chart || candles.length < 2) return;
                const first = candles[Math.max(0, candles.length - 20)];
                const second = candles[candles.length - 5] || candles[candles.length - 1];
                useMarketStore.getState().addDrawing(chart.id, {
                    type: 'trend-line',
                    points: [
                        { time: Number(first.time), price: Number(first.close) },
                        { time: Number(second.time), price: Number(second.close) },
                    ],
                    symbol: chart.symbol,
                    interval: chart.interval,
                    source: chart.source,
                    color: '#2962FF',
                    visible: true,
                    lineWidth: 1,
                    lineStyle: 'dashed',
                    params: {},
                });
            },
            addIndicator: (type, pane) => {
                const chart = activeChart();
                if (!chart) return;
                useMarketStore.getState().addIndicator(chart.id, indicatorDefaults(type, pane));
            },
            clearIndicators: () => {
                const chart = activeChart();
                if (!chart) return;
                const state = useMarketStore.getState();
                const ids = (state.chartIndicators[chart.id] || []).map((indicator) => indicator.id);
                ids.forEach((id) => useMarketStore.getState().removeIndicator(chart.id, id));
            },
            updateFirstIndicatorParams: (params) => {
                const chart = activeChart();
                if (!chart) return;
                const state = useMarketStore.getState();
                const indicator = (state.chartIndicators[chart.id] || [])[0];
                if (!indicator) return;
                state.updateIndicator(chart.id, indicator.id, {
                    params: { ...indicator.params, ...params },
                });
            },
            getIndicatorState: () => {
                const chart = activeChart();
                if (!chart) return { configured: [], runtime: [] };
                const state = useMarketStore.getState();
                return {
                    configured: (state.chartIndicators[chart.id] || []).map(({ id, type, visible, params }) => ({ id, type, visible, params })),
                    runtime: (state.chartIndicatorRuntime[chart.id] || []).map(({ id, type, params }) => ({ id, type, params })),
                };
            },
            startDrawing: (tool) => {
                useMarketStore.getState().startDrawing(tool);
            },
            clearDrawings: () => {
                const chart = activeChart();
                if (chart) useMarketStore.getState().clearDrawings(chart.id);
            },
            moveFirstDrawing: (timeDelta = 60, priceDelta = 1) => {
                const chart = activeChart();
                if (!chart) return;
                const state = useMarketStore.getState();
                const drawing = (state.chartDrawings[chart.id] || [])[0];
                if (!drawing) return;
                state.updateDrawing(chart.id, drawing.id, {
                    points: drawing.points.map((point) => ({
                        time: Number(point.time) + timeDelta,
                        price: Number(point.price) + priceDelta,
                    })),
                });
            },
            resizeFirstDrawing: (timeDelta = 60, priceDelta = 1) => {
                const chart = activeChart();
                if (!chart) return;
                const state = useMarketStore.getState();
                const drawing = (state.chartDrawings[chart.id] || [])[0];
                if (!drawing || drawing.points.length === 0) return;
                const points = drawing.points.map((point) => ({ ...point }));
                const lastIndex = points.length - 1;
                points[lastIndex] = {
                    time: Number(points[lastIndex].time) + timeDelta,
                    price: Number(points[lastIndex].price) + priceDelta,
                };
                state.updateDrawing(chart.id, drawing.id, { points });
            },
            deleteFirstDrawing: () => {
                const chart = activeChart();
                if (!chart) return;
                const state = useMarketStore.getState();
                const drawing = (state.chartDrawings[chart.id] || [])[0];
                if (drawing) state.removeDrawing(chart.id, drawing.id);
            },
            getDrawingState: () => {
                const chart = activeChart();
                const state = useMarketStore.getState();
                return {
                    count: chart ? (state.chartDrawings[chart.id] || []).length : 0,
                    isDrawing: state.isDrawing,
                    currentTool: state.currentDrawingTool,
                    tempPoints: state.tempPoints.length,
                    selectedDrawingId: state.selectedDrawingId,
                };
            },
        };

        window.__VIEWX_E2E__ = api;
        seed();
        return () => {
            delete window.__VIEWX_E2E__;
        };
    }, []);

    return null;
}
