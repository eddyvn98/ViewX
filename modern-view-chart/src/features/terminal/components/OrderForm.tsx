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

type OrderType = 'market' | 'pending';
type Side = 'buy' | 'sell';

export const OrderForm = memo(function OrderForm() {
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
    const isInputFocused = useMarketStore(state => state.isInputFocused);
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
    const formatPrice = (p: number) => p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
        <div className="flex-1 bg-[#0b0e14] flex flex-col overflow-hidden select-none">
            {/* MOBILE ELEGANT LAYOUT */}
            <div
                className="md:hidden flex flex-col p-3 pb-20 space-y-3 h-full justify-start overflow-y-auto custom-scrollbar"
            >
                {/* ROW 1: Info Header */}
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex flex-col">
                        <span className="font-bold text-white text-xs tracking-tight">{symbol.replace('m', '')}</span>
                        <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-sm w-fit mt-0.5", isCrypto ? "bg-yellow-500/10 text-yellow-100/60" : "bg-blue-500/10 text-blue-100/60")}>
                            {isCrypto ? 'BINANCE' : 'MT5 GATEWAY'}
                        </span>
                    </div>
                    <div className="w-36">
                        <OrderTypeTabs orderType={orderType} setOrderType={setOrderType} />
                    </div>
                </div>

                {/* ROW 2: Price Action */}
                <div className="shrink-0 bg-white/[0.02] p-0.5 rounded-xl">
                    <SideButtons
                        side={side} setSide={setSide} setIsDrafting={setIsDrafting}
                        bid={bid} ask={ask} spread={spread} formatPrice={formatPrice}
                    />
                </div>

                {/* ROW 3: Configuration Grid (Volume & Action) */}
                <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="flex flex-col">
                        <span className="block text-[9px] text-zinc-500 font-bold mb-1 ml-1 uppercase">Volume</span>
                        <div className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden h-10">
                            <button
                                onClick={() => setVolume(adjustVolume(volume, -0.01))}
                                className="w-9 h-full flex items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-white transition-colors"
                            >
                                <Minus size={14} />
                            </button>
                            <div className="flex-1 relative flex items-center justify-center min-w-0">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={volume}
                                    onFocus={() => setInputFocused(true)}
                                    onBlur={() => setInputFocused(false)}
                                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                    onChange={(e) => setVolume(e.target.value)}
                                    className="w-full bg-transparent text-center text-xs text-white focus:outline-none font-bold"
                                />
                                <span className="absolute right-1 text-[7px] text-zinc-600 font-black pointer-events-none">LOT</span>
                            </div>
                            <button
                                onClick={() => setVolume(adjustVolume(volume, 0.01))}
                                className="w-9 h-full flex items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-white transition-colors"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="block text-[9px] mb-1 opacity-0">Action</span>
                        <button
                            onClick={handleSubmit}
                            className={cn(
                                "flex-1 h-10 rounded-lg text-xs font-black shadow-2xl active:scale-[0.98] transition-all uppercase tracking-wider flex items-center justify-center gap-1",
                                side === 'buy' ? "bg-blue-600 shadow-blue-600/20 text-white" : "bg-red-600 shadow-red-600/20 text-white"
                            )}
                        >
                            <span>{side === 'buy' ? 'Buy' : 'Sell'}</span>
                            <span className="text-[10px] opacity-70">{volume}</span>
                        </button>
                    </div>
                </div>

                {/* ROW 4: SL & TP */}
                <div className="grid grid-cols-2 gap-3 shrink-0 pt-0.5">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-red-500/60 font-bold mb-1 ml-1 uppercase">Stop Loss</span>
                        <div className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden h-10">
                            <button
                                onClick={() => setSl(adjustValue(sl, -10, true))}
                                className="w-9 h-full flex items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-red-500 transition-colors"
                            >
                                <Minus size={14} />
                            </button>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Auto"
                                value={sl}
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                onChange={(e) => setSl(e.target.value)}
                                className="flex-1 bg-transparent text-center text-xs text-red-400 focus:outline-none font-bold placeholder:text-zinc-800"
                            />
                            <button
                                onClick={() => setSl(adjustValue(sl, 10, true))}
                                className="w-9 h-full flex items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-red-500 transition-colors"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] text-blue-500/60 font-bold mb-1 ml-1 uppercase">Take Profit</span>
                        <div className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden h-10">
                            <button
                                onClick={() => setTp(adjustValue(tp, -10, false))}
                                className="w-8 h-full flex items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-blue-500 transition-colors"
                            >
                                <Minus size={14} />
                            </button>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Auto"
                                value={tp}
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                onChange={(e) => setTp(e.target.value)}
                                className="flex-1 bg-transparent text-center text-xs text-blue-400 focus:outline-none font-bold placeholder:text-zinc-800"
                            />
                            <button
                                onClick={() => setTp(adjustValue(tp, 10, false))}
                                className="w-8 h-full flex items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-blue-500 transition-colors"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {isInputFocused && (
                    <div className="flex justify-center pt-2">
                        <button
                            onClick={() => (document.activeElement as HTMLElement)?.blur()}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold animate-in fade-in slide-in-from-bottom-2"
                        >
                            <ChevronDown size={14} />
                            <span>Đóng bàn phím</span>
                        </button>
                    </div>
                )}
            </div>

            {/* DESKTOP LAYOUT (Existing) */}
            <div className="hidden md:flex flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 flex-col">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-900">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-white text-base tracking-tighter">{symbol.replace('m', '')}</span>
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

                <div className="pt-0 space-y-2">
                    <button onClick={handleSubmit} className={cn("w-full py-3 rounded-md text-sm font-black shadow-lg active:scale-95 transition-all uppercase tracking-widest", side === 'buy' ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/40 text-white" : "bg-red-600 hover:bg-red-500 shadow-red-900/40 text-white")}>
                        Xác nhận {side === 'buy' ? 'Mua' : 'Bán'} {volume} Lô
                    </button>
                    <button onClick={resetForm} className="w-full py-2 rounded-md text-[10px] font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all">Hủy</button>
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
