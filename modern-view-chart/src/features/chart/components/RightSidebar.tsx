import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useMarketStore } from '@/lib/store';
import { MarketList } from '@/features/market/MarketList';
import { IndicatorManager } from '@/features/chart/components/IndicatorManager';
import { OrderForm } from '@/features/terminal/components/OrderForm';
import { StrategyPanel } from '@/features/chart/components/StrategyPanel';
import { LineChart, Layout, ShoppingCart, Brain, GripHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export const RightSidebar = memo(function RightSidebar() {
    const sidebarRef = useRef<HTMLDivElement>(null);
    const activeTab = useMarketStore(state => state.activeRightSidebarTab);
    const setActiveTab = useMarketStore(state => state.setActiveRightSidebarTab);
    const topHeight = useMarketStore(state => state.sidebarTopHeight);
    const setTopHeight = useMarketStore(state => state.setSidebarTopHeight);
    const tabOrder = useMarketStore(state => state.rightSidebarTabOrder);
    const setTabOrder = useMarketStore(state => state.setRightSidebarTabOrder);

    const [isResizing, setIsResizing] = useState(false);
    const [draggedTab, setDraggedTab] = useState<string | null>(null);

    /* ================= RESIZING LOGIC ================= */
    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing && sidebarRef.current) {
            const rect = sidebarRef.current.getBoundingClientRect();
            const offset = e.clientY - rect.top;
            const newHeight = (offset / rect.height) * 100;
            // Constrain height between 15% and 85%
            setTopHeight(Math.max(15, Math.min(85, newHeight)));
        }
    }, [isResizing, setTopHeight]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    /* ================= DRAG & DROP LOGIC ================= */
    const handleDragStart = (e: React.DragEvent, tabId: string) => {
        setDraggedTab(tabId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, targetTabId: string) => {
        e.preventDefault();
        if (!draggedTab || draggedTab === targetTabId) return;

        const newOrder = [...tabOrder];
        const draggedIdx = newOrder.indexOf(draggedTab);
        const targetIdx = newOrder.indexOf(targetTabId);

        newOrder.splice(draggedIdx, 1);
        newOrder.splice(targetIdx, 0, draggedTab);
        setTabOrder(newOrder);
    };

    const handleDragEnd = () => {
        setDraggedTab(null);
    };

    const tabConfigs: Record<string, { icon: any, label: string, component: React.ReactNode }> = {
        market: { icon: LineChart, label: 'Watchlist', component: <MarketList mode="watchlist" /> },
        indicators: { icon: Layout, label: 'Indicators', component: <IndicatorManager /> },
        strategy: { icon: Brain, label: 'Strategy', component: <StrategyPanel /> },
        trade: { icon: ShoppingCart, label: 'Trade', component: <OrderForm /> }
    };

    // Filter to exclude 'market' from the bottom tabs as it's fixed on top
    const bottomTabs = tabOrder.filter(id => id !== 'market');

    return (
        <aside ref={sidebarRef} className="w-80 border-l border-zinc-800 bg-[#0c0d10] flex flex-col h-full overflow-hidden shrink-0 relative">
            {/* 1. TOP SECTION: WATCHLIST (Fixed) */}
            <div
                className="flex flex-col min-h-0 overflow-hidden"
                style={{ height: `${topHeight}%` }}
            >
                <div className="flex-1 min-h-0">
                    <MarketList mode="watchlist" />
                </div>
            </div>

            {/* 2. RESIZER HANDLE */}
            <div
                onMouseDown={startResizing}
                className={cn(
                    "h-1 flex items-center justify-center cursor-row-resize bg-zinc-800/30 hover:bg-blue-600/40 transition-colors group z-50",
                    isResizing && "bg-blue-600"
                )}
            >
                <div className="w-8 h-[1px] rounded-full bg-zinc-700 group-hover:bg-blue-400 transition-colors" />
            </div>

            {/* 3. BOTTOM SECTION: TABS */}
            <div
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
                style={{ height: `${100 - topHeight}%` }}
            >
                {/* Tab Header & Draggable Area */}
                <div className="flex border-b border-zinc-800 bg-[#131722]/80">
                    {bottomTabs.map(tabId => {
                        const tab = tabConfigs[tabId];
                        return (
                            <button
                                key={tabId}
                                draggable
                                onDragStart={(e) => handleDragStart(e, tabId)}
                                onDragOver={(e) => handleDragOver(e, tabId)}
                                onDragEnd={handleDragEnd}
                                onClick={() => setActiveTab(tabId as any)}
                                className={cn(
                                    "flex-1 flex items-center justify-center py-1.5 gap-2 transition-all border-b border-transparent cursor-pointer active:cursor-grabbing",
                                    activeTab === tabId
                                        ? "text-blue-500 border-b-blue-500 bg-blue-500/5 font-black uppercase"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <tab.icon size={12} />
                                <span className="text-[8px] uppercase tracking-tighter">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden relative min-h-0 flex flex-col">
                    {bottomTabs.map(tabId => (
                        <div key={tabId} className={cn("flex-1 min-h-0", activeTab === tabId ? "flex flex-col h-full" : "hidden")}>
                            {tabConfigs[tabId].component}
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
});
