import React, { useCallback, memo, useRef, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { useWebSocket } from '@/hooks/use-websocket';
import { buildMt5WriteFields, type Mt5TradingIdentity } from '@/lib/mt5/trading-request';
import { resolveChartIdentityDataSource } from '@/lib/mt5/account-scope';

interface ChartTradingOverlayProps {
    symbol: string | undefined;
    source?: string;
    accountLogin?: string | null;
    terminalId?: string | null;
    broker?: string | null;
}

/**
 * ChartTradingOverlay with DOM-based price updates
 * Only subscribes to non-ticker state, uses RAF for realtime prices
 */
export const ChartTradingOverlay = memo(function ChartTradingOverlay({ symbol, source, accountLogin, terminalId, broker }: ChartTradingOverlayProps) {
    // Only subscribe to non-ticker state
    const draftOrder = useMarketStore(state => state.draftOrder);
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const { sendMessage } = useWebSocket();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const pendingRequestIdRef = useRef<string | null>(null);
    const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const identity = React.useMemo<Mt5TradingIdentity>(() => ({
        source,
        accountLogin,
        terminalId,
        broker,
    }), [source, accountLogin, terminalId, broker]);
    const dataSource = React.useMemo(
        () => resolveChartIdentityDataSource(source, identity),
        [source, identity],
    );

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
    }, [setDraftOrder]);

    // Trading prices must come from the chart-owned source/account. Never
    // fall back to another personal MT5 account that happens to share a symbol.
    const getCurrentPrice = useCallback(() => {
        if (!symbol) return 0;
        const state = useMarketStore.getState();
        const normSym = normalizeSymbol(symbol);
        const scoped = state.tickers[`${dataSource}:${symbol}`]
            || state.tickers[`${dataSource}:${normSym}`];
        if (String(source || '').toUpperCase() === 'MT5_PERSONAL') {
            return scoped?.price || 0;
        }
        return scoped?.price || state.tickers[symbol]?.price || state.tickers[normSym]?.price || 0;
    }, [symbol, source, dataSource]);

    const handleStartDraft = (type: 'buy' | 'sell') => {
        const price = getCurrentPrice();
        if (!price || !symbol) return;

        setDraftOrder({
            // Keep the exact broker symbol for execution. Normalization is only
            // for lookup/display and must never rewrite a trading transport ID.
            symbol,
            type,
            volume: 0.1,
            price: price,
            isMarket: true,
            sl: 0,
            tp: 0,
            source,
            accountLogin,
            terminalId,
            broker,
            slTouched: false,
            tpTouched: false
        });
    };

    const handleConfirm = () => {
        if (!draftOrder || isSubmitting) return;

        // ðŸ›¡ï¸ Final Validation Logic (Front-end Gatekeeper)
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
            const AudioContextCtor = window.AudioContext;
            if (AudioContextCtor) {
                const ctx = new AudioContextCtor();
                const osc = ctx.createOscillator();
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                osc.type = 'sawtooth';
                osc.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            }
            return;
        }

        const writeFields = buildMt5WriteFields(identity, pendingRequestIdRef.current || undefined);
        const requestId = writeFields.request_id;
        const payload: Record<string, unknown> = {
            topic: 'mt5_command',
            command: 'order',
            symbol: draftOrder.symbol,
            type: draftOrder.type,
            volume: draftOrder.volume,
            is_market: draftOrder.isMarket,
            ...writeFields,
        };

        const state = useMarketStore.getState();
        const normSym = normalizeSymbol(draftOrder.symbol);
        const scopedInfo = state.symbolInfo?.[`${dataSource}:${draftOrder.symbol}`]
            || state.symbolInfo?.[`${dataSource}:${normSym}`];
        const symbolInfo = String(source || '').toUpperCase() === 'MT5_PERSONAL'
            ? scopedInfo
            : (scopedInfo || state.symbolInfo?.[normSym]);
        const digits = symbolInfo?.digits || 5;

        if (draftOrder.isMarket) {
            payload.price = 0;
        } else {
            payload.price = Number((draftOrder.price ?? 0).toFixed(digits));
        }

        if (draftOrder.sl && draftOrder.sl > 0) payload.sl = Number(draftOrder.sl.toFixed(digits));
        if (draftOrder.tp && draftOrder.tp > 0) payload.tp = Number(draftOrder.tp.toFixed(digits));

        pendingRequestIdRef.current = requestId;
        setIsSubmitting(true);
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = setTimeout(() => {
            if (pendingRequestIdRef.current !== requestId) return;
            pendingTimeoutRef.current = null;
            setIsSubmitting(false);
            useMarketStore.getState().addNotification(
                'MT5: Chưa nhận được kết quả lệnh chart. Gửi lại sẽ dùng cùng request ID để tránh nhân đôi.',
                'warning',
            );
        }, 20000);
        sendMessage(payload as Parameters<typeof sendMessage>[0]);
    };

    const handleCancel = () => {
        if (isSubmitting) return;
        pendingRequestIdRef.current = null;
        setDraftOrder(null);
    };

    // This overlay executes MT5 writes. Do not expose it on Binance or
    // other sources, where a click must never fall through to shared MT5.
    const normalizedSource = String(source || '').trim().toUpperCase();
    if (!symbol || (normalizedSource !== 'MT5' && normalizedSource !== 'MT5_PERSONAL')) return null;

    return (
        <div className="absolute top-1 left-2 z-[100] flex items-center gap-1.5">
            {(!draftOrder || draftOrder.symbol !== symbol) ? (
                <div className="flex w-[114px] bg-secondary/80 dark:bg-white/[0.03] backdrop-blur-xl border border-border dark:border-white/5 p-0.5 rounded-xl shadow-sm relative overflow-hidden group">
                    <button
                        onClick={() => handleStartDraft('buy')}
                        className="flex-1 flex items-center justify-center h-6.5 transition-all duration-300 rounded-lg hover:bg-blue-500/10 active:scale-95 group/btn"
                    >
                        <span className="text-[11px] font-bold text-blue-500 uppercase tracking-widest leading-none">BUY</span>
                    </button>

                    <div className="w-[1px] h-2.5 bg-border/20 self-center mx-0.5" />

                    <button
                        onClick={() => handleStartDraft('sell')}
                        className="flex-1 flex items-center justify-center h-6.5 transition-all duration-300 rounded-lg hover:bg-rose-500/10 active:scale-95 group/btn"
                    >
                        <span className="text-[11px] font-bold text-rose-500 uppercase tracking-widest leading-none">SELL</span>
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-1 p-0.5 w-[114px] bg-secondary/90 dark:bg-white/10 backdrop-blur-3xl border border-border dark:border-white/10 rounded-xl shadow-sm animate-in zoom-in-95 duration-200">
                    <button
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="w-6.5 h-6.5 flex-none flex items-center justify-center rounded-lg bg-white/5 text-muted-foreground/40 hover:text-foreground hover:bg-white/10 transition-all active:scale-90"
                    >
                        <X size={11} />
                    </button>

                    <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                        <span className={cn(
                            "text-[11px] font-bold uppercase tracking-tight leading-none mb-0.5",
                            draftOrder.type === 'buy' ? "text-blue-500/60" : "text-rose-500/60"
                        )}>
                            {draftOrder.type}
                        </span>
                        <span className="text-[11px] font-bold text-foreground tracking-tight leading-none uppercase">{draftOrder.volume}L</span>
                    </div>

                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className={cn(
                            "h-6.5 px-3 flex-none rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 border disabled:opacity-50 disabled:cursor-not-allowed",
                            draftOrder.type === 'buy'
                                ? "bg-blue-500 text-white border-blue-400/20 hover:bg-blue-600"
                                : "bg-rose-500 text-white border-rose-400/20 hover:bg-rose-600"
                        )}
                    >
                        {isSubmitting ? 'Sending...' : 'Confirm'}
                    </button>
                </div>
            )}
        </div>
    );
});

