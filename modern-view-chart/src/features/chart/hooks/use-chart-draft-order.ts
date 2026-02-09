import { useEffect, useRef } from 'react';
import { ISeriesApi, IPriceLine, LineStyle } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';

export function useChartDraftOrder(
    symbol: string | undefined,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
    isReady: boolean
) {
    const draftOrder = useMarketStore((state) => state.draftOrder);
    const focusedTicket = useMarketStore((state) => state.focusedTicket);
    const currentPrice = useMarketStore((state) => (symbol && state.tickers[symbol]) ? state.tickers[symbol].price : 0);
    const symbolInfo = useMarketStore((state) => state.symbolInfo[symbol || '']);

    const linesRef = useRef<{ entry?: IPriceLine, sl?: IPriceLine, tp?: IPriceLine }>({});

    // EFFECT 1: Manage Existence (Create/Remove)
    useEffect(() => {
        if (!seriesRef.current || !symbol || !isReady) return;
        const series = seriesRef.current;

        const cleanup = () => {
            if (linesRef.current.entry) { series.removePriceLine(linesRef.current.entry); linesRef.current.entry = undefined; }
            if (linesRef.current.sl) { series.removePriceLine(linesRef.current.sl); linesRef.current.sl = undefined; }
            if (linesRef.current.tp) { series.removePriceLine(linesRef.current.tp); linesRef.current.tp = undefined; }
            linesRef.current = {};
        };

        if (focusedTicket || !draftOrder || draftOrder.symbol !== symbol) {
            if (Object.keys(linesRef.current).length > 0) cleanup();
            return;
        }

        const bid = useMarketStore.getState().tickers[symbol]?.price || 0;
        const ask = bid * 1.0001;
        const entryPrice = draftOrder.isMarket ? (draftOrder.type === 'buy' ? ask : bid) : (draftOrder.price || bid);

        // Entry
        if (!linesRef.current.entry) {
            linesRef.current.entry = series.createPriceLine({
                price: entryPrice,
                color: '#3b82f6',
                lineWidth: 2,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }

        // SL
        if (draftOrder.sl && draftOrder.sl > 0) {
            if (!linesRef.current.sl) {
                linesRef.current.sl = series.createPriceLine({
                    price: draftOrder.sl,
                    color: '#ef4444',
                    lineWidth: 2,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: false,
                    title: '',
                });
            }
        } else if (linesRef.current.sl) {
            series.removePriceLine(linesRef.current.sl);
            linesRef.current.sl = undefined;
        }

        // TP
        if (draftOrder.tp && draftOrder.tp > 0) {
            if (!linesRef.current.tp) {
                linesRef.current.tp = series.createPriceLine({
                    price: draftOrder.tp,
                    color: '#22c55e',
                    lineWidth: 2,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: false,
                    title: '',
                });
            }
        } else if (linesRef.current.tp) {
            series.removePriceLine(linesRef.current.tp);
            linesRef.current.tp = undefined;
        }

    }, [symbol, !!draftOrder, draftOrder?.symbol, !!focusedTicket, isReady]);

    // EFFECT 2: High-frequency updates (Dragging & Price)
    useEffect(() => {
        const unsub = useMarketStore.subscribe(
            state => [state.tickers[symbol || '']?.price, state.draftOrder] as const,
            ([price, draft]) => {
                if (!symbol || !draft || draft.symbol !== symbol || focusedTicket) return;

                const bid = price || 0;
                const ask = bid * 1.0001;
                const entryPrice = draft.isMarket ? (draft.type === 'buy' ? ask : bid) : (draft.price || bid);

                // console.log('[DraftOrder] Update prices', entryPrice);
                if (linesRef.current.entry) linesRef.current.entry.applyOptions({ price: entryPrice });
                if (linesRef.current.sl && draft.sl) linesRef.current.sl.applyOptions({ price: draft.sl });
                if (linesRef.current.tp && draft.tp) linesRef.current.tp.applyOptions({ price: draft.tp });
            }
        );
        return unsub;
    }, [symbol, focusedTicket]);

    // ⚡ FAST-PATH: Listen to direct drag events for instant sync
    useEffect(() => {
        const handleFastDrag = (e: any) => {
            const { ticket, type, price, symbol: eventSymbol } = e.detail;
            if (eventSymbol !== symbol || ticket !== 'draft') return;

            if (type === 'entry' && linesRef.current.entry) linesRef.current.entry.applyOptions({ price });
            else if (type === 'sl' && linesRef.current.sl) linesRef.current.sl.applyOptions({ price });
            else if (type === 'tp' && linesRef.current.tp) linesRef.current.tp.applyOptions({ price });
        };

        window.addEventListener('order-line-drag', handleFastDrag);
        return () => window.removeEventListener('order-line-drag', handleFastDrag);
    }, [symbol]);

    // Final cleanup on unmount
    useEffect(() => {
        return () => {
            const series = seriesRef.current;
            if (series) {
                if (linesRef.current.entry) series.removePriceLine(linesRef.current.entry);
                if (linesRef.current.sl) series.removePriceLine(linesRef.current.sl);
                if (linesRef.current.tp) series.removePriceLine(linesRef.current.tp);
            }
        };
    }, []);
}
