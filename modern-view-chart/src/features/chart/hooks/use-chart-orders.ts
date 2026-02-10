import { useEffect, useRef } from 'react';
import { ISeriesApi, IPriceLine, LineStyle } from 'lightweight-charts';
import { Order, useMarketStore } from '@/lib/store';

export function useChartOrders(
    symbol: string | undefined,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
    orders: Order[]
) {
    const draftOrder = useMarketStore((state) => state.draftOrder);
    const priceLinesRef = useRef<Record<string, { entry?: IPriceLine, sl?: IPriceLine, tp?: IPriceLine }>>({});

    const sharedRef = useRef({
        symbol,
        orders,
        draggingPosition: null as any,
    });

    // Use centralized normalization from symbol.ts
    const targetSymbol = (symbol || '').trim();

    useEffect(() => {
        sharedRef.current = { symbol, orders, draggingPosition: useMarketStore.getState().draggingPosition };
    }, [symbol, orders]);

    // EFFECT 1: Manage Line Existence (Create/Remove)
    // Runs only when orders or symbol changes, not on price/drag
    useEffect(() => {
        const series = seriesRef.current;
        if (!series || !symbol) return;

        // Show orders even during draft for context

        const activeTickets = new Set<string>();
        const norm = (s: string) => s.toLowerCase().replace(/[.-]?[mh]$/, '');
        const targetNorm = norm(targetSymbol);

        orders.filter(o => norm(o.symbol) === targetNorm).forEach(o => {
            const ticket = o.ticket.toString();
            activeTickets.add(ticket);

            if (!priceLinesRef.current[ticket]) priceLinesRef.current[ticket] = {};
            const lines = priceLinesRef.current[ticket];

            // 🛡️ Web-First Priority: If dragging, use drag price, not store price
            const dragging = useMarketStore.getState().draggingPosition;
            const isDraggingThis = dragging && dragging.ticket === o.ticket;

            // Entry Line
            const finalEntry = (isDraggingThis && dragging.type === 'entry') ? dragging.price : o.price_open;
            const entryOptions = {
                price: finalEntry,
                color: '#FF9800',
                lineWidth: 2 as any,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: ''
            };
            if (!lines.entry) lines.entry = series.createPriceLine(entryOptions);
            else lines.entry.applyOptions(entryOptions);

            // SL Line
            const finalSL = (isDraggingThis && dragging.type === 'sl') ? dragging.price : o.sl;
            if (finalSL > 0) {
                const slOptions = {
                    price: finalSL,
                    color: '#ef5350',
                    lineWidth: 1 as any,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: false,
                    title: ''
                };
                if (!lines.sl) lines.sl = series.createPriceLine(slOptions);
                else lines.sl.applyOptions(slOptions);
            } else if (lines.sl) {
                series.removePriceLine(lines.sl);
                lines.sl = undefined;
            }

            // TP Line
            const finalTP = (isDraggingThis && dragging.type === 'tp') ? dragging.price : o.tp;
            if (finalTP > 0) {
                const tpOptions = {
                    price: finalTP,
                    color: '#26a69a',
                    lineWidth: 1 as any,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: false,
                    title: ''
                };
                if (!lines.tp) lines.tp = series.createPriceLine(tpOptions);
                else lines.tp.applyOptions(tpOptions);
            } else if (lines.tp) {
                series.removePriceLine(lines.tp);
                lines.tp = undefined;
            }
        });

        Object.keys(priceLinesRef.current).forEach(ticket => {
            if (!activeTickets.has(ticket)) {
                const lines = priceLinesRef.current[ticket];
                if (lines.entry) series.removePriceLine(lines.entry);
                if (lines.sl) series.removePriceLine(lines.sl);
                if (lines.tp) series.removePriceLine(lines.tp);
                delete priceLinesRef.current[ticket];
            }
        });
    }, [orders, symbol, draftOrder]);

    // EFFECT 2: Fast Drag Sync for Orders
    useEffect(() => {
        const unsub = useMarketStore.subscribe(
            state => state.draggingPosition,
            (drag) => {
                const series = seriesRef.current;
                if (!series || !symbol || !drag) return;

                const lines = priceLinesRef.current[drag.ticket];
                if (!lines) return;

                if (drag.type === 'sl' && lines.sl) {
                    lines.sl.applyOptions({ price: drag.price });
                } else if (drag.type === 'tp' && lines.tp) {
                    lines.tp.applyOptions({ price: drag.price });
                } else if (drag.type === 'entry' && lines.entry) {
                    lines.entry.applyOptions({ price: drag.price });
                }
            }
        );
        return unsub;
    }, [symbol, seriesRef]);
}
