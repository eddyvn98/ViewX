import React from 'react';
import { useMarketStore } from '@/lib/store';
import { Trash2, Eye, EyeOff, Settings2, ChevronDown, ChevronUp, Magnet, TrendingUp, Minus, Square } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DrawingTool, DrawingConfig } from '@/lib/store/types';

export function DrawingLayer() {
    const activeTabId = useMarketStore(state => state.activeTabId);
    const activeChartId = useMarketStore(state => state.tabs[activeTabId || '']?.activeChartId);
    const chartId = activeChartId || '';

    const drawings = useMarketStore(useShallow(state => chartId ? state.chartDrawings[chartId] || [] : []));
    const currentTool = useMarketStore(state => state.currentDrawingTool);
    const isDrawing = useMarketStore(state => state.isDrawing);

    const startDrawing = useMarketStore(state => state.startDrawing);
    const cancelDrawing = useMarketStore(state => state.cancelDrawing);
    const removeDrawing = useMarketStore(state => state.removeDrawing);
    const updateDrawing = useMarketStore(state => state.updateDrawing);
    const toggleVisibility = useMarketStore(state => state.toggleDrawingVisibility);
    const snapToCandle = useMarketStore(state => state.snapToCandle);
    const setSnapToCandle = useMarketStore(state => state.setSnapToCandle);

    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    const tools = [
        { id: 'fib-retracement', label: 'Fib Retracement', icon: 'F' },
        { id: 'fib-extension', label: 'Fib Extension', icon: 'FE' },
        { id: 'trend-line', label: 'Trend Line', icon: <TrendingUp size={16} /> },
        { id: 'horizontal-line', label: 'Horizontal Line', icon: <Minus size={16} /> },
        { id: 'rectangle', label: 'Rectangle', icon: <Square size={16} /> },
    ];

    if (!chartId) return null;

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* Drawing Tools Selector */}
            <div className="p-3 border-b border-border bg-secondary/10">
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground/60 mb-2 tracking-tight">Active Tools</h4>
                <div className="grid grid-cols-2 gap-2">
                    {tools.map(tool => (
                        <button
                            key={tool.id}
                            onClick={() => isDrawing && currentTool === tool.id ? cancelDrawing() : startDrawing(tool.id as DrawingTool)}
                            className={cn(
                                "flex items-center gap-2 p-2 rounded-md border transition-all text-left",
                                currentTool === tool.id
                                    ? "bg-blue-500/10 border-blue-500/50 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                    : "bg-secondary/20 border-transparent hover:border-border text-foreground/70"
                            )}
                        >
                            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                {typeof tool.icon === 'string' ? (
                                    <span className="text-[10px] font-bold">{tool.icon}</span>
                                ) : (
                                    tool.icon
                                )}
                            </div>
                            <span className="text-[10px] font-bold truncate">{tool.label}</span>
                        </button>
                    ))}
                </div>

                {isDrawing && (
                    <div className="mt-3 p-2 bg-blue-500/10 rounded-md border border-blue-500/30 animate-pulse">
                        <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider text-center">
                            Drawing Active - Click on chart
                        </p>
                    </div>
                )}

                {/* Snapping Toggle */}
                <div className="mt-3 flex items-center justify-between p-2 bg-secondary/10 rounded-md border border-border/40">
                    <div className="flex items-center gap-2">
                        <Magnet size={12} className={cn("transition-colors", snapToCandle ? "text-primary" : "text-muted-foreground/40")} />
                        <span className="text-[10px] font-bold uppercase tracking-tight">Snap to High/Low</span>
                    </div>
                    <button
                        onClick={() => setSnapToCandle(!snapToCandle)}
                        className={cn(
                            "w-8 h-4 rounded-full relative transition-colors duration-300",
                            snapToCandle ? "bg-primary" : "bg-secondary/40"
                        )}
                    >
                        <motion.div
                            animate={{ x: snapToCandle ? 16 : 2 }}
                            className="absolute top-1 w-2 h-2 rounded-full bg-white shadow-sm"
                        />
                    </button>
                </div>
            </div>

            {/* List of active drawings */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-0.5">
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground/60 mb-2 tracking-tight">Applied Objects</h4>
                {drawings.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground/30 text-[10px] italic">
                        No manual drawings
                    </div>
                )}

                {drawings.map(drawing => (
                    <div key={drawing.id} className="flex flex-col mb-0.5">
                        <div className={cn(
                            "flex items-center gap-2 px-2 py-1 rounded-md transition-colors min-h-[32px] group",
                            expandedId === drawing.id ? "bg-secondary/30" : "hover:bg-secondary/20"
                        )}>
                            <button
                                onClick={() => toggleVisibility(chartId, drawing.id)}
                                className={cn("transition-colors flex-shrink-0", drawing.visible ? "text-blue-500" : "text-muted-foreground/40")}
                            >
                                {drawing.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>

                            <div className="flex-1 flex items-center gap-2 overflow-hidden cursor-pointer" onClick={() => setExpandedId(expandedId === drawing.id ? null : drawing.id)}>
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: drawing.color }} />
                                <span className="text-[10px] truncate text-foreground font-medium">
                                    {drawing.type === 'fib-retracement' ? 'Fib Retracement' :
                                        drawing.type === 'fib-extension' ? 'Fib Extension' :
                                            drawing.type === 'trend-line' ? 'Trend Line' :
                                                drawing.type === 'horizontal-line' ? 'Horizontal Line' :
                                                    drawing.type === 'rectangle' ? 'Rectangle' : drawing.type}
                                </span>
                            </div>

                            <button
                                onClick={() => setExpandedId(expandedId === drawing.id ? null : drawing.id)}
                                className={cn("p-1 transition-all", expandedId === drawing.id ? "text-primary" : "text-muted-foreground/40 hover:text-foreground")}
                            >
                                <Settings2 size={11} />
                            </button>

                            <button
                                onClick={() => removeDrawing(chartId, drawing.id)}
                                className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
                            >
                                <Trash2 size={11} />
                            </button>
                        </div>

                        {/* Settings Panel */}
                        <AnimatePresence>
                            {expandedId === drawing.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-secondary/15 rounded-b-md mx-2 border-x border-b border-border/30"
                                >
                                    <div className="p-3 flex flex-col gap-3">
                                        {/* Color & Line Settings */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-bold text-muted-foreground/60 uppercase">Line Style</label>
                                                <div className="flex bg-secondary/30 rounded p-0.5 gap-0.5">
                                                    {(['solid', 'dashed', 'dotted'] as const).map(style => (
                                                        <button
                                                            key={style}
                                                            onClick={() => updateDrawing(chartId, drawing.id, { lineStyle: style })}
                                                            className={cn(
                                                                "flex-1 py-1 px-1 rounded transition-all",
                                                                drawing.lineStyle === style ? "bg-primary/20 text-primary border border-primary/30" : "hover:bg-secondary/40 text-muted-foreground"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "h-0.5 w-full mx-auto",
                                                                style === 'solid' ? "bg-current" : style === 'dashed' ? "border-b border-dashed border-current" : "border-b border-dotted border-current"
                                                            )} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-bold text-muted-foreground/60 uppercase">Width ({drawing.lineWidth}px)</label>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="5"
                                                    step="1"
                                                    value={drawing.lineWidth}
                                                    onChange={(e) => updateDrawing(chartId, drawing.id, { lineWidth: parseInt(e.target.value) })}
                                                    className="w-full accent-primary h-1 bg-secondary/50 rounded-lg appearance-none cursor-pointer mt-2"
                                                />
                                            </div>
                                        </div>

                                        {/* Levels Toggles (Fib Only) */}
                                        {(drawing.type === 'fib-retracement' || drawing.type === 'fib-extension') && (
                                            <div className="flex flex-col gap-2 border-t border-border/30 pt-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[9px] font-bold text-muted-foreground/60 uppercase">Active Levels</label>
                                                    <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">FIBONACCI</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618, 2.618].map(ratio => {
                                                        const isEnabled = drawing.params?.enabledLevels?.[ratio.toString()] !== false;
                                                        return (
                                                            <button
                                                                key={ratio}
                                                                onClick={() => {
                                                                    const enabledLevels = { ...(drawing.params?.enabledLevels || {}) };
                                                                    enabledLevels[ratio.toString()] = !isEnabled;
                                                                    updateDrawing(chartId, drawing.id, {
                                                                        params: { ...drawing.params, enabledLevels }
                                                                    });
                                                                }}
                                                                className={cn(
                                                                    "flex items-center justify-center p-1.5 rounded border text-[9px] font-bold transition-all",
                                                                    isEnabled
                                                                        ? "bg-primary/10 border-primary/30 text-primary"
                                                                        : "bg-secondary/10 border-transparent text-muted-foreground/40 hover:bg-secondary/20"
                                                                )}
                                                            >
                                                                {ratio}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    );
}
