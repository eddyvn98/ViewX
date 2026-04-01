'use client';

import React, { useState, useMemo, memo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { cn } from '@/lib/utils';
import { hasLegalConsent as readLegalConsent, saveLegalConsent, type TradingSource } from '@/lib/legal/consent';
import { getClientEntitlements } from '@/lib/auth/entitlements';
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
    const isBridgeOnline = useMarketStore((state) => state.isBridgeOnline);
    const account = useMarketStore((state) => {
        const tab = state.tabs[state.activeTabId];
        const source = tab?.activeChartId ? (tab.charts[tab.activeChartId]?.source || 'MT5') : 'MT5';
        const accountSource = source === 'BINANCE' ? 'BINANCE_DEMO' : 'MT5';
        return state.accounts[accountSource] || state.accounts['MT5'] || null;
    });
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
        resetOrderForm();
        setIsDrafting(false);
        setDraftOrder(null);
    };

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
        handleSubmit, setIsDrafting, setInputFocused, formatPrice, calculatePnl,
        isBridgeOnline, account
    };
}

export const OrderForm = memo(function OrderForm({ forceInline = false }: { forceInline?: boolean }) {
    const t = useTranslations('ProFlow');
    const {
        symbol, side, setSide, orderType, setOrderType, volume, setVolume,
        sl, setSl, tp, setTp, bid, ask, spread, adjustValue, adjustVolume,
        handleSubmit, setIsDrafting, formatPrice, calculatePnl, isBridgeOnline, account
    } = useOrderFormLogic();
    const resetOrderForm = useMarketStore((state) => state.resetOrderForm);

    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const [showLegalConsentDialog, setShowLegalConsentDialog] = useState(false);
    const [isLegalChecked, setIsLegalChecked] = useState(false);

    const slPnl = useMemo(() => calculatePnl(sl), [sl, calculatePnl]);
    const tpPnl = useMemo(() => calculatePnl(tp), [tp, calculatePnl]);

    const resetForm = () => {
        resetOrderForm();
        setIsDrafting(false);
    };

    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH'); // Simplified check for display
    const tradingSource: TradingSource = isCrypto ? 'BINANCE' : 'MT5';
    const hasMt5Module = getClientEntitlements().hasMt5Trade;
    const hasAccountLinked = Boolean(
        account && (
            (account as { login?: string | number }).login ||
            (account as { account_login?: string | number }).account_login ||
            (account as { number?: string | number }).number
        )
    );

    const hasLegalConsent = React.useCallback(() => {
        return readLegalConsent(tradingSource);
    }, [tradingSource]);
    const consentReady = hasLegalConsent();
    const isFlowReady = hasMt5Module && isBridgeOnline && hasAccountLinked && consentReady;
    const missingSetupSteps = useMemo(() => {
        const missing: Array<{ id: string; label: string; action: string }> = [];
        if (!hasMt5Module) {
            missing.push({
                id: 'plan',
                label: 'Module MT5 da kich hoat',
                action: 'Dang nhap tu app, neu chua mua module thi thanh toan tren web.',
            });
        }
        if (!isBridgeOnline) {
            missing.push({
                id: 'bridge',
                label: 'Bridge da ket noi',
                action: 'Mo app va de app chay tray de bridge online.',
            });
        }
        if (!hasAccountLinked) {
            missing.push({
                id: 'account',
                label: 'Da nhan dien tai khoan',
                action: 'Dang nhap bang nut trong app de web map dung tai khoan.',
            });
        }
        if (!consentReady) {
            missing.push({
                id: 'legal',
                label: 'Da chap thuan phap ly',
                action: 'Xac nhan dieu khoan truoc khi gui lenh that.',
            });
        }
        return missing;
    }, [consentReady, hasAccountLinked, isBridgeOnline, hasMt5Module]);

    const handleSubmitWithLegalGuard = React.useCallback(() => {
        if (!isFlowReady) {
            useMarketStore.getState().addNotification(
                t('warningSetupRequired'),
                'warning'
            );
            if (!consentReady && hasMt5Module && isBridgeOnline && hasAccountLinked) {
                setShowLegalConsentDialog(true);
            }
            return;
        }
        handleSubmit();
    }, [consentReady, handleSubmit, hasAccountLinked, isBridgeOnline, isFlowReady, hasMt5Module, t]);

    const confirmLegalConsentAndSubmit = React.useCallback(() => {
        if (!isLegalChecked) return;
        saveLegalConsent(tradingSource);
        setShowLegalConsentDialog(false);
        setIsLegalChecked(false);
        handleSubmit();
    }, [handleSubmit, isLegalChecked, tradingSource]);

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
                    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-200">
                        {t('riskNotice')}
                    </p>
                    <button
                        onClick={handleSubmitWithLegalGuard}
                        disabled={!isFlowReady}
                        className={cn(
                            "w-full py-2 rounded-md text-[11px] font-black shadow-lg transition-all uppercase tracking-widest",
                            side === 'buy' ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/40 text-white" : "bg-red-600 hover:bg-red-500 shadow-red-900/40 text-white",
                            !isFlowReady ? "cursor-not-allowed opacity-60" : "active:scale-95"
                        )}
                    >
                        {side === 'buy' ? 'BUY' : 'SELL'} {volume} LOTS
                    </button>
                    {!isFlowReady && (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200 space-y-1">
                            <p>Can hoan tat luong kich hoat MT5 (module, bridge, account, legal consent) truoc khi gui lenh.</p>
                            <ul className="space-y-0.5 text-[9px] leading-relaxed text-amber-100/90">
                                {missingSetupSteps.map((step) => (
                                    <li key={step.id}>
                                        - {step.label}: {step.action}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <button onClick={resetForm} className="w-full py-1.5 rounded-md text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all uppercase tracking-tight">{t('exit')}</button>
                </div>

                <OrderDetails
                    isDetailsExpanded={isDetailsExpanded}
                    setIsDetailsExpanded={setIsDetailsExpanded}
                    spread={spread}
                />
            </div>

            {showLegalConsentDialog && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md rounded-xl border border-border bg-background p-4 shadow-2xl">
                        <h3 className="text-sm font-bold text-foreground">{t('legalModalTitle')}</h3>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            {t('legalModalDesc', { source: tradingSource })}
                        </p>
                        <label className="mt-3 flex items-start gap-2 rounded-md border border-border/70 bg-secondary/20 p-2 text-xs">
                            <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={isLegalChecked}
                                onChange={(e) => setIsLegalChecked(e.target.checked)}
                            />
                            <span>
                                {t('iAgreeWith')}{" "}
                                <Link href="/terms" target="_blank" className="underline underline-offset-2">
                                    {t('terms')}
                                </Link>{" "}
                                {t('and')}{" "}
                                <Link href="/privacy" target="_blank" className="underline underline-offset-2">
                                    {t('privacy')}
                                </Link>
                                .
                            </span>
                        </label>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowLegalConsentDialog(false);
                                    setIsLegalChecked(false);
                                }}
                                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/50"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={!isLegalChecked}
                                onClick={confirmLegalConsentAndSubmit}
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-xs font-semibold text-white",
                                    isLegalChecked ? "bg-primary hover:bg-primary/90" : "cursor-not-allowed bg-primary/50"
                                )}
                            >
                                {t('acceptAndTrade')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});


