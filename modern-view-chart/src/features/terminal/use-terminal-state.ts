'use client';

import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { getClientEntitlements } from '@/lib/auth/entitlements';
import { useWebSocket } from '@/hooks/use-websocket';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminalResize } from './hooks/use-terminal-resize';
import { buildMt5AuthFields, buildMt5DataSourceKey, Mt5AccountScope } from '@/lib/mt5/account-scope';
import { buildMt5WriteFields } from '@/lib/mt5/trading-request';

type TerminalTab = 'positions' | 'orders' | 'history';

type Mt5ModifyPayload = {
    topic: 'mt5_command';
    command: 'modify';
    ticket: number;
    request_id: string;
    account_login?: string | null;
    terminal_id?: string | null;
    mt5_source?: string | null;
    broker?: string | null;
    sl?: number;
    tp?: number;
};

export function useTerminalState(forceExpanded: boolean) {
    const strategyEngineEnabled = process.env.NEXT_PUBLIC_STRATEGY_ENGINE_ENABLED === 'true';
    const hasYourMt5Module = getClientEntitlements().hasYourMt5;
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
    const mt5AccountsAvailable = useMarketStore((state) => state.mt5AccountsAvailable);
    const selectedMt5Scope = useMarketStore((state) => state.selectedMt5Scope);
    const setSelectedMt5Scope = useMarketStore((state) => state.setSelectedMt5Scope);
    const activateSymbolCatalog = useMarketStore((state) => state.activateSymbolCatalog);

    const selectedMt5Source = buildMt5DataSourceKey(selectedMt5Scope);
    const accountSource = activeChartSource === 'BINANCE' ? 'BINANCE_DEMO' : selectedMt5Source;
    const account = useMarketStore((state) => state.accounts[accountSource] || null);
    const visibleAccount = hasYourMt5Module ? account : null;
    const visiblePositions = hasYourMt5Module
        ? positions.filter((position) => String(position.source || 'MT5') === accountSource)
        : [];
    const visibleOrders = hasYourMt5Module
        ? orders.filter((order) => String(order.source || 'MT5') === accountSource)
        : [];
    const visibleHistory = hasYourMt5Module
        ? history.filter((deal) => String(deal.source || 'MT5') === accountSource)
        : [];

    const { sendMessage } = useWebSocket();

    const handleSelectMt5Scope = useCallback((scope: Mt5AccountScope) => {
        setSelectedMt5Scope(scope);
        activateSymbolCatalog(buildMt5DataSourceKey(scope));
        useMarketStore.getState().clearMt5CandleRuntime();
        sendMessage({
            topic: 'auth',
            ...buildMt5AuthFields(scope),
        });
    }, [activateSymbolCatalog, sendMessage, setSelectedMt5Scope]);
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
            if (source === 'BINANCE_DEMO') {
                sendMessage({
                    topic: 'binance_command',
                    command: 'close',
                    ticket,
                });
                return;
            }

            sendMessage({
                topic: 'mt5_command',
                command: 'close',
                ticket,
                ...buildMt5WriteFields(selectedMt5Scope),
            });
        }
    }, [positions, activeChartSource, selectedMt5Scope, sendMessage]);

    const handleUpdatePosition = useCallback((ticket: number, sl?: number, tp?: number) => {
        const payload: Mt5ModifyPayload = {
            topic: 'mt5_command',
            command: 'modify',
            ticket,
            ...buildMt5WriteFields(selectedMt5Scope),
        };

        if (sl !== undefined && !isNaN(sl)) payload.sl = sl;
        if (tp !== undefined && !isNaN(tp)) payload.tp = tp;

        if (Object.keys(payload).length > 3) {
            sendMessage(payload);
        }
    }, [selectedMt5Scope, sendMessage]);

    const handleSymbolClick = useCallback((symbol: string) => {
        const state = useMarketStore.getState();
        const activeTab = state.tabs[state.activeTabId];
        if (activeTab && activeTab.activeChartId) {
            setChartSymbol(activeTab.activeChartId, symbol, selectedMt5Scope.source, selectedMt5Scope);
        }
    }, [selectedMt5Scope, setChartSymbol]);

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
        hasYourMt5Module,
        isBridgeOnline,
        visibleAccount,
        visiblePositions,
        visibleOrders,
        visibleHistory,
        accountSource,
        mt5AccountsAvailable,
        selectedMt5Scope,
        handleSelectMt5Scope,
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
