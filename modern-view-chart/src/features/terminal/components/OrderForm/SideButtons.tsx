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
                    "flex flex-col items-center justify-center py-1.5 rounded-lg border-2 transition-all relative overflow-hidden group",
                    side === 'sell'
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-border/50 bg-secondary/30 hover:border-border/80"
                )}
            >
                <span className={cn("text-[8px] uppercase font-bold tracking-tight mb-0.5 transition-colors", side === 'sell' ? "text-rose-500" : "text-muted-foreground/60")}>Bán</span>
                <div className="text-[11px] font-bold text-foreground leading-none tracking-tight">
                    {formatPrice(bid).split('.')[0]}.<span className="text-rose-500 text-[9px]">{formatPrice(bid).split('.')[1]}</span>
                </div>
                {side === 'sell' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-rose-500" />}
            </button>

            <button
                onClick={() => { setSide('buy'); setIsDrafting(true); }}
                className={cn(
                    "flex flex-col items-center justify-center py-1.5 rounded-lg border-2 transition-all relative overflow-hidden group",
                    side === 'buy'
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-border/50 bg-secondary/30 hover:border-border/80"
                )}
            >
                <span className={cn("text-[8px] uppercase font-bold tracking-tight mb-0.5 transition-colors", side === 'buy' ? "text-blue-500" : "text-muted-foreground/60")}>Mua</span>
                <div className="text-[11px] font-bold text-foreground leading-none tracking-tight">
                    {formatPrice(ask).split('.')[0]}.<span className="text-blue-500 text-[9px]">{formatPrice(ask).split('.')[1]}</span>
                </div>
                {side === 'buy' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />}
            </button>

            {/* Spread Indicator */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-1.5 py-0.5 rounded-full border border-border text-[9px] font-bold text-muted-foreground/60 z-10 whitespace-nowrap shadow-sm">
                {spread}
            </div>
        </div>
    );
}
