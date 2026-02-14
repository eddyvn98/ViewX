'use client';

import React from 'react';
import { Minus, Plus, Info, ChevronDown } from 'lucide-react';

interface OrderInputsProps {
    volume: string;
    setVolume: (v: string) => void;
    sl: string;
    setSl: (v: string) => void;
    tp: string;
    setTp: (v: string) => void;
    slPnl: { label: string; percent: number } | null;
    tpPnl: { label: string; percent: number } | null;
    adjustVolume: (val: string, step: number) => string;
    adjustValue: (val: string, step: number, isSL: boolean) => string;
    formatPrice: (p: number) => string;
}

export function OrderInputs({
    volume, setVolume,
    sl, setSl,
    tp, setTp,
    slPnl, tpPnl,
    adjustVolume, adjustValue
}: OrderInputsProps) {
    return (
        <div className="space-y-2">
            {/* Volume */}
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tight">Khối lượng</label>
                <div className="flex items-center gap-1">
                    <div className="flex-1 relative flex items-center">
                        <input
                            type="text"
                            value={volume}
                            onChange={(e) => setVolume(e.target.value)}
                            className="w-full bg-secondary/30 border border-border rounded pl-2.5 pr-8 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-colors font-medium"
                        />
                        <span className="absolute right-2.5 text-[10px] text-muted-foreground/40 font-bold uppercase">Lô</span>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => setVolume(adjustVolume(volume, -0.01))} className="w-8 h-full bg-secondary hover:bg-secondary/70 rounded text-muted-foreground transition-colors flex items-center justify-center"><Minus size={14} /></button>
                        <button onClick={() => setVolume(adjustVolume(volume, 0.01))} className="w-8 h-full bg-secondary hover:bg-secondary/70 rounded text-muted-foreground transition-colors flex items-center justify-center"><Plus size={14} /></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {/* Stop Loss (Cắt lỗ) */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tight flex items-center gap-1">
                        Cắt lỗ <span className="text-rose-500 text-[10px]">(SL)</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Giá SL"
                            value={sl}
                            onChange={(e) => setSl(e.target.value)}
                            className="w-full bg-secondary/30 border border-border rounded pl-2 pr-8 py-2 text-xs text-red-300 focus:outline-none focus:border-red-500 transition-colors font-medium placeholder:text-muted-foreground/30"
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                            <button onClick={() => setSl(adjustValue(sl, -1, true))} className="p-1 text-muted-foreground hover:text-foreground"><Minus size={10} /></button>
                            <button onClick={() => setSl(adjustValue(sl, 1, true))} className="p-1 text-muted-foreground hover:text-foreground"><Plus size={10} /></button>
                        </div>
                    </div>
                    {slPnl && (
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[9px] font-bold text-rose-500">{slPnl.label.split(' (')[0]}</span>
                            <span className="text-[9px] font-bold text-rose-500">{slPnl.percent.toFixed(2)}%</span>
                        </div>
                    )}
                </div>

                {/* Take Profit (Chốt lời) */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tight flex items-center gap-1">
                        Chốt lời <span className="text-blue-500 text-[10px]">(TP)</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Giá TP"
                            value={tp}
                            onChange={(e) => setTp(e.target.value)}
                            className="w-full bg-secondary/30 border border-border rounded pl-2 pr-8 py-2 text-xs text-blue-300 focus:outline-none focus:border-blue-500 transition-colors font-medium placeholder:text-muted-foreground/30"
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                            <button onClick={() => setTp(adjustValue(tp, -1, false))} className="p-1 text-muted-foreground hover:text-foreground"><Minus size={10} /></button>
                            <button onClick={() => setTp(adjustValue(tp, 1, false))} className="p-1 text-muted-foreground hover:text-foreground"><Plus size={10} /></button>
                        </div>
                    </div>
                    {tpPnl && (
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[9px] font-bold text-blue-500">{tpPnl.label.split(' (')[0]}</span>
                            <span className="text-[9px] font-bold text-blue-500">{tpPnl.percent.toFixed(2)}%</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
