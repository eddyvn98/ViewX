'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RootState, useMarketStore } from '@/lib/store';
import { RightSidebarTab } from '@/lib/store/types';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { migrateStrategyStoreState } from '@/features/strategy/store/strategy-store.migrations';
import type { StrategyState } from '@/features/strategy/store/strategy-store.types';
import type { TradeContext } from '@/features/strategy/types';
import { useTheme } from 'next-themes';
import { shallow } from 'zustand/shallow';

const USER_STATE_SCHEMA_VERSION = 1;
const SAVE_DEBOUNCE_MS = 1500;
const MIN_SAVE_INTERVAL_MS = 5000;
const FALLBACK_SAVE_INTERVAL_MS = 15000;
const RATE_LIMIT_BACKOFF_MS = 30000;
const PUBLIC_STATE_SAVE_PAUSE_MS = 60000;
const USER_STATE_TARGET_BYTES = 220 * 1024;
const CLIENT_ID_STORAGE_KEY = 'vivutrade-client-id';
const LEGACY_CLIENT_ID_STORAGE_KEY = 'viewx-client-id';

type PersistedUiState = {
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

type PersistedTerminalState = {
    isTerminalVisible: boolean;
    isTerminalCollapsed: boolean;
    terminalHeight: number;
    orderForm: RootState['orderForm'];
};

type PersistedStrategyState = Pick<
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

type PersistedSetupState = {
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

type UserStateApiResponse = {
    state?: Partial<PersistedSetupState>;
};

function stripViewportFromTabs(tabs: RootState['tabs']): RootState['tabs'] {
    const sanitizedTabs: RootState['tabs'] = {};

    for (const [tabId, tab] of Object.entries(tabs || {})) {
        const sanitizedCharts = Object.fromEntries(
            Object.entries(tab.charts || {}).map(([chartId, chart]) => [
                chartId,
                chart.viewport ? { ...chart, viewport: undefined } : chart,
            ]),
        );

        sanitizedTabs[tabId] = {
            ...tab,
            charts: sanitizedCharts,
        };
    }

    return sanitizedTabs;
}

function getPersistedUiState(state: Partial<PersistedSetupState> | undefined): Partial<PersistedUiState> | null {
    if (!state || !isPlainObject(state.ui)) return null;
    return state.ui as Partial<PersistedUiState>;
}

function createFallbackTabs(): RootState['tabs'] {
    return {
        'default-tab': {
            id: 'default-tab',
            name: 'Workspace 1',
            charts: {
                default: {
                    id: 'default',
                    symbol: 'XAUUSDm',
                    interval: '1',
                    source: 'MT5',
                    group: 'A',
                    chartType: 'smart_candles',
                    timezone: 'Asia/Ho_Chi_Minh',
                },
            },
            activeChartId: 'default',
            maximizedChartId: null,
            layoutMode: '1x1',
            rows: 1,
            cols: 1,
        },
    };
}

function sanitizeTabsInput(input: unknown): RootState['tabs'] | null {
    if (!isPlainObject(input)) return null;

    const tabEntries = Object.entries(input).filter(([, tab]) => isPlainObject(tab));
    if (tabEntries.length === 0) return null;

    const safeTabs: RootState['tabs'] = {};

    for (const [tabId, rawTab] of tabEntries) {
        const tab = rawTab as Record<string, unknown>;
        const rawCharts = isPlainObject(tab.charts) ? tab.charts : {};
        const chartEntries = Object.entries(rawCharts).filter(([, chart]) => isPlainObject(chart));
        if (chartEntries.length === 0) continue;

        const safeCharts: RootState['tabs'][string]['charts'] = {};
        for (const [chartId, rawChart] of chartEntries) {
            const chart = rawChart as Record<string, unknown>;
            const symbol = typeof chart.symbol === 'string' && chart.symbol.trim() ? chart.symbol : 'XAUUSDm';
            const interval = typeof chart.interval === 'string' && chart.interval.trim() ? chart.interval : '1';
            const source = chart.source === 'BINANCE' || chart.source === 'MT5' ? chart.source : 'MT5';
            const chartType = chart.chartType === 'candles' || chart.chartType === 'heikin_ashi' || chart.chartType === 'smart_candles'
                ? chart.chartType
                : 'smart_candles';
            safeCharts[chartId] = {
                ...chart,
                id: typeof chart.id === 'string' && chart.id.trim() ? chart.id : chartId,
                symbol,
                interval,
                source,
                chartType,
                timezone: typeof chart.timezone === 'string' ? chart.timezone : 'Asia/Ho_Chi_Minh',
            };
        }

        const safeChartIds = Object.keys(safeCharts);
        if (safeChartIds.length === 0) continue;

        const rawActiveChartId = typeof tab.activeChartId === 'string' ? tab.activeChartId : '';
        const activeChartId = safeCharts[rawActiveChartId] ? rawActiveChartId : safeChartIds[0];
        const rawRows = Number(tab.rows);
        const rawCols = Number(tab.cols);
        const rows = Number.isFinite(rawRows) && rawRows > 0 ? Math.floor(rawRows) : 1;
        const cols = Number.isFinite(rawCols) && rawCols > 0 ? Math.floor(rawCols) : 1;

        safeTabs[tabId] = {
            id: typeof tab.id === 'string' && tab.id.trim() ? tab.id : tabId,
            name: typeof tab.name === 'string' && tab.name.trim() ? tab.name : `Workspace ${Object.keys(safeTabs).length + 1}`,
            charts: safeCharts,
            activeChartId,
            maximizedChartId: typeof tab.maximizedChartId === 'string' && safeCharts[tab.maximizedChartId] ? tab.maximizedChartId : null,
            layoutMode: typeof tab.layoutMode === 'string' && tab.layoutMode.trim() ? tab.layoutMode : `${rows}x${cols}`,
            rows,
            cols,
        } as RootState['tabs'][string];
    }

    return Object.keys(safeTabs).length > 0 ? safeTabs : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function getOrCreateClientId(): string {
    if (typeof window === 'undefined') return 'public';
    const current = localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim() || '';
    if (current) return current;
    const legacy = localStorage.getItem(LEGACY_CLIENT_ID_STORAGE_KEY)?.trim() || '';
    if (legacy) {
        localStorage.setItem(CLIENT_ID_STORAGE_KEY, legacy);
        return legacy;
    }

    const generated =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
    return generated;
}

function buildApiUrl(clientId: string): string {
    const params = new URLSearchParams();
    if (clientId) params.set('client_id', clientId);

    const query = params.toString();
    return query ? `/api/user/state?${query}` : '/api/user/state';
}

function buildPublicApiUrl(clientId: string): string {
    const params = new URLSearchParams();
    if (clientId) params.set('client_id', clientId);

    const query = params.toString();
    return query ? `/api/user/state/public?${query}` : '/api/user/state/public';
}

function getAuthHeaders(clientId: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (clientId) headers['x-client-id'] = clientId;
    if (typeof window === 'undefined') return headers;
    const accessToken = (localStorage.getItem('auth_access_token') || '').trim();
    if (accessToken) {
        headers.authorization = `Bearer ${accessToken}`;
    }
    return headers;
}

function getAccessTokenValue(): string {
    if (typeof window === 'undefined') return '';
    return (localStorage.getItem('auth_access_token') || '').trim();
}

function parseRetryAfterMs(retryAfterHeader: string | null): number {
    const raw = (retryAfterHeader || '').trim();
    if (!raw) return RATE_LIMIT_BACKOFF_MS;

    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) {
        return seconds * 1000;
    }

    const retryAt = Date.parse(raw);
    if (Number.isFinite(retryAt)) {
        return Math.max(retryAt - Date.now(), RATE_LIMIT_BACKOFF_MS);
    }

    return RATE_LIMIT_BACKOFF_MS;
}

function measureJsonBytes(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).length;
}

function trimIndicatorsSnapshot(input: unknown, limit = 24): Record<string, unknown> {
    if (!isPlainObject(input)) return {};
    return Object.fromEntries(Object.entries(input).slice(0, limit));
}

function trimTradeContext(input: unknown): TradeContext | undefined {
    if (!isPlainObject(input)) return undefined;

    const next: Record<string, unknown> = { ...input };
    next.indicators_snapshot = trimIndicatorsSnapshot(input.indicators_snapshot);
    if (isPlainObject(input.post_exit)) {
        next.post_exit = Object.fromEntries(Object.entries(input.post_exit).slice(0, 12));
    }
    return next as unknown as TradeContext;
}

function trimDrawings(drawings: RootState['chartDrawings']): RootState['chartDrawings'] {
    const next: RootState['chartDrawings'] = {};
    for (const [chartId, items] of Object.entries(drawings || {})) {
        if (!Array.isArray(items)) continue;
        next[chartId] = items.slice(-50).map((drawing) => ({
            ...drawing,
            points: Array.isArray(drawing.points) ? drawing.points.slice(0, 12) : [],
            params: isPlainObject(drawing.params) ? Object.fromEntries(Object.entries(drawing.params).slice(0, 20)) : drawing.params,
        }));
    }
    return next;
}

function trimStrategyState(strategy: PersistedStrategyState, aggressive = false): PersistedStrategyState {
    const openPositions = strategy.virtualPositions.filter((position) => position.status !== 'closed');
    const closedPositions = strategy.virtualPositions.filter((position) => position.status === 'closed');
    const keptClosedPositions = aggressive ? [] : closedPositions.slice(0, 20);
    const keptSignals = aggressive ? [] : strategy.signals.slice(0, 20);
    const keptScopedLastSignalTimes = Object.fromEntries(
        Object.entries(strategy.scopedLastSignalTimes || {}).slice(0, aggressive ? 25 : 100),
    );

    return {
        ...strategy,
        signals: keptSignals.map((signal) => ({
            ...signal,
            aiAnalysis: signal.aiAnalysis
                ? {
                    confidence: signal.aiAnalysis.confidence,
                    riskLevel: signal.aiAnalysis.riskLevel,
                    reasoning: Array.isArray(signal.aiAnalysis.reasoning) ? signal.aiAnalysis.reasoning.slice(0, 3) : [],
                    suggestedFix: signal.aiAnalysis.suggestedFix,
                }
                : undefined,
            context: trimTradeContext(signal.context),
        })),
        virtualPositions: [...openPositions, ...keptClosedPositions].map((position) => ({
            ...position,
            metadata: trimTradeContext(position.metadata),
        })),
        matrixScanners: strategy.matrixScanners.slice(0, aggressive ? 4 : 12),
        scopedLastSignalTimes: keptScopedLastSignalTimes,
    };
}

function fitPersistedSetupStateToBudget(snapshot: PersistedSetupState): PersistedSetupState {
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

function pickPersistedSetupState(state: RootState, themeMode?: 'light' | 'dark' | 'system'): PersistedSetupState {
    const strategyState = useStrategyStore.getState();
    return {
        watchlist: state.watchlist,
        tabs: stripViewportFromTabs(state.tabs),
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

function selectPersistableMarketState(state: RootState) {
    return {
        watchlist: state.watchlist,
        tabs: stripViewportFromTabs(state.tabs),
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

function selectPersistableStrategyState(state: StrategyState) {
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

function applyPersistedSetupState(persisted: Partial<PersistedSetupState>) {
    if (!isPlainObject(persisted)) return;

    useMarketStore.setState((prev) => {
        const next: Partial<RootState> = {};

        if (Array.isArray(persisted.watchlist)) next.watchlist = persisted.watchlist.filter((s): s is string => typeof s === 'string');
        if (Array.isArray(persisted.favoriteTimeframes)) {
            next.favoriteTimeframes = persisted.favoriteTimeframes.filter((s): s is string => typeof s === 'string');
        }
        if (Array.isArray(persisted.alerts)) next.alerts = persisted.alerts;

        const sanitizedTabs = sanitizeTabsInput(persisted.tabs);
        if (sanitizedTabs) {
            next.tabs = sanitizedTabs;
            if (typeof persisted.activeTabId === 'string' && sanitizedTabs[persisted.activeTabId]) {
                next.activeTabId = persisted.activeTabId;
            } else {
                next.activeTabId = Object.keys(sanitizedTabs)[0];
            }
        } else if (isPlainObject(persisted.tabs)) {
            // Persisted tabs payload exists but is invalid/empty; keep app usable.
            const fallbackTabs = createFallbackTabs();
            next.tabs = fallbackTabs;
            next.activeTabId = 'default-tab';
        } else if (typeof persisted.activeTabId === 'string' && (next.tabs || prev.tabs)[persisted.activeTabId]) {
            next.activeTabId = persisted.activeTabId;
        }

        if (isPlainObject(persisted.chartIndicators)) {
            next.chartIndicators = persisted.chartIndicators as RootState['chartIndicators'];
        }
        if (isPlainObject(persisted.chartDrawings)) {
            next.chartDrawings = persisted.chartDrawings as RootState['chartDrawings'];
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
            if (ui.strategyPanelView === 'build' || ui.strategyPanelView === 'list' || ui.strategyPanelView === 'signals' || ui.strategyPanelView === 'ai_chat') {
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
            if (ui.marketListSourceTab === 'ALL' || ui.marketListSourceTab === 'BINANCE' || ui.marketListSourceTab === 'MT5') {
                next.marketListSourceTab = ui.marketListSourceTab;
            }
            if (ui.activeRightSidebarTab === 'market' || ui.activeRightSidebarTab === 'layer' || ui.activeRightSidebarTab === 'strategy' || ui.activeRightSidebarTab === 'trade') {
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
        useStrategyStore.setState((prev) => ({
            ...prev,
            ...migrated,
        }));
    }
}

export function useUserSetupSync() {
    const { theme, setTheme } = useTheme();
    const clientId = useMemo(() => (typeof window === 'undefined' ? 'public' : getOrCreateClientId()), []);
    const [authToken, setAuthToken] = useState<string>(() => getAccessTokenValue());
    const isAuthenticated = authToken.length > 0;
    const apiUrl = useMemo(() => {
        if (typeof window === 'undefined') return '/api/user/state';
        return isAuthenticated ? buildApiUrl(clientId) : buildPublicApiUrl(clientId);
    }, [clientId, isAuthenticated]);

    const isReadyRef = useRef(false);
    const hasInitializedRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastSavedRef = useRef('');
    const lastSaveAttemptAtRef = useRef(0);
    const pendingSaveRef = useRef<{ snapshot: PersistedSetupState; serialized: string } | null>(null);
    const retryAfterRef = useRef(0);
    const themeRef = useRef<'light' | 'dark' | 'system' | undefined>(undefined);
    const setThemeRef = useRef(setTheme);

    useEffect(() => {
        themeRef.current = (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : undefined;
    }, [theme]);

    useEffect(() => {
        setThemeRef.current = setTheme;
    }, [setTheme]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const syncAuthToken = () => {
            const nextToken = getAccessTokenValue();
            setAuthToken((prev) => (prev === nextToken ? prev : nextToken));
        };

        syncAuthToken();
        window.addEventListener('storage', syncAuthToken);
        window.addEventListener('focus', syncAuthToken);
        window.addEventListener('auth-state-changed', syncAuthToken as EventListener);

        return () => {
            window.removeEventListener('storage', syncAuthToken);
            window.removeEventListener('focus', syncAuthToken);
            window.removeEventListener('auth-state-changed', syncAuthToken as EventListener);
        };
    }, []);

    useEffect(() => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        let isDisposed = false;

        const buildSnapshot = () => {
            const snapshot = pickPersistedSetupState(useMarketStore.getState(), themeRef.current);
            return fitPersistedSetupStateToBudget(snapshot);
        };

        const saveState = async (snapshot: PersistedSetupState, serialized: string) => {
            if (Date.now() < retryAfterRef.current) return false;
            lastSaveAttemptAtRef.current = Date.now();
            try {
                const response = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders(clientId),
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        schema_version: USER_STATE_SCHEMA_VERSION,
                        state: snapshot,
                    }),
                });

                if (response.ok || response.status === 202) {
                    lastSavedRef.current = serialized;
                    retryAfterRef.current = response.status === 202 && !isAuthenticated
                        ? Date.now() + PUBLIC_STATE_SAVE_PAUSE_MS
                        : 0;
                    return true;
                }

                if (response.status === 429) {
                    retryAfterRef.current = Date.now() + parseRetryAfterMs(response.headers.get('retry-after'));
                }
            } catch {
                // Keep silent and retry on next user change.
            }
            return false;
        };

        const flushSave = async () => {
            const pending = pendingSaveRef.current;
            if (!pending || !isReadyRef.current) return;

            const now = Date.now();
            const waitForRateLimit = Math.max(0, retryAfterRef.current - now);
            const waitForMinInterval = Math.max(0, MIN_SAVE_INTERVAL_MS - (now - lastSaveAttemptAtRef.current));
            const delay = Math.max(waitForRateLimit, waitForMinInterval);

            if (delay > 0) {
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                saveTimerRef.current = setTimeout(() => {
                    void flushSave();
                }, delay);
                return;
            }

            pendingSaveRef.current = null;
            const didSave = await saveState(pending.snapshot, pending.serialized);
            if (!didSave && pendingSaveRef.current === null) {
                pendingSaveRef.current = pending;
            }
        };

        const scheduleSave = (delayMs = SAVE_DEBOUNCE_MS) => {
            if (!isReadyRef.current) return;
            const snapshot = buildSnapshot();
            const serialized = JSON.stringify(snapshot);
            if (serialized === lastSavedRef.current) return;

            pendingSaveRef.current = { snapshot, serialized };
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
            saveTimerRef.current = setTimeout(() => {
                void flushSave();
                saveTimerRef.current = null;
            }, delayMs);
        };

        const loadInitialState = async () => {
            try {
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: getAuthHeaders(clientId),
                    credentials: 'include',
                });
                if (!response.ok) {
                    isReadyRef.current = true;
                    return;
                }

                const data = (await response.json()) as UserStateApiResponse;
                if (!isDisposed && isPlainObject(data.state)) {
                    const persistedUi = getPersistedUiState(data.state);
                    const persistedThemeMode = persistedUi?.themeMode;
                    if (persistedThemeMode === 'light' || persistedThemeMode === 'dark' || persistedThemeMode === 'system') {
                        setThemeRef.current(persistedThemeMode);
                    }
                    applyPersistedSetupState(data.state as Partial<PersistedSetupState>);
                }
            } catch {
                // Ignore initial sync errors to avoid blocking UI.
            } finally {
                if (isDisposed) return;
                const initialSnapshot = buildSnapshot();
                lastSavedRef.current = JSON.stringify(initialSnapshot);
                isReadyRef.current = true;
            }
        };

        loadInitialState();

        const unsubscribeMarket = useMarketStore.subscribe(
            selectPersistableMarketState,
            () => {
                scheduleSave();
            },
            { equalityFn: shallow }
        );
        const unsubscribeStrategy = useStrategyStore.subscribe(
            selectPersistableStrategyState,
            () => {
                scheduleSave();
            },
            { equalityFn: shallow }
        );

        // Fallback poll to guarantee persistence even if subscribe callbacks are skipped
        // due middleware signature differences.
        saveIntervalRef.current = setInterval(() => {
            scheduleSave(0);
        }, FALLBACK_SAVE_INTERVAL_MS);

        return () => {
            isDisposed = true;
            unsubscribeMarket();
            unsubscribeStrategy();
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
            if (saveIntervalRef.current) {
                clearInterval(saveIntervalRef.current);
                saveIntervalRef.current = null;
            }
        };
    }, [apiUrl, clientId, isAuthenticated]);
}
