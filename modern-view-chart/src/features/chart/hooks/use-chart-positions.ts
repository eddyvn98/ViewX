import { useEffect, useRef } from 'react';
import { ISeriesApi, IPriceLine, LineStyle } from 'lightweight-charts';
import { Position, useMarketStore } from '@/lib/store';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';

export function useChartPositions(
    symbol: string | undefined,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
    positions: Position[],
    chartRef: React.RefObject<import('lightweight-charts').IChartApi | null>
) {
    const symbolInfo = useMarketStore((state) => state.symbolInfo[symbol || '']);
    const focusedTicket = useMarketStore((state) => state.focusedTicket);
    const draftOrder = useMarketStore((state) => state.draftOrder);
    const hoveredTicket = useMarketStore((state) => state.hoveredTicket);
    const setEditingPosition = useMarketStore((state) => state.setEditingPosition);
    const setFocusedTicket = useMarketStore((state) => state.setFocusedTicket);

    const priceLinesRef = useRef<Record<string, { entry?: IPriceLine, sl?: IPriceLine, tp?: IPriceLine }>>({});

    // Stable state ref for high-frequency updates
    const sharedRef = useRef({
        symbol,
        positions,
        symbolInfo,
        draggingPosition: null as any,
        focusedTicket
    });

    // Helper to match symbols with or without suffixes like .m
    const norm = (sym: string | undefined) => (sym || '').toUpperCase().replace('.M', '').replace('.H', '');
    const targetSymbol = norm(symbol);

    useEffect(() => {
        sharedRef.current = { symbol, positions, symbolInfo, draggingPosition: useMarketStore.getState().draggingPosition, focusedTicket };
    }, [symbol, positions, symbolInfo, focusedTicket]);

    // EFFECT 1: Manage Line Existence (Create/Remove)
    // Runs only when positions or symbol changes, not on price/drag
    useEffect(() => {
        const series = seriesRef.current;
        if (!series || !symbol) return;

        if (draftOrder && norm(draftOrder.symbol) === targetSymbol) {
            Object.keys(priceLinesRef.current).forEach(ticket => {
                const lines = priceLinesRef.current[ticket];
                if (lines.entry) series.removePriceLine(lines.entry);
                if (lines.sl) series.removePriceLine(lines.sl);
                if (lines.tp) series.removePriceLine(lines.tp);
                delete priceLinesRef.current[ticket];
            });
            return;
        }

        let symbolPositions = positions.filter(p => norm(p.symbol) === targetSymbol);
        if (focusedTicket) {
            symbolPositions = symbolPositions.filter(p => p.ticket === focusedTicket);
        }

        const activeTicketsWithGroup = new Set<string>();

        // Handle Active Positions
        symbolPositions.forEach(p => {
            const ticketStr = p.ticket.toString();
            activeTicketsWithGroup.add(ticketStr);

            if (!priceLinesRef.current[ticketStr]) priceLinesRef.current[ticketStr] = {};
            const lines = priceLinesRef.current[ticketStr];

            const isFoc = focusedTicket === p.ticket || hoveredTicket === p.ticket;

            // 🛡️ Web-First Priority for Positions
            const dragging = useMarketStore.getState().draggingPosition;
            const isDraggingThis = dragging && dragging.ticket === p.ticket;

            // Entry Line
            const finalEntry = (isDraggingThis && dragging.type === 'entry') ? dragging.price : p.open_price;
            const entryOptions = {
                price: finalEntry,
                color: '#71717a',
                lineWidth: (isFoc ? 2 : 1) as any,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: false,
                title: ''
            };
            if (!lines.entry) lines.entry = series.createPriceLine(entryOptions);
            else lines.entry.applyOptions(entryOptions);

            // SL Line
            const finalSL = (isDraggingThis && dragging.type === 'sl') ? dragging.price : p.sl;
            if (finalSL > 0) {
                const slOptions = {
                    price: finalSL,
                    color: '#ef5350',
                    lineWidth: 1 as any,
                    lineStyle: isFoc ? LineStyle.Solid : LineStyle.Dashed,
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
            const finalTP = (isDraggingThis && dragging.type === 'tp') ? dragging.price : p.tp;
            if (finalTP > 0) {
                const tpOptions = {
                    price: finalTP,
                    color: '#26a69a',
                    lineWidth: 1 as any,
                    lineStyle: isFoc ? LineStyle.Solid : LineStyle.Dashed,
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

        // Cleanup
        Object.keys(priceLinesRef.current).forEach(t => {
            if (!activeTicketsWithGroup.has(t)) {
                const lines = priceLinesRef.current[t];
                if (lines.entry) series.removePriceLine(lines.entry);
                if (lines.sl) series.removePriceLine(lines.sl);
                if (lines.tp) series.removePriceLine(lines.tp);
                delete priceLinesRef.current[t];
            }
        });
    }, [positions.length, symbol, draftOrder, focusedTicket, hoveredTicket]);

    // EFFECT 2: High-frequency updates (Dragging & Price)
    // Uses manual subscription for maximum smoothness
    useEffect(() => {
        const unsub = useMarketStore.subscribe(
            state => [state.tickers[symbol || '']?.price, state.draggingPosition] as const,
            ([price, drag]) => {
                const series = seriesRef.current;
                if (!series || !symbol) return;

                const currentPositions = sharedRef.current.positions.filter(p => p.symbol === symbol);

                currentPositions.forEach(p => {
                    const lines = priceLinesRef.current[p.ticket];
                    if (!lines) return;

                    // Update prices smoothly bypassing React re-renders
                    if (lines.entry) {
                        const pnl = p.profit ?? calculatePnL({ type: p.type, openPrice: p.open_price, currentPrice: price || p.open_price, volume: p.volume, symbolInfo, symbol: p.symbol });
                        lines.entry.applyOptions({ color: pnl >= 0 ? '#22c55e' : '#71717a' });
                    }

                    if (lines.sl) {
                        const slPrice = (drag?.ticket === p.ticket && drag.type === 'sl') ? drag.price : p.sl;
                        lines.sl.applyOptions({ price: slPrice });
                    }

                    if (lines.tp) {
                        const tpPrice = (drag?.ticket === p.ticket && drag.type === 'tp') ? drag.price : p.tp;
                        lines.tp.applyOptions({ price: tpPrice });
                    }
                });
            }
        );
        return unsub;
    }, [symbol, symbolInfo, seriesRef]);

    // ⚡ FAST-PATH: Listen to direct drag events for instant sync
    useEffect(() => {
        const handleFastDrag = (e: any) => {
            const { ticket, type, price, symbol: eventSymbol } = e.detail;
            if (eventSymbol !== symbol || ticket === 'draft') return;

            const lines = priceLinesRef.current[ticket];
            if (!lines) return;

            if (type === 'entry' && lines.entry) lines.entry.applyOptions({ price });
            else if (type === 'sl' && lines.sl) lines.sl.applyOptions({ price });
            else if (type === 'tp' && lines.tp) lines.tp.applyOptions({ price });
        };

        window.addEventListener('order-line-drag', handleFastDrag);
        return () => window.removeEventListener('order-line-drag', handleFastDrag);
    }, [symbol]);

    // Handle Clicks
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !symbol) return;
        const chart = chartRef.current;
        const series = seriesRef.current;

        const handleClick = (param: import('lightweight-charts').MouseEventParams) => {
            if (!param.point || !param.time) return;
            const activePositions = positions.filter(p => p.symbol === symbol);
            let found = false;
            for (const pos of activePositions) {
                const pricesToTest = [pos.open_price, pos.sl, pos.tp].filter(p => p > 0);
                for (const p of pricesToTest) {
                    const coords = series.priceToCoordinate(p);
                    if (coords !== null && Math.abs(param.point.y - coords) < 15) {
                        setEditingPosition(pos);
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (!found && focusedTicket) setFocusedTicket(null);
        };

        chart.subscribeClick(handleClick);
        return () => chart.unsubscribeClick(handleClick);
    }, [chartRef, seriesRef, symbol, positions, setEditingPosition, setFocusedTicket, focusedTicket]);
}
