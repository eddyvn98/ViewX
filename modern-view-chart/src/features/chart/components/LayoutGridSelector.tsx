'use client';

import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Grid3X3 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type LayoutGridSelectorProps = {
    renderTrigger?: (props: { isOpen: boolean; toggle: () => void }) => React.ReactNode;
};

export function LayoutGridSelector({ renderTrigger }: LayoutGridSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null);
    const t = useTranslations('ChartToolbar');
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

    const toggle = () => setIsOpen((prev) => !prev);

    return (
        <div className="relative group px-1">
            {renderTrigger ? (
                renderTrigger({ isOpen, toggle })
            ) : (
                <button
                    onClick={toggle}
                    className={cn(
                        "p-1.5 rounded-md transition-all duration-200 border",
                        isOpen
                            ? "bg-primary/10 text-primary border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                            : "text-muted-foreground border-transparent hover:bg-secondary/50 hover:text-foreground"
                    )}
                    title={isOpen ? "" : t('changeLayout')}
                >
                    <Grid3X3 size={16} className={cn("transition-transform duration-300", isOpen && "rotate-90")} />
                </button>
            )}

            {isOpen && (
                <>
                    {/* Backdrop to close on click outside */}
                    <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Grid */}
                    <div className="absolute left-0 top-full mt-1.5 z-[70] p-3 bg-popover border border-border rounded-lg shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-top-left min-w-[160px]">
                        <div className="mb-3 flex justify-between items-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                            <span>{t('gridLayout')}</span>
                            <span className="text-primary font-mono text-[11px]">
                                {hovered ? `${hovered.r}x${hovered.c}` : `${activeTab?.rows || 1}x${activeTab?.cols || 1}`}
                            </span>
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
                                            "w-5 h-5 rounded-[3px] border transition-all cursor-pointer",
                                            isHighlighted
                                                ? "bg-primary/40 border-primary shadow-[0_0_8px_rgba(var(--primary),0.3)] scale-110 z-10"
                                                : isCurrent
                                                    ? "bg-primary/20 border-primary/50"
                                                    : "bg-secondary/40 border-border/50 hover:border-muted-foreground/50 hover:bg-secondary/80"
                                        )}
                                    />
                                );
                            })}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-border/50">
                            {['1x1', '2x1', '2x2', '3x2'].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => {
                                        const [r, c] = m.split('x').map(Number);
                                        handleSelect(r, c);
                                    }}
                                    className={cn(
                                        "px-2 py-1 text-[11px] font-bold rounded border transition-all flex-1 text-center whitespace-nowrap",
                                        activeTab?.layoutMode === m
                                            ? "bg-primary/20 border-primary/40 text-primary"
                                            : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80"
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
