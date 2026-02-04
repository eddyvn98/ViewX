import { StateCreator } from 'zustand';
import { ChartTab } from '../types';

export interface TabSlice {
    tabs: Record<string, ChartTab>;
    activeTabId: string;
    addTab: (name?: string) => void;
    removeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    renameTab: (id: string, name: string) => void;
    setLayoutMode: (mode: ChartTab['layoutMode']) => void;
}

export const createTabSlice: StateCreator<TabSlice> = (set) => ({
    tabs: {
        'default-tab': {
            id: 'default-tab',
            name: 'Workspace 1',
            charts: {
                'default': { id: 'default', symbol: 'BTCUSDm', interval: '15', source: 'MT5', group: 'A', chartType: 'candles' }
            },
            activeChartId: 'default',
            maximizedChartId: null,
            layoutMode: '1x1',
        }
    },
    activeTabId: 'default-tab',

    addTab: (name) => set((state) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newTab: ChartTab = {
            id,
            name: name || `Workspace ${Object.keys(state.tabs).length + 1}`,
            charts: {
                [`chart-${id}-1`]: { id: `chart-${id}-1`, symbol: 'BTCUSDm', interval: '15', source: 'MT5', group: 'A', chartType: 'candles' }
            },
            activeChartId: `chart-${id}-1`,
            maximizedChartId: null,
            layoutMode: '1x1'
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

    setLayoutMode: (mode) => set((state) => ({
        tabs: {
            ...state.tabs,
            [state.activeTabId]: { ...state.tabs[state.activeTabId], layoutMode: mode }
        }
    })),
});
