'use client';

import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Grid3X3 } from 'lucide-react';

export function LayoutGridSelector() {
    const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null);
    const setLayoutMode = useMarketStore((state) => state.setLayoutMode);
    const activeTab = useMarketStore((state) => state.tabs[state.activeTabId]);

    // Grid size: 5x5
    const GRID_ROWS = 5;
    const GRID_COLS = 5;

    const handleSelect = (r: number, c: number) => {
        setLayoutMode(`${r}x${c}`, r, c);
    };

    return (
        <div className="relative group p-2">
            <button className="p-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 group-hover:text-blue-400" title="Change Layout">
                <Grid3X3 size={20} />
            </button>

            {/* Dropdown Grid */}
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 p-3 bg-[#1e222d] border border-zinc-700/50 rounded-xl shadow-2xl backdrop-blur-xl scale-95 origin-top-right group-hover:scale-100 transition-transform duration-200">
                <div className="mb-2 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#787b86]">
                    <span>Select Layout</span>
                    <span className="text-blue-400">{hovered ? `${hovered.r} x ${hovered.c}` : `${activeTab?.rows} x ${activeTab?.cols}`}</span>
                </div>

                <div
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
                    onMouseLeave={() => setHovered(null)}
                >
                    {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
                        const r = Math.floor(i / GRID_COLS) + 1;
                        const c = (i % GRID_COLS) + 1;
                        const isHighlighted = hovered && r <= hovered.r && c <= hovered.c;
                        const isCurrent = !hovered && r <= (activeTab?.rows || 1) && c <= (activeTab?.cols || 1);

                        return (
                            <div
                                key={i}
                                onMouseEnter={() => setHovered({ r, c })}
                                onClick={() => handleSelect(r, c)}
                                className={cn(
                                    "w-7 h-7 rounded-[4px] border transition-all cursor-pointer",
                                    isHighlighted
                                        ? "bg-blue-500/30 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                        : isCurrent
                                            ? "bg-zinc-500/20 border-zinc-500/50"
                                            : "bg-zinc-800/40 border-zinc-700/30 hover:border-zinc-500"
                                )}
                            />
                        );
                    })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-zinc-800/50">
                    {['1x1', '2x1', '2x2', '3x2'].map((m) => (
                        <button
                            key={m}
                            onClick={() => {
                                const [r, c] = m.split('x').map(Number);
                                handleSelect(r, c);
                            }}
                            className={cn(
                                "px-2 py-1 text-[9px] font-bold rounded border transition-all",
                                activeTab?.layoutMode === m
                                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                                    : "bg-zinc-800/30 border-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
