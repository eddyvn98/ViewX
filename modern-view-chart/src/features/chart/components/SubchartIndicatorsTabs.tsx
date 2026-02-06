'use client';

import React, { useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';

interface SubchartIndicatorsTabsProps {
    chartId: string;
    isSubchartVisible: boolean;
}

const EMPTY_ARRAY: any[] = [];

export function SubchartIndicatorsTabs({ chartId, isSubchartVisible }: SubchartIndicatorsTabsProps) {
    const indicators = useMarketStore(useShallow(state => state.chartIndicators[chartId] || EMPTY_ARRAY));
    const subchartIndicators = useMemo(() =>
        indicators.filter(i => i.pane === 'subchart'),
        [indicators]);

    const toggleIndicatorVisibility = useMarketStore(state => state.toggleIndicatorVisibility);

    if (subchartIndicators.length === 0) return null;

    const handleTabClick = (targetId: string) => {
        // Find currently visible one
        const visibleInd = subchartIndicators.find(i => i.visible);

        // If the one clicked is already visible, do nothing
        if (visibleInd?.id === targetId) return;

        // Hide current if exists
        if (visibleInd) {
            toggleIndicatorVisibility(chartId, visibleInd.id);
        }

        // Show new one
        toggleIndicatorVisibility(chartId, targetId);
    };

    return (
        <div className="flex bg-[#1e222d]/80 backdrop-blur-md border border-zinc-700/40 rounded-t-md overflow-hidden border-b-0">
            {subchartIndicators.map((ind, idx) => (
                <button
                    key={ind.id}
                    onClick={() => handleTabClick(ind.id)}
                    className={cn(
                        "px-3 md:px-5 py-1 text-[11px] md:text-[10px] font-black uppercase tracking-tight md:tracking-widest transition-all relative",
                        ind.visible
                            ? "bg-blue-600/20 text-blue-400"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5",
                        idx !== 0 && "border-l border-zinc-800/40"
                    )}
                >
                    {/* Active Indicator Top Border */}
                    {ind.visible && (
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    )}
                    {ind.type}
                </button>
            ))}
        </div>
    );
}
