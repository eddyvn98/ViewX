'use client';

import { useEffect, useMemo, useRef } from 'react';
import { RootState, useMarketStore } from '@/lib/store';
import { RightSidebarTab } from '@/lib/store/types';

const USER_STATE_SCHEMA_VERSION = 1;
const SAVE_DEBOUNCE_MS = 1500;
const CLIENT_ID_STORAGE_KEY = 'viewx-client-id';

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function getOrCreateClientId(): string {
    if (typeof window === 'undefined') return 'public';
    const current = localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim() || '';
    if (current) return current;

    const generated =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
    return generated;
}

function buildApiUrl(clientId: string): string {
    const params = new URLSearchParams();
    const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const accessToken = (search.get('access_token') || '').trim();
    const accessTicket = (search.get('access_ticket') || '').trim();

    if (accessToken) params.set('access_token', accessToken);
    if (accessTicket) params.set('access_ticket', accessTicket);
    if (clientId) params.set('client_id', clientId);

    const query = params.toString();
    return query ? `/api/user/state?${query}` : '/api/user/state';
}

function pickPersistedSetupState(state: RootState): PersistedSetupState {
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

        if (isPlainObject(persisted.tabs)) next.tabs = persisted.tabs as RootState['tabs'];
        if (typeof persisted.activeTabId === 'string' && (next.tabs || prev.tabs)[persisted.activeTabId]) {
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
    const clientId = useMemo(() => (typeof window === 'undefined' ? 'public' : getOrCreateClientId()), []);
    const apiUrl = useMemo(() => (typeof window === 'undefined' ? '/api/user/state' : buildApiUrl(clientId)), [clientId]);

    const isReadyRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastSavedRef = useRef('');

    useEffect(() => {
        let isDisposed = false;

        const loadInitialState = async () => {
            try {
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    credentials: 'include',
                });
                if (!response.ok) {
                    isReadyRef.current = true;
                    return;
                }

                const data = (await response.json()) as UserStateApiResponse;
                if (!isDisposed && isPlainObject(data.state)) {
                    applyPersistedSetupState(data.state as Partial<PersistedSetupState>);
                }
            } catch {
                // Ignore initial sync errors to avoid blocking UI.
            } finally {
                if (isDisposed) return;
                const initialSnapshot = pickPersistedSetupState(useMarketStore.getState());
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
                        'x-client-id': clientId,
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
            (state) => pickPersistedSetupState(state),
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
            const snapshot = pickPersistedSetupState(useMarketStore.getState());
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
