import { RootState } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import type { StrategyState } from '@/features/strategy/store/strategy-store.types';
import { USER_STATE_TARGET_BYTES } from './constants';
import type { PersistedSetupState } from './types';
import { sanitizeTabsForPersistence } from './tabs-utils';
import { trimStrategyState } from './strategy-utils';

export function measureJsonBytes(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function fitPersistedSetupStateToBudget(snapshot: PersistedSetupState): PersistedSetupState {
    if (measureJsonBytes(snapshot) <= USER_STATE_TARGET_BYTES) return snapshot;

    // Never trim chartDrawings here to avoid silently dropping user drawings.
    // Prefer reducing high-churn strategy/alert payloads first.
    const compact: PersistedSetupState = {
        ...snapshot,
        alerts: snapshot.alerts.slice(-100),
        strategy: trimStrategyState(snapshot.strategy, false),
    };
    if (measureJsonBytes(compact) <= USER_STATE_TARGET_BYTES) return compact;

    const aggressive: PersistedSetupState = {
        ...compact,
        alerts: compact.alerts.slice(-20),
        strategy: trimStrategyState(compact.strategy, true),
    };
    if (measureJsonBytes(aggressive) <= USER_STATE_TARGET_BYTES) return aggressive;

    const keepDrawingsLastResort: PersistedSetupState = {
        ...aggressive,
        chartIndicators: {},
        watchlist: aggressive.watchlist.slice(0, 30),
        watchlistItems: aggressive.watchlistItems.slice(0, 30),
        favoriteTimeframes: aggressive.favoriteTimeframes.slice(0, 12),
        favoriteChartTypes: aggressive.favoriteChartTypes.slice(0, 3),
        alerts: [],
        strategy: {
            ...aggressive.strategy,
            strategies: [],
            signals: [],
            virtualPositions: aggressive.strategy.virtualPositions.filter((position) => position.status !== 'closed'),
            matrixScanners: [],
            focusedMatrixScannerId: null,
            scopedLastSignalTimes: {},
        },
    };
    if (measureJsonBytes(keepDrawingsLastResort) <= USER_STATE_TARGET_BYTES) return keepDrawingsLastResort;

    // If still over budget, keep drawings intact and return the smallest snapshot we can
    // without deleting them. Backend may still reject oversized payloads; this avoids data loss.
    return {
        ...keepDrawingsLastResort,
        strategy: {
            ...keepDrawingsLastResort.strategy,
            signals: [],
            virtualPositions: [],
            scopedLastSignalTimes: {},
        },
    };
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
