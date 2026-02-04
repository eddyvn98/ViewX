'use client';

import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTerminalResize } from './hooks/use-terminal-resize';
import { AccountSummary } from './components/AccountSummary';
import { PositionsTable } from './components/PositionsTable';
import { OrdersTable } from './components/OrdersTable';
import { HistoryTable } from './components/HistoryTable';

export function Terminal() {
    const isBridgeOnline = useMarketStore((state) => state.isBridgeOnline);
    const setChartSymbol = useMarketStore((state) => state.setChartSymbol);
    const tabs = useMarketStore((state) => state.tabs);
    const activeTabId = useMarketStore((state) => state.activeTabId);
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
    const { height, isCollapsed, handleDragStart, toggleCollapse } = useTerminalResize(
        terminalHeightStore,
        setTerminalHeight,
        isTerminalCollapsed,
        setTerminalCollapsed
    );

    // Get current account based on active chart source
    const activeChartSource = activeTabId && tabs[activeTabId] && tabs[activeTabId].activeChartId
        ? tabs[activeTabId].charts[tabs[activeTabId].activeChartId!].source
        : 'MT5';

    const accountSource = activeChartSource === 'BINANCE' ? 'BINANCE_DEMO' : 'MT5';
    const account = accounts[accountSource] || accounts['MT5'];

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
        const activeTab = tabs[activeTabId];
        if (activeTab && activeTab.activeChartId) {
            setChartSymbol(activeTab.activeChartId, symbol);
        }
    }, [tabs, activeTabId, setChartSymbol]);

    const handleAnalyze = useCallback((deal: any) => {
        console.log("brain", deal);
        sendMessage({
            topic: "request_analysis",
            deal: deal
        });
    }, [sendMessage]);

    // Hydration fix: only render content on client
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return <div className="h-full bg-[#131722]" />;
    }

    return (
        <div className="flex flex-col h-full bg-[#131722] relative">
            {/* Resizer Handle */}
            <div
                className="absolute top-[-4px] left-0 right-0 h-[8px] cursor-ns-resize hover:bg-blue-500/50 z-50 transition-colors"
                onMouseDown={handleDragStart}
            />

            {/* Header */}
            <div
                className={`flex items-center justify-between px-3 h-[40px] bg-[#1e222d] border-t border-b shrink-0 cursor-pointer hover:bg-[#2a2e39] transition-colors group ${!isCollapsed ? 'border-t-blue-500 border-b-[#2a2e39]' : 'border-t-[#2a2e39] border-b-transparent'}`}
                onClick={toggleCollapse}
            >
                <div className="flex items-center gap-2">
                    <span className={`text-[12px] font-bold tracking-wider uppercase transition-colors ${!isCollapsed ? 'text-blue-400' : 'text-[#d1d4dc]'}`}>
                        Trading Terminal
                    </span>
                    <div
                        className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${isBridgeOnline ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500'}`}
                        title={isBridgeOnline ? "Bridge Connected" : "Bridge Disconnected"}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600 font-mono hidden group-hover:block transition-all opacity-0 group-hover:opacity-100">
                        {isCollapsed ? 'Click to Open' : 'Click to Collapse'}
                    </span>
                    <button
                        className={`p-1 rounded transition-all ${!isCollapsed ? 'text-blue-500 bg-blue-500/10' : 'text-[#787b86] hover:text-[#d1d4dc]'}`}
                    >
                        {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Fixed Top Section: Tabs & Account */}
                    <div className="p-3 pb-0 shrink-0">
                        {/* Tabs */}
                        <div className="flex items-center gap-4 mb-3 border-b border-[#2a2e39] pb-0">
                            <button
                                onClick={() => setTerminalTab('positions')}
                                className={`pb-2 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 ${terminalTab === 'positions' ? 'text-blue-500 border-blue-500' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]'}`}
                            >
                                Positions ({positions.length})
                            </button>
                            <button
                                onClick={() => setTerminalTab('orders')}
                                className={`pb-2 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 ${terminalTab === 'orders' ? 'text-blue-500 border-blue-500' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]'}`}
                            >
                                Orders ({orders.length})
                            </button>
                            <button
                                onClick={() => setTerminalTab('history')}
                                className={`pb-2 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 ${terminalTab === 'history' ? 'text-blue-500 border-blue-500' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]'}`}
                            >
                                History
                            </button>
                        </div>

                        {/* Account Summary */}
                        <AccountSummary account={account} />
                    </div>

                    {/* Scrollable Table Area */}
                    <div className={`flex-1 min-h-0 p-3 pt-0 relative flex flex-col ${terminalTab !== 'history' ? 'overflow-auto' : 'overflow-x-auto overflow-y-hidden'}`}>
                        {terminalTab === 'positions' ? (
                            <PositionsTable
                                positions={positions}
                                onClosePosition={handleClosePosition}
                                onUpdatePosition={handleUpdatePosition}
                                onSymbolClick={handleSymbolClick}
                            />
                        ) : terminalTab === 'orders' ? (
                            <OrdersTable
                                orders={orders}
                                onCancelOrder={handleClosePosition} // Use the same closer for now
                                onSymbolClick={handleSymbolClick}
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
            )}
        </div>
    );
}
