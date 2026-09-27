'use client';

import { useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import type { Candle, ChartInstance, DrawingTool, IndicatorConfig } from '@/lib/store/types';

type IndicatorState = {
    configured: Array<{ id: string; type: string; visible: boolean }>;
    runtime: Array<{ id: string; type: string }>;
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
    addIndicator: (type: string, pane?: IndicatorConfig['pane']) => void;
    clearIndicators: () => void;
    getIndicatorState: () => IndicatorState;
    startDrawing: (tool: DrawingTool) => void;
    clearDrawings: () => void;
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
    });

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
                const start = basePrice(chart.symbol);
                for (let index = 0; index < count; index += 1) {
                    state.updateTicker(chart.symbol, {
                        symbol: chart.symbol,
                        source: chart.source,
                        price: start + Math.sin(index / 5) * (start * 0.0005),
                        serverTime: Date.now() + index,
                    });
                }
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
            getIndicatorState: () => {
                const chart = activeChart();
                if (!chart) return { configured: [], runtime: [] };
                const state = useMarketStore.getState();
                return {
                    configured: (state.chartIndicators[chart.id] || []).map(({ id, type, visible }) => ({ id, type, visible })),
                    runtime: (state.chartIndicatorRuntime[chart.id] || []).map(({ id, type }) => ({ id, type })),
                };
            },
            startDrawing: (tool) => {
                useMarketStore.getState().startDrawing(tool);
            },
            clearDrawings: () => {
                const chart = activeChart();
                if (chart) useMarketStore.getState().clearDrawings(chart.id);
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
