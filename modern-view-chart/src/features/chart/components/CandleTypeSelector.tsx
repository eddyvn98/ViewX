'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketStore } from '@/lib/store';
import { CHART_TYPE_CONFIG, ChartTypeOption } from './candle-type-config';

interface CandleTypeSelectorProps {
    onClose: () => void;
}

const DEFAULT_UP = '#22c55e';
const DEFAULT_DOWN = '#ef4444';
const PRESET_COLORS = [
    '#22c55e', '#10b981', '#00c2ff', '#3b82f6', '#6366f1', '#a855f7',
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#ec4899', '#94a3b8',
    '#ffffff', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827',
];

export function CandleTypeSelector({ onClose }: CandleTypeSelectorProps) {
    const favoriteChartTypes = useMarketStore((state) => state.favoriteChartTypes || []);
    const toggleFavoriteChartType = useMarketStore((state) => state.toggleFavoriteChartType);
    const updateChart = useMarketStore((state) => state.updateChart);
    const setChartType = useMarketStore((state) => state.setChartType);

    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore((state) => state.tabs[activeTabId]);
    const activeChartId = activeTab?.activeChartId;
    const activeChart = activeChartId ? activeTab?.charts?.[activeChartId] : null;
    const currentType = (activeChart?.chartType || 'candles') as ChartTypeOption;
    const [editingColorKey, setEditingColorKey] = React.useState<string | null>(null);
    const [draftColor, setDraftColor] = React.useState<string>('');

    const getPalette = (type: ChartTypeOption) => ({
        up: activeChart?.candleColors?.[type]?.up || DEFAULT_UP,
        down: activeChart?.candleColors?.[type]?.down || DEFAULT_DOWN,
    });

    const normalizeHex = (value: string): string => {
        const hex = value.trim().replace('#', '').slice(0, 6);
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '';
        return `#${hex.toLowerCase()}`;
    };

    const updateTypeColor = (type: ChartTypeOption, side: 'up' | 'down', color: string) => {
        if (!activeChart) return;
        const next = {
            candles: activeChart.candleColors?.candles || { up: DEFAULT_UP, down: DEFAULT_DOWN },
            heikin_ashi: activeChart.candleColors?.heikin_ashi || { up: DEFAULT_UP, down: DEFAULT_DOWN },
            smart_candles: activeChart.candleColors?.smart_candles || { up: DEFAULT_UP, down: DEFAULT_DOWN },
        };
        next[type] = { ...next[type], [side]: color };
        updateChart(activeChart.id, { candleColors: next });
    };

    const openColorEditor = (type: ChartTypeOption, side: 'up' | 'down', current: string) => {
        setEditingColorKey(`${type}:${side}`);
        setDraftColor(current);
    };

    const closeColorEditor = () => {
        setEditingColorKey(null);
        setDraftColor('');
    };

    const handleSelectType = (type: ChartTypeOption) => {
        if (!activeChartId) return;
        setChartType(activeChartId, type);
        onClose();
    };

    return (
        <div className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-lg shadow-2xl z-50 overflow-visible py-1">
            {CHART_TYPE_CONFIG.map((item) => {
                const palette = getPalette(item.id);
                const isCurrent = currentType === item.id;
                const isFav = favoriteChartTypes.includes(item.id);
                return (
                    <div
                        key={item.id}
                        onClick={() => handleSelectType(item.id)}
                        className={cn(
                            'group flex items-center justify-between px-3 py-2 cursor-pointer transition-all',
                            isCurrent ? 'bg-secondary/40' : 'hover:bg-secondary/20'
                        )}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={cn(
                                'text-xs font-semibold truncate',
                                isCurrent ? 'text-yellow-500' : 'text-muted-foreground group-hover:text-foreground'
                            )}>
                                {item.label}
                            </span>
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <div className="relative">
                                    <span className="absolute -top-3 left-0 text-[9px] font-bold uppercase text-emerald-600">Tăng</span>
                                    <button
                                        type="button"
                                        onClick={() => openColorEditor(item.id, 'up', palette.up)}
                                        className="w-7 h-5 rounded border border-border/20 transition-all hover:scale-105"
                                        style={{ backgroundColor: palette.up }}
                                        title="Màu nến tăng"
                                    />
                                    {editingColorKey === `${item.id}:up` && (
                                        <div className="absolute top-7 left-0 z-[70] w-44 rounded-lg border border-border bg-popover/95 backdrop-blur-md shadow-xl p-2">
                                            <div className="grid grid-cols-6 gap-1.5 mb-2">
                                                {PRESET_COLORS.map((color) => (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        onClick={() => {
                                                            updateTypeColor(item.id, 'up', color);
                                                            setDraftColor(color);
                                                        }}
                                                        className={cn(
                                                            'w-5 h-5 rounded border transition-all',
                                                            palette.up.toLowerCase() === color.toLowerCase()
                                                                ? 'border-primary scale-110'
                                                                : 'border-border/40 hover:border-primary/60'
                                                        )}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    value={draftColor}
                                                    onChange={(e) => setDraftColor(e.target.value)}
                                                    placeholder="#22c55e"
                                                    className="h-7 w-full rounded border border-border/40 bg-background/60 px-2 text-[11px] font-mono outline-none focus:border-primary/60"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const valid = normalizeHex(draftColor);
                                                        if (!valid) return;
                                                        updateTypeColor(item.id, 'up', valid);
                                                        closeColorEditor();
                                                    }}
                                                    className="h-7 px-2 rounded bg-primary/15 text-primary text-[11px] font-semibold hover:bg-primary/25"
                                                >
                                                    OK
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="relative">
                                    <span className="absolute -top-3 right-0 text-[9px] font-bold uppercase text-rose-600">Giảm</span>
                                    <button
                                        type="button"
                                        onClick={() => openColorEditor(item.id, 'down', palette.down)}
                                        className="w-7 h-5 rounded border border-border/20 transition-all hover:scale-105"
                                        style={{ backgroundColor: palette.down }}
                                        title="Màu nến giảm"
                                    />
                                    {editingColorKey === `${item.id}:down` && (
                                        <div className="absolute top-7 right-0 z-[70] w-44 rounded-lg border border-border bg-popover/95 backdrop-blur-md shadow-xl p-2">
                                            <div className="grid grid-cols-6 gap-1.5 mb-2">
                                                {PRESET_COLORS.map((color) => (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        onClick={() => {
                                                            updateTypeColor(item.id, 'down', color);
                                                            setDraftColor(color);
                                                        }}
                                                        className={cn(
                                                            'w-5 h-5 rounded border transition-all',
                                                            palette.down.toLowerCase() === color.toLowerCase()
                                                                ? 'border-primary scale-110'
                                                                : 'border-border/40 hover:border-primary/60'
                                                        )}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    value={draftColor}
                                                    onChange={(e) => setDraftColor(e.target.value)}
                                                    placeholder="#ef4444"
                                                    className="h-7 w-full rounded border border-border/40 bg-background/60 px-2 text-[11px] font-mono outline-none focus:border-primary/60"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const valid = normalizeHex(draftColor);
                                                        if (!valid) return;
                                                        updateTypeColor(item.id, 'down', valid);
                                                        closeColorEditor();
                                                    }}
                                                    className="h-7 px-2 rounded bg-primary/15 text-primary text-[11px] font-semibold hover:bg-primary/25"
                                                >
                                                    OK
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoriteChartType(item.id);
                            }}
                            className={cn(
                                'p-1 rounded hover:bg-secondary transition-all',
                                isFav ? 'text-yellow-500 opacity-100' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                            )}
                        >
                            <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
