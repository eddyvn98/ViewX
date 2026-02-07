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

    useEffect(() => {
        if (!seriesRef.current || !symbol) return;
        const series = seriesRef.current;

        // HIDE ALL PENDING ORDERS if user is drafting a new order for this symbol
        if (draftOrder && draftOrder.symbol === symbol) {
            Object.keys(priceLinesRef.current).forEach(ticket => {
                const lines = priceLinesRef.current[ticket];
                if (lines.entry) series.removePriceLine(lines.entry);
                if (lines.sl) series.removePriceLine(lines.sl);
                if (lines.tp) series.removePriceLine(lines.tp);
                delete priceLinesRef.current[ticket];
            });
            return;
        }

        const activeTickets = orders.filter(o => o.symbol === symbol).map(o => {
            const ticket = o.ticket.toString();
            if (!priceLinesRef.current[ticket]) priceLinesRef.current[ticket] = {};
            const lines = priceLinesRef.current[ticket];

            const typeStr = (o.type || '').toUpperCase();
            const entryTitle = `${typeStr} ${o.volume}`;

            // Entry Line (Pending Price)
            if (!lines.entry) {
                lines.entry = series.createPriceLine({
                    price: o.price_open,
                    color: '#FF9800', // Orange for pending
                    lineWidth: 2,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: false,
                    title: ''
                });
            } else {
                lines.entry.applyOptions({ price: o.price_open });
            }

            // SL Line
            if (o.sl > 0) {
                const slTitle = `SL (Pending)`;
                if (!lines.sl) {
                    lines.sl = series.createPriceLine({
                        price: o.sl,
                        color: '#ef5350',
                        lineWidth: 1,
                        lineStyle: LineStyle.Dotted,
                        axisLabelVisible: false,
                        title: ''
                    });
                } else {
                    lines.sl.applyOptions({ price: o.sl });
                }
            } else if (lines.sl) {
                series.removePriceLine(lines.sl);
                lines.sl = undefined;
            }

            // TP Line
            if (o.tp > 0) {
                const tpTitle = `TP (Pending)`;
                if (!lines.tp) {
                    lines.tp = series.createPriceLine({
                        price: o.tp,
                        color: '#26a69a',
                        lineWidth: 1,
                        lineStyle: LineStyle.Dotted,
                        axisLabelVisible: false,
                        title: ''
                    });
                } else {
                    lines.tp.applyOptions({ price: o.tp });
                }
            } else if (lines.tp) {
                series.removePriceLine(lines.tp);
                lines.tp = undefined;
            }

            return ticket;
        });

        // Cleanup removed orders
        Object.keys(priceLinesRef.current).forEach(ticket => {
            if (!activeTickets.includes(ticket)) {
                const lines = priceLinesRef.current[ticket];
                if (lines.entry) series.removePriceLine(lines.entry);
                if (lines.sl) series.removePriceLine(lines.sl);
                if (lines.tp) series.removePriceLine(lines.tp);
                delete priceLinesRef.current[ticket];
            }
        });
    }, [orders, symbol, draftOrder]);
}
