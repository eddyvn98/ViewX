'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
    ChevronLeft,
    Minus,
    Plus,
    X,
    TrendingUp,
    TrendingDown,
    CheckCircle2
} from 'lucide-react';

type Step = 'side' | 'type' | 'volume' | 'sl' | 'tp' | 'confirm';

interface MobileTradeFlowProps {
    symbol: string;
    side: 'buy' | 'sell';
    setSide: (side: 'buy' | 'sell') => void;
    orderType: 'market' | 'pending';
    setOrderType: (type: 'market' | 'pending') => void;
    volume: string;
    setVolume: (v: string) => void;
    sl: string;
    setSl: (v: string) => void;
    tp: string;
    setTp: (v: string) => void;
    bid: number;
    ask: number;
    spread: string;
    formatPrice: (p: number) => string;
    adjustVolume: (val: string, step: number) => string;
    adjustValue: (val: string, step: number, isSL: boolean) => string;
    handleSubmit: () => void;
    setIsDrafting: (v: boolean) => void;
    setInputFocused: (v: boolean) => void;
    onClose: () => void;
    calculatePnl: (targetPriceStr: string) => { value: number; percent: number; label: string } | null;
}

export function MobileTradeFlow({
    symbol, side, setSide,
    orderType, setOrderType,
    volume, setVolume,
    sl, setSl, tp, setTp,
    bid, ask, spread, formatPrice,
    adjustVolume, adjustValue,
    handleSubmit, setIsDrafting,
    setInputFocused, onClose,
    calculatePnl
}: MobileTradeFlowProps) {
    const [step, setStep] = useState<Step>('side');

    const nextStep = () => {
        const flow: Step[] = ['side', 'type', 'volume', 'sl', 'tp', 'confirm'];
        const idx = flow.indexOf(step);
        if (idx < flow.length - 1) setStep(flow[idx + 1]);
    };

    const prevStep = () => {
        const flow: Step[] = ['side', 'type', 'volume', 'sl', 'tp', 'confirm'];
        const idx = flow.indexOf(step);
        if (idx > 0) setStep(flow[idx - 1]);
        else onClose();
    };

    const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <span className={cn("text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground", className)}>
            {children}
        </span>
    );

    return (
        <div className="relative w-full h-[48px] overflow-x-hidden overflow-y-hidden bg-transparent">
            {/* ULTRA-THIN PROGRESS (Bottom aligned) */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-secondary/10 flex overflow-hidden">
                <div
                    className="h-full bg-blue-500 transition-all duration-500 ease-out"
                    style={{
                        width: `${((['side', 'type', 'volume', 'sl', 'tp', 'confirm'].indexOf(step) + 1) / 6) * 100}%`
                    }}
                />
            </div>

            <div
                className="flex h-full transition-transform duration-500 ease-[cubic-bezier(0.2,1,0.3,1)]"
                style={{
                    transform: `translateX(-${['side', 'type', 'volume', 'sl', 'tp', 'confirm'].indexOf(step) * 100}%)`
                }}
            >
                {/* STEP 1: SIDE */}
                <div className="w-full shrink-0 flex items-center px-3 gap-2">
                    <button onClick={onClose} className="p-2 text-muted-foreground active:scale-95 transition-all">
                        <X size={18} />
                    </button>
                    <div className="flex-1 grid grid-cols-2 gap-2 h-[34px]">
                        <button
                            onClick={() => { setSide('sell'); nextStep(); }}
                            className="bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <TrendingDown size={14} className="text-red-500" />
                            <span className="text-[11px] font-black text-foreground">BÁN</span>
                        </button>
                        <button
                            onClick={() => { setSide('buy'); nextStep(); }}
                            className="bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <TrendingUp size={14} className="text-blue-500" />
                            <span className="text-[11px] font-black text-foreground">MUA</span>
                        </button>
                    </div>
                </div>

                {/* STEP 2: TYPE */}
                <div className="w-full shrink-0 flex items-center px-3 gap-2">
                    <button onClick={prevStep} className="p-2 text-muted-foreground active:scale-95 transition-all">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex-1 grid grid-cols-2 gap-2 h-[34px]">
                        <button
                            onClick={() => { setOrderType('market'); nextStep(); }}
                            className={cn(
                                "rounded-xl text-[10px] font-black uppercase transition-all border",
                                orderType === 'market' ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/10 text-muted-foreground border-border/20"
                            )}
                        >THỊ TRƯỜNG</button>
                        <button
                            onClick={() => { setOrderType('pending'); nextStep(); }}
                            className={cn(
                                "rounded-xl text-[10px] font-black uppercase transition-all border",
                                orderType === 'pending' ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/10 text-muted-foreground border-border/20"
                            )}
                        >CHỜ KHỚP</button>
                    </div>
                </div>

                {/* STEP 3: VOLUME */}
                <div className="w-full shrink-0 flex items-center px-3 gap-2">
                    <button onClick={prevStep} className="p-2 text-muted-foreground active:scale-95 transition-all">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex-1 flex items-center justify-between bg-secondary/5 rounded-xl h-[34px] border border-border/20 px-1">
                        <button onClick={() => setVolume(adjustVolume(volume, -0.01))} className="p-2 text-muted-foreground active:text-foreground"><Minus size={14} strokeWidth={3} /></button>
                        <div className="relative flex flex-col items-center">
                            <input
                                type="text" value={volume}
                                onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
                                onChange={(e) => setVolume(e.target.value)}
                                className="bg-transparent text-center text-sm font-black text-foreground w-16 focus:outline-none"
                            />
                            <Label className="absolute -bottom-3 text-[5px] text-muted-foreground/40">LOTS</Label>
                        </div>
                        <button onClick={() => setVolume(adjustVolume(volume, 0.01))} className="p-2 text-muted-foreground active:text-foreground"><Plus size={14} strokeWidth={3} /></button>
                    </div>
                    <button onClick={nextStep} className="h-[34px] px-4 bg-primary text-primary-foreground rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all">TIẾP</button>
                </div>

                {/* STEP 4: SL */}
                <div className="w-full shrink-0 flex items-center px-3 gap-2">
                    <button onClick={prevStep} className="p-2 text-muted-foreground active:scale-95 transition-all">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex-1 flex items-center justify-between bg-red-500/5 rounded-xl h-[34px] border border-red-500/20 px-1 relative overflow-hidden">
                        <button onClick={() => setSl(adjustValue(sl, -0.1, true))} className="p-2 text-red-500/40 active:text-red-500"><Minus size={14} strokeWidth={3} /></button>
                        <div className="flex flex-col items-center">
                            <input
                                placeholder="DỪNG LỖ" value={sl}
                                onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
                                onChange={(e) => setSl(e.target.value)}
                                className="bg-transparent text-center text-sm font-black text-red-500 w-24 focus:outline-none placeholder:text-red-500/30"
                            />
                            {sl && calculatePnl(sl) && (
                                <span className="absolute -bottom-0.5 text-[6px] font-black text-red-500/60 uppercase">
                                    {calculatePnl(sl)?.percent.toFixed(1)}% / ≈ {calculatePnl(sl)?.label.split(' (')[0].replace(' USD', '')}$
                                </span>
                            )}
                        </div>
                        <button onClick={() => setSl(adjustValue(sl, 0.1, true))} className="p-2 text-red-500/40 active:text-red-500"><Plus size={14} strokeWidth={3} /></button>
                    </div>
                    <button onClick={nextStep} className="h-[34px] px-4 bg-primary text-primary-foreground rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all">TIẾP</button>
                </div>

                {/* STEP 5: TP */}
                <div className="w-full shrink-0 flex items-center px-3 gap-2">
                    <button onClick={prevStep} className="p-2 text-muted-foreground active:scale-95 transition-all">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex-1 flex items-center justify-between bg-blue-500/5 rounded-xl h-[34px] border border-blue-500/20 px-1 relative overflow-hidden">
                        <button onClick={() => setTp(adjustValue(tp, -0.1, false))} className="p-2 text-blue-500/40 active:text-blue-500"><Minus size={14} strokeWidth={3} /></button>
                        <div className="flex flex-col items-center">
                            <input
                                placeholder="CHỐT LỜI" value={tp}
                                onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
                                onChange={(e) => setTp(e.target.value)}
                                className="bg-transparent text-center text-sm font-black text-blue-500 w-24 focus:outline-none placeholder:text-blue-500/30"
                            />
                            {tp && calculatePnl(tp) && (
                                <span className="absolute -bottom-0.5 text-[6px] font-black text-blue-500/60 uppercase">
                                    {calculatePnl(tp)?.percent.toFixed(1)}% / ≈ {calculatePnl(tp)?.label.split(' (')[0].replace(' USD', '')}$
                                </span>
                            )}
                        </div>
                        <button onClick={() => setTp(adjustValue(tp, 0.1, false))} className="p-2 text-blue-500/40 active:text-blue-500"><Plus size={14} strokeWidth={3} /></button>
                    </div>
                    <button onClick={nextStep} className="h-[34px] px-4 bg-primary text-primary-foreground rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all">XONG</button>
                </div>

                {/* STEP 6: CONFIRM */}
                <div className="w-full shrink-0 flex items-center px-3 gap-3">
                    <button onClick={prevStep} className="p-2 text-muted-foreground active:scale-95 transition-all">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex-1 flex flex-col justify-center leading-tight">
                        <div className="flex items-center gap-1.5">
                            <span className={cn("text-[10px] font-black", side === 'buy' ? "text-blue-500" : "text-red-500")}>
                                {side === 'buy' ? 'MUA' : 'BÁN'} {volume} LÔ
                            </span>
                            <div className="w-1 h-1 rounded-full bg-secondary" />
                            <span className="text-[10px] font-black text-foreground">{symbol.replace('m', '')}</span>
                        </div>
                        <Label className="text-muted-foreground/60 font-bold">{orderType === 'market' ? 'GIÁ THỊ TRƯỜNG' : 'LỆNH CHỜ KHỚP'}</Label>
                    </div>
                    <button
                        onClick={() => {
                            handleSubmit();
                            setTimeout(() => setStep('side'), 500);
                        }}
                        className={cn(
                            "h-[36px] px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                            side === 'buy' ? "bg-blue-600 text-white shadow-blue-500/20" : "bg-red-600 text-white shadow-red-500/20"
                        )}
                    >
                        VÀO LỆNH
                    </button>
                </div>
            </div>
        </div>
    );
}
