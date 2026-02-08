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
    const buyPriceRef = useRef<HTMLSpanElement>(null);
    const sellPriceRef = useRef<HTMLSpanElement>(null);
    const rafIdRef = useRef<number | null>(null);
    const lastPriceRef = useRef<string>('');

    // Only subscribe to non-ticker state
    const draftOrder = useMarketStore(state => state.draftOrder);
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const symbolInfo = useMarketStore(state => symbol ? state.symbolInfo[symbol] : undefined);
    const { sendMessage } = useWebSocket();

    const digits = symbolInfo?.digits || 2;

    // RAF-based price update
    const updatePrices = useCallback(() => {
        if (!symbol) return;
        const state = useMarketStore.getState();
        const ticker = state.tickers[symbol];
        if (!ticker) return;

        const priceStr = ticker.price.toFixed(digits);
        if (priceStr !== lastPriceRef.current) {
            lastPriceRef.current = priceStr;
            if (buyPriceRef.current) buyPriceRef.current.textContent = priceStr;
            if (sellPriceRef.current) sellPriceRef.current.textContent = priceStr;
        }
    }, [symbol, digits]);

    useEffect(() => {
        if (!symbol) return;
        let running = true;
        let lastUpdate = 0;
        const interval = 100;

        const tick = () => {
            if (!running) return;
            const now = Date.now();
            if (now - lastUpdate >= interval) {
                lastUpdate = now;
                updatePrices();
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };

        updatePrices();
        rafIdRef.current = requestAnimationFrame(tick);

        return () => {
            running = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [symbol, updatePrices]);

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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
            {(!draftOrder || draftOrder.symbol !== symbol) ? (
                <div className="flex items-center p-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 shadow-2xl overflow-hidden">
                    <button
                        onClick={() => handleStartDraft('buy')}
                        className="group flex flex-col items-center justify-center w-16 h-12 hover:bg-emerald-500/20 rounded-l transition-all border-r border-white/5"
                    >
                        <span className="text-[10px] font-bold text-emerald-400 group-hover:text-emerald-300">BUY</span>
                        <span ref={buyPriceRef} className="text-xs font-mono text-white tracking-tighter">···</span>
                    </button>

                    <div className="px-2 opacity-20">
                        <Zap size={10} className="text-white" />
                    </div>

                    <button
                        onClick={() => handleStartDraft('sell')}
                        className="group flex flex-col items-center justify-center w-16 h-12 hover:bg-red-500/20 rounded-r transition-all"
                    >
                        <span className="text-[10px] font-bold text-red-400 group-hover:text-red-300">SELL</span>
                        <span ref={sellPriceRef} className="text-xs font-mono text-white tracking-tighter">···</span>
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-1 p-1.5 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
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

