import { StateCreator } from 'zustand';
import { ChartTab } from '../types';
import { RootState } from '../index';

export interface TabSlice {
    tabs: Record<string, ChartTab>;
    activeTabId: string;
    addTab: (name?: string) => void;
    removeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    renameTab: (id: string, name: string) => void;
    setLayoutMode: (mode: string, r?: number, c?: number) => void;
}

export const createTabSlice: StateCreator<RootState, [], [], TabSlice> = (set) => ({
    tabs: {
        'default-tab': {
            id: 'default-tab',
            name: 'Workspace 1',
            charts: {
                'default': { id: 'default', symbol: 'BTCUSDT', interval: '1', source: 'BINANCE', group: 'A', chartType: 'smart_candles', timezone: 'Asia/Ho_Chi_Minh' }
            },
            activeChartId: 'default',
            maximizedChartId: null,
            layoutMode: '1x1',
            rows: 1,
            cols: 1
        }
    },
    activeTabId: 'default-tab',

    addTab: (name) => set((state) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newTab: ChartTab = {
            id,
            name: name || `Workspace ${Object.keys(state.tabs).length + 1}`,
            charts: {
                [`chart-${id}-1`]: { id: `chart-${id}-1`, symbol: 'BTCUSDT', interval: '1', source: 'BINANCE', group: 'A', chartType: 'smart_candles', timezone: 'Asia/Ho_Chi_Minh' }
            },
            activeChartId: `chart-${id}-1`,
            maximizedChartId: null,
            layoutMode: '1x1',
            rows: 1,
            cols: 1
        };
        return {
            tabs: { ...state.tabs, [id]: newTab },
            activeTabId: id
        };
    }),

    removeTab: (id) => set((state) => {
        if (Object.keys(state.tabs).length <= 1) return state;
        const newTabs = { ...state.tabs };
        delete newTabs[id];
        const remainingIds = Object.keys(newTabs);
        return {
            tabs: newTabs,
            activeTabId: state.activeTabId === id ? remainingIds[0] : state.activeTabId
        };
    }),

    setActiveTab: (id) => set({ activeTabId: id }),

    renameTab: (id, name) => set((state) => ({
        tabs: {
            ...state.tabs,
            [id]: { ...state.tabs[id], name }
        }
    })),

    setLayoutMode: (mode: string, r?: number, c?: number) => set((state) => {
        const activeTab = state.tabs[state.activeTabId];
        if (!activeTab) return state;

        const rows = r || parseInt(mode.split('x')[0]) || 1;
        const cols = c || parseInt(mode.split('x')[1]) || 1;
        const needed = rows * cols;
        const existingCharts = Object.keys(activeTab.charts);
        const existingCount = existingCharts.length;

        const newCharts = { ...activeTab.charts };
        const newChartIndicators = { ...state.chartIndicators };

        // Find prototype
        const protoId = activeTab.activeChartId || existingCharts[0];
        const protoChart = activeTab.charts[protoId];
        const protoIndicators = state.chartIndicators[protoId] || [];

        if (existingCount < needed) {
            for (let i = existingCount + 1; i <= needed; i++) {
                const newId = `chart-${activeTab.id}-${i}`;
                newCharts[newId] = { ...protoChart, id: newId, group: 'none' };
                newChartIndicators[newId] = protoIndicators.map((ind) => ({
                    ...ind,
                    id: Math.random().toString(36).substring(7)
                }));
            }
        }

        return {
            chartIndicators: newChartIndicators,
            tabs: {
                ...state.tabs,
                [state.activeTabId]: {
                    ...activeTab,
                    layoutMode: `${rows}x${cols}`,
                    rows,
                    cols,
                    charts: newCharts
                }
            }
        };
    }),
});
