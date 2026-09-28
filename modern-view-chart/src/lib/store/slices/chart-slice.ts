import { StateCreator } from 'zustand';
import { ChartInstance, SymbolDescriptor } from '../types';
import { TabSlice } from './tab-slice';
import { MarketSlice } from './market-slice';

export interface ChartSlice {
    addChart: (symbol: string, interval: string, source: ChartInstance['source']) => void;
    removeChart: (id: string) => void;
    updateChart: (id: string, patch: Partial<ChartInstance>) => void;
    setChartSymbol: (
        id: string,
        symbol: string,
        source?: ChartInstance['source'],
        identity?: Pick<SymbolDescriptor, 'accountLogin' | 'terminalId' | 'broker'>,
    ) => void;
    setChartTimeframe: (id: string, interval: string) => void;
    setActiveChart: (id: string) => void;
    toggleMaximizeChart: (id: string | null) => void;
    setChartTimezone: (id: string, timezone: string) => void;
    setChartType: (id: string, type: ChartInstance['chartType']) => void;
    toggleSubchartVisibility: (id: string, visible?: boolean) => void;
    setSubchartHeightPct: (id: string, heightPct: number) => void;
    resetSubchartHeightPct: (id: string) => void;
    favoriteTimeframes: string[];
    toggleFavoriteTimeframe: (timeframe: string) => void;
    favoriteChartTypes: Array<'candles' | 'heikin_ashi' | 'smart_candles'>;
    toggleFavoriteChartType: (chartType: 'candles' | 'heikin_ashi' | 'smart_candles') => void;
}

// Internal helper for symbol normalization
import { normalizeSymbol } from '@/lib/utils/symbol';
import { normalizeTransportSymbol } from '@/lib/market/symbol-catalog';

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
        const normSymbol = normalizeTransportSymbol(symbol, source);

        const newChart: ChartInstance = {
            id,
            symbol: normSymbol,
            interval: interval || '15',
            group: 'none',
            source,
            timezone: 'Asia/Ho_Chi_Minh',
            chartType: 'candles',
            candleUpColor: '#22c55e',
            candleDownColor: '#ef4444',
            candleColors: {
                candles: { up: '#22c55e', down: '#ef4444' },
                heikin_ashi: { up: '#22c55e', down: '#ef4444' },
                smart_candles: { up: '#22c55e', down: '#ef4444' },
            },
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
        const nextActiveChartId = activeTab.activeChartId === id ? (remainingIds[0] || null) : activeTab.activeChartId;
        const safeActiveChartId = nextActiveChartId && newCharts[nextActiveChartId] ? nextActiveChartId : (remainingIds[0] || null);

        const updatedTab = {
            ...activeTab,
            charts: newCharts,
            activeChartId: safeActiveChartId,
            maximizedChartId: activeTab.maximizedChartId === id ? null : activeTab.maximizedChartId
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    updateChart: (id, patch) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab || !activeTab.charts[id]) return state;

        const currentChart = activeTab.charts[id];
        const nextSource = patch.source ?? currentChart.source;
        const nextSymbol = patch.symbol !== undefined
            ? normalizeTransportSymbol(patch.symbol, nextSource)
            : currentChart.symbol;
        const nextInterval = patch.interval ?? currentChart.interval;
        const contextChanged =
            nextSymbol !== currentChart.symbol
            || nextSource !== currentChart.source
            || nextInterval !== currentChart.interval;
        const normalizedPatch = patch.symbol !== undefined
            ? { ...patch, symbol: nextSymbol }
            : patch;

        const updatedTab = {
            ...activeTab,
            charts: {
                ...activeTab.charts,
                [id]: {
                    ...currentChart,
                    ...(contextChanged ? { forecast: undefined } : {}),
                    ...normalizedPatch,
                } as ChartInstance
            }
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    setChartSymbol: (id, symbol, source, identity) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab) return state;

        const sourceChart = activeTab.charts[id];
        if (!sourceChart) return state;

        const legacySymbol = normalizeSymbol(symbol);
        const symbolSource =
            source
            || state.tickers[legacySymbol]?.source
            || (legacySymbol.toUpperCase() === 'SJCVN' || legacySymbol.toUpperCase() === 'DOJIVN'
                ? 'VN_GOLD'
                : legacySymbol.toUpperCase().includes('USDT')
                    ? 'BINANCE'
                    : 'MT5');
        const normSymbol = normalizeTransportSymbol(symbol, symbolSource);
        const accountPatch = {
            accountLogin: identity?.accountLogin ?? null,
            terminalId: identity?.terminalId ?? null,
            broker: identity?.broker ?? null,
        };

        const newCharts = { ...activeTab.charts };
        let hasChanges = false;

        if (sourceChart.group && sourceChart.group !== 'none') {
            Object.values(newCharts).forEach(chart => {
                if (chart.group === sourceChart.group) {
                    if (
                        chart.symbol === normSymbol
                        && chart.source === symbolSource
                        && (chart.accountLogin ?? null) === accountPatch.accountLogin
                        && (chart.terminalId ?? null) === accountPatch.terminalId
                    ) return;
                    newCharts[chart.id] = {
                        ...chart,
                        symbol: normSymbol,
                        source: symbolSource,
                        ...accountPatch,
                        forecast: undefined,
                    };
                    hasChanges = true;
                }
            });
        } else {
            if (
                sourceChart.symbol === normSymbol
                && sourceChart.source === symbolSource
                && (sourceChart.accountLogin ?? null) === accountPatch.accountLogin
                && (sourceChart.terminalId ?? null) === accountPatch.terminalId
            ) {
                return state;
            }
            newCharts[id] = {
                ...sourceChart,
                symbol: normSymbol,
                source: symbolSource,
                ...accountPatch,
                forecast: undefined,
            };
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
                [id]: { ...activeTab.charts[id], interval, forecast: undefined }
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

    setSubchartHeightPct: (id, heightPct) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab || !activeTab.charts[id]) return state;

        const normalized = Math.max(3, Math.min(85, Math.round(heightPct)));
        if (activeTab.charts[id].subchartHeightPct === normalized) return state;

        const updatedTab = {
            ...activeTab,
            charts: {
                ...activeTab.charts,
                [id]: { ...activeTab.charts[id], subchartHeightPct: normalized }
            }
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    resetSubchartHeightPct: (id) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab || !activeTab.charts[id]) return state;
        if (activeTab.charts[id].subchartHeightPct === 25 || activeTab.charts[id].subchartHeightPct === undefined) return state;

        const updatedTab = {
            ...activeTab,
            charts: {
                ...activeTab.charts,
                [id]: { ...activeTab.charts[id], subchartHeightPct: 25 }
            }
        };

        return { tabs: { ...state.tabs, [state.activeTabId]: updatedTab } };
    }),

    favoriteTimeframes: ['1', '5', '15', '60', '240', '1440', '10080', '43200', '525600'],
    favoriteChartTypes: ['candles', 'heikin_ashi', 'smart_candles'],

    toggleFavoriteTimeframe: (tf) => set((state) => {
        const current = state.favoriteTimeframes || [];
        const exists = current.includes(tf);
        return {
            favoriteTimeframes: exists
                ? current.filter(id => id !== tf)
                : [...current, tf]
        };
    }),

    toggleFavoriteChartType: (chartType) => set((state) => {
        const current = state.favoriteChartTypes || [];
        const exists = current.includes(chartType);
        return {
            favoriteChartTypes: exists
                ? current.filter((id) => id !== chartType)
                : [...current, chartType]
        };
    }),
});
