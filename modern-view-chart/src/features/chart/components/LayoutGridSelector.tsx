'use client';

import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Grid3X3 } from 'lucide-react';

export function LayoutGridSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null);
    const setLayoutMode = useMarketStore((state) => state.setLayoutMode);
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore((state) => state.tabs[activeTabId]);

    // Grid size: 5x5
    const GRID_ROWS = 5;
    const GRID_COLS = 5;

    const handleSelect = (r: number, c: number) => {
        setLayoutMode(`${r}x${c}`, r, c);
        setIsOpen(false);
    };

    return (
        <div className="relative group p-0.5">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "p-2 rounded-md transition-all duration-200",
                    isOpen
                        ? "bg-blue-500/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                )}
                title={isOpen ? "" : "Change Layout"}
            >
                <Grid3X3 size={20} className={cn("transition-transform duration-300", isOpen && "rotate-90")} />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop to close on click outside */}
                    <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Grid */}
                    <div className="absolute right-0 top-full mt-2 z-[70] p-4 bg-[#1e222d] border border-zinc-700/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                        <div className="mb-4 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#787b86]">
                            <span>Select Layout</span>
                            <span className="text-blue-400 font-mono text-xs">
                                {hovered ? `${hovered.r} x ${hovered.c}` : `${activeTab?.rows || 1} x ${activeTab?.cols || 1}`}
                            </span>
                        </div>

                        <div
                            className="grid gap-2"
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
                                                ? "bg-blue-500/40 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.3)] scale-110 z-10"
                                                : isCurrent
                                                    ? "bg-blue-500/20 border-blue-500/50"
                                                    : "bg-zinc-800/40 border-zinc-700/30 hover:border-zinc-500 hover:bg-zinc-700/50"
                                        )}
                                    />
                                );
                            })}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2 pt-4 border-t border-zinc-800/50">
                            {['1x1', '2x1', '2x2', '3x2'].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => {
                                        const [r, c] = m.split('x').map(Number);
                                        handleSelect(r, c);
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-bold rounded-md border transition-all flex-1 text-center",
                                        activeTab?.layoutMode === m
                                            ? "bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                            : "bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:text-zinc-200 hover:border-zinc-500"
                                    )}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
