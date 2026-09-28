'use client';

import React, { useState, useMemo, memo } from 'react';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { cn } from '@/lib/utils';
import { buildMt5DataSourceKey, normalizeMt5AccountScope } from '@/lib/mt5/account-scope';
import { buildMt5WriteFields } from '@/lib/mt5/trading-request';
// Sub-components
import { OrderTypeTabs } from './OrderForm/OrderTypeTabs';
import { SideButtons } from './OrderForm/SideButtons';
import { OrderInputs } from './OrderForm/OrderInputs';
import { OrderDetails } from './OrderForm/OrderDetails';
import { SentimentBar } from './OrderForm/SentimentBar';

type OrderType = 'market' | 'pending';
type Side = 'buy' | 'sell';

/**
 * Mobile-specific order logic hook
 */
export function useOrderFormLogic() {
    const orderType = useMarketStore((state) => state.orderForm.orderType) as OrderType;
    const side = useMarketStore((state) => state.orderForm.side) as Side;
    const volume = useMarketStore((state) => state.orderForm.volume);
    const sl = useMarketStore((state) => state.orderForm.sl);
    const tp = useMarketStore((state) => state.orderForm.tp);
    const setOrderForm = useMarketStore((state) => state.setOrderForm);
    const resetOrderForm = useMarketStore((state) => state.resetOrderForm);
    const isConnected = useMarketStore((state) => state.isConnected);
    const [isDrafting, setIsDrafting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const pendingRequestIdRef = React.useRef<string | null>(null);
    const pendingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const setInputFocused = useMarketStore(state => state.setInputFocused);
    const { sendMessage } = useWebSocket();

    const activeTabId = useMarketStore(state => state.activeTabId);
    const activeTab = useMarketStore(state => state.tabs[activeTabId]);
    const activeChartId = activeTab?.activeChartId;
    const activeChart = activeChartId ? activeTab.charts[activeChartId] : null;
    const symbol = activeChart?.symbol || 'BTCUSDm';
    const mt5Scope = useMemo(() => normalizeMt5AccountScope({
        source: activeChart?.source === 'MT5_PERSONAL' ? 'MT5_PERSONAL' : 'MT5',
        accountLogin: activeChart?.accountLogin,
        terminalId: activeChart?.terminalId,
        broker: activeChart?.broker,
    }), [activeChart?.source, activeChart?.accountLogin, activeChart?.terminalId, activeChart?.broker]);
    const tickerSourceKey = activeChart?.source === 'MT5_PERSONAL'
        ? buildMt5DataSourceKey(mt5Scope)
        : String(activeChart?.source || 'MT5').toUpperCase();
    const ticker = useMarketStore(state =>
        state.tickers[`${tickerSourceKey}:${symbol}`] || state.tickers[symbol]
    );

    const isCrypto = activeChart?.source === 'BINANCE';
    const bid = ticker?.price || 0;
    const ask = bid * 1.0001;
    const spread = (ask - bid).toFixed(2);

    // Sync drafting state from OrderForm only when user is actively drafting from this panel.
    React.useEffect(() => {
        if (!isDrafting) return;
        setDraftOrder({
            symbol, type: side, volume: parseFloat(volume) || 0,
            sl: parseFloat(sl) || undefined, tp: parseFloat(tp) || undefined,
            isMarket: orderType === 'market'
        });
    }, [symbol, side, volume, sl, tp, orderType, isDrafting, setDraftOrder]);

    const setOrderType = (value: OrderType) => setOrderForm({ orderType: value });
    const setSide = (value: Side) => setOrderForm({ side: value });
    const setVolume = (value: string) => setOrderForm({ volume: value });
    const setSl = (value: string) => setOrderForm({ sl: value });
    const setTp = (value: string) => setOrderForm({ tp: value });

    const resetForm = () => {
        if (isSubmitting) return;
        resetOrderForm();
        setIsDrafting(false);
        setDraftOrder(null);
    };

    React.useEffect(() => {
        const handleMt5OrderResult = (event: Event) => {
            const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
            const requestId = String(detail.request_id || '');
            if (!requestId || requestId !== pendingRequestIdRef.current) return;

            pendingRequestIdRef.current = null;
            if (pendingTimeoutRef.current) {
                clearTimeout(pendingTimeoutRef.current);
                pendingTimeoutRef.current = null;
            }
            setIsSubmitting(false);
            if (detail.success === true) {
                resetOrderForm();
                setIsDrafting(false);
                setDraftOrder(null);
            }
        };

        window.addEventListener('vivutrade:mt5-order-result', handleMt5OrderResult);
        return () => {
            window.removeEventListener('vivutrade:mt5-order-result', handleMt5OrderResult);
            if (pendingTimeoutRef.current) {
                clearTimeout(pendingTimeoutRef.current);
                pendingTimeoutRef.current = null;
            }
        };
    }, [resetOrderForm, setDraftOrder]);

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
        if (isSubmitting) return;

        const parsedVolume = parseFloat(volume);
        if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
            useMarketStore.getState().addNotification('Khối lượng giao dịch không hợp lệ', 'warning');
            return;
        }

        if (!isConnected) {
            useMarketStore.getState().addNotification('WebSocket chưa kết nối. Vui lòng thử lại.', 'warning');
            return;
        }

        if (isCrypto) {
            sendMessage({
                topic: 'binance_command',
                command: side,
                symbol,
                order_type: side,
                volume: parsedVolume,
                quantity: parsedVolume,
                price: orderType === 'pending' ? (side === 'buy' ? ask : bid) : 0,
                sl: parseFloat(sl) || 0,
                tp: parseFloat(tp) || 0,
                is_market: orderType === 'market',
            });
            resetForm();
            return;
        }

        const writeFields = buildMt5WriteFields(mt5Scope);
        const requestId = writeFields.request_id;
        pendingRequestIdRef.current = requestId;
        setIsSubmitting(true);
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = setTimeout(() => {
            if (pendingRequestIdRef.current !== requestId) return;
            pendingRequestIdRef.current = null;
            pendingTimeoutRef.current = null;
            setIsSubmitting(false);
            useMarketStore.getState().addNotification('MT5: Hết thời gian chờ phản hồi lệnh', 'warning');
        }, 20000);
        sendMessage({
            topic: 'mt5_command',
            command: 'place_order',
            ...writeFields,
            symbol,
            order_type: side,
            volume: parsedVolume,
            quantity: parsedVolume,
            price: orderType === 'pending' ? (side === 'buy' ? ask : bid) : 0,
            sl: parseFloat(sl) || 0,
            tp: parseFloat(tp) || 0,
            is_market: orderType === 'market',
        });
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
        handleSubmit, setIsDrafting, setInputFocused, formatPrice, calculatePnl,
        isSubmitting, isCrypto
    };
}

