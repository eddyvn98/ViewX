import { StateCreator } from 'zustand';
import { RootState } from '../index';
import { RightSidebarTab } from '../types';
import type { StrategyDirection, StrategyLeg } from '@/features/strategy/types';

export type StrategyPanelView = 'build' | 'list' | 'signals' | 'ai_chat';
export type SignalHistoryRange = 'day' | 'week' | 'month';
export type MarketSourceTab = 'ALL' | 'BINANCE' | 'MT5' | 'VN_GOLD';

const MT5_TERMS_STORAGE_PREFIX = 'mt5-consent:v1';
const VOICE_ALERTS_STORAGE_KEY = 'voice-alerts-enabled:v1';
const VOICE_ALERTS_PREGEN_STORAGE_KEY = 'voice-alerts-pregen:v1';

type Mt5TermsScope = {
    userId?: string | null;
    accountId?: string | null;
};

function readStoredAuthUserId() {
    if (typeof window === 'undefined') return '';
    try {
        const raw = localStorage.getItem('auth_user') || '';
        if (!raw) return '';
        const parsed = JSON.parse(raw) as { _id?: string; id?: string; username?: string; email?: string };
        return String(parsed._id || parsed.id || parsed.username || parsed.email || '').trim();
    } catch {
        return '';
    }
}

export function buildMt5TermsStorageKey(scope?: Mt5TermsScope) {
    const userId = String(scope?.userId || readStoredAuthUserId() || 'anonymous').trim();
    const accountId = String(scope?.accountId || '').trim();
    if (accountId) {
        return `${MT5_TERMS_STORAGE_PREFIX}:user:${userId}:account:${accountId}`;
    }
    return `${MT5_TERMS_STORAGE_PREFIX}:user:${userId}`;
}

function readMt5TermsAccepted(scope?: Mt5TermsScope) {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(buildMt5TermsStorageKey(scope)) === 'true';
}

