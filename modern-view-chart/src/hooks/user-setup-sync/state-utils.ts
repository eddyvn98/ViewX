import { RootState } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import type { StrategyState } from '@/features/strategy/store/strategy-store.types';
import { USER_STATE_TARGET_BYTES } from './constants';
import type { PersistedSetupState } from './types';
import { sanitizeTabsForPersistence } from './tabs-utils';
import { trimDrawings, trimStrategyState } from './strategy-utils';

export function measureJsonBytes(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function fitPersistedSetupStateToBudget(snapshot: PersistedSetupState): PersistedSetupState {
    if (measureJsonBytes(snapshot) <= USER_STATE_TARGET_BYTES) return snapshot;

    const compact: PersistedSetupState = {
        ...snapshot,
        alerts: snapshot.alerts.slice(-100),
        chartDrawings: trimDrawings(snapshot.chartDrawings),
        strategy: trimStrategyState(snapshot.strategy, false),
    };
    if (measureJsonBytes(compact) <= USER_STATE_TARGET_BYTES) return compact;

    const aggressive: PersistedSetupState = {
        ...compact,
        alerts: compact.alerts.slice(-50),
        chartDrawings: {},
        strategy: trimStrategyState(compact.strategy, true),
    };
    if (measureJsonBytes(aggressive) <= USER_STATE_TARGET_BYTES) return aggressive;

    const lastResort = {
        ...aggressive,
        strategy: {
            ...aggressive.strategy,
            signals: [],
            virtualPositions: aggressive.strategy.virtualPositions.filter((position) => position.status !== 'closed'),
            matrixScanners: aggressive.strategy.matrixScanners.slice(0, 2),
            scopedLastSignalTimes: {},
        },
    };
    if (measureJsonBytes(lastResort) <= USER_STATE_TARGET_BYTES) return lastResort;

    return {
        ...lastResort,
        chartIndicators: {},
        alerts: [],
        strategy: {
            ...lastResort.strategy,
            strategies: [],
            virtualPositions: [],
            matrixScanners: [],
            focusedMatrixScannerId: null,
            showHistoryMarkers: true,
        },
    };
}

export function pickPersistedSetupState(state: RootState, themeMode?: 'light' | 'dark' | 'system'): PersistedSetupState {
    const strategyState = useStrategyStore.getState();
    return {
        watchlist: state.watchlist,
        tabs: sanitizeTabsForPersistence(state.tabs),
        activeTabId: state.activeTabId,
        favoriteTimeframes: state.favoriteTimeframes,
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
        tabs: sanitizeTabsForPersistence(state.tabs),
        activeTabId: state.activeTabId,
        favoriteTimeframes: state.favoriteTimeframes,
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
