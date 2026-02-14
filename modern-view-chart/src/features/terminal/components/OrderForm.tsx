'use client';

import React, { useState, useMemo, memo } from 'react';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { cn } from '@/lib/utils';
import { X, ChevronDown, Minus, Plus } from 'lucide-react';

// Sub-components
import { OrderTypeTabs } from './OrderForm/OrderTypeTabs';
import { SideButtons } from './OrderForm/SideButtons';
import { OrderInputs } from './OrderForm/OrderInputs';
import { OrderDetails } from './OrderForm/OrderDetails';
import { SentimentBar } from './OrderForm/SentimentBar';
import { MobileTradeFlow } from './OrderForm/MobileTradeFlow';

type OrderType = 'market' | 'pending';
type Side = 'buy' | 'sell';

/**
 * Mobile-specific order logic hook
 */
export function useOrderFormLogic() {
    const [orderType, setOrderType] = useState<OrderType>('market');
    const [side, setSide] = useState<Side>('buy');
    const [volume, setVolume] = useState('0.1');
    const [sl, setSl] = useState('');
    const [tp, setTp] = useState('');
    const [isDrafting, setIsDrafting] = useState(false);

    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const setInputFocused = useMarketStore(state => state.setInputFocused);
    const { sendMessage } = useWebSocket();

    const activeTabId = useMarketStore(state => state.activeTabId);
    const activeTab = useMarketStore(state => state.tabs[activeTabId]);
    const activeChartId = activeTab?.activeChartId;
    const activeChart = activeChartId ? activeTab.charts[activeChartId] : null;
    const symbol = activeChart?.symbol || 'BTCUSDm';
    const ticker = useMarketStore(state => state.tickers[symbol]);

    const isCrypto = activeChart?.source === 'BINANCE';
    const bid = ticker?.price || 0;
    const ask = bid * 1.0001;
    const spread = (ask - bid).toFixed(2);

    // Sync drafting state
    React.useEffect(() => {
        if (!isDrafting) { setDraftOrder(null); return; }
        setDraftOrder({
            symbol, type: side, volume: parseFloat(volume) || 0,
            sl: parseFloat(sl) || undefined, tp: parseFloat(tp) || undefined,
            isMarket: orderType === 'market'
        });
        return () => setDraftOrder(null);
    }, [symbol, side, volume, sl, tp, orderType, isDrafting, setDraftOrder]);

    const resetForm = () => { setSl(''); setTp(''); setIsDrafting(false); setDraftOrder(null); };

    const adjustValue = (val: string, step: number, isSL: boolean) => {
        let current = parseFloat(val);
        if (isNaN(current)) {
            const entry = side === 'buy' ? ask : bid;
            const direction = isSL ? (side === 'buy' ? -1 : 1) : (side === 'buy' ? 1 : -1);
            current = entry + (direction * (ticker?.price ? ticker.price * 0.005 : 10));
        } else { current += step; }
        setIsDrafting(true);
        return current.toFixed(2);
    };

    const adjustVolume = (val: string, step: number) => {
        setIsDrafting(true);
        return Math.max(0.01, (parseFloat(val) || 0) + step).toFixed(2);
    };

    const handleSubmit = () => {
        sendMessage({
            topic: isCrypto ? 'binance_command' : 'mt5_command',
            command: isCrypto ? side : 'place_order',
            symbol, order_type: side,
            volume: parseFloat(volume), quantity: parseFloat(volume),
            price: orderType === 'pending' ? (side === 'buy' ? ask : bid) : 0,
            sl: parseFloat(sl) || 0, tp: parseFloat(tp) || 0,
            is_market: orderType === 'market'
        });
        resetForm();
    };

    const formatPrice = (p: number) => p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const calculatePnl = (targetPriceStr: string) => {
        const targetPrice = parseFloat(targetPriceStr);
        if (isNaN(targetPrice) || !bid) return null;
        const volNum = parseFloat(volume) || 0;
        const entry = side === 'buy' ? ask : bid;
        const diff = side === 'buy' ? targetPrice - entry : entry - targetPrice;

        // Basic calculation (can be refined with actual contract sizes)
        const pnlValue = diff * volNum * 100;
        const pnlPercent = (diff / entry) * 100;

        return {
            value: pnlValue,
            percent: pnlPercent,
            label: `${pnlValue >= 0 ? '+' : ''}${pnlValue.toFixed(2)} USD (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`
        };
    };

    return {
        symbol, side, setSide, orderType, setOrderType, volume, setVolume,
        sl, setSl, tp, setTp, bid, ask, spread, adjustValue, adjustVolume,
        handleSubmit, setIsDrafting, setInputFocused, formatPrice, calculatePnl
    };
}

export const OrderForm = memo(function OrderForm() {
    const {
        symbol, side, setSide, orderType, setOrderType, volume, setVolume,
        sl, setSl, tp, setTp, bid, ask, spread, adjustValue, adjustVolume,
        handleSubmit, setIsDrafting, setInputFocused, formatPrice, calculatePnl
    } = useOrderFormLogic();

    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

    const slPnl = useMemo(() => calculatePnl(sl), [sl, calculatePnl]);
    const tpPnl = useMemo(() => calculatePnl(tp), [tp, calculatePnl]);

    const resetForm = () => { setSl(''); setTp(''); setIsDrafting(false); };

    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH'); // Simplified check for display

    return (
        <div className="flex-1 bg-[#0b0e14] flex flex-col overflow-hidden select-none">
            {/* MOBILE LAYOUT REMOVED - NOW IN BOTTOM NAV */}

            {/* DESKTOP LAYOUT (Existing) */}
            <div className="hidden md:flex flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 flex-col">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-900">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-white text-[12px] tracking-tighter">{symbol.replace('m', '')}</span>
                        <span className={cn("text-[8px] font-black px-1 py-0.5 rounded border border-white/5", isCrypto ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500")}>
                            {isCrypto ? 'BINANCE' : 'MT5'}
                        </span>
                    </div>
                </div>

                <OrderTypeTabs orderType={orderType} setOrderType={setOrderType} />

                <SideButtons
                    side={side} setSide={setSide} setIsDrafting={setIsDrafting}
                    bid={bid} ask={ask} spread={spread} formatPrice={formatPrice}
                />

                <SentimentBar />

                <OrderInputs
                    volume={volume} setVolume={setVolume}
                    sl={sl} setSl={setSl} tp={tp} setTp={setTp}
                    slPnl={slPnl} tpPnl={tpPnl}
                    adjustVolume={adjustVolume} adjustValue={adjustValue}
                    formatPrice={formatPrice}
                />

                <div className="pt-0 space-y-1.5 shrink-0">
                    <button onClick={handleSubmit} className={cn("w-full py-2 rounded-md text-[11px] font-black shadow-lg active:scale-95 transition-all uppercase tracking-widest", side === 'buy' ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/40 text-white" : "bg-red-600 hover:bg-red-500 shadow-red-900/40 text-white")}>
                        {side === 'buy' ? 'BUY' : 'SELL'} {volume} LOTS
                    </button>
                    <button onClick={resetForm} className="w-full py-1.5 rounded-md text-[9px] font-bold text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/50 transition-all uppercase tracking-tight">Thoát</button>
                </div>

                <OrderDetails
                    isDetailsExpanded={isDetailsExpanded}
                    setIsDetailsExpanded={setIsDetailsExpanded}
                    spread={spread}
                />
            </div>
        </div>
    );
});