function readVoiceAlertsEnabled() {
    if (typeof window === 'undefined') return true;
    const raw = localStorage.getItem(VOICE_ALERTS_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
}

function readVoiceAlertsUsePreGeneratedAudio() {
    if (typeof window === 'undefined') return true;
    const raw = localStorage.getItem(VOICE_ALERTS_PREGEN_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
}

export interface StrategyBuilderDraft {
    editingStrategyId: string | null;
    name: string;
    activeDirection: StrategyDirection;
    buyEnabled: boolean;
    sellEnabled: boolean;
    buy: StrategyLeg;
    sell: StrategyLeg;
    executionMode: 'virtual' | 'real';
    comment: string;
    magic: number;
}

export interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    alertId?: string; // For click-to-edit
}

export interface NotificationHistoryItem extends Notification {
    createdAt: number;
    readAt?: number;
}

export interface UISlice {
    isLeftSidebarOpen: boolean;
    isRightSidebarOpen: boolean;
    isMarketListDialogOpen: boolean;
    activeRightSidebarTab: RightSidebarTab;
    activeMobileTab: string;
    isInputFocused: boolean;
    isScrollingPanel: boolean;
    notifications: Notification[];
    notificationHistory: NotificationHistoryItem[];
    focusedTicket: number | null;
    themeColor: 'blue' | 'green' | 'amber' | 'red' | 'slate';
    sidebarTopHeight: number;
    rightSidebarWidth: number;
    rightSidebarTabOrder: string[];
    isDrawingToolbarVisible: boolean;
    isChartLegendVisible: boolean;
    strategyPanelView: StrategyPanelView;
    strategyEditingStrategyId: string | null;
    strategyBuilderDraft: StrategyBuilderDraft | null;
    signalHistoryRange: SignalHistoryRange;
    marketListSearchQuery: string;
    marketListSourceTab: MarketSourceTab;
    hasAcceptedMt5Terms: boolean;
    voiceAlertsEnabled: boolean;
    voiceAlertsUsePreGeneratedAudio: boolean;

    setLeftSidebarOpen: (isOpen: boolean) => void;
    toggleLeftSidebar: () => void;
    setRightSidebarOpen: (isOpen: boolean) => void;
    setMarketListDialogOpen: (isOpen: boolean) => void;
    toggleRightSidebar: () => void;
    toggleDrawingToolbar: () => void;
    setDrawingToolbarVisible: (visible: boolean) => void;
    setActiveRightSidebarTab: (tab: RightSidebarTab) => void;
    setActiveMobileTab: (tab: string) => void;
    setInputFocused: (focused: boolean) => void;
    setIsScrollingPanel: (isScrolling: boolean) => void;
    addNotification: (message: string, type?: Notification['type'], alertId?: string) => void;
    removeNotification: (id: string) => void;
    markAllNotificationsAsRead: () => void;
    clearNotificationHistory: () => void;
    setFocusedTicket: (ticket: number | null) => void;
    setSidebarTopHeight: (height: number) => void;
    setRightSidebarWidth: (width: number) => void;
    setRightSidebarTabOrder: (order: string[]) => void;
    setThemeColor: (color: 'blue' | 'green' | 'amber' | 'red' | 'slate') => void;
    setChartLegendVisible: (visible: boolean) => void;
    setStrategyPanelView: (view: StrategyPanelView) => void;
    setStrategyEditingStrategyId: (strategyId: string | null) => void;
    setStrategyBuilderDraft: (draft: StrategyBuilderDraft | null) => void;
    setSignalHistoryRange: (range: SignalHistoryRange) => void;
    setMarketListSearchQuery: (query: string) => void;
    setMarketListSourceTab: (tab: MarketSourceTab) => void;
    setHasAcceptedMt5Terms: (accepted: boolean, storageKey?: string) => void;
    syncHasAcceptedMt5Terms: (storageKey?: string) => void;
    setVoiceAlertsEnabled: (enabled: boolean) => void;
    setVoiceAlertsUsePreGeneratedAudio: (enabled: boolean) => void;
    syncUiPreferences: () => Promise<void>;
}

export const createUISlice: StateCreator<RootState, [], [], UISlice> = (set) => ({
    isLeftSidebarOpen: false,
    isRightSidebarOpen: true,
    isMarketListDialogOpen: false,
    activeRightSidebarTab: 'strategy',
    activeMobileTab: 'chart',
    isInputFocused: false,
    isScrollingPanel: false,
    notifications: [],
    notificationHistory: [],
    focusedTicket: null,
    sidebarTopHeight: 40,
    rightSidebarWidth: 320,
    rightSidebarTabOrder: ['strategy', 'layer', 'trade'],
    themeColor: 'green',
    isDrawingToolbarVisible: false,
    isChartLegendVisible: true,
    strategyPanelView: 'signals',
    strategyEditingStrategyId: null,
    strategyBuilderDraft: null,
    signalHistoryRange: 'day',
    marketListSearchQuery: '',
    marketListSourceTab: 'ALL',
    hasAcceptedMt5Terms: readMt5TermsAccepted(),
    voiceAlertsEnabled: readVoiceAlertsEnabled(),
    voiceAlertsUsePreGeneratedAudio: readVoiceAlertsUsePreGeneratedAudio(),

    setLeftSidebarOpen: (isOpen) => set({ isLeftSidebarOpen: isOpen }),
    toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
    setRightSidebarOpen: (isOpen) => set({ isRightSidebarOpen: isOpen }),
    setMarketListDialogOpen: (isOpen) => set({ isMarketListDialogOpen: isOpen }),
    toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
    toggleDrawingToolbar: () => set((state) => ({ isDrawingToolbarVisible: !state.isDrawingToolbarVisible })),
    setDrawingToolbarVisible: (visible) => set({ isDrawingToolbarVisible: visible }),
    setActiveRightSidebarTab: (tab) => set({ activeRightSidebarTab: tab }),
    setActiveMobileTab: (tab) => set({ activeMobileTab: tab }),
    setInputFocused: (focused) => set({ isInputFocused: focused }),
    setIsScrollingPanel: (isScrolling) => set((state) => state.isScrollingPanel === isScrolling ? state : { isScrollingPanel: isScrolling }),
    addNotification: (message, type = 'info', alertId) => set((state) => {
        const item: NotificationHistoryItem = {
            id: crypto.randomUUID(),
            message,
            type,
            alertId,
            createdAt: Date.now()
        };
        return {
            notifications: [...state.notifications, item],
            notificationHistory: [...state.notificationHistory, item].slice(-200)
        };
    }),
    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
    })),
    markAllNotificationsAsRead: () => set((state) => ({
        notificationHistory: state.notificationHistory.map((item) => (
            item.readAt ? item : { ...item, readAt: Date.now() }
        ))
    })),
    clearNotificationHistory: () => set({ notificationHistory: [] }),
    setFocusedTicket: (ticket) => set({ focusedTicket: ticket }),
    setSidebarTopHeight: (height) => set({ sidebarTopHeight: height }),
    setRightSidebarWidth: (width) => {
        const value = Math.max(280, Math.min(640, Math.round(width)));
        set({ rightSidebarWidth: value });
    },
    setRightSidebarTabOrder: (order) => set({ rightSidebarTabOrder: order }),
    setThemeColor: (color) => {
        set({ themeColor: color });
        if (typeof window !== 'undefined') {
            document.documentElement.classList.remove('theme-blue', 'theme-green', 'theme-amber', 'theme-red', 'theme-slate');
            document.documentElement.classList.add(`theme-${color}`);
        }
    },
    setChartLegendVisible: (visible) => set({ isChartLegendVisible: visible }),
    setStrategyPanelView: (view) => set({ strategyPanelView: view }),
    setStrategyEditingStrategyId: (strategyId) => set({ strategyEditingStrategyId: strategyId }),
    setStrategyBuilderDraft: (draft) => set({ strategyBuilderDraft: draft }),
    setSignalHistoryRange: (range) => set({ signalHistoryRange: range }),
    setMarketListSearchQuery: (query) => set({ marketListSearchQuery: query }),
    setMarketListSourceTab: (tab) => set({ marketListSourceTab: tab }),
    setHasAcceptedMt5Terms: (accepted, storageKey) => {
        set({ hasAcceptedMt5Terms: accepted });
        if (typeof window !== 'undefined') {
            localStorage.setItem(storageKey || buildMt5TermsStorageKey(), accepted ? 'true' : 'false');
        }
    },
    syncHasAcceptedMt5Terms: (storageKey) => {
        const accepted = typeof window !== 'undefined'
            ? localStorage.getItem(storageKey || buildMt5TermsStorageKey()) === 'true'
            : false;
        set((state) => state.hasAcceptedMt5Terms === accepted ? state : { hasAcceptedMt5Terms: accepted });
    },
    setVoiceAlertsEnabled: (enabled) => {
        set({ voiceAlertsEnabled: enabled });
        if (typeof window !== 'undefined') {
            localStorage.setItem(VOICE_ALERTS_STORAGE_KEY, enabled ? 'true' : 'false');

            const token = localStorage.getItem('auth_access_token');
            if (token) {
                fetch('/api/user/ui-preferences', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ voiceAlertsEnabled: enabled })
                }).catch(() => {});
            }
        }
    },
    setVoiceAlertsUsePreGeneratedAudio: (enabled) => {
        set({ voiceAlertsUsePreGeneratedAudio: enabled });
        if (typeof window !== 'undefined') {
            localStorage.setItem(VOICE_ALERTS_PREGEN_STORAGE_KEY, enabled ? 'true' : 'false');

            const token = localStorage.getItem('auth_access_token');
            if (token) {
                fetch('/api/user/ui-preferences', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ voiceAlertsUsePreGeneratedAudio: enabled })
                }).catch(() => {});
            }
        }
    },
    syncUiPreferences: async () => {
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('auth_access_token') : null;
            if (!token) return;

            const response = await fetch('/api/user/ui-preferences', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.uiPreferences) {
                    const { voiceAlertsEnabled, voiceAlertsUsePreGeneratedAudio } = data.uiPreferences;

                    set((state) => ({
                        voiceAlertsEnabled: typeof voiceAlertsEnabled === 'boolean' ? voiceAlertsEnabled : state.voiceAlertsEnabled,
                        voiceAlertsUsePreGeneratedAudio: typeof voiceAlertsUsePreGeneratedAudio === 'boolean' ? voiceAlertsUsePreGeneratedAudio : state.voiceAlertsUsePreGeneratedAudio
                    }));

                    // Update localStorage and DOM to match server state
                    if (typeof window !== 'undefined') {
                        if (typeof voiceAlertsEnabled === 'boolean') {
                            localStorage.setItem(VOICE_ALERTS_STORAGE_KEY, String(voiceAlertsEnabled));
                        }
                        if (typeof voiceAlertsUsePreGeneratedAudio === 'boolean') {
                            localStorage.setItem(VOICE_ALERTS_PREGEN_STORAGE_KEY, String(voiceAlertsUsePreGeneratedAudio));
                        }
                    }
                }
            }
        } catch (error) {
            console.error('syncUiPreferences.error', error);
        }
    },
});
