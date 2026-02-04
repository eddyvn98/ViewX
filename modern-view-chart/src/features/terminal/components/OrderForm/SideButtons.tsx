'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SideButtonsProps {
    side: 'buy' | 'sell';
    setSide: (side: 'buy' | 'sell') => void;
    setIsDrafting: (isDrafting: boolean) => void;
    bid: number;
    ask: number;
    spread: string;
    formatPrice: (p: number) => string;
}

export function SideButtons({
    side,
    setSide,
    setIsDrafting,
    bid,
    ask,
    spread,
    formatPrice
}: SideButtonsProps) {
    return (
        <div className="grid grid-cols-2 gap-2 relative">
            <button
                onClick={() => { setSide('sell'); setIsDrafting(true); }}
                className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all relative overflow-hidden",
                    side === 'sell' ? "border-red-500 bg-red-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                )}
            >
                <span className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Bán</span>
                <div className="text-sm font-bold text-white leading-none tracking-tighter">
                    {formatPrice(bid).split('.')[0]}.<span className="text-red-400 font-black text-xs">{formatPrice(bid).split('.')[1]}</span>
                </div>
                {side === 'sell' && <div className="absolute top-1 right-1 w-1 h-1 bg-red-500 rounded-full" />}
            </button>

            <button
                onClick={() => { setSide('buy'); setIsDrafting(true); }}
                className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all relative overflow-hidden",
                    side === 'buy' ? "border-blue-500 bg-blue-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                )}
            >
                <span className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Mua</span>
                <div className="text-sm font-bold text-white leading-none tracking-tighter">
                    {formatPrice(ask).split('.')[0]}.<span className="text-blue-400 font-black text-xs">{formatPrice(ask).split('.')[1]}</span>
                </div>
                {side === 'buy' && <div className="absolute top-1 right-1 w-1 h-1 bg-blue-500 rounded-full" />}
            </button>

            {/* Spread Indicator */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1e222d] px-1.5 py-0.5 rounded-full border border-zinc-800 text-[9px] font-bold text-zinc-500 z-10 whitespace-nowrap">
                {spread}
            </div>
        </div>
    );
}
