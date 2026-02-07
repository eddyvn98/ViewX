'use client';

import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalResize } from './hooks/use-terminal-resize';
import { AccountSummary } from './components/AccountSummary';
import { PositionsTable } from './components/PositionsTable';
import { MobilePositionsTable } from './components/MobilePositionsTable';
import { MobileAccountSummary } from './components/MobileAccountSummary';
import { MobileOrdersTable } from './components/MobileOrdersTable';
import { MobileHistoryTable } from './components/MobileHistoryTable';
import { OrdersTable } from './components/OrdersTable';
import { HistoryTable } from './components/HistoryTable';

export const Terminal = memo(function Terminal({ forceExpanded = false }: { forceExpanded?: boolean }) {
    const isBridgeOnline = useMarketStore((state) => state.isBridgeOnline);
    const setChartSymbol = useMarketStore((state) => state.setChartSymbol);

    // Optimized selector for active chart source to prevent Terminal re-renders on unrelated tab changes
    const activeChartSource = useMarketStore((state) => {
        const tab = state.tabs[state.activeTabId];
        if (!tab?.activeChartId) return 'MT5';
        return tab.charts[tab.activeChartId]?.source || 'MT5';
    });
    const accounts = useMarketStore((state) => state.accounts);
    const positions = useMarketStore((state) => state.positions);
    const orders = useMarketStore((state) => state.orders);
    const history = useMarketStore((state) => state.history);

    const { sendMessage } = useWebSocket();
    const [isMounted, setIsMounted] = useState(false);
    const [terminalTab, setTerminalTab] = useState<'positions' | 'orders' | 'history'>('positions');

    useEffect(() => {
        if (history.length > 0) {
            console.log(`🏦 [TERMINAL] Store has ${history.length} history deals`);
        }
    }, [history.length]);

    // Custom Hook for Resizing
    const terminalHeightStore = useMarketStore(state => state.terminalHeight);
    const setTerminalHeight = useMarketStore(state => state.setTerminalHeight);
    const isTerminalCollapsed = useMarketStore(state => state.isTerminalCollapsed);
    const setTerminalCollapsed = useMarketStore(state => state.setTerminalCollapsed);

    const { isCollapsed, handleDragStart, toggleCollapse } = useTerminalResize(
        terminalHeightStore,
        setTerminalHeight,
        isTerminalCollapsed,
        setTerminalCollapsed
    );

    const effectiveCollapsed = forceExpanded ? false : isCollapsed;

    const accountSource = activeChartSource === 'BINANCE' ? 'BINANCE_DEMO' : 'MT5';
    // Select specific account based on source
    const account = useMarketStore((state) => state.accounts[accountSource] || state.accounts['MT5']);

    // Wrap in useCallback to ensure stable references
    const handleClosePosition = useCallback((ticket: number) => {
        const pos = positions.find(p => p.ticket === ticket);
        const source = pos?.source || (activeChartSource === 'BINANCE' ? 'BINANCE_DEMO' : 'MT5');

        if (confirm(`Do you want to close position ${ticket}?`)) {
            sendMessage({
                topic: source === 'BINANCE_DEMO' ? "binance_command" : "mt5_command",
                command: "close",
                ticket: ticket
            });
        }
    }, [positions, activeChartSource, sendMessage]);

    const handleUpdatePosition = useCallback((ticket: number, sl: number | undefined, tp: number | undefined) => {
        // Only send fields that are defined/changed
        const payload: any = {
            topic: "mt5_command",
            command: "modify",
            ticket: ticket
        };

        if (sl !== undefined && !isNaN(sl)) payload.sl = sl;
        if (tp !== undefined && !isNaN(tp)) payload.tp = tp;

        if (Object.keys(payload).length > 3) { // type, command, ticket + at least one modify
            sendMessage(payload);
        }
    }, [sendMessage]);

    const handleSymbolClick = useCallback((symbol: string) => {
        // We need to access state imperatively here to avoid subscribing to tabs/activeTabId
        const state = useMarketStore.getState();
        const activeTab = state.tabs[state.activeTabId];
        if (activeTab && activeTab.activeChartId) {
            setChartSymbol(activeTab.activeChartId, symbol);
        }
    }, [setChartSymbol]);

    const handleAnalyze = useCallback((deal: any) => {
        console.log("brain", deal);
        sendMessage({
            topic: "request_analysis",
            deal: deal
        });
    }, [sendMessage]);

    const setIsScrollingPanel = useMarketStore(state => state.setIsScrollingPanel);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleScroll = () => {
        if (!setIsScrollingPanel) return;
        setIsScrollingPanel(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrollingPanel(false);
        }, 1500);
    };

    // Hydration fix: only render content on client
    useEffect(() => {
        setIsMounted(true);
        return () => {
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            if (setIsScrollingPanel) setIsScrollingPanel(false);
        };
    }, [setIsScrollingPanel]);

    if (!isMounted) {
        return <div className="h-full bg-[#131722]" />;
    }

    return (
        <div className="flex flex-col h-full bg-[#131722] relative">
            {/* Resizer Handle - Hidden if forced expanded */}
            {!forceExpanded && (
                <div
                    className="absolute top-[-4px] left-0 right-0 h-[8px] cursor-ns-resize hover:bg-blue-500/50 z-50 transition-colors"
                    onMouseDown={handleDragStart}
                />
            )}

            {/* Header - Hidden if forced expanded */}
            {!forceExpanded && (
                <div
                    className={`flex items-center justify-between px-3 h-[40px] bg-[#1e222d] border-t border-b shrink-0 cursor-pointer hover:bg-[#2a2e39] transition-colors group ${!effectiveCollapsed ? 'border-t-blue-500 border-b-[#2a2e39]' : 'border-t-[#2a2e39] border-b-transparent'}`}
                    onClick={toggleCollapse}
                >
                    <div className="flex items-center gap-2">
                        <span className={`text-[12px] font-bold tracking-wider uppercase transition-colors ${!effectiveCollapsed ? 'text-blue-400' : 'text-[#d1d4dc]'}`}>
                            Trading Terminal
                        </span>
                        <div
                            className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${isBridgeOnline ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500'}`}
                            title={isBridgeOnline ? "Bridge Connected" : "Bridge Disconnected"}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600 font-mono hidden group-hover:block transition-all opacity-0 group-hover:opacity-100">
                            {effectiveCollapsed ? 'Click to Open' : 'Click to Collapse'}
                        </span>
                        <button
                            className={`p-1 rounded transition-all ${!effectiveCollapsed ? 'text-blue-500 bg-blue-500/10' : 'text-[#787b86] hover:text-[#d1d4dc]'}`}
                        >
                            {effectiveCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>
            )}

            {!effectiveCollapsed && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Fixed Top Section: Tabs & Account */}
                    <div className={cn("shrink-0 pb-0", forceExpanded ? "p-1.5" : "p-3")}>
                        {/* Tabs */}
                        <div className={cn("flex items-center gap-4 border-b border-[#2a2e39] pb-0", forceExpanded ? "mb-1.5" : "mb-3")}>
                            <button
                                onClick={() => setTerminalTab('positions')}
                                className={cn("pb-2 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2", terminalTab === 'positions' ? 'text-blue-500 border-blue-500' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]')}
                            >
                                {forceExpanded ? `Pos (${positions.length})` : `Positions (${positions.length})`}
                            </button>
                            <button
                                onClick={() => setTerminalTab('orders')}
                                className={cn("pb-2 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2", terminalTab === 'orders' ? 'text-blue-500 border-blue-500' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]')}
                            >
                                {forceExpanded ? `Ord (${orders.length})` : `Orders (${orders.length})`}
                            </button>
                            <button
                                onClick={() => setTerminalTab('history')}
                                className={cn("pb-2 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2", terminalTab === 'history' ? 'text-blue-500 border-blue-500' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]')}
                            >
                                Hist
                            </button>
                        </div>

                        {/* Account Summary - Different for Mobile */}
                        {forceExpanded ? (
                            <MobileAccountSummary account={account} />
                        ) : (
                            <AccountSummary account={account} />
                        )}
                    </div>

                    {/* Scrollable Area - ANIMATED SLIDING TABS */}
                    <div
                        className="flex-1 min-h-0 relative overflow-hidden"
                        onTouchStart={(e) => {
                            if (!forceExpanded) return;
                            const touch = e.touches[0];
                            (window as any)._terminalTouchStart = touch.clientX;
                        }}
                        onTouchEnd={(e) => {
                            if (!forceExpanded) return;
                            const touchStart = (window as any)._terminalTouchStart;
                            if (touchStart === undefined) return;

                            const touchEnd = e.changedTouches[0].clientX;
                            const deltaX = touchEnd - touchStart;
                            const threshold = 50;

                            const tabs: typeof terminalTab[] = ['positions', 'orders', 'history'];
                            const currentIndex = tabs.indexOf(terminalTab);

                            if (Math.abs(deltaX) > threshold) {
                                if (deltaX < 0 && currentIndex < tabs.length - 1) {
                                    setTerminalTab(tabs[currentIndex + 1]);
                                } else if (deltaX > 0 && currentIndex > 0) {
                                    setTerminalTab(tabs[currentIndex - 1]);
                                }
                            }
                            delete (window as any)._terminalTouchStart;
                        }}
                    >
                        <div
                            className={cn(
                                "flex h-full w-full",
                                forceExpanded && "transition-transform duration-300 ease-out"
                            )}
                            style={forceExpanded ? {
                                transform: `translateX(-${(terminalTab === 'positions' ? 0 : terminalTab === 'orders' ? 1 : 2) * 100}%)`
                            } : {}}
                        >
                            {/* POSITIONS TAB */}
                            <div
                                onScroll={forceExpanded ? handleScroll : undefined}
                                className={cn(
                                    "h-full flex-col p-3 pt-0 px-1 md:px-3 overflow-y-auto custom-scrollbar flex",
                                    forceExpanded ? "w-full shrink-0" : (terminalTab === 'positions' ? 'w-full' : 'hidden')
                                )}>
                                {forceExpanded ? (
                                    <MobilePositionsTable
                                        positions={positions}
                                        onClosePosition={handleClosePosition}
                                        onUpdatePosition={handleUpdatePosition}
                                        onSymbolClick={handleSymbolClick}
                                    />
                                ) : (
                                    <PositionsTable
                                        positions={positions}
                                        onClosePosition={handleClosePosition}
                                        onUpdatePosition={handleUpdatePosition}
                                        onSymbolClick={handleSymbolClick}
                                    />
                                )}
                            </div>

                            {/* ORDERS TAB */}
                            <div
                                onScroll={forceExpanded ? handleScroll : undefined}
                                className={cn(
                                    "h-full flex-col p-3 pt-0 px-1 md:px-3 overflow-y-auto custom-scrollbar flex",
                                    forceExpanded ? "w-full shrink-0" : (terminalTab === 'orders' ? 'w-full' : 'hidden')
                                )}>
                                {forceExpanded ? (
                                    <MobileOrdersTable
                                        orders={orders}
                                        onCancelOrder={handleClosePosition}
                                        onSymbolClick={handleSymbolClick}
                                    />
                                ) : (
                                    <OrdersTable
                                        orders={orders}
                                        onCancelOrder={handleClosePosition}
                                        onSymbolClick={handleSymbolClick}
                                    />
                                )}
                            </div>

                            {/* HISTORY TAB */}
                            <div
                                onScroll={forceExpanded ? handleScroll : undefined}
                                className={cn(
                                    "h-full flex-col p-3 pt-0 px-1 md:px-3 overflow-x-auto custom-scrollbar flex",
                                    forceExpanded ? "w-full shrink-0" : (terminalTab === 'history' ? 'w-full' : 'hidden')
                                )}>
                                {forceExpanded ? (
                                    <MobileHistoryTable
                                        history={history}
                                        onSymbolClick={handleSymbolClick}
                                        onAnalyze={handleAnalyze}
                                    />
                                ) : (
                                    <HistoryTable
                                        history={history}
                                        onSymbolClick={handleSymbolClick}
                                        onAnalyze={handleAnalyze}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
