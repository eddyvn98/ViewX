'use client';

import React from 'react';
import { useMarketStore } from '@/lib/store';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIMEFRAME_CONFIG } from './timeframe-config';

interface TimeframeSelectorProps {
    onClose: () => void;
}

export function TimeframeSelector({ onClose }: TimeframeSelectorProps) {
    const favoriteTimeframes = useMarketStore((state) => state.favoriteTimeframes);
    const toggleFavoriteTimeframe = useMarketStore((state) => state.toggleFavoriteTimeframe);

    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore((state) => state.tabs[activeTabId]);
    const activeChartId = activeTab?.activeChartId;
    const currentInterval = activeChartId ? activeTab.charts[activeChartId]?.interval : null;

    const setChartTimeframe = useMarketStore((state) => state.setChartTimeframe);

    const categories = ['PHÚT', 'GIỜ', 'NGÀY'];

    const handleSelect = (id: string) => {
        if (activeChartId) {
            setChartTimeframe(activeChartId, id);
        }
        onClose();
    };

    return (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e222d] border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden py-1">
            {categories.map((cat) => (
                <div key={cat} className="mb-1">
                    <div className="px-3 py-1 text-[9px] font-bold text-zinc-600 uppercase tracking-widest flex justify-between items-center group/cat">
                        {cat}
                        <div className="h-[1px] flex-1 bg-zinc-800/50 ml-2" />
                    </div>
                    {TIMEFRAME_CONFIG.filter((tf: any) => tf.category === cat).map((tf: any) => (
                        <div
                            key={tf.id}
                            onClick={() => handleSelect(tf.id)}
                            className={cn(
                                "group flex items-center justify-between px-3 py-1.5 cursor-pointer transition-all",
                                currentInterval === tf.id ? "bg-zinc-800/50" : "hover:bg-zinc-800/30"
                            )}
                        >
                            <span className={cn(
                                "text-xs font-medium",
                                currentInterval === tf.id ? "text-yellow-500" : "text-zinc-300 group-hover:text-white"
                            )}>
                                {tf.title}
                            </span>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavoriteTimeframe(tf.id);
                                }}
                                className={cn(
                                    "p-1 rounded hover:bg-zinc-700 transition-all",
                                    favoriteTimeframes.includes(tf.id)
                                        ? "text-yellow-500 opacity-100"
                                        : "text-zinc-600 opacity-0 group-hover:opacity-100"
                                )}
                            >
                                <Star size={12} fill={favoriteTimeframes.includes(tf.id) ? "currentColor" : "none"} />
                            </button>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
