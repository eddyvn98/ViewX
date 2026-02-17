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
        <div className="flex flex-col h-full bg-background relative overflow-hidden glass-panel">
            {/* Indicator Selector Overlay */}
            {isSelectorOpen && (
                <IndicatorSelector
                    chartId={chartId}
                    onClose={() => setIsSelectorOpen(false)}
                />
            )}

            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-xl shrink-0">
                <div className="flex flex-col">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary text-glow-primary">
                        Layer Manager
                    </h3>
                    <span className="text-[9px] text-muted-foreground/40 font-medium">Quản lý và tùy chỉnh chỉ báo</span>
                </div>
                <button
                    onClick={() => setIsSelectorOpen(true)}
                    className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-90"
                    title="Thêm chỉ báo"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 relative min-h-0 bg-transparent overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar touch-scrolling p-3 pb-10 flex flex-col gap-2">
                    {indicators.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-20">
                            <Layout size={32} className="text-muted-foreground" />
                            <div className="text-center text-muted-foreground text-[10px] font-medium uppercase tracking-widest">
                                Chưa có chỉ báo nào
                            </div>
                        </div>
                    )}

                    {indicators.map(indicator => (
                        <div key={indicator.id} className="flex flex-col gap-1">
                            <div className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-xl glass-card border-white/5 transition-all duration-300 group min-h-[44px]",
                                editingId === indicator.id ? "glow-primary-border bg-white/5" : "hover:bg-white/5"
                            )}>
                                <button
                                    onClick={() => toggleVisibility(chartId, indicator.id)}
                                    className={cn(
                                        "transition-all flex-shrink-0 p-1.5 rounded-lg",
                                        indicator.visible
                                            ? "bg-primary/10 text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                            : "bg-white/5 text-muted-foreground/30"
                                    )}
                                >
                                    {indicator.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>

                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: indicator.color }} />
                                        <span className="text-[11px] truncate text-foreground font-bold tracking-tight uppercase">
                                            {indicator.type}
                                        </span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground/40 font-medium truncate">
                                        {Object.entries(indicator.params).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                                    <button
                                        onClick={() => setEditingId(editingId === indicator.id ? null : indicator.id)}
                                        className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            editingId === indicator.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-white/5"
                                        )}
                                    >
                                        <Settings size={12} />
                                    </button>
                                    <button
                                        onClick={() => removeIndicator(chartId, indicator.id)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Inline Settings */}
                            {editingId === indicator.id && (
                                <div className="mx-2 mb-2 p-3 bg-white/5 backdrop-blur-xl rounded-xl flex flex-col gap-3 border border-white/5 animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.keys(indicator.params).map(key => (
                                            <div key={key} className="flex flex-col gap-1">
                                                <label className="text-[8px] uppercase text-muted-foreground/40 font-bold tracking-widest">{key}</label>
                                                <input
                                                    type="number"
                                                    value={indicator.params[key]}
                                                    onChange={(e) => updateIndicator(chartId, indicator.id, {
                                                        params: { ...indicator.params, [key]: Number(e.target.value) }
                                                    })}
                                                    className="bg-black/20 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] text-foreground focus:border-primary/50 outline-none w-full transition-all"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex flex-col gap-1 pt-2 border-t border-white/5">
                                        <label className="text-[8px] uppercase text-muted-foreground/40 font-bold tracking-widest">Màu sắc</label>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="color"
                                                value={indicator.color}
                                                onChange={(e) => updateIndicator(chartId, indicator.id, { color: e.target.value })}
                                                className="w-full h-6 bg-transparent border-none cursor-pointer p-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-2 px-4 border-t border-white/5 bg-white/5 backdrop-blur-xl flex-shrink-0">
                <div className="flex items-center gap-2 text-primary opacity-40">
                    <Layout size={10} />
                    <span className="text-[8px] font-bold uppercase tracking-[0.15em]">Analytics Context</span>
                </div>
            </div>
        </div>
    );
}
