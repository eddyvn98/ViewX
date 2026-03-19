import { RootState } from '@/lib/store';
import { RightSidebarTab } from '@/lib/store/types';
import type { StrategyState } from '@/features/strategy/store/strategy-store.types';

export type PersistedUiState = {
    isLeftSidebarOpen: boolean;
    isRightSidebarOpen: boolean;
    activeRightSidebarTab: RightSidebarTab;
    activeMobileTab: string;
    themeColor: RootState['themeColor'];
    sidebarTopHeight: number;
    rightSidebarWidth: number;
    rightSidebarTabOrder: string[];
    isDrawingToolbarVisible: boolean;
    snapToCandle: boolean;
    isChartLegendVisible: boolean;
    strategyPanelView: RootState['strategyPanelView'];
    strategyEditingStrategyId: RootState['strategyEditingStrategyId'];
    strategyBuilderDraft: RootState['strategyBuilderDraft'];
    signalHistoryRange: RootState['signalHistoryRange'];
    marketListSearchQuery: RootState['marketListSearchQuery'];
    marketListSourceTab: RootState['marketListSourceTab'];
    themeMode?: 'light' | 'dark' | 'system';
};

export type PersistedTerminalState = {
    isTerminalVisible: boolean;
    isTerminalCollapsed: boolean;
    terminalHeight: number;
    orderForm: RootState['orderForm'];
};

export type PersistedStrategyState = Pick<
    StrategyState,
    | 'strategies'
    | 'signals'
    | 'virtualPositions'
    | 'virtualBalance'
    | 'initialVirtualBalance'
    | 'lastBacktestPnL'
    | 'backtestCount'
    | 'matrixScanners'
    | 'focusedMatrixScannerId'
    | 'scopedLastSignalTimes'
    | 'showHistoryMarkers'
    | 'lastResetTime'
>;

export type PersistedSetupState = {
    watchlist: RootState['watchlist'];
    tabs: RootState['tabs'];
    activeTabId: RootState['activeTabId'];
    favoriteTimeframes: RootState['favoriteTimeframes'];
    chartIndicators: RootState['chartIndicators'];
    chartDrawings: RootState['chartDrawings'];
    alerts: RootState['alerts'];
    ui: PersistedUiState;
    terminal: PersistedTerminalState;
    strategy: PersistedStrategyState;
};

export type UserStateApiResponse = {
    state?: Partial<PersistedSetupState>;
    updated_at?: string | null;
    client_updated_at?: string | null;
    revision?: number;
    message?: string;
};

export type UserSetupSyncMessage = {
    type: 'USER_SETUP_STATE_SYNC';
    sourceId: string;
    state: PersistedSetupState;
    serialized: string;
};

export type UserSetupSyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export type ApplyPersistedSetupStateOptions = {
    includeTabs?: boolean;
};
