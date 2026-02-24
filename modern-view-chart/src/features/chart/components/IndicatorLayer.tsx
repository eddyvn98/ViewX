import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { Eye, EyeOff, Settings2, Trash2, Plus, Layout } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { IndicatorSelector } from './IndicatorSelector';

const EMPTY_INDICATORS: any[] = [];
const EMPTY_CHARTS: any = {};

export function IndicatorLayer() {
    const activeTabId = useMarketStore(state => state.activeTabId);
    const charts = useMarketStore(useShallow(state => state.tabs[activeTabId || '']?.charts || EMPTY_CHARTS));
    const activeChartId = useMarketStore(state => state.tabs[activeTabId || '']?.activeChartId);

    // Fallback if no specific chart is active
    const chartId = activeChartId || Object.keys(charts)[0];
    const indicators = useMarketStore(useShallow(state => chartId ? state.chartIndicators[chartId] || EMPTY_INDICATORS : EMPTY_INDICATORS));

    const updateIndicator = useMarketStore(state => state.updateIndicator);
    const removeIndicator = useMarketStore(state => state.removeIndicator);
    const toggleVisibility = useMarketStore(state => state.toggleIndicatorVisibility);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    if (!chartId) {
        return <div className="p-4 text-zinc-500 text-sm">No active chart</div>;
    }

    return (
        <div className="flex flex-col h-full bg-background relative overflow-y-auto custom-scrollbar">
            {/* Indicator Selector Overlay */}
            {isSelectorOpen && (
                <IndicatorSelector
                    chartId={chartId}
                    onClose={() => setIsSelectorOpen(false)}
                />
            )}

            <div className="p-3 flex flex-col gap-4 flex-shrink-0">
                {/* Header & Add Button */}
                <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black uppercase text-foreground/80 tracking-tight">Layers</h4>
                    <button
                        onClick={() => setIsSelectorOpen(true)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95"
                        title="Add Indicator"
                    >
                        <Plus size={10} strokeWidth={3} />
                        <span className="text-[10px] font-bold">Add</span>
                    </button>
                </div>

                {indicators.length === 0 && (
                    <div className="text-center py-8 flex flex-col items-center gap-2 text-muted-foreground/40 bg-secondary/5 rounded-xl border border-dashed border-border/40">
                        <Layout size={24} strokeWidth={1.5} className="opacity-50" />
                        <span className="text-[10px] font-medium">No active layers</span>
                    </div>
                )}

                {/* Smart Analysis Section */}
                {indicators.some(i => ['MARKET_STRUCTURE', 'BREAKOUT_RAYS', 'TREND_LINES', 'FIBONACCI', 'FIBONACCI_EXTENSION', 'MarketStructure', 'BreakoutRays', 'TrendLines'].includes(i.type)) && (
                    <div className="flex flex-col gap-1">
                        <h5 className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-1 mb-1">Smart Analysis</h5>
                        {indicators
                            .filter(i => ['MARKET_STRUCTURE', 'BREAKOUT_RAYS', 'TREND_LINES', 'FIBONACCI', 'FIBONACCI_EXTENSION', 'MarketStructure', 'BreakoutRays', 'TrendLines'].includes(i.type))
                            .map(indicator => (
                                <IndicatorItem
                                    key={indicator.id}
                                    indicator={indicator}
                                    chartId={chartId}
                                    editingId={editingId}
                                    setEditingId={setEditingId}
                                    toggleVisibility={toggleVisibility}
                                    updateIndicator={updateIndicator}
                                    removeIndicator={removeIndicator}
                                />
                            ))}
                    </div>
                )}

                {/* Standard Indicators Section */}
                {indicators.some(i => !['MARKET_STRUCTURE', 'BREAKOUT_RAYS', 'TREND_LINES', 'FIBONACCI', 'FIBONACCI_EXTENSION', 'MarketStructure', 'BreakoutRays', 'TrendLines'].includes(i.type)) && (
                    <div className="flex flex-col gap-1">
                        {indicators.some(i => ['MARKET_STRUCTURE', 'BREAKOUT_RAYS', 'TREND_LINES', 'FIBONACCI', 'FIBONACCI_EXTENSION', 'MarketStructure', 'BreakoutRays', 'TrendLines'].includes(i.type)) && (
                            <h5 className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-1 mb-1 mt-1">Indicators</h5>
                        )}
                        {indicators
                            .filter(i => !['MARKET_STRUCTURE', 'BREAKOUT_RAYS', 'TREND_LINES', 'FIBONACCI', 'FIBONACCI_EXTENSION', 'MarketStructure', 'BreakoutRays', 'TrendLines'].includes(i.type))
                            .map(indicator => (
                                <IndicatorItem
                                    key={indicator.id}
                                    indicator={indicator}
                                    chartId={chartId}
                                    editingId={editingId}
                                    setEditingId={setEditingId}
                                    toggleVisibility={toggleVisibility}
                                    updateIndicator={updateIndicator}
                                    removeIndicator={removeIndicator}
                                />
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}

import { INDICATOR_REGISTRY } from '../indicators/registry';

function IndicatorItem({ indicator, chartId, editingId, setEditingId, toggleVisibility, updateIndicator, removeIndicator }: any) {
    const metadata = INDICATOR_REGISTRY[indicator.type as keyof typeof INDICATOR_REGISTRY];

    return (
        <div className="flex flex-col mb-0.5">
            <div className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 min-h-[36px] group border border-transparent",
                editingId === indicator.id ? "bg-secondary/40 border-border/20" : "hover:bg-secondary/20 hover:border-border/10"
            )}>
                <button
                    onClick={() => toggleVisibility(chartId, indicator.id)}
                    className={cn(
                        "transition-colors flex-shrink-0 p-1 rounded-md hover:bg-secondary/40 active:scale-95",
                        indicator.visible ? "text-primary" : "text-muted-foreground/40"
                    )}
                    title={indicator.visible ? "Hide" : "Show"}
                >
                    {indicator.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>

                <div
                    className="flex-1 flex items-center gap-2.5 overflow-hidden cursor-pointer select-none"
                    onClick={() => setEditingId(editingId === indicator.id ? null : indicator.id)}
                >
                    <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 transition-transform duration-300", editingId === indicator.id && "scale-125")} style={{ backgroundColor: indicator.color }} />
                    <span className={cn("text-[10px] truncate transition-colors font-semibold", editingId === indicator.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                        {indicator.type.replace(/_/g, ' ')}
                    </span>
                </div>

                <button
                    onClick={() => setEditingId(editingId === indicator.id ? null : indicator.id)}
                    className={cn(
                        "p-1.5 rounded-md transition-all active:scale-95",
                        editingId === indicator.id ? "text-primary bg-primary/10" : "text-muted-foreground/30 hover:text-foreground hover:bg-secondary/40"
                    )}
                >
                    <Settings2 size={12} />
                </button>

                <button
                    onClick={() => removeIndicator(chartId, indicator.id)}
                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-95"
                >
                    <Trash2 size={12} />
                </button>
            </div>

            {/* Inline Settings Control Panel */}
            <AnimatePresence>
                {editingId === indicator.id && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-secondary/10 rounded-b-lg mx-2 border-x border-b border-border/20 -mt-1 pt-1"
                    >
                        <div className="p-3 flex flex-col gap-4">
                            {/* Parameters Schema */}
                            {metadata?.params && (
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(metadata.params).map(([key, schema]) => (
                                        <div key={key} className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">{schema.name}</label>
                                            <input
                                                type={schema.type === 'number' ? 'number' : 'text'}
                                                value={indicator.params[key] ?? schema.default}
                                                min={schema.min}
                                                max={schema.max}
                                                step={schema.step}
                                                onChange={(e) => updateIndicator(chartId, indicator.id, {
                                                    params: { ...indicator.params, [key]: schema.type === 'number' ? Number(e.target.value) : e.target.value }
                                                })}
                                                className="bg-background/50 border border-border/20 rounded-md px-2 py-1.5 text-[10px] text-foreground focus:border-primary/50 focus:bg-background outline-none w-full transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Fallback for indicators not in registry */}
                            {!metadata && indicator.params && (
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.keys(indicator.params).map(key => (
                                        <div key={key} className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">{key}</label>
                                            <input
                                                type="number"
                                                value={indicator.params[key]}
                                                onChange={(e) => updateIndicator(chartId, indicator.id, {
                                                    params: { ...indicator.params, [key]: Number(e.target.value) }
                                                })}
                                                className="bg-background/50 border border-border/20 rounded-md px-2 py-1.5 text-[10px] text-foreground focus:border-primary/50 focus:bg-background outline-none w-full transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Styles Schema */}
                            <div className="flex flex-col gap-2.5 pt-3 border-t border-border/10">
                                <label className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Appearance</label>
                                <div className="flex flex-col gap-3">
                                    {metadata?.styles ? (
                                        Object.entries(metadata.styles).map(([key, schema]) => (
                                            <div key={key} className="flex items-center justify-between gap-4">
                                                <span className="text-[10px] text-muted-foreground font-medium">{schema.label}</span>
                                                {schema.type === 'color' ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-10 h-6 rounded border border-border/20 overflow-hidden relative">
                                                            <input
                                                                type="color"
                                                                value={indicator.styles?.[key] ?? schema.default}
                                                                onChange={(e) => updateIndicator(chartId, indicator.id, {
                                                                    styles: { ...indicator.styles, [key]: e.target.value }
                                                                })}
                                                                className="absolute -top-2 -left-2 w-[150%] h-[200%] cursor-pointer p-0"
                                                            />
                                                        </div>
                                                        <span className="text-[9px] font-mono opacity-40 uppercase">{(indicator.styles?.[key] ?? schema.default).slice(1)}</span>
                                                    </div>
                                                ) : schema.type === 'number' ? (
                                                    <input
                                                        type="number"
                                                        value={indicator.styles?.[key] ?? schema.default}
                                                        min={schema.min}
                                                        max={schema.max}
                                                        step={schema.step}
                                                        onChange={(e) => updateIndicator(chartId, indicator.id, {
                                                            styles: { ...indicator.styles, [key]: Number(e.target.value) }
                                                        })}
                                                        className="w-12 bg-background/30 border border-border/10 rounded px-1.5 py-0.5 text-[10px] text-right"
                                                    />
                                                ) : null}
                                            </div>
                                        ))
                                    ) : (
                                        // Fallback Legacy Color Picker
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-[10px] text-muted-foreground font-medium">Main Color</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-6 rounded border border-border/20 overflow-hidden relative">
                                                    <input
                                                        type="color"
                                                        value={indicator.color}
                                                        onChange={(e) => updateIndicator(chartId, indicator.id, { color: e.target.value })}
                                                        className="absolute -top-2 -left-2 w-[150%] h-[200%] cursor-pointer p-0"
                                                    />
                                                </div>
                                                <span className="text-[9px] font-mono opacity-40 uppercase">{indicator.color.slice(1)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
