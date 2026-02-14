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
        return <div className="h-full bg-background" />;
    }

    return (
        <div className="flex flex-col h-full bg-background/30 backdrop-blur-xl relative shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.2)] border-t border-border/20">
            {/* Resizer Handle - Hidden if forced expanded */}
            {!forceExpanded && (
                <div
                    className="absolute top-[-6px] left-0 right-0 h-[12px] cursor-ns-resize hover:bg-primary/20 z-50 transition-all group"
                    onMouseDown={handleDragStart}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-[3px] bg-border/20 rounded-full group-hover:bg-primary/40 transition-all" />
                </div>
            )}

            {/* Header - Hidden if forced expanded */}
            {!forceExpanded && (
                <div
                    className={cn(
                        "flex items-center justify-between px-4 h-[44px] bg-secondary/10 border-b shrink-0 cursor-pointer hover:bg-secondary/30 transition-all group",
                        !effectiveCollapsed ? "border-b-border/10" : "border-b-transparent"
                    )}
                    onClick={toggleCollapse}
                >
                    <div className="flex items-center gap-3">
                        <span className={cn(
                            "text-[11px] font-black uppercase tracking-[0.2em] transition-colors",
                            !effectiveCollapsed ? "text-primary glow-primary" : "text-muted-foreground/60"
                        )}>
                            Trading Terminal
                        </span>
                        <div
                            className={cn(
                                "w-2 h-2 rounded-full shadow-lg transition-all",
                                isBridgeOnline ? "bg-emerald-500 shadow-emerald-500/40 animate-pulse" : "bg-rose-500 shadow-rose-500/40"
                            )}
                            title={isBridgeOnline ? "Bridge Connected" : "Bridge Disconnected"}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest hidden group-hover:block transition-all opacity-0 group-hover:opacity-100 italic">
                            {effectiveCollapsed ? 'Maximize' : 'Minimize'}
                        </span>
                        <button
                            className={cn(
                                "p-1.5 rounded-lg transition-all",
                                !effectiveCollapsed ? "text-primary bg-primary/10 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                            )}
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
                        <div className={cn("flex items-center gap-6 border-b border-border/10 pb-0", forceExpanded ? "mb-1.5" : "mb-4")}>
                            {['positions', 'orders', 'history'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setTerminalTab(tab as any)}
                                    className={cn(
                                        "pb-2.5 text-[11px] font-black uppercase tracking-widest transition-all relative group",
                                        terminalTab === tab
                                            ? "text-primary"
                                            : "text-muted-foreground/60 hover:text-foreground"
                                    )}
                                >
                                    <span className="relative z-10">
                                        {tab === 'positions' ? (forceExpanded ? `Pos (${positions.length})` : `Positions (${positions.length})`) :
                                            tab === 'orders' ? (forceExpanded ? `Ord (${orders.length})` : `Orders (${orders.length})`) :
                                                'History'}
                                    </span>
                                    {terminalTab === tab && (
                                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-full shadow-glow animate-in fade-in slide-in-from-bottom-1" />
                                    )}
                                </button>
                            ))}
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
