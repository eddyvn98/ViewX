'use client';

import React from 'react';
import { useChartOHLC } from '../hooks/use-chart-ohlc';
import { cn } from '@/lib/utils';

interface OHLCHeaderProps {
    symbol: string | undefined;
    interval: string | undefined;
    source: string | undefined;
}

export function OHLCHeader({ symbol, interval, source }: OHLCHeaderProps) {
    const data = useChartOHLC(symbol, interval, source);

    if (!data) return null;

    const { open, high, low, close, changeValue, change } = data;
    const isPositive = changeValue >= 0;
    const colorClass = isPositive ? "text-green-500" : "text-red-500";

    const formatPrice = (p: number) => {
        if (p === 0) return '0.00';
        if (p < 0.0001) return p.toExponential(4);
        if (p < 1) return p.toFixed(5);
        if (p < 100) return p.toFixed(3);
        return p.toFixed(2);
    };

    return (
        <div className="flex items-center gap-2 ml-2 overflow-hidden">
            <div className="flex items-center gap-1 text-[10px] font-mono">
                <span className="text-zinc-600 font-bold">O</span>
                <span className="text-zinc-400">{formatPrice(open)}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono">
                <span className="text-zinc-600 font-bold">H</span>
                <span className="text-zinc-400">{formatPrice(high)}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono">
                <span className="text-zinc-600 font-bold">L</span>
                <span className="text-zinc-400">{formatPrice(low)}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono">
                <span className="text-zinc-600 font-bold">C</span>
                <span className={cn("font-bold", colorClass)}>{formatPrice(close)}</span>
            </div>
            <div className={cn("flex items-center gap-1 text-[10px] font-bold font-mono ml-1", colorClass)}>
                <span>{isPositive ? '+' : ''}{formatPrice(changeValue)}</span>
                <span className="text-[9px] opacity-80">({change.toFixed(2)}%)</span>
            </div>
        </div>
    );
}
