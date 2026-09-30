import { RootState } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import type { StrategyState } from '@/features/strategy/store/strategy-store.types';
import type { PersistedSetupState } from './types';
import { sanitizeTabsForPersistence } from './tabs-utils';

export function measureJsonBytes(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function fitPersistedSetupStateToBudget(snapshot: PersistedSetupState): PersistedSetupState {
    // Preserve the complete user snapshot. The backend stores chartDrawings separately
    // and enforces explicit payload limits, so the client must never silently delete
    // indicators, alerts, strategies, watchlists, or other user-owned configuration.
    return snapshot;
}

export function pickPersistedSetupState(state: RootState, themeMode?: 'light' | 'dark' | 'system'): PersistedSetupState {
    const strategyState = useStrategyStore.getState();
    return {
        watchlist: state.watchlist,
        watchlistItems: state.watchlistItems,
        tabs: sanitizeTabsForPersistence(state.tabs),
        activeTabId: state.activeTabId,
        favoriteTimeframes: state.favoriteTimeframes,
        favoriteChartTypes: state.favoriteChartTypes,
        chartIndicators: state.chartIndicators,
        chartDrawings: state.chartDrawings,
        alerts: state.alerts,
        ui: {
            isLeftSidebarOpen: state.isLeftSidebarOpen,
            isRightSidebarOpen: state.isRightSidebarOpen,
            activeRightSidebarTab: state.activeRightSidebarTab,
            activeMobileTab: state.activeMobileTab,
            themeColor: state.themeColor,
            sidebarTopHeight: state.sidebarTopHeight,
            rightSidebarWidth: state.rightSidebarWidth,
            rightSidebarTabOrder: state.rightSidebarTabOrder,
            isDrawingToolbarVisible: state.isDrawingToolbarVisible,
            snapToCandle: state.snapToCandle,
            isChartLegendVisible: state.isChartLegendVisible,
            isCrosshairSyncEnabled: state.isCrosshairSyncEnabled,
            strategyPanelView: state.strategyPanelView,
            strategyEditingStrategyId: state.strategyEditingStrategyId,
            strategyBuilderDraft: state.strategyBuilderDraft,
            signalHistoryRange: state.signalHistoryRange,
            marketListSearchQuery: state.marketListSearchQuery,
            marketListSourceTab: state.marketListSourceTab,
            themeMode,
        },
        terminal: {
            isTerminalVisible: state.isTerminalVisible,
            isTerminalCollapsed: state.isTerminalCollapsed,
            terminalHeight: state.terminalHeight,
            orderForm: state.orderForm,
        },
        strategy: {
            strategies: strategyState.strategies,
            signals: strategyState.signals,
            virtualPositions: strategyState.virtualPositions,
            virtualBalance: strategyState.virtualBalance,
            initialVirtualBalance: strategyState.initialVirtualBalance,
            lastBacktestPnL: strategyState.lastBacktestPnL,
            backtestCount: strategyState.backtestCount,
            matrixScanners: strategyState.matrixScanners,
            focusedMatrixScannerId: strategyState.focusedMatrixScannerId,
            scopedLastSignalTimes: strategyState.scopedLastSignalTimes,
            showHistoryMarkers: strategyState.showHistoryMarkers,
            lastResetTime: strategyState.lastResetTime,
        },
    };
}

export function selectPersistableMarketState(state: RootState) {
    return {
        watchlist: state.watchlist,
        watchlistItems: state.watchlistItems,
        tabs: sanitizeTabsForPersistence(state.tabs),
        activeTabId: state.activeTabId,
        favoriteTimeframes: state.favoriteTimeframes,
        favoriteChartTypes: state.favoriteChartTypes,
        chartIndicators: state.chartIndicators,
        chartDrawings: state.chartDrawings,
        alerts: state.alerts,
        isLeftSidebarOpen: state.isLeftSidebarOpen,
        isRightSidebarOpen: state.isRightSidebarOpen,
        activeRightSidebarTab: state.activeRightSidebarTab,
        activeMobileTab: state.activeMobileTab,
        themeColor: state.themeColor,
        sidebarTopHeight: state.sidebarTopHeight,
        rightSidebarWidth: state.rightSidebarWidth,
        rightSidebarTabOrder: state.rightSidebarTabOrder,
        isDrawingToolbarVisible: state.isDrawingToolbarVisible,
        snapToCandle: state.snapToCandle,
        isChartLegendVisible: state.isChartLegendVisible,
        isCrosshairSyncEnabled: state.isCrosshairSyncEnabled,
        strategyPanelView: state.strategyPanelView,
        strategyEditingStrategyId: state.strategyEditingStrategyId,
        strategyBuilderDraft: state.strategyBuilderDraft,
        signalHistoryRange: state.signalHistoryRange,
        marketListSearchQuery: state.marketListSearchQuery,
        marketListSourceTab: state.marketListSourceTab,
        isTerminalVisible: state.isTerminalVisible,
        isTerminalCollapsed: state.isTerminalCollapsed,
        terminalHeight: state.terminalHeight,
        orderForm: state.orderForm,
    };
}

export function selectPersistableStrategyState(state: StrategyState) {
    return {
        strategies: state.strategies,
        signals: state.signals,
        virtualPositions: state.virtualPositions,
        virtualBalance: state.virtualBalance,
        initialVirtualBalance: state.initialVirtualBalance,
        lastBacktestPnL: state.lastBacktestPnL,
        backtestCount: state.backtestCount,
        matrixScanners: state.matrixScanners,
        focusedMatrixScannerId: state.focusedMatrixScannerId,
        scopedLastSignalTimes: state.scopedLastSignalTimes,
        showHistoryMarkers: state.showHistoryMarkers,
        lastResetTime: state.lastResetTime,
    };
}
