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

const INDICATOR_COLORS = [
    '#00ff88', // Emerald
    '#2196F3', // Azure
    '#9C27B0', // Amethyst
    '#FF9800', // Amber
    '#e91e63', // Rose
    '#00BCD4', // Cyan
    '#FFD700', // Gold
];

export const createIndicatorSlice: StateCreator<RootState, [], [], IndicatorSlice> = (set) => ({
    chartIndicators: {},
    activeIndicatorId: null,

    addIndicator: (chartId, indicator) => set((state) => {
        const id = Math.random().toString(36).substring(7);
        const currentIndicators = state.chartIndicators[chartId] || [];

        // Smart Color Selection:
        // 1. Find colors currently used by indicators on this chart
        const usedColors = currentIndicators.map(ind => ind.color.toLowerCase());

        // 2. Find the first color in our palette that isn't used
        let assignedColor = indicator.color;

        // If the indicator color is a "default" or "white" or not provided, we override it
        const isGenericColor = !indicator.color || indicator.color === '#ffffff' || indicator.color === 'white';

        if (isGenericColor) {
            const availableColor = INDICATOR_COLORS.find(c => !usedColors.includes(c.toLowerCase()));

            if (availableColor) {
                assignedColor = availableColor;
            } else {
                // If all colors are used, pick the one that appears least frequently, or just cycle
                assignedColor = INDICATOR_COLORS[currentIndicators.length % INDICATOR_COLORS.length];
            }
        }

        const newIndicator = { ...indicator, id, color: assignedColor } as IndicatorConfig;

        return {
            chartIndicators: {
                ...state.chartIndicators,
                [chartId]: [...currentIndicators, newIndicator]
            }
        };
    }),

    addIndicators: (chartId, indicators) => set((state) => {
        const currentIndicators = [...(state.chartIndicators[chartId] || [])];

        const newIndicators = indicators.map(ind => {
            const id = Math.random().toString(36).substring(7);
            const usedColors = currentIndicators.map(i => i.color.toLowerCase());

            let assignedColor = ind.color;
            const isGenericColor = !ind.color || ind.color === '#ffffff' || ind.color === 'white';

            if (isGenericColor) {
                const availableColor = INDICATOR_COLORS.find(c => !usedColors.includes(c.toLowerCase()));
                if (availableColor) {
                    assignedColor = availableColor;
                } else {
                    assignedColor = INDICATOR_COLORS[currentIndicators.length % INDICATOR_COLORS.length];
                }
            }

            const newInd = { ...ind, id, color: assignedColor } as IndicatorConfig;
            currentIndicators.push(newInd); // Push to track colors for the next one in the map loop
            return newInd;
        });

        return {
            chartIndicators: {
                ...state.chartIndicators,
                [chartId]: [...(state.chartIndicators[chartId] || []), ...newIndicators]
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
