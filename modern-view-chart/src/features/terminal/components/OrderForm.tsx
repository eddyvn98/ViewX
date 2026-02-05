'use client';

import React, { useState, useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

// Sub-components
import { OrderTypeTabs } from './OrderForm/OrderTypeTabs';
import { SideButtons } from './OrderForm/SideButtons';
import { OrderInputs } from './OrderForm/OrderInputs';
import { OrderDetails } from './OrderForm/OrderDetails';
import { SentimentBar } from './OrderForm/SentimentBar';

type OrderType = 'market' | 'pending';
type Side = 'buy' | 'sell';

export function OrderForm() {
    const [orderType, setOrderType] = useState<OrderType>('market');
    const [side, setSide] = useState<Side>('buy');
    const [volume, setVolume] = useState('0.1');
    const [sl, setSl] = useState('');
    const [tp, setTp] = useState('');
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const [isDrafting, setIsDrafting] = useState(false);

    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const positions = useMarketStore(state => state.positions);
    const setPositions = useMarketStore(state => state.setPositions);
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
    const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const pnlCalculation = (price: string) => {
        const targetPrice = parseFloat(price);
        if (isNaN(targetPrice) || !bid) return null;
        const volNum = parseFloat(volume) || 0;
        const entry = side === 'buy' ? ask : bid;
        const diff = side === 'buy' ? targetPrice - entry : entry - targetPrice;
        const pnl = diff * volNum * 100;
        return `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USD`;
    };

    const slPnl = useMemo(() => pnlCalculation(sl), [sl, side, volume, bid, ask]);
    const tpPnl = useMemo(() => pnlCalculation(tp), [tp, side, volume, bid, ask]);

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
        const newPosition: any = {
            ticket: Math.floor(Math.random() * 1000000),
            symbol, type: side, volume: parseFloat(volume),
            open_price: side === 'buy' ? ask : bid,
            current_price: side === 'buy' ? bid : ask,
            sl: parseFloat(sl) || 0, tp: parseFloat(tp) || 0,
            profit: 0, time: Math.floor(Date.now() / 1000), magic: 0
        };

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

    return (
        <div className="flex-1 bg-[#131722] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-white text-lg tracking-tighter">{symbol.replace('m', '')}</span>
                        <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded border border-white/5", isCrypto ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500")}>
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
                />

                <div className="pt-1 space-y-1.5">
                    <button onClick={handleSubmit} className={cn("w-full py-2.5 rounded-lg text-xs font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest", side === 'buy' ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/40 text-white" : "bg-red-600 hover:bg-red-500 shadow-red-900/40 text-white")}>
                        Xác nhận {side === 'buy' ? 'Mua' : 'Bán'} {volume} Lô
                    </button>
                    <button onClick={resetForm} className="w-full py-2 rounded-lg text-[11px] font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all">Hủy</button>
                </div>

                <OrderDetails
                    isDetailsExpanded={isDetailsExpanded}
                    setIsDetailsExpanded={setIsDetailsExpanded}
                    spread={spread}
                />
            </div>
        </div>
    );
}
