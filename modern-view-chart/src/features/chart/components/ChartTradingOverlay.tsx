import React, { useRef, useEffect, useCallback, memo } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Zap, Check, X } from 'lucide-react';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { useWebSocket } from '@/hooks/use-websocket';

interface ChartTradingOverlayProps {
    symbol: string | undefined;
    source?: string;
}

/**
 * ChartTradingOverlay with DOM-based price updates
 * Only subscribes to non-ticker state, uses RAF for realtime prices
 */
export const ChartTradingOverlay = memo(function ChartTradingOverlay({ symbol }: ChartTradingOverlayProps) {
    // Only subscribe to non-ticker state
    const draftOrder = useMarketStore(state => state.draftOrder);
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const { sendMessage } = useWebSocket();

    // Get initial price for draft (computed once when needed)
    const getCurrentPrice = useCallback(() => {
        if (!symbol) return 0;
        const normSym = normalizeSymbol(symbol);
        return useMarketStore.getState().tickers[normSym]?.price || 0;
    }, [symbol]);

    const handleStartDraft = (type: 'buy' | 'sell') => {
        const price = getCurrentPrice();
        if (!price || !symbol) return;

        let distance = 0.00500;
        if (symbol.includes('JPY')) distance = 0.50;
        else if (symbol.includes('XAU')) distance = 10.0;
        else if (symbol.includes('BTC')) distance = 100.0;

        const normSym = normalizeSymbol(symbol);
        setDraftOrder({
            symbol: normSym,
            type,
            volume: 0.1,
            price: price,
            isMarket: true,
            sl: 0,
            tp: 0,
            slTouched: false,
            tpTouched: false
        });
    };

    const handleConfirm = () => {
        if (!draftOrder) return;

        // 🛡️ Final Validation Logic (Front-end Gatekeeper)
        const isBuy = draftOrder.type === 'buy';
        const entryPrice = draftOrder.isMarket ? getCurrentPrice() : (draftOrder.price || getCurrentPrice());

        let errorMsg = '';

        if (draftOrder.sl && draftOrder.sl > 0) {
            if (isBuy && draftOrder.sl >= entryPrice) errorMsg = 'Invalid Buy SL: Must be below Entry';
            if (!isBuy && draftOrder.sl <= entryPrice) errorMsg = 'Invalid Sell SL: Must be above Entry';
        }

        if (draftOrder.tp && draftOrder.tp > 0) {
            if (isBuy && draftOrder.tp <= entryPrice) errorMsg = 'Invalid Buy TP: Must be above Entry';
            if (!isBuy && draftOrder.tp >= entryPrice) errorMsg = 'Invalid Sell TP: Must be below Entry';
        }

        if (errorMsg) {
            useMarketStore.getState().addNotification(errorMsg, 'error');
            // Play error sound
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                osc.type = 'sawtooth';
                osc.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            }
            return;
        }

        const payload: any = {
            topic: 'mt5_command',
            command: 'order',
            symbol: draftOrder.symbol,
            type: draftOrder.type,
            volume: draftOrder.volume,
            is_market: draftOrder.isMarket
        };

        const normSym = normalizeSymbol(draftOrder.symbol);
        const digits = useMarketStore.getState().symbolInfo?.[normSym]?.digits || 5;

        if (draftOrder.isMarket) {
            payload.price = 0;
        } else {
            payload.price = Number((draftOrder.price ?? 0).toFixed(digits));
        }

        if (draftOrder.sl && draftOrder.sl > 0) payload.sl = Number(draftOrder.sl.toFixed(digits));
        if (draftOrder.tp && draftOrder.tp > 0) payload.tp = Number(draftOrder.tp.toFixed(digits));

        sendMessage(payload);
        setDraftOrder(null);
    };

    const handleCancel = () => setDraftOrder(null);
    const toggleMarket = () => {
        if (!draftOrder) return;
        setDraftOrder({ ...draftOrder, isMarket: !draftOrder.isMarket });
    };

    // Don't render if no symbol
    if (!symbol) return null;

    return (
        <div className="absolute top-2 left-2 z-50 flex items-center gap-1.5">
            {(!draftOrder || draftOrder.symbol !== symbol) ? (
                <div className="flex items-center p-0.5 bg-zinc-950/90 backdrop-blur-xl rounded-lg border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
                    <button
                        onClick={() => handleStartDraft('buy')}
                        className="group flex items-center justify-center px-3 h-7 bg-emerald-500/10 hover:bg-emerald-500 rounded-md transition-all duration-200"
                    >
                        <span className="text-[11px] font-black text-emerald-400 group-hover:text-white uppercase tracking-wider">BUY</span>
                    </button>

                    <div className="h-3 w-[1px] bg-white/10 mx-1" />

                    <button
                        onClick={() => handleStartDraft('sell')}
                        className="group flex items-center justify-center px-3 h-7 bg-red-500/10 hover:bg-red-500 rounded-md transition-all duration-200"
                    >
                        <span className="text-[11px] font-black text-red-400 group-hover:text-white uppercase tracking-wider">SELL</span>
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-1 p-1 bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                    <button
                        onClick={toggleMarket}
                        className={cn(
                            "px-2.5 h-7 rounded-md text-[11px] font-black uppercase transition-all duration-200 border",
                            draftOrder?.isMarket
                                ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-900/40"
                                : "bg-zinc-800 text-zinc-400 border-white/5 hover:text-white hover:border-white/20"
                        )}
                    >
                        {draftOrder?.isMarket ? "Market" : "Limit"}
                    </button>

                    <button
                        onClick={handleConfirm}
                        className={cn(
                            "flex items-center gap-1.5 px-3.5 h-7 rounded-md text-[11px] font-black transition-all duration-200 shadow-md uppercase tracking-tight",
                            draftOrder?.type === 'buy'
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 border-t border-emerald-400/30"
                                : "bg-red-600 hover:bg-red-500 text-white shadow-red-900/40 border-t border-red-400/30"
                        )}
                    >
                        <Check size={12} strokeWidth={3} />
                        CONFIRM {draftOrder?.type}
                    </button>

                    <button
                        onClick={handleCancel}
                        className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-600 text-zinc-400 hover:text-white rounded-md border border-white/5 transition-all duration-200"
                    >
                        <X size={14} strokeWidth={2.5} />
                    </button>
                </div>
            )}
        </div>
    );
});

