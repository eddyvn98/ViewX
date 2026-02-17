'use client';

import React, { useState, useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { X, Plus, Info, Activity, TrendingUp, LayoutTemplate, Ruler, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IndicatorSelectorProps {
    onClose: () => void;
    chartId: string;
}

const CATEGORIES = [
    {
        id: 'averages',
        name: 'Moving Averages',
        icon: TrendingUp,
        indicators: [
            {
                type: 'EMA' as const,
                name: 'Exponential Moving Average',
                description: 'Đường trung bình động lũy thừa, phản ứng nhanh hơn.',
                defaultParams: { period: 20 },
                defaultColor: '#ffffff', // Auto-color
                pane: 'main' as const
            },
            {
                type: 'SMA' as const,
                name: 'Simple Moving Average',
                description: 'Đường trung bình động đơn giản, xác định xu hướng dài hạn.',
                defaultParams: { period: 50 },
                defaultColor: '#ffffff', // Auto-color
                pane: 'main' as const
            },
            {
                type: 'HMA' as const,
                name: 'Hull Moving Average',
                description: 'Đường trung bình động Hull, cực kỳ mượt mà và ít trễ.',
                defaultParams: { period: 25 },
                defaultColor: '#ffffff', // Auto-color
                pane: 'main' as const
            },
        ]
    },
    {
        id: 'oscillators',
        name: 'Oscillators',
        icon: Activity,
        indicators: [
            {
                type: 'RSI' as const,
                name: 'Relative Strength Index',
                description: 'Chỉ số sức mạnh tương đối, đo lường quá mua/quá bán.',
                defaultParams: { period: 14, overbought: 70, oversold: 30 },
                defaultColor: '#ffffff', // Auto-color
                pane: 'rsi' as const
            },
            {
                type: 'RSI' as const,
                name: 'RSI Subchart',
                description: 'RSI hiển thị trong một khung riêng biệt bên dưới.',
                defaultParams: { period: 14, overbought: 70, oversold: 30 },
                defaultColor: '#ffffff', // Auto-color
                pane: 'subchart' as const
            },
        ]
    },
    {
        id: 'structure',
        name: 'Price Action & Structure',
        icon: LayoutTemplate,
        indicators: [
            {
                type: 'TrendLines' as const,
                name: 'Trend Lines',
                description: 'Vẽ đường xu hướng dựa trên đỉnh/đáy cấu trúc.',
                defaultParams: {},
                defaultColor: '#ffffff', // Auto-color
                pane: 'main' as const
            },
            {
                type: 'MarketStructure' as const,
                name: 'Market Structure Labels',
                description: 'Hiển thị HH, LL, HL, LH trực tiếp trên biểu đồ.',
                defaultParams: { depth: 7 },
                defaultColor: '#ffffff', // Auto-color
                pane: 'main' as const
            },
            {
                type: 'BreakoutRays' as const,
                name: 'Breakout Horizontal Rays',
                description: 'Vẽ các đường ngang tại mức đỉnh/đáy đột phá.',
                defaultParams: {},
                defaultColor: '#ffffff', // Auto-color
                pane: 'main' as const
            },
        ]
    },
    {
        id: 'fibonacci',
        name: 'Fibonacci Tools',
        icon: Ruler,
        indicators: [
            {
                type: 'Fibonacci' as const,
                name: 'Fibonacci Retracement',
                description: 'Tự động tính toán các mức thoái lui Fibonacci.',
                defaultParams: { depth: 7 },
                defaultColor: '#ffffff', // Auto-color
                pane: 'main' as const
            },
            {
                type: 'FibonacciExtension' as const,
                name: 'Trend-Based Fibonacci Extension',
                description: 'Mở rộng Fibonacci dựa trên xu hướng (3 điểm swing).',
                defaultParams: { depth: 7 },
                defaultColor: '#ffffff', // Auto-color
                pane: 'main' as const
            }
        ]
    }
];

export function IndicatorSelector({ onClose, chartId }: IndicatorSelectorProps) {
    const addIndicator = useMarketStore(state => state.addIndicator);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const filteredCategories = useMemo(() => {
        if (!searchQuery) return CATEGORIES;

        const q = searchQuery.toLowerCase();
        return CATEGORIES.map(cat => ({
            ...cat,
            indicators: cat.indicators.filter(ind =>
                ind.name.toLowerCase().includes(q) ||
                ind.type.toLowerCase().includes(q)
            )
        })).filter(cat => cat.indicators.length > 0);
    }, [searchQuery]);

    const handleAdd = (indicator: any) => {
        addIndicator(chartId, {
            type: indicator.type as any,
            params: { ...indicator.defaultParams },
            color: indicator.defaultColor,
            visible: true,
            lineWidth: 2,
            pane: indicator.pane
        });
        onClose();
    };

    return (
        <div className="absolute inset-0 z-50 flex flex-col glass-panel animate-in fade-in zoom-in-95 duration-200">
            {/* Ultra-Compact Header */}
            <div className="px-4 py-3 border-b border-white/5 bg-white/5 backdrop-blur-xl flex items-center justify-between min-h-[52px]">
                {!isSearching ? (
                    <>
                        <div className="flex flex-col">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-primary text-glow-primary">
                                Indicators
                            </h3>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsSearching(true)}
                                className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-all"
                            >
                                <Search size={14} />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-all active:scale-95"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                        <Search size={14} className="text-primary shrink-0" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Tìm chỉ báo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={() => !searchQuery && setIsSearching(false)}
                            className="flex-1 bg-transparent border-none py-1 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none font-medium"
                        />
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setIsSearching(false);
                            }}
                            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Content area covering almost everything */}
            <div className="flex-1 overflow-y-auto custom-scrollbar touch-scrolling p-3 pb-10 space-y-4">
                {filteredCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-10 gap-3">
                        <Search size={24} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">No results</span>
                    </div>
                ) : (
                    filteredCategories.map(category => (
                        <div key={category.id} className="space-y-1.5">
                            {/* Minimal Category Heading */}
                            <div className="flex items-center gap-2 px-1">
                                <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
                                    {category.name}
                                </h4>
                                <div className="h-[1px] flex-1 bg-white/5" />
                            </div>

                            {/* Indicator Grid (Ultra-Compact) */}
                            <div className="grid gap-1">
                                {category.indicators.map(indicator => (
                                    <button
                                        key={`${indicator.type}-${indicator.pane}`}
                                        onClick={() => handleAdd(indicator)}
                                        className="group relative flex items-center justify-between gap-3 p-2.5 rounded-xl glass-card border-white/5 hover:glow-primary-border transition-all duration-300 text-left overflow-hidden active:scale-[0.98] min-h-[42px]"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                                            {indicator.defaultColor === '#ffffff' ? (
                                                <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                                    <Sparkles size={10} className="text-primary animate-pulse" />
                                                </div>
                                            ) : (
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0"
                                                    style={{ backgroundColor: indicator.defaultColor, color: indicator.defaultColor }}
                                                />
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] font-bold text-foreground tracking-tight uppercase truncate">
                                                    {indicator.type === 'RSI' && indicator.pane === 'subchart' ? 'RSI (Sub)' : indicator.type}
                                                </span>
                                                <span className="text-[8px] text-muted-foreground/40 font-semibold truncate leading-none">
                                                    {indicator.name}
                                                </span>
                                            </div>
                                        </div>

                                        <Plus size={12} className="text-muted-foreground/20 group-hover:text-primary transition-all shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
