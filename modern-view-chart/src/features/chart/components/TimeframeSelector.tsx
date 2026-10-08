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
        <div className="absolute top-full left-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-2xl z-50 overflow-hidden py-1">
            {categories.map((cat) => (
                <div key={cat} className="mb-1">
                    <div className="px-3 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex justify-between items-center group/cat">
                        {cat}
                        <div className="h-[1px] flex-1 bg-border/50 ml-2" />
                    </div>
                    {TIMEFRAME_CONFIG.filter((tf) => tf.category === cat).map((tf) => (
                        <div
                            key={tf.id}
                            className={cn(
                                "group flex items-center justify-between px-1 py-0.5 transition-all",
                                currentInterval === tf.id ? "bg-secondary/40" : "hover:bg-secondary/20"
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => handleSelect(tf.id)}
                                aria-pressed={currentInterval === tf.id}
                                className={cn(
                                    "touch-target flex-1 px-2 text-left text-xs font-medium",
                                    currentInterval === tf.id ? "text-yellow-500" : "text-muted-foreground group-hover:text-foreground"
                                )}
                            >
                                {tf.title}
                            </button>

                            <button
                                type="button"
                                onClick={() => toggleFavoriteTimeframe(tf.id)}
                                aria-label={`Toggle favorite ${tf.title}`}
                                aria-pressed={favoriteTimeframes.includes(tf.id)}
                                className={cn(
                                    "touch-target p-1 rounded hover:bg-secondary transition-all",
                                    favoriteTimeframes.includes(tf.id)
                                        ? "text-yellow-500 opacity-100"
                                        : "text-muted-foreground opacity-70 group-hover:opacity-100"
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
