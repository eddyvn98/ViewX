'use client';
import type { HistoryDeal, Order, Position } from '@/lib/store/types';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { HistoryTable } from './HistoryTable';
import { MobileHistoryTable } from './MobileHistoryTable';
import { MobileOrdersTable } from './MobileOrdersTable';
import { MobilePositionsTable } from './MobilePositionsTable';
import { OrdersTable } from './OrdersTable';
import { PositionsTable } from './PositionsTable';
import { ActivationChecklist } from './ActivationChecklist';
import { useMarketStore } from '@/lib/store';
import { getClientEntitlements } from '@/lib/auth/entitlements';

declare global {
    interface Window {
        _terminalTouchStart?: number;
    }
}

type TerminalTab = 'positions' | 'orders' | 'history';

type TerminalTabsProps = {
    forceExpanded: boolean;
    terminalTab: TerminalTab;
    setTerminalTab: (value: TerminalTab) => void;
    visiblePositions: Position[];
    visibleOrders: Order[];
    visibleHistory: HistoryDeal[];
    handleScroll: () => void;
    handleClosePosition: (ticket: number) => void;
    handleCancelOrder: (ticket: number) => void;
    handleUpdatePosition: (ticket: number, sl?: number, tp?: number) => void;
    handleSymbolClick: (symbol: string) => void;
    handleAnalyze: (deal: unknown) => void;
    strategyEngineEnabled: boolean;
};

export function TerminalTabs({
    forceExpanded,
    terminalTab,
    setTerminalTab,
    visiblePositions,
    visibleOrders,
    visibleHistory,
    handleScroll,
    handleClosePosition,
    handleCancelOrder,
    handleUpdatePosition,
    handleSymbolClick,
    handleAnalyze,
    strategyEngineEnabled,
}: TerminalTabsProps) {
    const tabs: TerminalTab[] = ['positions', 'orders', 'history'];
    const hasAcceptedMt5Terms = useMarketStore((state) => state.hasAcceptedMt5Terms);
    const [hasYourMt5Module, setHasYourMt5Module] = useState(
        () => typeof window !== 'undefined' && getClientEntitlements().hasYourMt5
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const syncEntitlements = () => setHasYourMt5Module(getClientEntitlements().hasYourMt5);
        syncEntitlements();
        window.addEventListener('storage', syncEntitlements);
        window.addEventListener('focus', syncEntitlements);
        window.addEventListener('auth-changed', syncEntitlements);
        window.addEventListener('auth-state-changed', syncEntitlements);
        return () => {
            window.removeEventListener('storage', syncEntitlements);
            window.removeEventListener('focus', syncEntitlements);
            window.removeEventListener('auth-changed', syncEntitlements);
            window.removeEventListener('auth-state-changed', syncEntitlements);
        };
    }, []);

    const shouldShowActivationChecklist = !hasYourMt5Module || !hasAcceptedMt5Terms;

    return (
        <div
            className="flex-1 min-h-0 relative overflow-hidden"
            onTouchStart={(e) => {
                if (!forceExpanded) return;
                const touch = e.touches[0];
                window._terminalTouchStart = touch.clientX;
            }}
            onTouchEnd={(e) => {
                if (!forceExpanded) return;
                const touchStart = window._terminalTouchStart;
                if (touchStart === undefined) return;

                const touchEnd = e.changedTouches[0].clientX;
                const deltaX = touchEnd - touchStart;
                const threshold = 50;
                const currentIndex = tabs.indexOf(terminalTab);

                if (Math.abs(deltaX) > threshold) {
                    if (deltaX < 0 && currentIndex < tabs.length - 1) {
                        setTerminalTab(tabs[currentIndex + 1]);
                    } else if (deltaX > 0 && currentIndex > 0) {
                        setTerminalTab(tabs[currentIndex - 1]);
                    }
                }
                delete window._terminalTouchStart;
            }}
        >
            {shouldShowActivationChecklist && <ActivationChecklist />}
            <div
                className={cn('flex h-full w-full', forceExpanded && 'transition-transform duration-300 ease-out')}
                style={
                    forceExpanded
                        ? {
                              transform: `translateX(-${terminalTab === 'positions' ? 0 : terminalTab === 'orders' ? 100 : 200}%)`,
                          }
                        : {}
                }
            >
                <div
                    onScroll={forceExpanded ? handleScroll : undefined}
                    className={cn(
                        'h-full flex-col overflow-y-auto custom-scrollbar flex',
                        forceExpanded ? 'p-2 pt-0' : 'px-2 pt-0 pb-0',
                        forceExpanded ? 'w-full shrink-0' : (terminalTab === 'positions' ? 'w-full' : 'hidden')
                    )}
                >
                    {forceExpanded ? (
                        <MobilePositionsTable
                            positions={visiblePositions}
                            onClosePosition={handleClosePosition}
                            onUpdatePosition={handleUpdatePosition}
                            onSymbolClick={handleSymbolClick}
                        />
                    ) : (
                        <PositionsTable
                            positions={visiblePositions}
                            onClosePosition={handleClosePosition}
                            onUpdatePosition={handleUpdatePosition}
                            onSymbolClick={handleSymbolClick}
                        />
                    )}
                </div>

                <div
                    onScroll={forceExpanded ? handleScroll : undefined}
                    className={cn(
                        'h-full flex-col overflow-y-auto custom-scrollbar flex',
                        forceExpanded ? 'p-2 pt-0' : 'px-2 pt-0 pb-0',
                        forceExpanded ? 'w-full shrink-0' : (terminalTab === 'orders' ? 'w-full' : 'hidden')
                    )}
                >
                    {forceExpanded ? (
                        <MobileOrdersTable
                            orders={visibleOrders}
                            onCancelOrder={handleCancelOrder}
                            onSymbolClick={handleSymbolClick}
                        />
                    ) : (
                        <OrdersTable
                            orders={visibleOrders}
                            onCancelOrder={handleCancelOrder}
                            onSymbolClick={handleSymbolClick}
                        />
                    )}
                </div>

                <div
                    onScroll={forceExpanded ? handleScroll : undefined}
                    className={cn(
                        'h-full flex-col overflow-x-auto custom-scrollbar flex',
                        forceExpanded ? 'p-2 pt-0' : 'px-2 pt-0 pb-0',
                        forceExpanded ? 'w-full shrink-0' : (terminalTab === 'history' ? 'w-full' : 'hidden')
                    )}
                >
                    {forceExpanded ? (
                        <MobileHistoryTable
                            history={visibleHistory}
                            onSymbolClick={handleSymbolClick}
                            onAnalyze={strategyEngineEnabled ? handleAnalyze : undefined}
                            analyzeEnabled={strategyEngineEnabled}
                        />
                    ) : (
                        <HistoryTable
                            history={visibleHistory}
                            onSymbolClick={handleSymbolClick}
                            onAnalyze={strategyEngineEnabled ? handleAnalyze : undefined}
                            analyzeEnabled={strategyEngineEnabled}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
