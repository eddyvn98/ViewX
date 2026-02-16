import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { IndicatorLayer } from './IndicatorLayer';
import { DrawingLayer } from './DrawingLayer';
import { Layout, Pencil, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LayerManager() {
    const [activeTab, setActiveTab] = useState<'indicator' | 'draw'>('indicator');

    const tabs = [
        { id: 'indicator' as const, label: 'Indicators', icon: Layout },
        { id: 'draw' as const, label: 'Draw Tools', icon: Pencil },
    ];

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Sub-tab Header */}
            <div className="flex p-2 gap-1 bg-secondary/5 border-b border-border shrink-0">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex-1 flex items-center justify-center py-1.5 gap-2 rounded-lg transition-all border",
                                isActive
                                    ? "bg-primary/20 border-primary/30 text-primary shadow-[0_0_10px_rgba(var(--primary),0.1)]"
                                    : "bg-secondary/20 border-transparent text-muted-foreground hover:bg-secondary/30"
                            )}
                        >
                            <tab.icon size={12} className={cn("transition-transform", isActive && "scale-110")} />
                            <span className="text-[10px] font-bold uppercase tracking-tight">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
                <div className={cn("absolute inset-0 transition-all duration-300", activeTab === 'indicator' ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-full pointer-events-none")}>
                    <IndicatorLayer />
                </div>
                <div className={cn("absolute inset-0 transition-all duration-300", activeTab === 'draw' ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full pointer-events-none")}>
                    <DrawingLayer />
                </div>
            </div>

            {/* Quick Actions / Status Footer */}
            <div className="p-2 border-t border-border bg-secondary/10 shrink-0">
                <div className="flex items-center gap-2 text-muted-foreground/30">
                    <Zap size={10} className="text-yellow-500/40" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Manual Drawing Mode Enabled</span>
                </div>
            </div>
        </div>
    );
}
