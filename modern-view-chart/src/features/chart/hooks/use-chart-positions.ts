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
    // OPTIMIZATION: Only subscribe to specific symbol price instead of entire tickers object
    const currentPrice = useMarketStore((state) => state.tickers[symbol || '']?.price);
    const setEditingPosition = useMarketStore((state) => state.setEditingPosition);
    const setFocusedTicket = useMarketStore((state) => state.setFocusedTicket);
    const symbolInfo = useMarketStore((state) => state.symbolInfo[symbol || '']);
    const draggingPosition = useMarketStore((state) => state.draggingPosition);
    const focusedTicket = useMarketStore((state) => state.focusedTicket);
    const draftOrder = useMarketStore((state) => state.draftOrder);
    const hoveredTicket = useMarketStore((state) => state.hoveredTicket);
    const priceLinesRef = useRef<Record<string, { entry?: IPriceLine, sl?: IPriceLine, tp?: IPriceLine }>>({});

    // EFFECT 1: Create/Remove price lines when positions change (infrequent)
    useEffect(() => {
        if (!seriesRef.current || !symbol) return;
        const series = seriesRef.current;

        // HIDE ALL POSITIONS if user is drafting a new order for this symbol
        if (draftOrder && draftOrder.symbol === symbol) {
            // Clean up active positions lines
            Object.keys(priceLinesRef.current).forEach(ticket => {
                if (ticket === 'draft') return;
                const lines = priceLinesRef.current[ticket];
                if (lines.entry) series.removePriceLine(lines.entry);
                if (lines.sl) series.removePriceLine(lines.sl);
                if (lines.tp) series.removePriceLine(lines.tp);
                delete priceLinesRef.current[ticket];
            });

            // Handle DRAFT lines
            if (!priceLinesRef.current['draft']) priceLinesRef.current['draft'] = {};
            const dLines = priceLinesRef.current['draft'];

            // Draft Entry
            const entryOpt = {
                price: draftOrder.price || 0,
                color: '#3b82f6',
                lineWidth: 2 as any,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: false,
                title: ''
            };
            if (!dLines.entry) dLines.entry = series.createPriceLine(entryOpt);
            else dLines.entry.applyOptions(entryOpt);

            // Draft SL
            if (draftOrder.sl && draftOrder.sl > 0) {
                const slOpt = {
                    price: draftOrder.sl,
                    color: '#ef5350',
                    lineWidth: 1 as any,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: false,
                    title: ''
                };
                if (!dLines.sl) dLines.sl = series.createPriceLine(slOpt);
                else dLines.sl.applyOptions(slOpt);
            } else if (dLines.sl) {
                series.removePriceLine(dLines.sl);
                dLines.sl = undefined;
            }

            // Draft TP
            if (draftOrder.tp && draftOrder.tp > 0) {
                const tpOpt = {
                    price: draftOrder.tp,
                    color: '#26a69a',
                    lineWidth: 1 as any,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: false,
                    title: ''
                };
                if (!dLines.tp) dLines.tp = series.createPriceLine(tpOpt);
                else dLines.tp.applyOptions(tpOpt);
            } else if (dLines.tp) {
                series.removePriceLine(dLines.tp);
                dLines.tp = undefined;
            }

            return;
        } else if (priceLinesRef.current['draft']) {
            // Cleanup draft lines if no longer drafting
            const dLines = priceLinesRef.current['draft'];
            if (dLines.entry) series.removePriceLine(dLines.entry);
            if (dLines.sl) series.removePriceLine(dLines.sl);
            if (dLines.tp) series.removePriceLine(dLines.tp);
            delete priceLinesRef.current['draft'];
        }

        let symbolPositions = positions.filter(p => p.symbol === symbol);

        // FOCUS MODE: If a ticket is focused, only show that one
        if (focusedTicket) {
            symbolPositions = symbolPositions.filter(p => p.ticket === focusedTicket);
        }

        // --- AGGREGATION LOGIC ---
        // Hide summaries in Focus Mode
        const groups = {
            buy: focusedTicket ? [] : symbolPositions.filter(p => (p.type || '').toLowerCase().includes('buy')),
            sell: focusedTicket ? [] : symbolPositions.filter(p => (p.type || '').toLowerCase().includes('sell'))
        };

        const summaryLinesToDelete = new Set(Object.keys(priceLinesRef.current).filter(k => k.startsWith('sum_')));

        [groups.buy, groups.sell].forEach(group => {
            if (group.length <= 1) return;

            const type = (group[0].type || '').toUpperCase();
            const side = type.toLowerCase().includes('BUY') ? 'buy' : 'sell';
            const sumId = `sum_${side}`;
            summaryLinesToDelete.delete(sumId);

            const totalVolume = group.reduce((s, p) => s + (p.volume || 0), 0);
            const totalProfit = group.reduce((s, p) => s + (p.profit || 0), 0);
            const weightedSum = group.reduce((s, p) => s + (p.open_price * (p.volume || 0)), 0);
            const avgPrice = weightedSum / totalVolume;

            const title = `AVG ${type} ${totalVolume.toFixed(2)} (${group.length}) • ${formatPnL(totalProfit)}`;
            const options = {
                price: avgPrice,
                color: '#9c27b0', // Purple for summary
                lineWidth: 2 as any,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: false,
                title: ''
            };

            if (!priceLinesRef.current[sumId]) priceLinesRef.current[sumId] = {};
            const lines = priceLinesRef.current[sumId];
            if (!lines.entry) {
                lines.entry = series.createPriceLine(options);
            } else {
                lines.entry.applyOptions(options);
            }
        });

        // Delete old summary lines
        summaryLinesToDelete.forEach(id => {
            const lines = priceLinesRef.current[id];
            if (lines?.entry) series.removePriceLine(lines.entry);
            delete priceLinesRef.current[id];
        });

        const activeTickets = symbolPositions.map(p => {
            const ticketStr = p.ticket.toString();
            const isHovered = hoveredTicket === p.ticket;
            const isDragging = draggingPosition?.ticket === p.ticket;
            const isFocused = isHovered || isDragging;

            // If we have multiple positions on this side, we might want to hide axis labels for individual entries too
            const side = (p.type || '').toLowerCase().includes('buy') ? 'buy' : 'sell';
            const hasMultipleOnSide = groups[side as keyof typeof groups].length > 1;

            if (!priceLinesRef.current[ticketStr]) priceLinesRef.current[ticketStr] = {};
            const lines = priceLinesRef.current[ticketStr];

            // Create/Update Entry line
            const pnl = p.profit !== undefined ? p.profit : calculatePnL({
                type: p.type,
                openPrice: p.open_price,
                currentPrice: currentPrice || p.open_price,
                volume: p.volume,
                symbolInfo,
                symbol: p.symbol
            });
            const entryColor = pnl >= 0 ? '#22c55e' : '#71717a'; // Green if profit, Gray if loss
            const entryTitle = `${(p.type || '').toUpperCase()} ${p.volume} • ${formatPnL(pnl)}`;
            const entryOptions = {
                price: p.open_price,
                color: entryColor,
                lineWidth: (isFocused ? 2 : 1) as any,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: false,
                title: ''
            };

            if (!lines.entry) {
                lines.entry = series.createPriceLine(entryOptions);
            } else {
                lines.entry.applyOptions(entryOptions);
            }

            // --- SL Logic with Drag Override ---
            let slPrice = p.sl;
            if (isDragging && draggingPosition.type === 'sl') {
                slPrice = draggingPosition.price;
            }

            if (slPrice > 0) {
                const slPnl = calculatePnL({
                    type: p.type,
                    openPrice: p.open_price,
                    currentPrice: slPrice,
                    volume: p.volume,
                    symbolInfo,
                    symbol: p.symbol
                });
                const slTitle = `SL • ${formatPnL(slPnl)}`;
                const slOptions = {
                    price: slPrice,
                    color: '#ef5350',
                    lineWidth: 1 as any,
                    lineStyle: isFocused ? LineStyle.Solid : LineStyle.Dashed,
                    axisLabelVisible: false,
                    title: ''
                };

                if (!lines.sl) {
                    lines.sl = series.createPriceLine(slOptions);
                } else {
                    lines.sl.applyOptions(slOptions);
                }
            } else if (lines.sl) {
                series.removePriceLine(lines.sl);
                lines.sl = undefined;
            }

            // --- TP Logic with Drag Override ---
            let tpPrice = p.tp;
            if (isDragging && draggingPosition.type === 'tp') {
                tpPrice = draggingPosition.price;
            }

            if (tpPrice > 0) {
                const tpPnl = calculatePnL({
                    type: p.type,
                    openPrice: p.open_price,
                    currentPrice: tpPrice,
                    volume: p.volume,
                    symbolInfo,
                    symbol: p.symbol
                });
                const tpTitle = `TP • ${formatPnL(tpPnl)}`;
                const tpOptions = {
                    price: tpPrice,
                    color: '#26a69a',
                    lineWidth: 1 as any,
                    lineStyle: isFocused ? LineStyle.Solid : LineStyle.Dashed,
                    axisLabelVisible: false,
                    title: ''
                };

                if (!lines.tp) {
                    lines.tp = series.createPriceLine(tpOptions);
                } else {
                    lines.tp.applyOptions(tpOptions);
                }
            } else if (lines.tp) {
                series.removePriceLine(lines.tp);
                lines.tp = undefined;
            }
            return ticketStr;
        });

        // Remove lines for positions that no longer exist
        Object.keys(priceLinesRef.current).forEach(ticketStr => {
            if (ticketStr.startsWith('sum_')) return; // Keep summaries
            if (!activeTickets.includes(ticketStr)) {
                const lines = priceLinesRef.current[ticketStr];
                if (lines.entry) series.removePriceLine(lines.entry);
                if (lines.sl) series.removePriceLine(lines.sl);
                if (lines.tp) series.removePriceLine(lines.tp);
                delete priceLinesRef.current[ticketStr];
            }
        });
    }, [
        // Dependencies
        JSON.stringify(positions.filter(p => p.symbol === symbol).map(p => ({
            t: p.ticket, type: p.type, op: p.open_price, sl: p.sl, tp: p.tp, vol: p.volume, prof: p.profit
        }))),
        symbol, draggingPosition, hoveredTicket, symbolInfo, draftOrder, seriesRef, focusedTicket
    ]);

    // EFFECT 2: Update PnL text when price changes (THROTTLED to prevent flickering)
    const lastPnlUpdateRef = useRef<number>(0);
    const pnlUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!seriesRef.current || !symbol || !currentPrice) return;

        const now = Date.now();
        const timeSinceLastUpdate = now - lastPnlUpdateRef.current;

        // Throttle: Only update every 1000ms (1 second)
        if (timeSinceLastUpdate < 1000) {
            // Schedule an update for later if not already scheduled
            if (!pnlUpdateTimerRef.current) {
                pnlUpdateTimerRef.current = setTimeout(() => {
                    updatePnLText();
                    pnlUpdateTimerRef.current = null;
                }, 1000 - timeSinceLastUpdate);
            }
            return;
        }

        updatePnLText();

        function updatePnLText() {
            if (!seriesRef.current || !symbol) return;

            lastPnlUpdateRef.current = Date.now();

            positions.filter(p => p.symbol === symbol).forEach(p => {
                const ticket = p.ticket.toString();
                const lines = priceLinesRef.current[ticket];
                if (!lines) return;

                // Update Entry line PnL
                if (lines.entry) {
                    const pnl = p.profit !== undefined ? p.profit : calculatePnL({
                        type: p.type,
                        openPrice: p.open_price,
                        currentPrice: currentPrice,
                        volume: p.volume,
                        symbolInfo,
                        symbol: p.symbol
                    });
                    const typeStr = (p.type || '').toUpperCase();
                    const entryTitle = `${typeStr} ${p.volume} • ${formatPnL(pnl)}`;
                    const entryColor = pnl >= 0 ? '#22c55e' : '#71717a';
                    lines.entry.applyOptions({ title: entryTitle, color: entryColor });
                }

                // Update SL PnL if exists
                if (lines.sl && p.sl > 0) {
                    const slPrice = (draggingPosition?.ticket === p.ticket && draggingPosition.type === 'sl')
                        ? draggingPosition.price : p.sl;
                    const slPnl = calculatePnL({
                        type: p.type,
                        openPrice: p.open_price,
                        currentPrice: slPrice,
                        volume: p.volume,
                        symbolInfo,
                        symbol: p.symbol
                    });
                    const slTitle = `SL • ${formatPnL(slPnl)}`;
                    lines.sl.applyOptions({ title: slTitle });
                }

                // Update TP PnL if exists
                if (lines.tp && p.tp > 0) {
                    const tpPrice = (draggingPosition?.ticket === p.ticket && draggingPosition.type === 'tp')
                        ? draggingPosition.price : p.tp;
                    const tpPnl = calculatePnL({
                        type: p.type,
                        openPrice: p.open_price,
                        currentPrice: tpPrice,
                        volume: p.volume,
                        symbolInfo,
                        symbol: p.symbol
                    });
                    const tpTitle = `TP • ${formatPnL(tpPnl)}`;
                    lines.tp.applyOptions({ title: tpTitle });
                }
            });
        }

        return () => {
            if (pnlUpdateTimerRef.current) {
                clearTimeout(pnlUpdateTimerRef.current);
                pnlUpdateTimerRef.current = null;
            }
        };
    }, [currentPrice, symbol, positions, symbolInfo, draggingPosition, seriesRef]);

    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !symbol) return;
        const chart = chartRef.current;
        const series = seriesRef.current;

        const handleClick = (param: import('lightweight-charts').MouseEventParams) => {
            if (!param.point || !param.time) return;

            const startTime = performance.now();

            // Get price at click location
            const price = series.coordinateToPrice(param.point.y);
            if (!price) return;

            // Hit test against active positions for this symbol
            const activePositions = positions.filter(p => p.symbol === symbol);
            if (activePositions.length === 0) return; // Early return

            // Hit test using screen coordinates for better UX
            let found = false;
            for (const pos of activePositions) {
                const pricesToTest = [pos.open_price, pos.sl, pos.tp].filter(p => p > 0);
                for (const p of pricesToTest) {
                    const priceCoordinate = series.priceToCoordinate(p);
                    if (priceCoordinate === null) continue;

                    // Check if click Y is within 10 pixels of the line Y
                    if (Math.abs(param.point.y - priceCoordinate) < 10) {
                        setEditingPosition(pos);
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            // If no position line was hit, clear focus mode
            if (!found && focusedTicket) {
                setFocusedTicket(null);
            }

            const elapsed = performance.now() - startTime;
            if (elapsed > 50) {
                console.warn(`[PERF] Position click took ${elapsed.toFixed(0)}ms`);
            }
        };

        chart.subscribeClick(handleClick);
        return () => chart.unsubscribeClick(handleClick);
    }, [chartRef, seriesRef, symbol, positions, setEditingPosition, setFocusedTicket, focusedTicket]);
}
