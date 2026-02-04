import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { Eye, EyeOff, Settings, Trash2, ChevronDown, ChevronRight, Plus, Layout, ShoppingCart } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { IndicatorSelector } from './IndicatorSelector';

const EMPTY_INDICATORS: any[] = [];
const EMPTY_CHARTS: any = {};

export function IndicatorManager() {
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
        <div className="flex flex-col h-full bg-zinc-950 relative overflow-hidden">
            {/* Indicator Selector Overlay */}
            {isSelectorOpen && (
                <IndicatorSelector
                    chartId={chartId}
                    onClose={() => setIsSelectorOpen(false)}
                />
            )}

            <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/20">
                <h3 className="text-xs font-bold uppercase text-zinc-400">Layer Manager</h3>
                <button
                    onClick={() => setIsSelectorOpen(true)}
                    className="text-blue-500 hover:text-blue-400 p-1 hover:bg-blue-500/10 rounded-md transition-all active:scale-90"
                    title="Thêm chỉ báo"
                >
                    <Plus size={18} />
                </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                    {indicators.length === 0 && (
                        <div className="text-center py-8 text-zinc-600 text-xs italic">
                            No indicators added
                        </div>
                    )}

                    {indicators.map(indicator => (
                        <div key={indicator.id} className="flex flex-col gap-1">
                            <div className={cn(
                                "flex items-center gap-2 p-2 rounded-md group transition-colors",
                                editingId === indicator.id ? "bg-zinc-900" : "hover:bg-zinc-900/50"
                            )}>
                                <button
                                    onClick={() => toggleVisibility(chartId, indicator.id)}
                                    className={cn("transition-colors", indicator.visible ? "text-blue-500" : "text-zinc-700")}
                                >
                                    {indicator.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>

                                <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: indicator.color }} />
                                    <span className="text-sm truncate text-zinc-300 font-medium">
                                        {indicator.type} ({indicator.params.period || indicator.params.upperLimit})
                                    </span>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setEditingId(editingId === indicator.id ? null : indicator.id)}
                                        className="p-1 text-zinc-500 hover:text-blue-400"
                                    >
                                        <Settings size={14} />
                                    </button>
                                    <button
                                        onClick={() => removeIndicator(chartId, indicator.id)}
                                        className="p-1 text-zinc-500 hover:text-red-400"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Inline Settings */}
                            {editingId === indicator.id && (
                                <div className="ml-8 p-3 bg-zinc-900 rounded-md flex flex-col gap-3 my-1 border border-zinc-800">
                                    {Object.keys(indicator.params).map(key => (
                                        <div key={key} className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase text-zinc-500 font-bold">{key}</label>
                                            <input
                                                type="number"
                                                value={indicator.params[key]}
                                                onChange={(e) => updateIndicator(chartId, indicator.id, {
                                                    params: { ...indicator.params, [key]: Number(e.target.value) }
                                                })}
                                                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                    ))}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Color</label>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="color"
                                                value={indicator.color}
                                                onChange={(e) => updateIndicator(chartId, indicator.id, { color: e.target.value })}
                                                className="w-full h-6 bg-transparent border-none cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-3 border-t border-zinc-800 bg-zinc-900/30">
                <div className="flex items-center gap-2 text-zinc-500">
                    <Layout size={14} />
                    <span className="text-[10px] font-bold uppercase">Main Chart Area</span>
                </div>
            </div>
        </div>
    );
}
