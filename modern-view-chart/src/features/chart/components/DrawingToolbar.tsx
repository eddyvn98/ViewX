'use client';

import React from 'react';
import { useMarketStore } from '@/lib/store';
import {
    Minus,
    Square,
    Magnet,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DrawingTool } from '@/lib/store/types';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

function TrendLineIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="3" cy="11.5" r="1.2" fill="currentColor" />
            <circle cx="12.5" cy="4" r="1.2" fill="currentColor" />
            <path d="M3.8 10.9L11.8 4.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
    );
}

function VerticalLineIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.2V13.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M5.2 3.2H10.8M5.2 12.8H10.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function CrosshairIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="4.3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1.5V4M8 12V14.5M1.5 8H4M12 8H14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="8" r="1.1" fill="currentColor" />
        </svg>
    );
}

function FibRetracementIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.2 4H13.8M2.2 8H13.8M2.2 12H13.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M13 3L9.8 5.2M13 7L9.8 9.2M13 11L9.8 13.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M10.2 4.7L9.3 5.3L10.2 5.9M10.2 8.7L9.3 9.3L10.2 9.9M10.2 12.7L9.3 13.3L10.2 13.9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function FibExtensionIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.2 4H13.8M2.2 8H13.8M2.2 12H13.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M9.4 3L13.2 5.6M9.4 7L13.2 9.6M9.4 11L13.2 13.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M12.2 4.8L13.3 5.6L12.2 6.4M12.2 8.8L13.3 9.6L12.2 10.4M12.2 12.8L13.3 13.6L12.2 14.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function DrawingToolbar({ chartId }: { chartId: string }) {
    const t = useTranslations('ChartPanel.layerManager');
    const isVisible = useMarketStore(state => state.isDrawingToolbarVisible);
    const toggleVisible = useMarketStore(state => state.toggleDrawingToolbar);
    const currentTool = useMarketStore(state => state.currentDrawingTool);
    const startDrawing = useMarketStore(state => state.startDrawing);
    const cancelDrawing = useMarketStore(state => state.cancelDrawing);
    const isDrawing = useMarketStore(state => state.isDrawing);
    const snapToCandle = useMarketStore(state => state.snapToCandle);
    const setSnapToCandle = useMarketStore(state => state.setSnapToCandle);

    const tools = [
        { id: 'trend-line', label: t('drawing.objectNames.trendLine'), icon: <TrendLineIcon /> },
        { id: 'horizontal-line', label: t('drawing.objectNames.horizontalLine'), icon: <Minus size={16} /> },
        { id: 'vertical-line', label: t('drawing.objectNames.verticalLine'), icon: <VerticalLineIcon /> },
        { id: 'crosshair', label: t('drawing.objectNames.crosshair'), icon: <CrosshairIcon /> },
        { id: 'rectangle', label: t('drawing.objectNames.rectangle'), icon: <Square size={16} /> },
        { id: 'fib-retracement', label: t('drawing.objectNames.fibRetracement'), icon: <FibRetracementIcon /> },
        { id: 'fib-extension', label: t('drawing.objectNames.fibExtension'), icon: <FibExtensionIcon /> },
    ];

    if (!chartId) return null;

    return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-[80] flex items-center pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-500 max-md:left-2 max-md:top-auto max-md:bottom-12 max-md:translate-y-0">
            <motion.div
                initial={false}
                animate={{ x: isVisible ? 8 : -52 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="flex items-stretch pointer-events-auto"
            >
                {/* Main Toolbar Panel */}
                <div className="flex flex-col gap-1.5 p-1.5 glass-panel rounded-xl border border-white/10 shadow-2xl relative">
                    {tools.map(tool => {
                        const isActive = currentTool === tool.id && isDrawing;
                        return (
                            <button
                                key={tool.id}
                                onClick={() => isActive ? cancelDrawing() : startDrawing(tool.id as DrawingTool)}
                                data-testid={`drawing-tool-${tool.id}`}
                                className={cn(
                                    "w-9 h-9 flex items-center justify-center rounded-lg transition-all relative group/btn",
                                    isActive
                                        ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]"
                                        : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
                                )}
                                title={tool.label}
                            >
                                {tool.icon}
                                <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-[11px] font-bold rounded shadow-xl opacity-0 translate-x-1 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 border border-border/50">
                                    {tool.label}
                                </div>
                            </button>
                        );
                    })}

                    <div className="h-px bg-white/5 mx-1 my-1" />

                    {/* Snapping Toggle */}
                    <button
                        onClick={() => setSnapToCandle(!snapToCandle)}
                        className={cn(
                            "w-9 h-9 flex items-center justify-center rounded-lg transition-all relative group/btn",
                            snapToCandle
                                ? "text-primary bg-primary/10 border border-primary/20 shadow-[0_0_10px_rgba(var(--primary-rgb),0.15)]"
                                : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
                        )}
                        title={t('drawing.magnetModeTooltip')}
                    >
                        <Magnet size={16} className={cn(snapToCandle && "animate-pulse")} />
                        <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-[11px] font-bold rounded shadow-xl opacity-0 translate-x-1 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 border border-border/50">
                            {t('drawing.magnetMode')}
                        </div>
                    </button>
                </div>

                {/* Integrated Toggle Handle */}
                <div className="flex flex-col justify-center -ml-px">
                    <button
                        onClick={toggleVisible}
                        className={cn(
                            "group/toggle w-4 h-12 flex items-center justify-center rounded-r-xl border border-l-0 border-white/10 glass-panel hover:bg-white/10 transition-all",
                            isVisible ? "opacity-100" : "opacity-100 bg-primary/20 border-primary/20"
                        )}
                    >
                        {isVisible ? (
                            <ChevronLeft size={10} className="text-muted-foreground/40 group-hover/toggle:text-primary transition-colors" />
                        ) : (
                            <ChevronRight size={10} className="text-primary animate-pulse" />
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
