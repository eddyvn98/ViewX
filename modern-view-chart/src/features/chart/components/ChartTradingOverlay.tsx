import React from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Zap, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { useWebSocket } from '@/hooks/use-websocket';

interface ChartTradingOverlayProps {
    symbol: string | undefined;
}

export function ChartTradingOverlay({ symbol }: ChartTradingOverlayProps) {
    const draftOrder = useMarketStore(state => state.draftOrder);
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const tickers = useMarketStore(state => state.tickers);
    const symbolInfo = useMarketStore(state => symbol ? state.symbolInfo[symbol] : undefined);
    const { sendMessage } = useWebSocket();

    const currentTicker = symbol ? tickers[symbol] : null;

    if (!symbol || !currentTicker) return null;

    const handleStartDraft = (type: 'buy' | 'sell') => {
        const price = currentTicker.price;

        // Default distances
        const distance = symbol.includes('JPY') ? 0.3 : (symbol.includes('XAU') || symbol.includes('BTC')) ? 5.0 : 0.00300;

        setDraftOrder({
            symbol,
            type,
            volume: 0.1, // Default lot
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
            payload.price = 0; // Current market price
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
        setDraftOrder({
            ...draftOrder,
            isMarket: !draftOrder.isMarket
        });
    };

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
            {!draftOrder ? (
                <div className="flex items-center p-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 shadow-2xl overflow-hidden">
                    <button
                        onClick={() => handleStartDraft('buy')}
                        className="group flex flex-col items-center justify-center w-16 h-12 hover:bg-emerald-500/20 rounded-l transition-all border-r border-white/5"
                    >
                        <span className="text-[10px] font-bold text-emerald-400 group-hover:text-emerald-300">BUY</span>
                        <span className="text-xs font-mono text-white tracking-tighter">
                            {currentTicker.price.toFixed(symbolInfo?.digits || 2)}
                        </span>
                    </button>

                    <div className="px-2 opacity-20">
                        <Zap size={10} className="text-white" />
                    </div>

                    <button
                        onClick={() => handleStartDraft('sell')}
                        className="group flex flex-col items-center justify-center w-16 h-12 hover:bg-red-500/20 rounded-r transition-all"
                    >
                        <span className="text-[10px] font-bold text-red-400 group-hover:text-red-300">SELL</span>
                        <span className="text-xs font-mono text-white tracking-tighter">
                            {currentTicker.price.toFixed(symbolInfo?.digits || 2)}
                        </span>
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-1 p-1.5 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
                    {/* Market/Limit Toggle */}
                    <button
                        onClick={toggleMarket}
                        className={cn(
                            "px-3 h-9 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5",
                            draftOrder.isMarket
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                                : "bg-zinc-800 text-zinc-400 hover:text-white"
                        )}
                    >
                        {draftOrder.isMarket ? "Market" : "Limit"}
                    </button>

                    {/* CONFIRM BUTTON */}
                    <button
                        onClick={handleConfirm}
                        className={cn(
                            "flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-bold transition-all shadow-lg",
                            draftOrder.type === 'buy'
                                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20"
                                : "bg-red-600 hover:bg-red-500 shadow-red-900/20"
                        )}
                    >
                        <Check size={14} />
                        CONFIRM {draftOrder.type.toUpperCase()}
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
}
