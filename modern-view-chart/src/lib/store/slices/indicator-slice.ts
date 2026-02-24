import { StateCreator } from 'zustand';
import { RootState } from '../index';
import { IndicatorConfig } from '../types';
import { INDICATOR_REGISTRY } from '../../../features/chart/indicators/registry';

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

        // Get Metadata for default styles
        const metadata = INDICATOR_REGISTRY[indicator.type as keyof typeof INDICATOR_REGISTRY];
        const defaultStyles: Record<string, any> = {};
        if (metadata) {
            Object.keys(metadata.styles).forEach(key => {
                defaultStyles[key] = metadata.styles[key].default;
            });
        }

        // Merge with provided styles if any
        const styles = { ...defaultStyles, ...(indicator.styles || {}) };

        // Smart Color Selection (Legacy support)
        const usedColors = currentIndicators.map(ind => ind.color.toLowerCase());
        let assignedColor = indicator.color;
        const isGenericColor = !indicator.color || indicator.color === '#ffffff' || indicator.color === 'white';

        if (isGenericColor) {
            const availableColor = INDICATOR_COLORS.find(c => !usedColors.includes(c.toLowerCase()));
            assignedColor = availableColor || INDICATOR_COLORS[currentIndicators.length % INDICATOR_COLORS.length];
        }

        // Apply primary color to main style if it's a simple indicator
        if (styles.line && isGenericColor) {
            styles.line = assignedColor;
        }

        const newIndicator: IndicatorConfig = {
            ...indicator,
            id,
            color: assignedColor,
            styles
        };

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

            // Get Metadata for default styles
            const metadata = INDICATOR_REGISTRY[ind.type as keyof typeof INDICATOR_REGISTRY];
            const defaultStyles: Record<string, any> = {};
            if (metadata) {
                Object.keys(metadata.styles).forEach(key => {
                    defaultStyles[key] = metadata.styles[key].default;
                });
            }
            const styles = { ...defaultStyles, ...(ind.styles || {}) };

            const usedColors = currentIndicators.map(i => i.color.toLowerCase());
            let assignedColor = ind.color;
            const isGenericColor = !ind.color || ind.color === '#ffffff' || ind.color === 'white';

            if (isGenericColor) {
                const availableColor = INDICATOR_COLORS.find(c => !usedColors.includes(c.toLowerCase()));
                assignedColor = availableColor || INDICATOR_COLORS[currentIndicators.length % INDICATOR_COLORS.length];
            }

            if (styles.line && isGenericColor) {
                styles.line = assignedColor;
            }

            const newInd: IndicatorConfig = { ...ind, id, color: assignedColor, styles };
            currentIndicators.push(newInd);
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
