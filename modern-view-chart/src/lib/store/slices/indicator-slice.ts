import { StateCreator } from 'zustand';
import { RootState } from '../index';
import { IndicatorConfig } from '../types';

export interface IndicatorSlice {
    chartIndicators: Record<string, IndicatorConfig[]>;
    activeIndicatorId: string | null;

    addIndicator: (chartId: string, indicator: Omit<IndicatorConfig, 'id'>) => void;
    addIndicators: (chartId: string, indicators: Omit<IndicatorConfig, 'id'>[]) => void;
    removeIndicator: (chartId: string, indicatorId: string) => void;
    updateIndicator: (chartId: string, indicatorId: string, updates: Partial<IndicatorConfig>) => void;
    toggleIndicatorVisibility: (chartId: string, indicatorId: string) => void;
    setActiveIndicatorId: (id: string | null) => void;
}

export const createIndicatorSlice: StateCreator<RootState, [], [], IndicatorSlice> = (set) => ({
    chartIndicators: {},
    activeIndicatorId: null,

    addIndicator: (chartId, indicator) => set((state) => {
        const id = Math.random().toString(36).substring(7);
        const newIndicator = { ...indicator, id } as IndicatorConfig;
        const currentIndicators = state.chartIndicators[chartId] || [];
        return {
            chartIndicators: {
                ...state.chartIndicators,
                [chartId]: [...currentIndicators, newIndicator]
            }
        };
    }),

    addIndicators: (chartId, indicators) => set((state) => {
        const newIndicators = indicators.map(ind => ({
            ...ind,
            id: Math.random().toString(36).substring(7)
        })) as IndicatorConfig[];

        const currentIndicators = state.chartIndicators[chartId] || [];
        return {
            chartIndicators: {
                ...state.chartIndicators,
                [chartId]: [...currentIndicators, ...newIndicators]
            }
        };
    }),

    removeIndicator: (chartId, indicatorId) => set((state) => {
        const currentIndicators = state.chartIndicators[chartId] || [];
        return {
            chartIndicators: {
                ...state.chartIndicators,
                [chartId]: currentIndicators.filter(i => i.id !== indicatorId)
            },
            activeIndicatorId: state.activeIndicatorId === indicatorId ? null : state.activeIndicatorId
        };
    }),

    updateIndicator: (chartId, indicatorId, updates) => set((state) => {
        const currentIndicators = state.chartIndicators[chartId] || [];
        return {
            chartIndicators: {
                ...state.chartIndicators,
                [chartId]: currentIndicators.map(i => i.id === indicatorId ? { ...i, ...updates } : i)
            }
        };
    }),

    toggleIndicatorVisibility: (chartId, indicatorId) => set((state) => {
        const currentIndicators = state.chartIndicators[chartId] || [];
        return {
            chartIndicators: {
                ...state.chartIndicators,
                [chartId]: currentIndicators.map(i => i.id === indicatorId ? { ...i, visible: !i.visible } : i)
            }
        };
    }),

    setActiveIndicatorId: (id) => set({ activeIndicatorId: id }),
});
