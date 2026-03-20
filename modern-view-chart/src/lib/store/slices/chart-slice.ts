import { StateCreator } from 'zustand';
import { ChartInstance } from '../types';
import { TabSlice } from './tab-slice';
import { MarketSlice } from './market-slice';
import { IndicatorSlice } from './indicator-slice';

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
    toggleSubchartVisibility: (id: string, visible?: boolean) => void;
    favoriteTimeframes: string[];
    toggleFavoriteTimeframe: (timeframe: string) => void;
}

// Internal helper for symbol normalization
import { normalizeSymbol } from '@/lib/utils/symbol';

export const createChartSlice: StateCreator<
    TabSlice & MarketSlice & IndicatorSlice & ChartSlice,
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
            timezone: 'Asia/Ho_Chi_Minh',
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
        const newChartIndicators = { ...state.chartIndicators };
        delete newCharts[id];
        delete newChartIndicators[id];
        const remainingIds = Object.keys(newCharts);
        const remainingCount = remainingIds.length;

        let nextRows = activeTab.rows || 1;
        let nextCols = activeTab.cols || 1;

        if (remainingCount > 0) {
            // Shrink to an exact-fit grid after deleting a chart so the remaining
            // charts expand and we avoid leaving empty cells behind.
            let bestRows = 1;
            let bestCols = remainingCount;
            let bestDelta = Math.abs(bestCols - bestRows);

            for (let rows = 1; rows <= remainingCount; rows++) {
                if (remainingCount % rows !== 0) continue;
                const cols = remainingCount / rows;
                const delta = Math.abs(cols - rows);
                if (delta < bestDelta) {
                    bestRows = rows;
                    bestCols = cols;
                    bestDelta = delta;
                }
            }

            nextRows = bestRows;
            nextCols = bestCols;
        } else {
            nextRows = 1;
            nextCols = 1;
        }

        const updatedTab = {
            ...activeTab,
            charts: newCharts,
            activeChartId: activeTab.activeChartId === id ? (remainingIds[0] || null) : activeTab.activeChartId,
            maximizedChartId: activeTab.maximizedChartId === id ? null : activeTab.maximizedChartId,
            layoutMode: `${nextRows}x${nextCols}`,
            rows: nextRows,
            cols: nextCols,
        };

        return {
            chartIndicators: newChartIndicators,
            tabs: { ...state.tabs, [state.activeTabId]: updatedTab },
        };
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
        let hasChanges = false;

        if (sourceChart.group && sourceChart.group !== 'none') {
            Object.values(newCharts).forEach(chart => {
                if (chart.group === sourceChart.group) {
                    if (chart.symbol === normSymbol && chart.source === symbolSource) return;
                    newCharts[chart.id] = { ...chart, symbol: normSymbol, source: symbolSource };
                    hasChanges = true;
                }
            });
        } else {
            if (sourceChart.symbol === normSymbol && sourceChart.source === symbolSource) {
                return state;
            }
            newCharts[id] = { ...sourceChart, symbol: normSymbol, source: symbolSource };
            hasChanges = true;
        }

        if (!hasChanges) return state;

        const updatedTab = { ...activeTab, charts: newCharts };
        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    setChartTimeframe: (id, interval) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab || !activeTab.charts[id]) return state;
        if (activeTab.charts[id].interval === interval) return state;

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
        if ((activeTab.charts[id].timezone || 'Asia/Ho_Chi_Minh') === timezone) return state;

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
        if (activeTab.charts[id].chartType === type) return state;

        const updatedTab = {
            ...activeTab,
            charts: {
                ...activeTab.charts,
                [id]: { ...activeTab.charts[id], chartType: type }
            }
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    toggleSubchartVisibility: (id, visible) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab || !activeTab.charts[id]) return state;

        const currentVisible = activeTab.charts[id].isSubchartVisible ?? false;
        const newVisible = visible !== undefined ? visible : !currentVisible;

        const updatedTab = {
            ...activeTab,
            charts: {
                ...activeTab.charts,
                [id]: { ...activeTab.charts[id], isSubchartVisible: newVisible }
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
