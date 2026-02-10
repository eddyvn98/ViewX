import { useEffect, useRef } from 'react';
import { ISeriesApi, IPriceLine, LineStyle } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { normalizeSymbol } from '@/lib/utils/symbol';

export function useChartDraftOrder(
    symbol: string | undefined,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
    isReady: boolean
) {
    const linesRef = useRef<{ entry?: IPriceLine, sl?: IPriceLine, tp?: IPriceLine }>({});

    // ⚡ Unified Management: Existence, Price, and Focus
    useEffect(() => {
        if (!seriesRef.current || !symbol || !isReady) return;
        const series = seriesRef.current;

        const cleanup = () => {
            if (linesRef.current.entry) { series.removePriceLine(linesRef.current.entry); linesRef.current.entry = undefined; }
            if (linesRef.current.sl) { series.removePriceLine(linesRef.current.sl); linesRef.current.sl = undefined; }
            if (linesRef.current.tp) { series.removePriceLine(linesRef.current.tp); linesRef.current.tp = undefined; }
            linesRef.current = {};
        };

        const syncLine = (type: 'entry' | 'sl' | 'tp', price: number, color: string, style: LineStyle) => {
            if (price <= 0) {
                if (linesRef.current[type]) {
                    series.removePriceLine(linesRef.current[type]!);
                    linesRef.current[type] = undefined;
                }
                return;
            }

            if (!linesRef.current[type]) {
                linesRef.current[type] = series.createPriceLine({
                    price, color, lineWidth: 2, lineStyle: style,
                    axisLabelVisible: false, title: '',
                });
            } else {
                linesRef.current[type]!.applyOptions({ price });
            }
        };

        const unsub = useMarketStore.subscribe(
            state => {
                const normSym = normalizeSymbol(symbol);
                return {
                    bid: state.tickers[normSym]?.price || 0,
                    draft: state.draftOrder,
                    focused: state.focusedTicket
                };
            },
            ({ bid, draft, focused }) => {
                // 1. Check Exit Conditions
                if (focused || !draft || draft.symbol !== symbol) {
                    cleanup();
                    return;
                }

                // 2. Calculations
                const ask = bid * 1.0001;
                const entryPrice = draft.isMarket ? (draft.type === 'buy' ? ask : bid) : (draft.price || bid);

                // 3. Atomically Sync All 3 Lines
                syncLine('entry', entryPrice, '#3b82f6', LineStyle.Dashed);
                syncLine('sl', draft.sl || 0, '#ef4444', LineStyle.Dotted);
                syncLine('tp', draft.tp || 0, '#22c55e', LineStyle.Dotted);
            },
            { fireImmediately: true }
        );

        return () => {
            unsub();
            cleanup();
        };
    }, [symbol, isReady]);

    // ⚡ FAST-PATH: Instant response to mouse drag without waiting for store update
    useEffect(() => {
        const handleFastDrag = (e: any) => {
            const { ticket, type, price, symbol: eventSymbol } = e.detail;
            if (eventSymbol !== symbol || ticket !== 'draft' || !seriesRef.current) return;
            const series = seriesRef.current;

            // Re-create or update line instantly
            if (type === 'entry') {
                if (!linesRef.current.entry) {
                    linesRef.current.entry = series.createPriceLine({
                        price, color: '#3b82f6', lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: ''
                    });
                } else linesRef.current.entry.applyOptions({ price });
            } else if (type === 'sl') {
                if (!linesRef.current.sl) {
                    linesRef.current.sl = series.createPriceLine({
                        price, color: '#ef4444', lineWidth: 2, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: ''
                    });
                } else linesRef.current.sl.applyOptions({ price });
            } else if (type === 'tp') {
                if (!linesRef.current.tp) {
                    linesRef.current.tp = series.createPriceLine({
                        price, color: '#22c55e', lineWidth: 2, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: ''
                    });
                } else linesRef.current.tp.applyOptions({ price });
            }
        };

        window.addEventListener('order-line-drag', handleFastDrag);
        return () => window.removeEventListener('order-line-drag', handleFastDrag);
    }, [symbol]);
}
