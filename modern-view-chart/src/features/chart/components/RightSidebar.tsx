import React, { memo } from 'react';
import { useMarketStore } from '@/lib/store';
import { MarketList } from '@/features/market/MarketList';
import { IndicatorManager } from '@/features/chart/components/IndicatorManager';
import { OrderForm } from '@/features/terminal/components/OrderForm';
import { StrategyPanel } from '@/features/chart/components/StrategyPanel';
import { LineChart, Layout, ShoppingCart, X, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

export const RightSidebar = memo(function RightSidebar() {
    const activeTab = useMarketStore(state => state.activeRightSidebarTab);
    const setActiveTab = useMarketStore(state => state.setActiveRightSidebarTab);

    const tabs = [
        { id: 'market', icon: LineChart, label: 'Watchlist' },
        { id: 'indicators', icon: Layout, label: 'Indicators' },
        { id: 'strategy', icon: Brain, label: 'Strategy' },
        { id: 'trade', icon: ShoppingCart, label: 'Trade' }
    ];

    return (
        <aside className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col h-full overflow-hidden shrink-0">
            {/* Tab Header */}
            <div className="flex border-b border-zinc-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex-1 flex flex-col items-center py-2 gap-1 transition-all border-b-2",
                            activeTab === tab.id
                                ? "text-blue-500 border-blue-500 bg-blue-500/5"
                                : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900"
                        )}
                    >
                        <tab.icon size={18} />
                        <span className="text-[10px] uppercase font-bold tracking-wider">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative min-h-0 flex flex-col">
                <div className={cn("flex-1 min-h-0", activeTab === 'market' ? "flex flex-col" : "hidden")}>
                    <MarketList mode="watchlist" />
                </div>
                <div className={cn("flex-1 min-h-0", activeTab === 'indicators' ? "flex flex-col" : "hidden")}>
                    <IndicatorManager />
                </div>
                <div className={cn("flex-1 min-h-0", activeTab === 'strategy' ? "flex flex-col" : "hidden")}>
                    <StrategyPanel />
                </div>
                <div className={cn("flex-1 overflow-y-auto custom-scrollbar min-h-0", activeTab === 'trade' ? "block" : "hidden")}>
                    <OrderForm />
                </div>
            </div>
        </aside>
    );
});
