'use client';

import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { getClientEntitlements } from '@/lib/auth/entitlements';
import { useWebSocket } from '@/hooks/use-websocket';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminalResize } from './hooks/use-terminal-resize';

type TerminalTab = 'positions' | 'orders' | 'history';

type Mt5ModifyPayload = {
    topic: 'mt5_command';
    command: 'modify';
    ticket: number;
    sl?: number;
    tp?: number;
};

export function useTerminalState(forceExpanded: boolean) {
    const strategyEngineEnabled = process.env.NEXT_PUBLIC_STRATEGY_ENGINE_ENABLED === 'true';
    const isProUser = getClientEntitlements().isPro;
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
    const visibleAccount = isProUser ? account : null;
    const visiblePositions = isProUser ? positions : [];
    const visibleOrders = isProUser ? orders : [];
    const visibleHistory = isProUser ? history : [];

    const { sendMessage } = useWebSocket();
    const [
        terminalTab,
        setTerminalTab,
    ] = useState<TerminalTab>('positions');

    useEffect(() => {
        if (history.length > 0) {
            debugLog(`[TERMINAL] Store has ${history.length} history deals`);
        }
    }, [history.length]);

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
        const pos = positions.find((p) => p.ticket === ticket);
        const source = pos?.source || (activeChartSource === 'BINANCE' ? 'BINANCE_DEMO' : 'MT5');

        if (confirm(`Do you want to close position ${ticket}?`)) {
            sendMessage({
                topic: source === 'BINANCE_DEMO' ? 'binance_command' : 'mt5_command',
                command: 'close',
                ticket,
            });
        }
    }, [positions, activeChartSource, sendMessage]);

    const handleUpdatePosition = useCallback((ticket: number, sl?: number, tp?: number) => {
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
    }, [sendMessage]);

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
        isProUser,
        isBridgeOnline,
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
    };
}
