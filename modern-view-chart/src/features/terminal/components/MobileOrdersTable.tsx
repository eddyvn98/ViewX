'use client';

import { Order } from "@/lib/store/types";
import React from "react";
import { useMarketStore } from "@/lib/store";
import { X, Target, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileOrdersTableProps {
    orders: Order[];
    onCancelOrder: (ticket: number) => void;
    onSymbolClick: (symbol: string) => void;
}

export function MobileOrdersTable({ orders, onCancelOrder, onSymbolClick }: MobileOrdersTableProps) {
    if (!orders || orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-500">
                <p className="text-sm italic">No pending orders</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 pb-20">
            {orders.map((ord) => (
                <OrderCard
                    key={ord.ticket}
                    ord={ord}
                    onCancel={onCancelOrder}
                    onSymbolClick={onSymbolClick}
                />
            ))}
        </div>
    );
}

function OrderCard({ ord, onCancel, onSymbolClick }: {
    ord: Order;
    onCancel: (t: number) => void;
    onSymbolClick: (s: string) => void;
}) {
    const setHoveredTicket = useMarketStore(state => state.setHoveredTicket);
    const livePrice = useMarketStore(state => state.tickers[ord.symbol]?.price || ord.current_price);

    const isBuy = (ord.type || '').toLowerCase().includes('buy');

    const handleFocus = () => {
        onSymbolClick(ord.symbol);
        setHoveredTicket(ord.ticket);
        setTimeout(() => setHoveredTicket(null), 3000);
    };

    return (
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg overflow-hidden shadow-sm active:border-blue-500/50 transition-colors mb-2">
            {/* Header: Type & Symbol */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/30" onClick={handleFocus}>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-yellow-500/10 text-yellow-500">
                        <Clock size={12} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-black text-white">{ord.symbol}</span>
                        <span className="text-[10px] text-zinc-500 font-bold">{ord.volume.toFixed(2)} Lot</span>
                    </div>
                </div>
                <div className="text-[10px] font-black uppercase text-yellow-500/80 bg-yellow-500/5 px-1.5 py-0.5 rounded border border-yellow-500/10">
                    {ord.type}
                </div>
            </div>

            {/* Price Info */}
            <div className="px-3 py-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Target:</span>
                        <span className="text-xs font-mono font-bold text-zinc-200">{ord.price_open.toFixed(5)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Live:</span>
                        <span className="text-xs font-mono text-zinc-400">{livePrice.toFixed(5)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] text-red-500/70 font-black uppercase">SL:</span>
                        <span className="text-[10px] font-mono text-zinc-300">{(ord.sl || 0) > 0 ? ord.sl.toFixed(2) : '--'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] text-green-500/70 font-black uppercase">TP:</span>
                        <span className="text-[10px] font-mono text-zinc-300">{(ord.tp || 0) > 0 ? ord.tp.toFixed(2) : '--'}</span>
                    </div>
                    <div className="ml-auto text-[9px] text-zinc-600 font-mono">#{ord.ticket}</div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center border-t border-zinc-800/30">
                <button onClick={handleFocus} className="flex-1 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-white border-r border-zinc-800/30 uppercase tracking-tighter">
                    Focus
                </button>
                <button onClick={() => onCancel(ord.ticket)} className="flex-1 py-1.5 text-[10px] font-bold text-red-500/80 hover:text-red-400 uppercase tracking-tighter">
                    Cancel Order
                </button>
            </div>
        </div>
    );
}
