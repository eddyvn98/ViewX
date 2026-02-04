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
                            "px-2 py-1 rounded text-[11px] font-bold transition-all",
                            currentInterval === tf.id
                                ? "text-yellow-500 bg-yellow-500/10"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
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
                        "p-1 rounded hover:bg-zinc-800 transition-all",
                        isOpen ? "bg-zinc-800 text-yellow-500" : "text-zinc-500"
                    )}
                >
                    <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                    <TimeframeSelector onClose={() => setIsOpen(false)} />
                )}
            </div>
        </div>
    );
}
