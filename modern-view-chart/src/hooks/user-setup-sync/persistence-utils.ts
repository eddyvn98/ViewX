import { RootState, useMarketStore } from '@/lib/store';
import type { MarketDataSource, SymbolDescriptor } from '@/lib/store/types';
import { createLegacySymbolDescriptor } from '@/lib/market/symbol-catalog';
import { migrateStrategyStoreState } from '@/features/strategy/store/strategy-store.migrations';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import type {
    ApplyPersistedSetupStateOptions,
    PersistedSetupState,
    PersistedStrategyState,
    PersistedTerminalState,
    PersistedUiState,
} from './types';
import {
    createFallbackTabs,
    isPlainObject,
    remapRemoteDrawingsToLocalCharts,
    remapRemoteIndicatorsToLocalCharts,
    sanitizeTabsInput,
} from './tabs-utils';
import {
    fitPersistedSetupStateToBudget,
    pickPersistedSetupState,
    selectPersistableMarketState,
    selectPersistableStrategyState,
} from './state-utils';
import { mergePersistedStrategyState } from './strategy-utils';


const VALID_SYMBOL_SOURCES = new Set<MarketDataSource>(['BINANCE', 'MT5', 'MT5_PERSONAL', 'VN_GOLD']);

function sanitizePersistedWatchlistItems(value: unknown, legacyWatchlist: string[]): SymbolDescriptor[] {
    if (!Array.isArray(value)) return legacyWatchlist.map(createLegacySymbolDescriptor);

    const items = value.flatMap((entry): SymbolDescriptor[] => {
        if (!entry || typeof entry !== 'object') return [];
        const raw = entry as Record<string, unknown>;
        const symbol = String(raw.symbol || '').trim();
        const source = String(raw.source || '').trim().toUpperCase() as MarketDataSource;
        if (!symbol || !VALID_SYMBOL_SOURCES.has(source)) return [];
        const optional = (input: unknown) => {
            const text = String(input || '').trim();
            return text || null;
        };
        const digits = Number(raw.digits);
        return [{
            symbol,
            source,
            accountLogin: optional(raw.accountLogin ?? raw.account_login),
            terminalId: optional(raw.terminalId ?? raw.terminal_id),
            broker: optional(raw.broker),
            description: optional(raw.description) || undefined,
            path: optional(raw.path) || undefined,
            digits: Number.isFinite(digits) ? digits : undefined,
            type: optional(raw.type) || undefined,
        }];
    });

    return items.length > 0 ? items : legacyWatchlist.map(createLegacySymbolDescriptor);
}

function getPersistedUiState(state: Partial<PersistedSetupState> | undefined): Partial<PersistedUiState> | null {
    if (!state || !isPlainObject(state.ui)) return null;
    return state.ui as Partial<PersistedUiState>;
}

