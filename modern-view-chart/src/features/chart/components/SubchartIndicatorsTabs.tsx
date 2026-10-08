'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMarketStore, type IndicatorConfig } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';

interface SubchartIndicatorsTabsProps {
    chartId: string;
    isSubchartVisible: boolean;
}

const EMPTY_ARRAY: IndicatorConfig[] = [];

export function SubchartIndicatorsTabs({ chartId, isSubchartVisible }: SubchartIndicatorsTabsProps) {
    const indicators = useMarketStore(useShallow(state => state.chartIndicators[chartId] || EMPTY_ARRAY));
    const subchartIndicators = useMemo(() =>
        indicators.filter(i => i.pane === 'subchart'),
        [indicators]);

    const updateIndicator = useMarketStore(state => state.updateIndicator);
    const [isCompactLandscape, setIsCompactLandscape] = useState(false);

    useEffect(() => {
        const updateCompactMode = () => {
            if (typeof window === 'undefined') return;
            const isLandscape = window.innerWidth > window.innerHeight;
            const isShortViewport = window.innerHeight <= 500;
            setIsCompactLandscape(Boolean(isLandscape && isShortViewport));
        };

        updateCompactMode();
        window.addEventListener('resize', updateCompactMode);
        window.addEventListener('orientationchange', updateCompactMode);
        return () => {
            window.removeEventListener('resize', updateCompactMode);
            window.removeEventListener('orientationchange', updateCompactMode);
        };
    }, []);

    if (subchartIndicators.length === 0) return null;

    const handleTabClick = (targetId: string) => {
        // Find currently visible one
        const visibleInd = subchartIndicators.find(i => i.visible);

        // If the one clicked is already visible, do nothing
        if (visibleInd?.id === targetId) return;

        // Hide current if exists
        if (visibleInd) {
            updateIndicator(chartId, visibleInd.id, { visible: false });
        }

        // Show new one
        updateIndicator(chartId, targetId, { visible: true });
    };

    return (
        <div
            aria-label={isSubchartVisible ? "Indicator subchart tabs" : "Indicator tabs"}
            className={cn(
            "flex bg-secondary/80 backdrop-blur-md border border-border rounded-t-md overflow-hidden border-b-0",
            isCompactLandscape && "rounded-t-sm"
        )}>
            {subchartIndicators.map((ind, idx) => {
                const isVisible = ind.visible;
                return (
                    <button
                        key={ind.id}
                        onClick={() => handleTabClick(ind.id)}
                        className={cn(
                            "touch-target px-3 md:px-5 py-1 text-[11px] md:text-[11px] font-black uppercase tracking-tight md:tracking-widest transition-all relative",
                            isCompactLandscape && "!px-2 !py-0.5 !text-[10px] !tracking-tight",
                            isVisible
                                ? "bg-primary/20 text-primary font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                            idx !== 0 && "border-l border-border"
                        )}
                    >
                        {/* Active Indicator Top Border */}
                        {isVisible && (
                            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-primary" />
                        )}
                        {ind.type}
                    </button>
                );
            })}
        </div>
    );
}
