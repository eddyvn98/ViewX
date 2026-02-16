import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createMarketSlice, MarketSlice } from './slices/market-slice';
import { createTabSlice, TabSlice } from './slices/tab-slice';
import { createChartSlice, ChartSlice } from './slices/chart-slice';
import { createDataSlice, DataSlice } from './slices/data-slice';
import { createTerminalSlice, TerminalSlice } from './slices/terminal-slice';
import { createUISlice, UISlice } from './slices/ui-slice';
import { createIndicatorSlice, IndicatorSlice } from './slices/indicator-slice';
import { createAlertSlice, AlertSlice } from './slices/alert-slice'; // Import
import { createDrawingSlice, DrawingSlice } from './slices/drawing-slice';

// Re-export types for convenience
export * from './types';

export type RootState = MarketSlice & TabSlice & ChartSlice & DataSlice & TerminalSlice & UISlice & IndicatorSlice & AlertSlice & DrawingSlice;

export const useMarketStore = create<RootState>()(
    subscribeWithSelector((...a) => ({
        ...createMarketSlice(...a),
        ...createTabSlice(...a),
        ...createChartSlice(...a),
        ...createDataSlice(...a),
        ...createTerminalSlice(...a),
        ...createUISlice(...a),
        ...createIndicatorSlice(...a),
        ...createAlertSlice(...a),
        ...createDrawingSlice(...a),
    }))
);

