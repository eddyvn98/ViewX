import React from 'react';
import { useMarketStore } from '@/lib/store';
import { Trash2, Eye, EyeOff, Settings2, Lock, Unlock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export function DrawingLayer() {
    const t = useTranslations('ChartPanel.layerManager.drawing');
    const activeTabId = useMarketStore(state => state.activeTabId);
    const activeChartId = useMarketStore(state => state.tabs[activeTabId || '']?.activeChartId);
    const chartId = activeChartId || '';

    const drawings = useMarketStore(useShallow(state => chartId ? state.chartDrawings[chartId] || [] : []));
    const removeDrawing = useMarketStore(state => state.removeDrawing);
    const updateDrawing = useMarketStore(state => state.updateDrawing);
    const toggleVisibility = useMarketStore(state => state.toggleDrawingVisibility);
    const toggleAllVisibility = useMarketStore(state => state.toggleAllDrawingVisibility);
    const toggleAllLock = useMarketStore(state => state.toggleAllDrawingLock);
    const clearDrawings = useMarketStore(state => state.clearDrawings);

    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    if (!chartId) return null;

    return (
        <div className="flex flex-col h-full bg-background relative overflow-y-auto custom-scrollbar">

            {/* List of active drawings */}
            <div className="p-3 flex flex-col gap-0.5 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold uppercase text-muted-foreground/60 tracking-tight">{t('appliedObjects')}</h4>
                    {drawings.length > 0 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    const anyVisible = drawings.some(d => d.visible);
                                    toggleAllVisibility(chartId, !anyVisible);
                                }}
                                title={drawings.some(d => d.visible) ? t('hideAll') : t('showAll')}
                                className="p-1 text-muted-foreground/60 hover:text-primary transition-colors"
                            >
                                {drawings.some(d => d.visible) ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                            <button
                                onClick={() => {
                                    const anyLocked = drawings.some(d => d.locked);
                                    toggleAllLock(chartId, !anyLocked);
                                }}
                                title={drawings.some(d => d.locked) ? t('unlockAll') : t('lockAll')}
                                className="p-1 text-muted-foreground/60 hover:text-primary transition-colors"
                            >
                                {drawings.some(d => d.locked) ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm(t('deleteAllConfirm'))) clearDrawings(chartId);
                                }}
                                title={t('deleteAll')}
                                className="p-1 text-muted-foreground/60 hover:text-red-400 transition-colors"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    )}
                </div>

                {drawings.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground/30 text-[11px] italic bg-secondary/5 rounded-lg border border-dashed border-border/40">
                        {t('noManualDrawings')}
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
                                className={cn("transition-colors flex-shrink-0 p-1 rounded hover:bg-secondary/40", drawing.visible ? "text-blue-500" : "text-muted-foreground/40")}
                                title={drawing.visible ? t('hide') : t('show')}
                            >
                                {drawing.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>

                            <button
                                onClick={() => updateDrawing(chartId, drawing.id, { locked: !drawing.locked })}
                                className={cn("transition-colors flex-shrink-0 p-1 rounded hover:bg-secondary/40", drawing.locked ? "text-amber-500" : "text-muted-foreground/40")}
                                title={drawing.locked ? t('unlock') : t('lock')}
                            >
                                {drawing.locked ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>

                            <div className="flex-1 flex items-center gap-2 overflow-hidden cursor-pointer" onClick={() => setExpandedId(expandedId === drawing.id ? null : drawing.id)}>
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: drawing.color }} />
                                <span className="text-[11px] truncate text-foreground font-medium">
                                    {drawing.type === 'fib-retracement' ? t('objectNames.fibRetracement') :
                                        drawing.type === 'fib-extension' ? t('objectNames.fibExtension') :
                                            drawing.type === 'trend-line' ? t('objectNames.trendLine') :
                                                drawing.type === 'horizontal-line' ? t('objectNames.horizontalLine') :
                                                    drawing.type === 'vertical-line' ? t('objectNames.verticalLine') :
                                                        drawing.type === 'crosshair' ? t('objectNames.crosshair') :
                                                            drawing.type === 'rectangle' ? t('objectNames.rectangle') : drawing.type}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setExpandedId(expandedId === drawing.id ? null : drawing.id)}
                                aria-label={`Configure ${drawing.type}`}
                                aria-expanded={expandedId === drawing.id}
                                className={cn("p-1 transition-all", expandedId === drawing.id ? "text-primary" : "text-muted-foreground/40 hover:text-foreground")}
                            >
                                <Settings2 size={11} />
                            </button>

                            <button
                                type="button"
                                onClick={() => removeDrawing(chartId, drawing.id)}
                                aria-label={`Remove ${drawing.type}`}
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
                                                <label className="text-[11px] font-bold text-muted-foreground/60 uppercase">{t('lineStyle')}</label>
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
                                                <label className="text-[11px] font-bold text-muted-foreground/60 uppercase">{t('width')} ({drawing.lineWidth}px)</label>
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
                                                    <label className="text-[11px] font-bold text-muted-foreground/60 uppercase">{t('activeLevels')}</label>
                                                    <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">FIBONACCI</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618, 2.618].map(ratio => {
                                                        const enabledLevels = (drawing.params?.enabledLevels as Record<string, boolean> | undefined) || {};
                                                        const isEnabled = enabledLevels[ratio.toString()] !== false;
                                                        return (
                                                            <button
                                                                key={ratio}
                                                                onClick={() => {
                                                                    const nextEnabledLevels: Record<string, boolean> = { ...enabledLevels };
                                                                    nextEnabledLevels[ratio.toString()] = !isEnabled;
                                                                    updateDrawing(chartId, drawing.id, {
                                                                        params: { ...drawing.params, enabledLevels: nextEnabledLevels }
                                                                    });
                                                                }}
                                                                className={cn(
                                                                    "flex items-center justify-center p-1.5 rounded border text-[11px] font-bold transition-all",
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
