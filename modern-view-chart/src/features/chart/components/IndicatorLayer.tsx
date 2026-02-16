import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { Eye, EyeOff, Settings, Trash2, ChevronDown, ChevronRight, Plus, Layout, ShoppingCart } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
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
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* Indicator Selector Overlay */}
            {isSelectorOpen && (
                <IndicatorSelector
                    chartId={chartId}
                    onClose={() => setIsSelectorOpen(false)}
                />
            )}

            <div className="p-1.5 px-3 border-b border-border flex justify-between items-center bg-secondary/10 shrink-0">
                <h3 className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-tight">Layer Manager</h3>
                <button
                    onClick={() => setIsSelectorOpen(true)}
                    className="text-blue-500 hover:text-blue-400 p-1 hover:bg-blue-500/10 rounded-md transition-all active:scale-90"
                    title="Thêm chỉ báo"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 relative min-h-0 bg-transparent">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-0.5">
                    {indicators.length === 0 && (
                        <div className="text-center py-6 text-muted-foreground/30 text-[10px] italic">
                            No indicators added
                        </div>
                    )}

                    {indicators.map(indicator => (
                        <div key={indicator.id} className="flex flex-col gap-0.5">
                            <div className={cn(
                                "flex items-center gap-2 px-2 py-1 rounded-md group transition-colors min-h-[32px]",
                                editingId === indicator.id ? "bg-secondary/40" : "hover:bg-secondary/20"
                            )}>
                                <button
                                    onClick={() => toggleVisibility(chartId, indicator.id)}
                                    className={cn("transition-colors flex-shrink-0", indicator.visible ? "text-blue-500" : "text-muted-foreground/40")}
                                >
                                    {indicator.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>

                                <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: indicator.color }} />
                                    <span className="text-[11px] truncate text-foreground font-bold tracking-tight">
                                        {indicator.type} ({indicator.params.period || indicator.params.depth || indicator.params.upperLimit || ''})
                                    </span>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button
                                        onClick={() => setEditingId(editingId === indicator.id ? null : indicator.id)}
                                        className="p-1 text-muted-foreground hover:text-blue-400"
                                    >
                                        <Settings size={11} />
                                    </button>
                                    <button
                                        onClick={() => removeIndicator(chartId, indicator.id)}
                                        className="p-1 text-muted-foreground hover:text-red-400"
                                    >
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            </div>

                            {/* Inline Settings */}
                            {editingId === indicator.id && (
                                <div className="ml-6 p-2 bg-secondary/20 rounded-md flex flex-col gap-2 my-0.5 border border-border/50">
                                    {Object.keys(indicator.params).map(key => (
                                        <div key={key} className="flex flex-col gap-1">
                                            <label className="text-[8px] uppercase text-muted-foreground/50 font-bold tracking-tight">{key}</label>
                                            <input
                                                type="number"
                                                value={indicator.params[key]}
                                                onChange={(e) => updateIndicator(chartId, indicator.id, {
                                                    params: { ...indicator.params, [key]: Number(e.target.value) }
                                                })}
                                                className="bg-background/50 border border-border/50 rounded px-1.5 py-0.5 text-[10px] text-foreground focus:border-blue-500/50 outline-none h-6 h-5"
                                            />
                                        </div>
                                    ))}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[8px] uppercase text-muted-foreground/60 font-black tracking-tighter">Color</label>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="color"
                                                value={indicator.color}
                                                onChange={(e) => updateIndicator(chartId, indicator.id, { color: e.target.value })}
                                                className="w-full h-4 bg-transparent border-none cursor-pointer p-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-1.5 px-3 border-t border-border bg-secondary/10 flex-shrink-0">
                <div className="flex items-center gap-2 text-muted-foreground/30">
                    <Layout size={11} />
                    <span className="text-[9px] font-bold uppercase tracking-tight">Main Chart Area</span>
                </div>
            </div>
        </div>
    );
}
