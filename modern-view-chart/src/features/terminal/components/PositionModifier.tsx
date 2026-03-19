'use client';

import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ChevronDown, Info, Minus, Plus, X } from 'lucide-react';

type ModifierTab = 'modify' | 'partial' | 'closeBy';

const tabs: Array<{ id: ModifierTab; label: string }> = [
    { id: 'modify', label: 'Modify' },
    { id: 'partial', label: 'Partial Close' },
    { id: 'closeBy', label: 'Close By' },
];

export function PositionModifier() {
    const editingPosition = useMarketStore((state) => state.editingPosition);
    const setEditingPosition = useMarketStore((state) => state.setEditingPosition);
    const tickers = useMarketStore((state) => state.tickers);

    const [activeTab, setActiveTab] = useState<ModifierTab>('modify');
    const [sl, setSl] = useState(editingPosition?.sl?.toString() || '');
    const [tp, setTp] = useState(editingPosition?.tp?.toString() || '');
    const [partialVolume, setPartialVolume] = useState('0.01');

    const ticker = editingPosition ? tickers[editingPosition.symbol] : undefined;
    const currentPrice = ticker?.price || editingPosition?.open_price || 0;
    const isLong = editingPosition ? editingPosition.type.toLowerCase().includes('buy') : true;

    const pnl = editingPosition
        ? (isLong
            ? (currentPrice - editingPosition.open_price) * editingPosition.volume * 100
            : (editingPosition.open_price - currentPrice) * editingPosition.volume * 100)
        : 0;

    const formatPrice = (price: number) => price.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const formatPnl = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)} USD`;

    const handleAdjust = (value: string, setter: (nextValue: string) => void, step: number) => {
        const current = parseFloat(value) || currentPrice;
        setter((current + step).toFixed(3));
    };

    const calculateTargetPnl = (targetPriceStr: string) => {
        if (!editingPosition) return null;
        const target = parseFloat(targetPriceStr);
        if (Number.isNaN(target)) return null;
        const diff = isLong ? target - editingPosition.open_price : editingPosition.open_price - target;
        const projected = diff * editingPosition.volume * 100;
        const points = Math.abs(target - editingPosition.open_price) * 1000;
        return { pnl: formatPnl(projected), points: points.toFixed(1) };
    };

    const slMetrics = calculateTargetPnl(sl);
    const tpMetrics = calculateTargetPnl(tp);

    if (!editingPosition) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="w-[420px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-5 py-4 border-b border-border/50 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">$</span>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground tracking-tight">{editingPosition.symbol}</span>
                                    <span className="text-[11px] text-muted-foreground font-bold">{editingPosition.volume} lot</span>
                                </div>
                                <div className="flex items-center gap-2 text-[12px]">
                                    <span className={cn('font-bold', isLong ? 'text-blue-500' : 'text-red-500')}>
                                        {isLong ? 'Buy' : 'Sell'}
                                    </span>
                                    <span className="text-muted-foreground">at {formatPrice(editingPosition.open_price)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={cn('text-sm font-black', pnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                                {formatPnl(pnl)}
                            </span>
                            <button onClick={() => setEditingPosition(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-muted-foreground font-bold">
                        <span>Current price</span>
                        <span className="text-foreground">{formatPrice(currentPrice)}</span>
                    </div>
                </div>

                <div className="px-4 py-2 border-b border-border/50 flex gap-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex-1 py-2 text-[13px] font-bold rounded-lg transition-all',
                                activeTab === tab.id ? 'bg-secondary text-foreground border border-border/50 shadow-sm' : 'text-muted-foreground hover:text-foreground/80'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-5 space-y-6 min-h-[220px]">
                    {activeTab === 'modify' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider flex items-center justify-between">
                                    <span>Take profit</span>
                                    <Info size={12} className="text-muted-foreground/30" />
                                </label>
                                <div className="flex gap-1.5">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={tp}
                                            onChange={(event) => setTp(event.target.value)}
                                            placeholder="Not set"
                                            className="w-full bg-secondary/40 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-all font-medium placeholder:text-muted-foreground/30"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-muted-foreground font-bold cursor-pointer hover:text-foreground">
                                            Price <ChevronDown size={14} />
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleAdjust(tp, setTp, -1)} className="p-2.5 bg-secondary hover:bg-secondary/70 rounded-xl text-muted-foreground border border-border/50 transition-colors"><Minus size={16} /></button>
                                        <button onClick={() => handleAdjust(tp, setTp, 1)} className="p-2.5 bg-secondary hover:bg-secondary/70 rounded-xl text-muted-foreground border border-border/50 transition-colors"><Plus size={16} /></button>
                                    </div>
                                </div>
                                {tpMetrics && (
                                    <div className="flex gap-3 text-[11px] font-bold text-blue-400 ml-1">
                                        <span>{tpMetrics.pnl}</span>
                                        <span className="text-muted-foreground/40">|</span>
                                        <span>{tpMetrics.points} points</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider flex items-center justify-between">
                                    <span>Stop loss</span>
                                    <Info size={12} className="text-muted-foreground/30" />
                                </label>
                                <div className="flex gap-1.5">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={sl}
                                            onChange={(event) => setSl(event.target.value)}
                                            placeholder="Not set"
                                            className="w-full bg-secondary/40 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-all font-medium placeholder:text-muted-foreground/30"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-muted-foreground font-bold cursor-pointer hover:text-foreground">
                                            Price <ChevronDown size={14} />
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleAdjust(sl, setSl, -1)} className="p-2.5 bg-secondary hover:bg-secondary/70 rounded-xl text-muted-foreground border border-border/50 transition-colors"><Minus size={16} /></button>
                                        <button onClick={() => handleAdjust(sl, setSl, 1)} className="p-2.5 bg-secondary hover:bg-secondary/70 rounded-xl text-muted-foreground border border-border/50 transition-colors"><Plus size={16} /></button>
                                    </div>
                                </div>
                                {slMetrics && (
                                    <div className="flex gap-3 text-[11px] font-bold text-red-400 ml-1">
                                        <span>{slMetrics.pnl}</span>
                                        <span className="text-muted-foreground/40">|</span>
                                        <span>{slMetrics.points} points</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'partial' && (
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Volume to close</label>
                                <div className="flex gap-1.5">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={partialVolume}
                                            onChange={(event) => setPartialVolume(event.target.value)}
                                            className="w-full bg-secondary/40 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-all font-bold"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/60 font-bold uppercase">Lot</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => {
                                                const value = Math.max(0.01, (parseFloat(partialVolume) || 0) - 0.01);
                                                setPartialVolume(value.toFixed(2));
                                            }}
                                            className="p-2.5 bg-secondary hover:bg-secondary/70 rounded-xl text-muted-foreground border border-border/50 transition-colors"
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const value = Math.min(editingPosition.volume, (parseFloat(partialVolume) || 0) + 0.01);
                                                setPartialVolume(value.toFixed(2));
                                            }}
                                            className="p-2.5 bg-secondary hover:bg-secondary/70 rounded-xl text-muted-foreground border border-border/50 transition-colors"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                                <span className="text-[11px] text-muted-foreground/50 font-bold ml-1">Min: 0.01 - Max: {editingPosition.volume}</span>
                            </div>
                            <div className="text-center pt-2">
                                <div className="text-[12px] text-muted-foreground font-bold">Estimated PnL:</div>
                                <div className={cn('text-lg font-black', pnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                                    {formatPnl((pnl * (parseFloat(partialVolume) || 0)) / editingPosition.volume)}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'closeBy' && (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <span className="text-2xl">#</span>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-foreground">No opposite order found</h4>
                                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[280px]">
                                    The close-by mode lets traders offset two opposite positions against each other.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 pt-0">
                    <button
                        onClick={() => setEditingPosition(null)}
                        className={cn(
                            'w-full py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]',
                            activeTab === 'modify' ? 'bg-yellow-400 hover:bg-yellow-300 text-black' : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        )}
                    >
                        {activeTab === 'modify' ? 'Modify Position' : activeTab === 'partial' ? 'Close Position' : 'Back'}
                    </button>
                    <button
                        onClick={() => setEditingPosition(null)}
                        className="w-full mt-2 py-3 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
