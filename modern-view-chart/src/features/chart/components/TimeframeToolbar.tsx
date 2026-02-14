'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeframeSelector } from './TimeframeSelector';
import { TIMEFRAME_CONFIG } from './timeframe-config';

export function TimeframeToolbar() {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const favoriteTimeframes = useMarketStore((state) => state.favoriteTimeframes);
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore((state) => state.tabs[activeTabId]);
    const activeChartId = activeTab?.activeChartId;
    const currentInterval = activeChartId ? activeTab.charts[activeChartId]?.interval : null;

    const setChartTimeframe = useMarketStore((state) => state.setChartTimeframe);

    const favorites = TIMEFRAME_CONFIG.filter(tf => favoriteTimeframes.includes(tf.id));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex items-center gap-1 h-full" ref={containerRef}>
            {/* Favorite Buttons */}
            <div className="flex items-center gap-0.5">
                {favorites.map((tf) => (
                    <button
                        key={tf.id}
                        onClick={() => activeChartId && setChartTimeframe(activeChartId, tf.id)}
                        className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all",
                            currentInterval === tf.id
                                ? "text-primary bg-primary/10"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        )}
                    >
                        {tf.label}
                    </button>
                ))}
            </div>

            {/* Dropdown Trigger */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "p-0.5 rounded hover:bg-secondary/40 transition-all",
                        isOpen ? "bg-secondary text-primary" : "text-muted-foreground"
                    )}
                >
                    <ChevronDown size={13} className={cn("transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                    <TimeframeSelector onClose={() => setIsOpen(false)} />
                )}
            </div>
        </div>
    );
}