function applyPersistedSetupState(
    persisted: Partial<PersistedSetupState>,
    options: ApplyPersistedSetupStateOptions = {},
) {
    if (!isPlainObject(persisted)) return;
    const includeTabs = options.includeTabs ?? true;

    useMarketStore.setState((prev) => {
        const next: Partial<RootState> = {};

        const persistedWatchlist = Array.isArray(persisted.watchlist)
            ? persisted.watchlist.filter((s): s is string => typeof s === 'string')
            : prev.watchlist;
        if (Array.isArray(persisted.watchlist)) next.watchlist = persistedWatchlist;
        if (Array.isArray(persisted.watchlistItems) || Array.isArray(persisted.watchlist)) {
            next.watchlistItems = sanitizePersistedWatchlistItems(persisted.watchlistItems, persistedWatchlist);
        }
        if (Array.isArray(persisted.favoriteTimeframes)) {
            next.favoriteTimeframes = persisted.favoriteTimeframes.filter((s): s is string => typeof s === 'string');
        }
        if (Array.isArray((persisted as Partial<RootState>).favoriteChartTypes)) {
            next.favoriteChartTypes = (persisted as Partial<RootState>).favoriteChartTypes?.filter(
                (s): s is 'candles' | 'heikin_ashi' | 'smart_candles' =>
                    s === 'candles' || s === 'heikin_ashi' || s === 'smart_candles'
            ) || ['candles', 'heikin_ashi', 'smart_candles'];
        }
        if (Array.isArray(persisted.alerts)) next.alerts = persisted.alerts;

        if (includeTabs) {
            const sanitizedTabs = sanitizeTabsInput(persisted.tabs);
            if (sanitizedTabs) {
                next.tabs = sanitizedTabs;
                if (typeof persisted.activeTabId === 'string' && sanitizedTabs[persisted.activeTabId]) {
                    next.activeTabId = persisted.activeTabId;
                } else {
                    next.activeTabId = Object.keys(sanitizedTabs)[0];
                }
            } else if (isPlainObject(persisted.tabs)) {
                const fallbackTabs = createFallbackTabs();
                next.tabs = fallbackTabs;
                next.activeTabId = 'default-tab';
            } else if (typeof persisted.activeTabId === 'string' && (next.tabs || prev.tabs)[persisted.activeTabId]) {
                next.activeTabId = persisted.activeTabId;
            }
        }

        if (isPlainObject(persisted.chartIndicators)) {
            if (includeTabs) {
                next.chartIndicators = persisted.chartIndicators as RootState['chartIndicators'];
            } else {
                // Local tabs are being kept as-is (e.g. periodic poll / cross-tab broadcast merge),
                // so remote chart ids may not match local ones. Remap by (symbol, interval, source)
                // context the same way chartDrawings does below, instead of blindly overwriting by id
                // and silently orphaning indicators added on this session (e.g. SuperTrend disappearing).
                const mapped = remapRemoteIndicatorsToLocalCharts(
                    persisted.chartIndicators,
                    persisted.tabs,
                    next.tabs || prev.tabs,
                );
                if (mapped && Object.keys(mapped).length > 0) {
                    next.chartIndicators = mapped;
                }
            }
        }
        if (isPlainObject(persisted.chartDrawings)) {
            if (includeTabs) {
                next.chartDrawings = persisted.chartDrawings as RootState['chartDrawings'];
            } else {
                const mapped = remapRemoteDrawingsToLocalCharts(
                    persisted.chartDrawings,
                    persisted.tabs,
                    next.tabs || prev.tabs,
                );
                if (mapped && Object.keys(mapped).length > 0) {
                    next.chartDrawings = mapped;
                }
            }
        }

        if (isPlainObject(persisted.ui)) {
            const ui = persisted.ui as Partial<PersistedUiState>;
            if (typeof ui.isLeftSidebarOpen === 'boolean') next.isLeftSidebarOpen = ui.isLeftSidebarOpen;
            if (typeof ui.isRightSidebarOpen === 'boolean') next.isRightSidebarOpen = ui.isRightSidebarOpen;
            if (typeof ui.activeMobileTab === 'string') next.activeMobileTab = ui.activeMobileTab;
            if (typeof ui.sidebarTopHeight === 'number') next.sidebarTopHeight = ui.sidebarTopHeight;
            if (typeof ui.rightSidebarWidth === 'number') next.rightSidebarWidth = ui.rightSidebarWidth;
            if (Array.isArray(ui.rightSidebarTabOrder)) {
                next.rightSidebarTabOrder = ui.rightSidebarTabOrder.filter((s): s is string => typeof s === 'string');
            }
            if (typeof ui.isDrawingToolbarVisible === 'boolean') next.isDrawingToolbarVisible = ui.isDrawingToolbarVisible;
            if (typeof ui.snapToCandle === 'boolean') next.snapToCandle = ui.snapToCandle;
            if (typeof ui.isChartLegendVisible === 'boolean') next.isChartLegendVisible = ui.isChartLegendVisible;
            if (typeof ui.isCrosshairSyncEnabled === 'boolean') next.isCrosshairSyncEnabled = ui.isCrosshairSyncEnabled;
            if (
                ui.strategyPanelView === 'build' ||
                ui.strategyPanelView === 'list' ||
                ui.strategyPanelView === 'signals' ||
                ui.strategyPanelView === 'ai_chat'
            ) {
                next.strategyPanelView = ui.strategyPanelView;
            }
            if (typeof ui.strategyEditingStrategyId === 'string' || ui.strategyEditingStrategyId === null) {
                next.strategyEditingStrategyId = ui.strategyEditingStrategyId;
            }
            if (isPlainObject(ui.strategyBuilderDraft)) {
                next.strategyBuilderDraft = ui.strategyBuilderDraft as RootState['strategyBuilderDraft'];
            } else if (ui.strategyBuilderDraft === null) {
                next.strategyBuilderDraft = null;
            }
            if (ui.signalHistoryRange === 'day' || ui.signalHistoryRange === 'week' || ui.signalHistoryRange === 'month') {
                next.signalHistoryRange = ui.signalHistoryRange;
            }
            if (typeof ui.marketListSearchQuery === 'string') next.marketListSearchQuery = ui.marketListSearchQuery;
            if (ui.marketListSourceTab === 'ALL' || ui.marketListSourceTab === 'BINANCE' || ui.marketListSourceTab === 'MT5' || ui.marketListSourceTab === 'VN_GOLD') {
                next.marketListSourceTab = ui.marketListSourceTab;
            }
            if (
                ui.activeRightSidebarTab === 'market' ||
                ui.activeRightSidebarTab === 'layer' ||
                ui.activeRightSidebarTab === 'strategy' ||
                ui.activeRightSidebarTab === 'trade'
            ) {
                next.activeRightSidebarTab = ui.activeRightSidebarTab;
            }
            if (ui.themeColor === 'blue' || ui.themeColor === 'green' || ui.themeColor === 'amber' || ui.themeColor === 'red' || ui.themeColor === 'slate') {
                next.themeColor = ui.themeColor;
            }
        }

        if (isPlainObject(persisted.terminal)) {
            const terminal = persisted.terminal as Partial<PersistedTerminalState>;
            if (typeof terminal.isTerminalVisible === 'boolean') next.isTerminalVisible = terminal.isTerminalVisible;
            if (typeof terminal.isTerminalCollapsed === 'boolean') next.isTerminalCollapsed = terminal.isTerminalCollapsed;
            if (typeof terminal.terminalHeight === 'number') next.terminalHeight = terminal.terminalHeight;
            if (isPlainObject(terminal.orderForm)) {
                next.orderForm = {
                    orderType: terminal.orderForm.orderType === 'pending' ? 'pending' : 'market',
                    side: terminal.orderForm.side === 'sell' ? 'sell' : 'buy',
                    volume: typeof terminal.orderForm.volume === 'string' ? terminal.orderForm.volume : '0.1',
                    sl: typeof terminal.orderForm.sl === 'string' ? terminal.orderForm.sl : '',
                    tp: typeof terminal.orderForm.tp === 'string' ? terminal.orderForm.tp : '',
                };
            }
        }

        return Object.keys(next).length > 0 ? next : prev;
    });

    if (isPlainObject(persisted.strategy)) {
        const migrated = migrateStrategyStoreState(persisted.strategy, 6) as Partial<PersistedStrategyState>;
        useStrategyStore.setState((prev) => mergePersistedStrategyState(prev, migrated));
    }
}

export {
    applyPersistedSetupState,
    fitPersistedSetupStateToBudget,
    getPersistedUiState,
    pickPersistedSetupState,
    selectPersistableMarketState,
    selectPersistableStrategyState,
    isPlainObject,
};
