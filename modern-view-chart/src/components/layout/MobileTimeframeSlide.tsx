'use client';

import React from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface MobileTimeframeSlideProps {
    onSelect: () => void;
}

export function MobileTimeframeSlide({ onSelect }: MobileTimeframeSlideProps) {
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore((state) => state.tabs[activeTabId]);
    const activeChartId = activeTab?.activeChartId;
    const currentInterval = activeChartId ? activeTab.charts[activeChartId]?.interval : null;
    const setChartTimeframe = useMarketStore((state) => state.setChartTimeframe);

    const timeframes = [
        { id: '1', label: '1m' },
        { id: '5', label: '5m' },
        { id: '15', label: '15m' },
        { id: '60', label: '1H' },
        { id: '240', label: '4H' },
        { id: 'D', label: '1D' },
        { id: 'W', label: '1W' },
    ];

    const handleSelect = (id: string) => {
        if (activeChartId) {
            setChartTimeframe(activeChartId, id);
            if (window.navigator.vibrate) window.navigator.vibrate(10);
            onSelect();
        }
    };

    return (
        <div className="flex items-center w-full h-10 px-4 overflow-x-auto no-scrollbar gap-1 animate-in slide-in-from-right duration-300">
            <div className="flex-shrink-0 pr-2 border-r border-white/10 mr-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">Timeframe</span>
            </div>
            {timeframes.map((tf) => (
                <button
                    key={tf.id}
                    onClick={() => handleSelect(tf.id)}
                    className={cn(
                        "flex-shrink-0 min-w-[40px] h-8 rounded-lg flex items-center justify-center text-[12px] font-bold transition-all active:scale-95",
                        currentInterval === tf.id
                            ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                            : "text-zinc-400 hover:text-white active:bg-white/10"
                    )}
                >
                    {tf.label}
                </button>
            ))}
        </div>
    );
}
