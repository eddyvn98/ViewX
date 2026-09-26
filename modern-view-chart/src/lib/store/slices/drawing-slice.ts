import { StateCreator } from 'zustand';
import { RootState } from '../index';
import { DrawingConfig, DrawingTool } from '../types';
import { THEME_COLORS } from '@/lib/constants/colors';

export interface DrawingSlice {
    chartDrawings: Record<string, DrawingConfig[]>;
    activeDrawingId: string | null;
    currentDrawingTool: DrawingTool;

    // UI Interaction State
    isDrawing: boolean;
    tempPoints: { time: number; price: number }[];
    snapToCandle: boolean;
    selectedDrawingId: string | null;

    setSnapToCandle: (snap: boolean) => void;
    setSelectedDrawing: (id: string | null) => void;

    setDrawingTool: (tool: DrawingTool) => void;
    addDrawing: (chartId: string, drawing: Omit<DrawingConfig, 'id'>) => void;
    removeDrawing: (chartId: string, drawingId: string) => void;
    updateDrawing: (chartId: string, drawingId: string, updates: Partial<DrawingConfig>) => void;
    toggleDrawingVisibility: (chartId: string, drawingId: string) => void;
    toggleAllDrawingVisibility: (chartId: string, visible: boolean) => void;
    toggleAllDrawingLock: (chartId: string, locked: boolean) => void;
    clearDrawings: (chartId: string) => void;

    // Interaction actions
    startDrawing: (tool: DrawingTool) => void;
    addDrawingPoint: (point: { time: number; price: number }) => void;
    cancelDrawing: () => void;
    finishDrawing: (chartId: string, context?: { symbol?: string; interval?: string; source?: 'BINANCE' | 'MT5' | 'VN_GOLD' }) => void;
}

export const createDrawingSlice: StateCreator<RootState, [], [], DrawingSlice> = (set, get) => ({
    chartDrawings: {},
    activeDrawingId: null,
    currentDrawingTool: 'none',
    isDrawing: false,
    tempPoints: [],
    snapToCandle: true,
    selectedDrawingId: null,

    setSnapToCandle: (snap) => set({ snapToCandle: snap }),
    setSelectedDrawing: (id) => set({ selectedDrawingId: id }),

    setDrawingTool: (tool) => set({ currentDrawingTool: tool }),

    addDrawing: (chartId, drawing) => set((state) => {
        const id = Math.random().toString(36).substring(7);
        const newDrawing = { ...drawing, id } as DrawingConfig;
        const currentDrawings = state.chartDrawings[chartId] || [];
        return {
            chartDrawings: {
                ...state.chartDrawings,
                [chartId]: [...currentDrawings, newDrawing]
            }
        };
    }),

    removeDrawing: (chartId, drawingId) => set((state) => {
        const currentDrawings = state.chartDrawings[chartId] || [];
        return {
            chartDrawings: {
                ...state.chartDrawings,
                [chartId]: currentDrawings.filter(d => d.id !== drawingId)
            },
            activeDrawingId: state.activeDrawingId === drawingId ? null : state.activeDrawingId,
            selectedDrawingId: state.selectedDrawingId === drawingId ? null : state.selectedDrawingId
        };
    }),

    updateDrawing: (chartId, drawingId, updates) => set((state) => {
        const currentDrawings = state.chartDrawings[chartId] || [];
        return {
            chartDrawings: {
                ...state.chartDrawings,
                [chartId]: currentDrawings.map(d => d.id === drawingId ? { ...d, ...updates } : d)
            }
        };
    }),

    toggleDrawingVisibility: (chartId, drawingId) => set((state) => {
        const currentDrawings = state.chartDrawings[chartId] || [];
        return {
            chartDrawings: {
                ...state.chartDrawings,
                [chartId]: currentDrawings.map(d => d.id === drawingId ? { ...d, visible: !d.visible } : d)
            }
        };
    }),

    toggleAllDrawingVisibility: (chartId, visible) => set((state) => {
        const currentDrawings = state.chartDrawings[chartId] || [];
        return {
            chartDrawings: {
                ...state.chartDrawings,
                [chartId]: currentDrawings.map(d => ({ ...d, visible }))
            }
        };
    }),

    toggleAllDrawingLock: (chartId, locked) => set((state) => {
        const currentDrawings = state.chartDrawings[chartId] || [];
        return {
            chartDrawings: {
                ...state.chartDrawings,
                [chartId]: currentDrawings.map(d => ({ ...d, locked }))
            }
        };
    }),

    clearDrawings: (chartId) => set((state) => ({
        chartDrawings: {
            ...state.chartDrawings,
            [chartId]: []
        },
        activeDrawingId: null,
        selectedDrawingId: null,
        isDrawing: false,
        currentDrawingTool: 'none',
        tempPoints: []
    })),

    startDrawing: (tool) => set({
        currentDrawingTool: tool,
        isDrawing: true,
        tempPoints: [],
        selectedDrawingId: null // Clear selection when starting new drawing
    }),

    addDrawingPoint: (point) => set((state) => ({
        tempPoints: [...state.tempPoints, point]
    })),

    cancelDrawing: () => set({
        isDrawing: false,
        currentDrawingTool: 'none',
        tempPoints: []
    }),

    finishDrawing: (chartId, context) => {
        const { currentDrawingTool, tempPoints, addDrawing } = get();
        if (currentDrawingTool !== 'none' && tempPoints.length > 0) {
            // Default enabled levels as requested: 1, 0.618, 0.5, 0.382
            const defaultLevels = {
                "1": true,
                "0.618": true,
                "0.5": true,
                "0.382": true,
                "0": true, // Always include 0 for base
                "0.236": false,
                "0.786": false,
                "1.618": false,
                "2.618": false
            };

            const themeColor = get().themeColor;
            const defaultColor = THEME_COLORS[themeColor] || '#2962FF';

            addDrawing(chartId, {
                type: currentDrawingTool,
                points: tempPoints,
                symbol: context?.symbol,
                interval: context?.interval,
                source: context?.source,
                color: defaultColor,
                visible: true,
                lineWidth: 1,
                lineStyle: 'dashed',
                params: { enabledLevels: defaultLevels }
            });
        }
        set({ isDrawing: false, currentDrawingTool: 'none', tempPoints: [] });
    }
});
