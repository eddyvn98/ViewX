import React, { useRef, useEffect, useCallback, memo } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Zap, Check, X } from 'lucide-react';
import { useWebSocket } from '@/hooks/use-websocket';

interface ChartTradingOverlayProps {
    symbol: string | undefined;
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
        return useMarketStore.getState().tickers[symbol]?.price || 0;
    }, [symbol]);

    const handleStartDraft = (type: 'buy' | 'sell') => {
        const price = getCurrentPrice();
        if (!price || !symbol) return;

        let distance = 0.00500;
        if (symbol.includes('JPY')) distance = 0.50;
        else if (symbol.includes('XAU')) distance = 10.0;
        else if (symbol.includes('BTC')) distance = 100.0;

        setDraftOrder({
            symbol,
            type,
            volume: 0.1,
            price: price,
            isMarket: true,
            sl: type === 'buy' ? price - distance : price + distance,
            tp: type === 'buy' ? price + distance : price - distance,
            slTouched: false,
            tpTouched: false
        });
    };

    const handleConfirm = () => {
        if (!draftOrder) return;

        const payload: any = {
            topic: 'mt5_command',
            command: 'order',
            symbol: draftOrder.symbol,
            type: draftOrder.type,
            volume: draftOrder.volume,
            is_market: draftOrder.isMarket
        };

        if (draftOrder.isMarket) {
            payload.price = 0;
        } else {
            payload.price = draftOrder.price;
        }

        if (draftOrder.slTouched) payload.sl = draftOrder.sl;
        if (draftOrder.tpTouched) payload.tp = draftOrder.tp;

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
        <div className="absolute top-1.5 left-1.5 z-50 flex items-center gap-2">
            {(!draftOrder || draftOrder.symbol !== symbol) ? (
                <div className="flex items-center p-1 bg-zinc-950/80 backdrop-blur-xl rounded-lg border border-white/10 shadow-2xl overflow-hidden">
                    <button
                        onClick={() => handleStartDraft('buy')}
                        className="group flex flex-col items-center justify-center w-10 h-7 hover:bg-emerald-500/20 rounded transition-all"
                    >
                        <span className="text-[10px] font-bold text-emerald-400 group-hover:text-emerald-300">BUY</span>
                    </button>

                    <div className="h-4 w-[1px] bg-white/10 mx-0.5" />

                    <button
                        onClick={() => handleStartDraft('sell')}
                        className="group flex flex-col items-center justify-center w-10 h-7 hover:bg-red-500/20 rounded transition-all"
                    >
                        <span className="text-[10px] font-bold text-red-400 group-hover:text-red-300">SELL</span>
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-1 p-1 bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl">
                    <button
                        onClick={toggleMarket}
                        className={cn(
                            "px-3 h-9 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5",
                            draftOrder?.isMarket
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                                : "bg-zinc-800 text-zinc-400 hover:text-white"
                        )}
                    >
                        {draftOrder?.isMarket ? "Market" : "Limit"}
                    </button>

                    <button
                        onClick={handleConfirm}
                        className={cn(
                            "flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-bold transition-all shadow-lg",
                            draftOrder?.type === 'buy'
                                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20"
                                : "bg-red-600 hover:bg-red-500 shadow-red-900/20"
                        )}
                    >
                        <Check size={14} />
                        CONFIRM {draftOrder?.type?.toUpperCase()}
                    </button>

                    <button
                        onClick={handleCancel}
                        className="w-9 h-9 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    );
});

