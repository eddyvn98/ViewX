'use client';

import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { getClientEntitlements } from '@/lib/auth/entitlements';
import { useWebSocket } from '@/hooks/use-websocket';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminalResize } from './hooks/use-terminal-resize';
import { hasLegalConsent as readLegalConsent, type TradingSource } from '@/lib/legal/consent';

type TerminalTab = 'positions' | 'orders' | 'history';

type Mt5ModifyPayload = {
    topic: 'mt5_command';
    command: 'modify';
    ticket: number;
    sl?: number;
    tp?: number;
};

type YourMt5FlowMessages = {
    warningSetupRequired: string;
    warningModifyUnavailable: string;
};

export function useTerminalState(forceExpanded: boolean, messages: YourMt5FlowMessages) {
    const strategyEngineEnabled = process.env.NEXT_PUBLIC_STRATEGY_ENGINE_ENABLED === 'true';
    const initialEnt = getClientEntitlements();
    const [moduleStatus, setModuleStatus] = useState<{
        status: 'inactive' | 'trial' | 'active';
        canUse: boolean;
        trialEndsAt: string | null;
        activeUntil: string | null;
    }>({
        status: initialEnt.hasYourMt5 ? 'active' : 'inactive',
        canUse: initialEnt.hasYourMt5,
        trialEndsAt: null,
        activeUntil: null,
    });
    const hasMt5Module = moduleStatus.canUse;
    const isBridgeOnline = useMarketStore((state) => state.isBridgeOnline);
    const setChartSymbol = useMarketStore((state) => state.setChartSymbol);
    const activeChartSource = useMarketStore((state) => {
        const tab = state.tabs[state.activeTabId];
        if (!tab?.activeChartId) return 'MT5';
        return tab.charts[tab.activeChartId]?.source || 'MT5';
    });

    const positions = useMarketStore((state) => state.positions);
    const orders = useMarketStore((state) => state.orders);
    const history = useMarketStore((state) => state.history);

    const accountSource = activeChartSource === 'BINANCE' ? 'BINANCE_DEMO' : 'MT5';
    const account = useMarketStore((state) => state.accounts[accountSource] || state.accounts['MT5'] || null);
    const visibleAccount = hasMt5Module ? account : null;
    const visiblePositions = hasMt5Module ? positions : [];
    const visibleOrders = hasMt5Module ? orders : [];
    const visibleHistory = hasMt5Module ? history : [];

    const [hasLegalConsent, setHasLegalConsent] = useState(false);
    const onboardingSource: TradingSource = activeChartSource === 'BINANCE' ? 'BINANCE' : 'MT5';
    const hasAccountLinked = Boolean(
        visibleAccount && (
            (visibleAccount as { login?: string | number }).login ||
            (visibleAccount as { account_login?: string | number }).account_login ||
            (visibleAccount as { number?: string | number }).number
        )
    );
    const isYourMt5FlowReady = hasMt5Module && isBridgeOnline && hasAccountLinked && hasLegalConsent;

    const { sendMessage } = useWebSocket();
    const [terminalTab, setTerminalTab] = useState<TerminalTab>('positions');
    const autoStartRequestedRef = useRef(false);

    const refreshModuleStatus = useCallback(async () => {
        if (typeof window === 'undefined') return;
        const token = (localStorage.getItem('auth_access_token') || '').trim();
        if (!token) {
            setModuleStatus((prev) => ({ ...prev, canUse: initialEnt.hasYourMt5, status: initialEnt.hasYourMt5 ? 'active' : 'inactive' }));
            return;
        }
        try {
            const res = await fetch('/api/user/module-status?module=your_mt5', {
                method: 'GET',
                headers: { authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            const nextStatus = String(data?.status || 'inactive') as 'inactive' | 'trial' | 'active';
            setModuleStatus({
                status: nextStatus,
                canUse: Boolean(data?.canUse),
                trialEndsAt: typeof data?.trialEndsAt === 'string' ? data.trialEndsAt : null,
                activeUntil: typeof data?.activeUntil === 'string' ? data.activeUntil : null,
            });
        } catch {
            // keep previous status
        }
    }, [initialEnt.hasYourMt5]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const runRefresh = () => {
            window.setTimeout(() => {
                void refreshModuleStatus();
            }, 0);
        };
        runRefresh();
        window.addEventListener('focus', runRefresh);
        window.addEventListener('auth-changed', runRefresh);
        return () => {
            window.removeEventListener('focus', runRefresh);
            window.removeEventListener('auth-changed', runRefresh);
        };
    }, [refreshModuleStatus]);

    useEffect(() => {
        if (history.length > 0) {
            debugLog(`[TERMINAL] Store has ${history.length} history deals`);
        }
    }, [history.length]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (autoStartRequestedRef.current) return;
        if (!hasMt5Module || isBridgeOnline) return;

        const enabled = process.env.NEXT_PUBLIC_BRIDGE_AUTOSTART_ENABLED === 'true';
        if (!enabled) return;

        autoStartRequestedRef.current = true;
        fetch('/api/bridge/autostart', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
        }).catch(() => {
            // Keep silent: wizard still shows manual remediation if autostart fails.
        });
    }, [isBridgeOnline, hasMt5Module]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const loadConsent = () => {
            setHasLegalConsent(readLegalConsent(onboardingSource));
        };

        loadConsent();
        window.addEventListener('storage', loadConsent);
        window.addEventListener('focus', loadConsent);
        return () => {
            window.removeEventListener('storage', loadConsent);
            window.removeEventListener('focus', loadConsent);
        };
    }, [onboardingSource]);

    const refreshLegalConsent = useCallback(() => {
        setHasLegalConsent(readLegalConsent(onboardingSource));
    }, [onboardingSource]);

    const terminalHeightStore = useMarketStore((state) => state.terminalHeight);
    const setTerminalHeight = useMarketStore((state) => state.setTerminalHeight);
    const isTerminalCollapsed = useMarketStore((state) => state.isTerminalCollapsed);
    const setTerminalCollapsed = useMarketStore((state) => state.setTerminalCollapsed);

    const { isCollapsed, handleDragStart, toggleCollapse } = useTerminalResize(
        terminalHeightStore,
        setTerminalHeight,
        isTerminalCollapsed,
        setTerminalCollapsed
    );

    const effectiveCollapsed = forceExpanded ? false : isCollapsed;

    const handleClosePosition = useCallback((ticket: number) => {
        if (!isYourMt5FlowReady) {
            useMarketStore.getState().addNotification(messages.warningSetupRequired, 'warning');
            return;
        }
        const pos = positions.find((p) => p.ticket === ticket);
        const source = pos?.source || (activeChartSource === 'BINANCE' ? 'BINANCE_DEMO' : 'MT5');

        if (confirm(`Do you want to close position ${ticket}?`)) {
            sendMessage({
                topic: source === 'BINANCE_DEMO' ? 'binance_command' : 'mt5_command',
                command: 'close',
                ticket,
            });
        }
    }, [positions, activeChartSource, sendMessage, isYourMt5FlowReady, messages.warningSetupRequired]);

    const handleUpdatePosition = useCallback((ticket: number, sl?: number, tp?: number) => {
        if (!isYourMt5FlowReady) {
            useMarketStore.getState().addNotification(messages.warningModifyUnavailable, 'warning');
            return;
        }
        const payload: Mt5ModifyPayload = {
            topic: 'mt5_command',
            command: 'modify',
            ticket,
        };

        if (sl !== undefined && !isNaN(sl)) payload.sl = sl;
        if (tp !== undefined && !isNaN(tp)) payload.tp = tp;

        if (Object.keys(payload).length > 3) {
            sendMessage(payload);
        }
    }, [sendMessage, isYourMt5FlowReady, messages.warningModifyUnavailable]);

    const handleSymbolClick = useCallback((symbol: string) => {
        const state = useMarketStore.getState();
        const activeTab = state.tabs[state.activeTabId];
        if (activeTab && activeTab.activeChartId) {
            setChartSymbol(activeTab.activeChartId, symbol);
        }
    }, [setChartSymbol]);

    const handleAnalyze = useCallback((deal: unknown) => {
        debugLog('[TERMINAL][analyze]', deal);
        useMarketStore.getState().addNotification('AI is temporarily disabled', 'warning');
    }, []);

    const setIsScrollingPanel = useMarketStore((state) => state.setIsScrollingPanel);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleScroll = useCallback(() => {
        if (!setIsScrollingPanel) return;
        setIsScrollingPanel(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrollingPanel(false);
        }, 1500);
    }, [setIsScrollingPanel]);

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            if (setIsScrollingPanel) setIsScrollingPanel(false);
        };
    }, [setIsScrollingPanel]);

    return {
        strategyEngineEnabled,
        hasMt5Module,
        isBridgeOnline,
        hasLegalConsent,
        hasAccountLinked,
        onboardingSource,
        refreshLegalConsent,
        isYourMt5FlowReady,
        visibleAccount,
        visiblePositions,
        visibleOrders,
        visibleHistory,
        terminalTab,
        setTerminalTab,
        effectiveCollapsed,
        handleDragStart,
        toggleCollapse,
        handleScroll,
        handleClosePosition,
        handleUpdatePosition,
        handleSymbolClick,
        handleAnalyze,
        forceExpanded,
        moduleStatus,
        refreshModuleStatus,
    };
}
