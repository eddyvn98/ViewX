import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { IndicatorLayer } from './IndicatorLayer';
import { DrawingLayer } from './DrawingLayer';
import { Activity, Pencil, Zap } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { cn } from '@/lib/utils';

export function LayerManager() {
    const [activeTab, setActiveTab] = useState<'indicator' | 'draw'>('indicator');

    const tabs = [
        { id: 'indicator' as const, label: 'Indicators', icon: Activity },
        { id: 'draw' as const, label: 'Draw Tools', icon: Pencil },
    ];

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
            {/* Sub-tab Header (Synced with StrategyPanel) */}
            <LayoutGroup id="layer-manager-tabs">
                <div className="flex bg-secondary/30 dark:bg-white/[0.02] p-0.5 gap-1 mx-4 mt-2 mb-2 rounded-lg shrink-0 relative z-0">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md transition-colors duration-300 text-[9.5px] font-bold uppercase border border-transparent relative outline-none",
                                    isActive
                                        ? "text-primary"
                                        : "text-muted-foreground/40 hover:text-foreground/60"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="active-layer-tab"
                                        className="absolute inset-0 bg-primary/10 rounded-md shadow-sm border border-primary/5"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <div className="relative z-10 flex items-center gap-1.5">
                                    <tab.icon size={10} className={cn("transition-transform", isActive && "scale-110")} />
                                    <span>{tab.label}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </LayoutGroup>

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
