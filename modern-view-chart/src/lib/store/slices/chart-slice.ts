import { StateCreator } from 'zustand';
import { ChartInstance, Ticker } from '../types';
import { TabSlice } from './tab-slice';
import { MarketSlice } from './market-slice';

export interface ChartSlice {
    addChart: (symbol: string, interval: string, source: ChartInstance['source']) => void;
    removeChart: (id: string) => void;
    updateChart: (id: string, patch: Partial<ChartInstance>) => void;
    setChartSymbol: (id: string, symbol: string) => void;
    setChartTimeframe: (id: string, interval: string) => void;
    setActiveChart: (id: string) => void;
    toggleMaximizeChart: (id: string | null) => void;
    setChartTimezone: (id: string, timezone: string) => void;
    setChartType: (id: string, type: ChartInstance['chartType']) => void;
    favoriteTimeframes: string[];
    toggleFavoriteTimeframe: (timeframe: string) => void;
}

// Internal helper for symbol normalization
const normalizeSymbol = (s: string) => s.toLowerCase().endsWith('m') ? s.replace(/[mM]$/, 'm') : s;

export const createChartSlice: StateCreator<
    TabSlice & MarketSlice & ChartSlice,
    [],
    [],
    ChartSlice
> = (set) => ({
    addChart: (symbol, interval, source) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab) return state;

        const id = Math.random().toString(36).substr(2, 9);
        const normSymbol = normalizeSymbol(symbol);

        const newChart: ChartInstance = {
            id,
            symbol: normSymbol,
            interval: interval || '15',
            group: 'none',
            source,
            timezone: 'Etc/UTC',
            chartType: 'candles'
        };

        const updatedTab = {
            ...activeTab,
            charts: { ...activeTab.charts, [id]: newChart },
            activeChartId: id
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    removeChart: (id) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab) return state;

        const newCharts = { ...activeTab.charts };
        delete newCharts[id];
        const remainingIds = Object.keys(newCharts);

        const updatedTab = {
            ...activeTab,
            charts: newCharts,
            activeChartId: activeTab.activeChartId === id ? (remainingIds[0] || null) : activeTab.activeChartId
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    updateChart: (id, patch) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab || !activeTab.charts[id]) return state;

        const updatedTab = {
            ...activeTab,
            charts: {
                ...activeTab.charts,
                [id]: { ...activeTab.charts[id], ...patch } as ChartInstance
            }
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    setChartSymbol: (id, symbol) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab) return state;

        const sourceChart = activeTab.charts[id];
        if (!sourceChart) return state;

        const normSymbol = normalizeSymbol(symbol);
        const symbolSource = state.tickers[normSymbol]?.source ||
            (normSymbol.toUpperCase().includes('USDT') ? 'BINANCE' : 'MT5');

        const newCharts = { ...activeTab.charts };

        if (sourceChart.group && sourceChart.group !== 'none') {
            Object.values(newCharts).forEach(chart => {
                if (chart.group === sourceChart.group) {
                    newCharts[chart.id] = { ...chart, symbol: normSymbol, source: symbolSource };
                }
            });
        } else {
            newCharts[id] = { ...sourceChart, symbol: normSymbol, source: symbolSource };
        }

        const updatedTab = { ...activeTab, charts: newCharts };
        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    setChartTimeframe: (id, interval) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab || !activeTab.charts[id]) return state;

        const updatedTab = {
            ...activeTab,
            charts: {
                ...activeTab.charts,
                [id]: { ...activeTab.charts[id], interval }
            }
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    setActiveChart: (id) => set((state) => ({
        tabs: {
            ...state.tabs,
            [state.activeTabId]: { ...state.tabs[state.activeTabId], activeChartId: id }
        }
    })),

    toggleMaximizeChart: (id) => set((state) => ({
        tabs: {
            ...state.tabs,
            [state.activeTabId]: { ...state.tabs[state.activeTabId], maximizedChartId: id }
        }
    })),

    setChartTimezone: (id, timezone) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab || !activeTab.charts[id]) return state;

        const updatedTab = {
            ...activeTab,
            charts: {
                ...activeTab.charts,
                [id]: { ...activeTab.charts[id], timezone }
            }
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    setChartType: (id, type) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab || !activeTab.charts[id]) return state;

        const updatedTab = {
            ...activeTab,
            charts: {
                ...activeTab.charts,
                [id]: { ...activeTab.charts[id], chartType: type }
            }
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    favoriteTimeframes: ['1', '5', '15', '60', '240', 'D'],

    toggleFavoriteTimeframe: (tf) => set((state) => {
        const current = state.favoriteTimeframes || [];
        const exists = current.includes(tf);
        return {
            favoriteTimeframes: exists
                ? current.filter(id => id !== tf)
                : [...current, tf]
        };
    }),
});
