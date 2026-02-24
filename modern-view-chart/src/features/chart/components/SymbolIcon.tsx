'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SymbolIconProps {
    symbol: string;
    className?: string;
}

export function SymbolIcon({ symbol, className }: SymbolIconProps) {
    const s = symbol.toUpperCase();

    // Premium Color Tokens
    const goldGradient = "bg-gradient-to-br from-[#FFD700] via-[#FDB931] to-[#9E7E38]";
    const btcColor = "bg-[#F7931A]";
    const forexBaseBg = "bg-emerald-500/20 text-emerald-500";
    const forexQuoteBg = "bg-slate-500/20 text-slate-500";

    // 1. Bitcoin (BTCUSD, BTCUSDM, BTCUSDT)
    if (s.includes('BTC')) {
        return (
            <div className={cn("relative flex items-center justify-center rounded-full shrink-0 shadow-sm overflow-hidden", btcColor, className)}>
                <svg viewBox="0 0 122.88 122.88" className="w-[60%] h-[60%] fill-white drop-shadow-sm">
                    <path d="M93.84,51.84c1.44-10.32-6-15.36-16.32-18.96l3.36-13.2l-8.16-2.16L69.6,30.48l-6.72-1.68l3.36-12.96 l-8.4-2.16l-3.12,13.44l-5.28-1.2l-11.28-2.88l-1.92,8.64L42,33.12c3.36,0.96,4.08,3.36,3.6,5.04L42,53.28l0.72,0.24L42,53.28 l-5.28,21.36c-0.48,1.2-1.44,2.64-3.84,1.92l-5.76-1.44l-4.08,9.36l16.32,4.08l-3.12,13.68l7.92,1.92l3.36-13.2l6.24,1.44 l-3.12,13.2l8.16,2.16l3.36-13.44c13.92,2.64,24.48,1.44,28.8-11.04c3.36-10.08-0.24-15.84-7.68-19.68 C88.56,62.4,92.64,58.8,93.84,51.84L93.84,51.84L93.84,51.84z M75.36,77.76c-2.64,9.84-19.68,4.8-25.2,3.36l4.56-18 C60.24,64.56,78,67.2,75.36,77.76L75.36,77.76L75.36,77.76z M77.52,51.36c-2.16,9.36-16.08,4.8-20.88,3.6l4.08-16.32 C65.52,39.84,80.16,42,77.52,51.36L77.52,51.36z" />
                </svg>
            </div>
        );
    }

    // 2. Gold (XAUUSD, XAUUSDM)
    if (s.includes('XAU')) {
        return (
            <div className={cn("relative flex items-center justify-center rounded-full shrink-0 shadow-sm overflow-hidden", goldGradient, className)}>
                {/* Professional Gold Ingot SVG (normalized viewBox) */}
                <svg viewBox="0 0 122.88 107.33" className="w-[65%] h-[65%] fill-white/90 drop-shadow-md">
                    <path d="M12.49,28.62l-0.26,0.21c1.72,2.11,2.43,4.6,2.14,7.46c-0.29,2.86-1.5,5.15-3.61,6.87l0.21,0.26 c2.11-1.72,4.6-2.43,7.46-2.13c12.88,1.34,3.67,8.8,4.99-4.07c0.29-2.86,1.5-5.15,3.61-6.87l-0.21-0.26 c-2.11,1.72-4.6,2.43-7.46,2.14C16.5,31.93,14.21,30.73,12.49,28.62L12.49,28.62L12.49,28.62z M31.26,64.84l8.86-31.19 c0.32-1.14,1.36-1.89,2.49-1.89v0H80.4c1.26,0,2.3,0.9,2.54,2.08l9.1,31.15c0.4,1.37-0.39,2.8-1.76,3.2 c-0.24,0.07-0.48,0.1-0.72,0.1v0.01H33.7c-1.43,0-2.59-1.16-2.59-2.59C31.11,65.4,31.16,65.11,31.26,64.84L31.26,64.84z M62,103.86 l8.86-31.19c0.32-1.14,1.36-1.89,2.49-1.89v0h37.79c1.26,0,2.3,0.9,2.54,2.08l9.1,31.15c0.4,1.37-0.39,2.8-1.76,3.2 c-0.24,0.07-0.48,0.1-0.72,0.1v0.01H64.44c-1.43,0-2.59-1.16-2.59-2.59C61.85,104.43,61.9,104.14,62,103.86L62,103.86z M75.3,75.96 l-7.43,26.18h48.99l-7.65-26.18H75.3L75.3,75.96z M0.15,103.86l8.86-31.19c0.32-1.14,1.36-1.89,2.49-1.89v0h37.79 c1.26,0,2.3,0.9,2.54,2.08l9.1,31.15c0.4,1.37-0.39,2.8-1.76,3.2c-0.24,0.07-0.48,0.1-0.72,0.1v0.01H2.59 c-1.43,0-2.59-1.16-2.59-2.59C0,104.43,0.05,104.14,0.15,103.86L0.15,103.86z M13.45,75.96l-7.43,26.18H55l-7.65-26.18H13.45 L13.45,75.96z M44.56,36.94l-7.43,26.18h48.99l-7.65-26.18H44.56L44.56,36.94z M44.31,0l-0.26,0.21c1.72,2.11,2.43,4.6,2.14,7.46 c-0.29,2.86-1.5,5.15-3.61,6.87l0.21,0.26c2.11-1.72,4.6-2.43,7.47-2.13c2.87,0.3,5.16,1.5,6.87,3.6l0.26-0.21 c-1.72-2.11-2.43-4.6-2.14-7.46c0.29-2.86,1.5-5.15,3.61-6.87l-0.21-0.26c-2.11,1.72-4.6,2.43-7.46,2.14 C48.32,3.31,46.03,2.11,44.31,0L44.31,0L44.31,0z M86.63,2.31l-0.47,0.39c3.14,3.86,4.45,8.41,3.91,13.65 c-0.54,5.24-2.74,9.43-6.6,12.57l0.39,0.47c3.86-3.14,8.41-4.45,13.66-3.9c5.24,0.54,9.43,2.75,12.57,6.6l0.47-0.39 c-3.14-3.86-4.45-8.41-3.91-13.65c0.54-5.24,2.74-9.43,6.6-12.57L112.85,5c-3.86,3.14-8.41,4.45-13.65,3.91 C93.96,8.37,89.77,6.17,86.63,2.31L86.63,2.31L86.63,2.31z" />
                </svg>
                {/* Shine Animation */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            </div>
        );
    }

    // 3. Forex Fallback (EURUSD, etc)
    if (s.endsWith('M') || (s.length >= 6 && !s.includes('USDT'))) {
        const base = s.slice(0, 3);
        const quote = s.slice(3, 6);

        return (
            <div className={cn("relative flex items-center justify-center shrink-0", className)}>
                {/* Quote (Back) */}
                <div className={cn("absolute right-0 bottom-0 w-[65%] h-[65%] rounded-full border border-border/50 flex items-center justify-center overflow-hidden z-0 shadow-sm", forexQuoteBg)}>
                    <span className="text-[6.5px] font-bold tracking-tighter mix-blend-multiply opacity-60">{quote}</span>
                </div>
                {/* Base (Front) */}
                <div className={cn("absolute left-0 top-0 w-[70%] h-[70%] rounded-full border border-primary/20 flex items-center justify-center overflow-hidden z-10 shadow-sm backdrop-blur-[2px]", forexBaseBg)}>
                    <span className="text-[7.5px] font-black tracking-tighter">{base}</span>
                </div>
            </div>
        );
    }

    // 4. Default Fallback
    return (
        <div className={cn("flex items-center justify-center rounded-full bg-secondary/30 border border-border/50 shrink-0", className)}>
            <span className="text-[10px] font-black uppercase text-muted-foreground">{s[0]}</span>
        </div>
    );
}