export const OrderForm = memo(function OrderForm({ forceInline = false }: { forceInline?: boolean }) {
    const {
        symbol, side, setSide, orderType, setOrderType, volume, setVolume,
        sl, setSl, tp, setTp, bid, ask, spread, adjustValue, adjustVolume,
        handleSubmit, setIsDrafting, formatPrice, calculatePnl,
        isSubmitting, isCrypto
    } = useOrderFormLogic();
    const resetOrderForm = useMarketStore((state) => state.resetOrderForm);

    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

    const slPnl = useMemo(() => calculatePnl(sl), [sl, calculatePnl]);
    const tpPnl = useMemo(() => calculatePnl(tp), [tp, calculatePnl]);

    const resetForm = () => {
        resetOrderForm();
        setIsDrafting(false);
    };

    return (
        <div className="flex-1 bg-background flex flex-col overflow-hidden select-none">
            {/* MOBILE LAYOUT REMOVED - NOW IN BOTTOM NAV */}

            {/* DESKTOP LAYOUT (Existing) */}
            <div className={cn(forceInline ? "flex" : "hidden md:flex", "flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 flex-col")}>
                <div className="flex items-center justify-between pb-1 border-b border-border">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-foreground text-[12px] tracking-tighter">{symbol.replace('m', '')}</span>
                        <span className={cn("text-[8px] font-black px-1 py-0.5 rounded border border-border/50", isCrypto ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500")}>
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
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={cn(
                            "w-full py-2 rounded-md text-[11px] font-black shadow-lg active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
                            side === 'buy' ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/40 text-white" : "bg-red-600 hover:bg-red-500 shadow-red-900/40 text-white"
                        )}
                    >
                        {isSubmitting ? 'ĐANG GỬI...' : `${side === 'buy' ? 'BUY' : 'SELL'} ${volume} LOTS`}
                    </button>
                    <button
                        onClick={resetForm}
                        disabled={isSubmitting}
                        className="w-full py-1.5 rounded-md text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all uppercase tracking-tight disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Thoát
                    </button>
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

