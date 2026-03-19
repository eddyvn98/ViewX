'use client';

import { Position } from "@/lib/store/types";
import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { useMarketStore } from "@/lib/store";
import { calculatePnL } from "@/lib/utils/pnl";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobilePositionsTableProps {
    positions: Position[];
    onClosePosition: (ticket: number) => void;
    onUpdatePosition: (ticket: number, sl?: number, tp?: number) => void;
    onSymbolClick: (symbol: string) => void;
}

export const MobilePositionsTable = memo(function MobilePositionsTable({ positions, onClosePosition, onUpdatePosition, onSymbolClick }: MobilePositionsTableProps) {
    if (!positions || positions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <p className="text-sm italic">No open positions</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 pb-20">
            {positions.map((pos) => (
                <PositionCard
                    key={pos.ticket}
                    pos={pos}
                    onClose={onClosePosition}
                    onUpdate={onUpdatePosition}
                    onSymbolClick={onSymbolClick}
                />
            ))}
        </div>
    );
});

interface PositionCardProps {
    pos: Position;
    onClose: (t: number) => void;
    onUpdate: (t: number, sl?: number, tp?: number) => void;
    onSymbolClick: (s: string) => void;
}

/**
 * PositionCard with DOM-based updates for realtime fields (price, profit)
 * Prevents React re-renders on every ticker update
 */
const PositionCard = memo(function PositionCard({ pos, onClose, onUpdate, onSymbolClick }: PositionCardProps) {
    const profitRef = useRef<HTMLDivElement>(null);
    const priceRef = useRef<HTMLSpanElement>(null);
    const rafIdRef = useRef<number | null>(null);
    const lastProfitRef = useRef<string>('');
    const lastPriceRef = useRef<string>('');

    const setHoveredTicket = useMarketStore(state => state.setHoveredTicket);

    const [isEditing, setIsEditing] = useState(false);
    const [slValue, setSlValue] = useState(pos.sl?.toString() || '');
    const [tpValue, setTpValue] = useState(pos.tp?.toString() || '');

    const isBuy = (pos.type || '').toLowerCase() === 'buy';

    // DOM update loop - bypasses React
    const updateDOM = useCallback(() => {
        const state = useMarketStore.getState();
        const tickerPrice = state.tickers[pos.symbol]?.price;
        const symbolInfo = state.symbolInfo[pos.symbol];

        const livePrice = tickerPrice || pos.current_price;
        const liveProfit = calculatePnL({
            type: pos.type,
            openPrice: pos.open_price,
            currentPrice: livePrice,
            volume: pos.volume,
            symbolInfo,
            symbol: pos.symbol
        });

        const displayProfit = tickerPrice ? liveProfit : pos.profit;
        const profitStr = (displayProfit > 0 ? '+' : '') + displayProfit.toFixed(2);
        const priceStr = livePrice.toFixed(5);

        if (profitRef.current && profitStr !== lastProfitRef.current) {
            lastProfitRef.current = profitStr;
            profitRef.current.textContent = profitStr;
            profitRef.current.className = cn(
                "text-base font-black font-mono",
                displayProfit >= 0 ? "text-green-500" : "text-red-500"
            );
        }

        if (priceRef.current && priceStr !== lastPriceRef.current) {
            lastPriceRef.current = priceStr;
            priceRef.current.textContent = priceStr;
        }
    }, [pos]);

    useEffect(() => {
        let running = true;
        let lastUpdate = 0;
        const interval = 100; // 10fps max for mobile performance

        const tick = () => {
            if (!running) return;
            const now = Date.now();
            if (now - lastUpdate >= interval) {
                lastUpdate = now;
                updateDOM();
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };

        updateDOM();
        rafIdRef.current = requestAnimationFrame(tick);

        return () => {
            running = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [updateDOM]);

    const handleCommit = () => {
        onUpdate(pos.ticket, parseFloat(slValue), parseFloat(tpValue));
        setIsEditing(false);
    };

    const handleFocus = () => {
        onSymbolClick(pos.symbol);
        setHoveredTicket(pos.ticket);
        setTimeout(() => setHoveredTicket(null), 3000);
    };

    return (
        <div className="bg-secondary/40 border border-border/50 rounded-lg overflow-hidden shadow-sm active:border-blue-500/50 transition-colors mb-2">
            {/* Row 1: Header & Profit */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30" onClick={handleFocus}>
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-5 h-5 rounded flex items-center justify-center",
                        isBuy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    )}>
                        {isBuy ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-black text-foreground">{pos.symbol}</span>
                        <span className="text-[11px] text-muted-foreground font-bold">{pos.volume.toFixed(2)}</span>
                    </div>
                </div>
                <div ref={profitRef} className={cn("text-base font-black font-mono", pos.profit >= 0 ? "text-green-500" : "text-red-500")}>
                    {pos.profit > 0 ? '+' : ''}{pos.profit.toFixed(2)}
                </div>
            </div>

            {/* Row 2: Prices & SL/TP */}
            <div className="px-3 py-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{pos.open_price.toFixed(5)}</span>
                        <div className="w-3 h-px bg-border" />
                        <span ref={priceRef} className={cn("text-xs font-mono font-bold", isBuy ? "text-green-400" : "text-red-400")}>
                            {pos.current_price.toFixed(5)}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <span className="text-[11px] text-red-500/70 font-black uppercase">SL:</span>
                            <span className="text-[11px] font-mono text-foreground/80">{(pos.sl || 0) > 0 ? pos.sl.toFixed(2) : '--'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[11px] text-green-500/70 font-black uppercase">TP:</span>
                            <span className="text-[11px] font-mono text-foreground/80">{(pos.tp || 0) > 0 ? pos.tp.toFixed(2) : '--'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 3: Buttons */}
            <div className="flex items-center border-t border-border/30">
                <button onClick={handleFocus} className="flex-1 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground border-r border-border/30 uppercase tracking-tighter">Focus</button>
                <button onClick={() => setIsEditing(!isEditing)} className="flex-1 py-1.5 text-[11px] font-bold text-blue-500/80 hover:text-blue-400 border-r border-border/30 uppercase tracking-tighter">Adjust</button>
                <button onClick={() => onClose(pos.ticket)} className="flex-1 py-1.5 text-[11px] font-bold text-red-500/80 hover:text-red-400 uppercase tracking-tighter">Close</button>
            </div>

            {/* Inline Edit Panel */}
            {isEditing && (
                <div className="p-3 bg-popover border-t border-border animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">New SL</label>
                            <input type="number" step="0.00001" value={slValue} onChange={e => setSlValue(e.target.value)}
                                className="w-full bg-secondary border-none rounded-md px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">New TP</label>
                            <input type="number" step="0.00001" value={tpValue} onChange={e => setTpValue(e.target.value)}
                                className="w-full bg-secondary border-none rounded-md px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCommit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Save Changes</button>
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-secondary text-muted-foreground rounded-lg text-xs font-bold">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
});
