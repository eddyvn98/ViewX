'use client';

import React from 'react';
import { useMarketStore } from '@/lib/store';
import {
    TrendingUp,
    Minus,
    MoveVertical,
    Crosshair,
    Square,
    Magnet,
    ChevronLeft,
    ChevronRight,
    Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DrawingTool } from '@/lib/store/types';
import { motion, AnimatePresence } from 'framer-motion';

export function DrawingToolbar({ chartId }: { chartId: string }) {
    const isVisible = useMarketStore(state => state.isDrawingToolbarVisible);
    const toggleVisible = useMarketStore(state => state.toggleDrawingToolbar);
    const currentTool = useMarketStore(state => state.currentDrawingTool);
    const startDrawing = useMarketStore(state => state.startDrawing);
    const cancelDrawing = useMarketStore(state => state.cancelDrawing);
    const isDrawing = useMarketStore(state => state.isDrawing);
    const snapToCandle = useMarketStore(state => state.snapToCandle);
    const setSnapToCandle = useMarketStore(state => state.setSnapToCandle);

    const tools = [
        { id: 'trend-line', label: 'Trend Line', icon: <TrendingUp size={16} /> },
        { id: 'horizontal-line', label: 'Horizontal Line', icon: <Minus size={16} /> },
        { id: 'vertical-line', label: 'Vertical Line', icon: <MoveVertical size={16} /> },
        { id: 'crosshair', label: 'Crosshair', icon: <Crosshair size={16} /> },
        { id: 'rectangle', label: 'Rectangle', icon: <Square size={16} /> },
        { id: 'fib-retracement', label: 'Fib Retracement', icon: <span className="text-[10px] font-bold">F</span> },
        { id: 'fib-extension', label: 'Fib Extension', icon: <span className="text-[10px] font-bold">FE</span> },
    ];

    if (!chartId) return null;

    return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-[45] flex items-center pointer-events-none md:flex hidden animate-in fade-in slide-in-from-left-4 duration-500">
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
                                className={cn(
                                    "w-9 h-9 flex items-center justify-center rounded-lg transition-all relative group/btn",
                                    isActive
                                        ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]"
                                        : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5"
                                )}
                                title={tool.label}
                            >
                                {tool.icon}
                                <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-[10px] font-bold rounded shadow-xl opacity-0 translate-x-1 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 border border-border/50">
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
                        title="Magnet Mode (Snap to High/Low)"
                    >
                        <Magnet size={16} className={cn(snapToCandle && "animate-pulse")} />
                        <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-[10px] font-bold rounded shadow-xl opacity-0 translate-x-1 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 border border-border/50">
                            Magnet Mode
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
