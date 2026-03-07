'use client';

import { useEffect, useMemo, useRef } from 'react';
import { RootState, useMarketStore } from '@/lib/store';
import { RightSidebarTab } from '@/lib/store/types';
import { useTheme } from 'next-themes';

const USER_STATE_SCHEMA_VERSION = 1;
const SAVE_DEBOUNCE_MS = 1500;
const CLIENT_ID_STORAGE_KEY = 'vivutrade-client-id';
const LEGACY_CLIENT_ID_STORAGE_KEY = 'viewx-client-id';

type PersistedUiState = {
    isLeftSidebarOpen: boolean;
    isRightSidebarOpen: boolean;
    activeRightSidebarTab: RightSidebarTab;
    activeMobileTab: string;
    themeColor: RootState['themeColor'];
    sidebarTopHeight: number;
    rightSidebarTabOrder: string[];
    isDrawingToolbarVisible: boolean;
    snapToCandle: boolean;
    isChartLegendVisible: boolean;
    themeMode?: 'light' | 'dark' | 'system';
};

type PersistedTerminalState = {
    isTerminalVisible: boolean;
    isTerminalCollapsed: boolean;
    terminalHeight: number;
};

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
};

type UserStateApiResponse = {
    state?: Partial<PersistedSetupState>;
};

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

        const safeCharts: Record<string, any> = {};
        for (const [chartId, rawChart] of chartEntries) {
            const chart = rawChart as Record<string, unknown>;
            const symbol = typeof chart.symbol === 'string' && chart.symbol.trim() ? chart.symbol : 'XAUUSDm';
            const interval = typeof chart.interval === 'string' && chart.interval.trim() ? chart.interval : '1';
            const source = typeof chart.source === 'string' && chart.source.trim() ? chart.source : 'MT5';
            safeCharts[chartId] = {
                ...chart,
                id: typeof chart.id === 'string' && chart.id.trim() ? chart.id : chartId,
                symbol,
                interval,
                source,
                chartType: typeof chart.chartType === 'string' ? chart.chartType : 'smart_candles',
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
            ...(tab as any),
            id: typeof tab.id === 'string' && tab.id.trim() ? tab.id : tabId,
            name: typeof tab.name === 'string' && tab.name.trim() ? tab.name : `Workspace ${Object.keys(safeTabs).length + 1}`,
            charts: safeCharts,
            activeChartId,
            maximizedChartId: typeof tab.maximizedChartId === 'string' && safeCharts[tab.maximizedChartId] ? tab.maximizedChartId : null,
            layoutMode: typeof tab.layoutMode === 'string' && tab.layoutMode.trim() ? tab.layoutMode : `${rows}x${cols}`,
            rows,
            cols,
        } as any;
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

function hasAccessToken(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((localStorage.getItem('auth_access_token') || '').trim());
}

function pickPersistedSetupState(state: RootState, themeMode?: 'light' | 'dark' | 'system'): PersistedSetupState {
    return {
        watchlist: state.watchlist,
        tabs: state.tabs,
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
            rightSidebarTabOrder: state.rightSidebarTabOrder,
            isDrawingToolbarVisible: state.isDrawingToolbarVisible,
            snapToCandle: state.snapToCandle,
            isChartLegendVisible: state.isChartLegendVisible,
            themeMode,
        },
        terminal: {
            isTerminalVisible: state.isTerminalVisible,
            isTerminalCollapsed: state.isTerminalCollapsed,
            terminalHeight: state.terminalHeight,
        },
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
            if (Array.isArray(ui.rightSidebarTabOrder)) {
                next.rightSidebarTabOrder = ui.rightSidebarTabOrder.filter((s): s is string => typeof s === 'string');
            }
            if (typeof ui.isDrawingToolbarVisible === 'boolean') next.isDrawingToolbarVisible = ui.isDrawingToolbarVisible;
            if (typeof ui.snapToCandle === 'boolean') next.snapToCandle = ui.snapToCandle;
            if (typeof ui.isChartLegendVisible === 'boolean') next.isChartLegendVisible = ui.isChartLegendVisible;
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
        }

        return Object.keys(next).length > 0 ? next : prev;
    });
}

export function useUserSetupSync() {
    const { theme, setTheme } = useTheme();
    const clientId = useMemo(() => (typeof window === 'undefined' ? 'public' : getOrCreateClientId()), []);
    const apiUrl = useMemo(() => {
        if (typeof window === 'undefined') return '/api/user/state';
        return hasAccessToken() ? buildApiUrl(clientId) : buildPublicApiUrl(clientId);
    }, [clientId]);

    const isReadyRef = useRef(false);
    const hasInitializedRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastSavedRef = useRef('');
    const themeRef = useRef<'light' | 'dark' | 'system' | undefined>(undefined);
    const setThemeRef = useRef(setTheme);

    useEffect(() => {
        themeRef.current = (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : undefined;
    }, [theme]);

    useEffect(() => {
        setThemeRef.current = setTheme;
    }, [setTheme]);

    useEffect(() => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        let isDisposed = false;

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
                    const persistedUi = isPlainObject((data.state as any).ui) ? (data.state as any).ui : null;
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
                const initialSnapshot = pickPersistedSetupState(useMarketStore.getState(), themeRef.current);
                lastSavedRef.current = JSON.stringify(initialSnapshot);
                isReadyRef.current = true;
            }
        };

        const saveState = async (snapshot: PersistedSetupState, serialized: string) => {
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

                if (response.ok) {
                    lastSavedRef.current = serialized;
                }
            } catch {
                // Keep silent and retry on next user change.
            }
        };

        loadInitialState();

        const unsubscribe = useMarketStore.subscribe(
            (state) => {
                return pickPersistedSetupState(state, themeRef.current);
            },
            (snapshot) => {
                if (!isReadyRef.current) return;
                const serialized = JSON.stringify(snapshot);
                if (serialized === lastSavedRef.current) return;

                if (saveTimerRef.current) {
                    clearTimeout(saveTimerRef.current);
                }
                saveTimerRef.current = setTimeout(() => {
                    saveState(snapshot, serialized);
                    saveTimerRef.current = null;
                }, SAVE_DEBOUNCE_MS);
            },
        );

        // Fallback poll to guarantee persistence even if subscribe callbacks are skipped
        // due middleware signature differences.
        saveIntervalRef.current = setInterval(() => {
            if (!isReadyRef.current) return;
            const snapshot = pickPersistedSetupState(useMarketStore.getState(), themeRef.current);
            const serialized = JSON.stringify(snapshot);
            if (serialized === lastSavedRef.current) return;
            saveState(snapshot, serialized);
        }, 2000);

        return () => {
            isDisposed = true;
            unsubscribe();
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
            if (saveIntervalRef.current) {
                clearInterval(saveIntervalRef.current);
                saveIntervalRef.current = null;
            }
        };
    }, [apiUrl, clientId]);
}
