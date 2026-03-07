'use client';

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useMarketStore } from '@/lib/store';
import { MarketList } from '@/features/market/MarketList';
import { LayerManager } from '@/features/chart/components/LayerManager';
import { OrderForm } from '@/features/terminal/components/OrderForm';
import { motion, LayoutGroup } from 'framer-motion';
import { StrategyPanel } from '@/features/chart/components/StrategyPanel';
import { LineChart, Layout, ShoppingCart, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RightSidebarTab } from '@/lib/store/types';

export const RightSidebar = memo(function RightSidebar() {
    const sidebarRef = useRef<HTMLDivElement>(null);
    const activeTab = useMarketStore(state => state.activeRightSidebarTab);
    const setActiveTab = useMarketStore(state => state.setActiveRightSidebarTab);
    const topHeight = useMarketStore(state => state.sidebarTopHeight);
    const sidebarWidth = useMarketStore(state => state.rightSidebarWidth);
    const setTopHeight = useMarketStore(state => state.setSidebarTopHeight);
    const setSidebarWidth = useMarketStore(state => state.setRightSidebarWidth);
    const tabOrder = useMarketStore(state => state.rightSidebarTabOrder);
    const setTabOrder = useMarketStore(state => state.setRightSidebarTabOrder);

    const [isResizing, setIsResizing] = useState(false);
    const [isWidthResizing, setIsWidthResizing] = useState(false);
    const [draggedTab, setDraggedTab] = useState<string | null>(null);

    /* ================= RESIZING LOGIC ================= */
    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);
    const stopWidthResizing = useCallback(() => {
        setIsWidthResizing(false);
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

    const startWidthResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsWidthResizing(true);
    }, []);

    const resizeWidth = useCallback((e: MouseEvent) => {
        if (!isWidthResizing) return;
        const nextWidth = window.innerWidth - e.clientX;
        setSidebarWidth(nextWidth);
    }, [isWidthResizing, setSidebarWidth]);

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

    useEffect(() => {
        if (isWidthResizing) {
            window.addEventListener('mousemove', resizeWidth);
            window.addEventListener('mouseup', stopWidthResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener('mousemove', resizeWidth);
            window.removeEventListener('mouseup', stopWidthResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener('mousemove', resizeWidth);
            window.removeEventListener('mouseup', stopWidthResizing);
        };
    }, [isWidthResizing, resizeWidth, stopWidthResizing]);

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

    const tabConfigs: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>, label: string, component: React.ReactNode }> = {
        market: { icon: LineChart, label: 'Watchlist', component: <MarketList mode="watchlist" /> },
        layer: { icon: Layout, label: 'Layer', component: <LayerManager /> },
        strategy: { icon: Brain, label: 'Strategy', component: <StrategyPanel /> },
        trade: { icon: ShoppingCart, label: 'Trade', component: <OrderForm /> }
    };

    // Filter to exclude 'market' from the bottom tabs as it's fixed on top
    const bottomTabs = tabOrder.filter((id: string) => id !== 'market') as RightSidebarTab[];

    return (
        <aside
            ref={sidebarRef}
            style={{ width: `${sidebarWidth}px` }}
            className="border-l border-white/5 bg-background/60 backdrop-blur-3xl flex flex-col h-full overflow-hidden shrink-0 relative transition-all shadow-2xl z-10 glass-panel"
        >
            <div
                onMouseDown={startWidthResizing}
                className={cn(
                    "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50 bg-transparent hover:bg-primary/20 transition-colors",
                    isWidthResizing && "bg-primary/40"
                )}
            />
            {/* 1. TOP SECTION: WATCHLIST (Fixed) */}
            <div
                className="flex flex-col min-h-0 overflow-hidden"
                style={{ height: `${topHeight}%` }}
            >
                <div className="flex-1 min-h-0 bg-transparent">
                    <MarketList mode="watchlist" />
                </div>
            </div>

            {/* 2. RESIZER HANDLE */}
            <div
                onMouseDown={startResizing}
                className={cn(
                    "h-1.5 flex items-center justify-center cursor-row-resize bg-white/5 hover:bg-primary/20 transition-all group z-50 border-y border-white/[0.02]",
                    isResizing && "bg-primary/40 shadow-[0_0_15px_var(--glow-primary)]"
                )}
            >
                <div className="w-12 h-[2px] rounded-full bg-white/10 group-hover:bg-primary/50 transition-all shadow-glow" />
            </div>

            {/* 3. BOTTOM SECTION: TABS */}
            <div
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
                style={{ height: `${100 - topHeight}%` }}
            >
                {/* Tab Header & Draggable Area */}
                <LayoutGroup id="sidebar-tabs">
                    <div className="flex bg-secondary/50 dark:bg-white/[0.03] p-1 gap-1 mx-2 mt-2 mb-0 rounded-xl border border-border dark:border-white/5 shadow-sm relative z-0">
                        {bottomTabs.map(tabId => {
                            const tab = tabConfigs[tabId];
                            const isActive = activeTab === tabId;
                            return (
                                <button
                                    key={tabId}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, tabId)}
                                    onDragOver={(e) => handleDragOver(e, tabId)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => setActiveTab(tabId)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center py-2 gap-2 rounded-lg transition-colors duration-300 relative cursor-pointer active:cursor-grabbing group overflow-hidden border border-transparent outline-none",
                                        isActive
                                            ? "text-primary font-bold"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-sidebar-tab"
                                            className="absolute inset-0 bg-primary/20 dark:bg-primary/20 shadow-sm rounded-lg border border-primary/20"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    {/* Icon & Label with higher z-index to sit on top of motion bg */}
                                    <div className="relative z-10 flex items-center gap-2">
                                        <tab.icon size={15} className={cn("transition-all duration-500", isActive ? "scale-105" : "group-hover:scale-105")} />
                                        <span className="text-[11px] font-bold leading-none tracking-tight">{tab.label}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </LayoutGroup>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden relative min-h-0 flex flex-col">
                    {bottomTabs.map(tabId => (
                        <div key={tabId} className={cn("flex-1 min-h-0 animate-in fade-in zoom-in-95 duration-500", activeTab === tabId ? "flex flex-col h-full" : "hidden")}>
                            {tabConfigs[tabId].component}
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
});
