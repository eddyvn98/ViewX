'use client';

import React from 'react';
import { useMarketStore } from '@/lib/store';
import { X, Plus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IndicatorSelectorProps {
    onClose: () => void;
    chartId: string;
}

const AVAILABLE_INDICATORS = [
    {
        type: 'EMA' as const,
        name: 'Exponential Moving Average',
        description: 'Đường trung bình động lũy thừa, phản ứng nhanh hơn với biến động giá.',
        defaultParams: { period: 20 },
        defaultColor: '#2196F3',
        pane: 'main' as const
    },
    {
        type: 'SMA' as const,
        name: 'Simple Moving Average',
        description: 'Đường trung bình động đơn giản, giúp xác định xu hướng dài hạn.',
        defaultParams: { period: 50 },
        defaultColor: '#FF9800',
        pane: 'main' as const
    },
    {
        type: 'HMA' as const,
        name: 'Hull Moving Average',
        description: 'Đường trung bình động Hull, cực kỳ mượt mà và ít trễ.',
        defaultParams: { period: 25 },
        defaultColor: '#00BCD4',
        pane: 'main' as const
    },
    {
        type: 'RSI' as const,
        name: 'Relative Strength Index',
        description: 'Chỉ số sức mạnh tương đối, đo lường quá mua/quá bán.',
        defaultParams: { period: 14, overbought: 70, oversold: 30 },
        defaultColor: '#9C27B0',
        pane: 'rsi' as const
    },
    {
        type: 'RSI' as const,
        name: 'RSI Subchart',
        description: 'RSI hiển thị trong một khung riêng biệt bên dưới biểu đồ chính.',
        defaultParams: { period: 14, overbought: 70, oversold: 30 },
        defaultColor: '#e91e63',
        pane: 'subchart' as const
    },
    {
        type: 'Signals' as const,
        name: 'Buy/Sell Signals',
        description: 'Tín hiệu mua bán dựa trên nến Heikin Ashi và bộ lọc ngưỡng.',
        defaultParams: { upperLimit: 60, lowerLimit: 40 },
        defaultColor: '#22C55E',
        pane: 'main' as const
    }
];

export function IndicatorSelector({ onClose, chartId }: IndicatorSelectorProps) {
    const addIndicator = useMarketStore(state => state.addIndicator);

    const handleAdd = (config: typeof AVAILABLE_INDICATORS[0]) => {
        addIndicator(chartId, {
            type: config.type as any,
            params: { ...config.defaultParams },
            color: config.defaultColor,
            visible: true,
            lineWidth: 2,
            pane: config.pane
        });
        onClose();
    };

    return (
        <div className="absolute inset-0 bg-zinc-950 z-50 flex flex-col">
            <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <h3 className="text-xs font-bold uppercase text-zinc-300">Thêm Chỉ báo</h3>
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <div className="grid gap-2">
                    {AVAILABLE_INDICATORS.map(indicator => (
                        <button
                            key={indicator.type}
                            onClick={() => handleAdd(indicator)}
                            className="flex flex-col gap-1 p-3 rounded-lg bg-zinc-900/40 hover:bg-blue-500/10 border border-zinc-800 hover:border-blue-500/50 transition-all text-left group"
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-zinc-200 group-hover:text-blue-400 transition-colors">
                                    {indicator.type}
                                </span>
                                <Plus size={14} className="text-zinc-600 group-hover:text-blue-500" />
                            </div>
                            <span className="text-[10px] text-zinc-500 leading-tight">
                                {indicator.name}
                            </span>
                            <p className="text-[9px] text-zinc-600 mt-1 italic">
                                {indicator.description}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/20">
                <div className="flex items-start gap-2">
                    <Info size={14} className="text-blue-500/50 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-zinc-500 leading-normal">
                        Mẹo: Bạn có thể thêm nhiều chỉ báo cùng loại với các thông số khác nhau.
                    </p>
                </div>
            </div>
        </div>
    );
}
