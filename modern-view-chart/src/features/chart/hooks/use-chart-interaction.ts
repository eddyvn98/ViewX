import { useEffect, useRef } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore, Alert, Position, Order } from '@/lib/store';

export function useChartInteraction(
    chartRef: React.RefObject<import('lightweight-charts').IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
    symbol: string | undefined,
    containerRef: React.RefObject<HTMLDivElement | null>,
    alerts: Alert[] = [],
    handleUpdateAlert: (id: string, price: number) => void = () => { },
    handleRemoveAlert: (id: string) => void = () => { },
    sendMessage?: (data: any) => void
) {
    const positions = useMarketStore(state => state.positions);
    const orders = useMarketStore(state => state.orders);
    const draftOrder = useMarketStore(state => state.draftOrder);
    const symbolInfo = useMarketStore(state => symbol ? state.symbolInfo[symbol] : undefined);
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const setDraggingPosition = useMarketStore(state => state.setDraggingPosition);

    const stateRef = useRef({
        positions,
        orders,
        draftOrder,
        symbolInfo,
        alerts,
        currentPrice: 0
    });

    useEffect(() => {
        stateRef.current = { ...stateRef.current, positions, orders, draftOrder, symbolInfo, alerts };
    }, [positions, orders, draftOrder, symbolInfo, alerts]);

    useEffect(() => {
        if (!symbol) return;
        return useMarketStore.subscribe(
            state => state.tickers[symbol]?.price,
            price => { if (price) stateRef.current.currentPrice = price; }
        );
    }, [symbol]);

    const isDragging = useRef(false);
    const dragState = useRef<any>(null);
    const mouseDownPos = useRef<{ x: number, y: number } | null>(null);

    const getNearElement = (y: number, x: number, isTouch: boolean = false) => {
        const series = seriesRef.current;
        const container = containerRef.current;
        if (!series || !container || !symbol) return null;

        const { positions, orders, draftOrder, alerts } = stateRef.current;

        // Helper to match symbols with or without suffixes like .m
        const norm = (sym: string) => sym.toUpperCase().replace('.M', '').replace('.H', '');
        const targetSymbol = norm(symbol);

        const width = container.clientWidth;
        const isNearRightEdge = (width - x) < 100;
        let tolerance = isNearRightEdge ? 25 : 12;
        if (isTouch) tolerance = 30;

        // 1. Alerts
        const symbolAlerts = alerts.filter(a => norm(a.symbol) === targetSymbol && a.active);
        for (const a of symbolAlerts) {
            const cy = series.priceToCoordinate(a.price);
            if (cy !== null && Math.abs(cy - y) < tolerance) return { type: 'alert', id: a.id, price: a.price, ticket: a.id };
        }

        // 2. Draft
        if (draftOrder && norm(draftOrder.symbol) === targetSymbol) {
            const bid = stateRef.current.currentPrice || 0;
            const ask = bid * 1.0005;
            const entryPrice = draftOrder.isMarket ? (draftOrder.type === 'buy' ? ask : bid) : (draftOrder.price || bid);
            const lines = [{ type: 'entry', price: entryPrice }, { type: 'sl', price: draftOrder.sl || 0 }, { type: 'tp', price: draftOrder.tp || 0 }];
            for (const l of lines) {
                if (l.price <= 0) continue;
                const cy = series.priceToCoordinate(l.price);
                if (cy !== null && Math.abs(cy - y) < tolerance) return { ...l, ticket: 'draft' };
            }
        }

        // 3. Positions & Orders
        const items = [
            ...positions.filter(p => norm(p.symbol) === targetSymbol),
            ...orders.filter(o => norm(o.symbol) === targetSymbol)
        ];

        for (const item of items) {
            const isPos = 'open_price' in item;
            const openPrice = isPos ? (item as Position).open_price : (item as Order).price_open;
            const lines = [{ type: 'entry', price: openPrice }, { type: 'sl', price: item.sl }, { type: 'tp', price: item.tp }];
            for (const l of lines) {
                if (l.price <= 0) continue;
                const cy = series.priceToCoordinate(l.price);
                if (cy !== null && Math.abs(cy - y) < tolerance) return { ...l, ticket: item.ticket };
            }
        }
        return null;
    };

    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !containerRef.current || !symbol) return;
        const chart = chartRef.current;
        const container = containerRef.current;
        const series = seriesRef.current;

        const handleMouseDown = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hit = getNearElement(y, x);

            if (hit) {
                mouseDownPos.current = { x, y };
                dragState.current = { ...hit, originalPrice: hit.price, currentPrice: hit.price };
                if (hit.ticket && hit.ticket !== 'draft') {
                    useMarketStore.getState().setFocusedTicket(hit.ticket as number);
                }
                chart.applyOptions({ handleScroll: false, handleScale: false });
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragState.current || !mouseDownPos.current) return;
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (!isDragging.current) {
                const dist = Math.sqrt(Math.pow(x - mouseDownPos.current.x, 2) + Math.pow(y - mouseDownPos.current.y, 2));
                if (dist > 3) isDragging.current = true;
                else return;
            }

            const price = series.coordinateToPrice(y);
            if (price === null) return;
            const finalPrice = Number((price as number).toFixed(stateRef.current.symbolInfo?.digits || 2));

            // 🛡️ VALIDATION LOGIC: Prevent SL/TP from crossing Entry in the wrong direction
            let validatedPrice = finalPrice;
            const digits = stateRef.current.symbolInfo?.digits || 2;

            if (dragState.current.ticket === 'draft') {
                const dr = stateRef.current.draftOrder;
                if (dr) {
                    const entry = dr.isMarket ? stateRef.current.currentPrice : (dr.price || stateRef.current.currentPrice);
                    if (dragState.current.type === 'sl') {
                        validatedPrice = dr.type === 'buy' ? Math.min(finalPrice, entry) : Math.max(finalPrice, entry);
                    } else if (dragState.current.type === 'tp') {
                        validatedPrice = dr.type === 'buy' ? Math.max(finalPrice, entry) : Math.min(finalPrice, entry);
                    }
                }
            } else if (dragState.current.type !== 'alert' && dragState.current.type !== 'entry') {
                const item = [...stateRef.current.positions, ...stateRef.current.orders].find(i => i.ticket === dragState.current.ticket);
                if (item) {
                    const isPos = 'open_price' in item;
                    const entry = isPos ? (item as any).open_price : (item as any).price_open;
                    const isBuy = item.type.toLowerCase().includes('buy');
                    if (dragState.current.type === 'sl') {
                        validatedPrice = isBuy ? Math.min(finalPrice, entry) : Math.max(finalPrice, entry);
                    } else if (dragState.current.type === 'tp') {
                        validatedPrice = isBuy ? Math.max(finalPrice, entry) : Math.min(finalPrice, entry);
                    }
                }
            }

            dragState.current.currentPrice = validatedPrice;

            // ⚡ ZERO-LAG SYNC: Update both Line and HTML Tag DOM directly in the same frame
            const tagId = dragState.current.ticket === 'draft' ? `draft-${dragState.current.type}` : `${dragState.current.ticket}-${dragState.current.type}`;
            const tagElement = container.querySelector(`[data-tag-id="${tagId}"]`) as HTMLElement;

            if (tagElement) {
                // ⚡ Sync the cached price so that sync() calls during panning use the new position
                const td = (tagElement as any)._tagData;
                if (td) td.price = validatedPrice;

                const newY = series.priceToCoordinate(validatedPrice);
                if (newY !== null) {
                    tagElement.style.transform = `translateY(${newY - 12}px)`;
                    const priceText = tagElement.querySelector('.price-text');
                    if (priceText) priceText.textContent = validatedPrice.toFixed(digits);
                }
            }

            // ⚡ FAST-PATH for Canvas Lines: Dispatch event for PriceLine hooks
            window.dispatchEvent(new CustomEvent('order-line-drag', {
                detail: { ticket: dragState.current.ticket, type: dragState.current.type, price: validatedPrice, symbol }
            }));

            if (dragState.current.ticket === 'draft') {
                const { draftOrder } = stateRef.current;
                const updates: any = {};
                if (dragState.current.type === 'entry') { updates.price = validatedPrice; updates.isMarket = false; }
                else if (dragState.current.type === 'sl') { updates.sl = validatedPrice; updates.slTouched = true; }
                else if (dragState.current.type === 'tp') { updates.tp = validatedPrice; updates.tpTouched = true; }
                setDraftOrder({ ...draftOrder, ...updates });
            } else if (dragState.current.type === 'alert') {
                handleUpdateAlert(dragState.current.id, validatedPrice);
            } else {
                setDraggingPosition({ ticket: dragState.current.ticket, type: dragState.current.type as any, price: validatedPrice });
            }
        };

        const handleMouseUp = () => {
            if (!dragState.current) return;
            if (!isDragging.current) {
                window.dispatchEvent(new CustomEvent('start-tag-edit', {
                    detail: { ticket: dragState.current.ticket, type: dragState.current.type, price: dragState.current.price }
                }));
            } else {
                const { ticket, id, type, currentPrice } = dragState.current;
                if (type === 'alert') {
                    handleUpdateAlert(id, currentPrice);
                } else if (ticket && ticket !== 'draft') {
                    const mappedType = type === 'entry' ? 'price' : type;
                    const command = { topic: 'mt5_command', command: 'modify', ticket, [mappedType]: currentPrice };

                    // 🚀 OPTIMISTIC UPDATE: Update store immediately so UI doesn't snap back
                    const store = useMarketStore.getState();
                    const isPos = store.positions.some(p => p.ticket === ticket);

                    if (isPos) {
                        const field = type === 'entry' ? 'open_price' : type;
                        store.addPendingModification(Number(ticket), field, currentPrice); // 🛡️ LOCK
                        store.setPositions(prev => prev.map(p =>
                            p.ticket === ticket ? { ...p, [field]: currentPrice } : p
                        ));
                    } else {
                        const field = type === 'entry' ? 'price_open' : type;
                        // @ts-ignore
                        store.addPendingModification(Number(ticket), field, currentPrice); // 🛡️ LOCK
                        store.setOrders(prev => prev.map(o =>
                            o.ticket === ticket
                                ? { ...o, [field as keyof Order]: currentPrice }
                                : o
                        ));
                    }

                    if (sendMessage) sendMessage(command);
                    else (store as any).sendMessage?.(command);

                    setDraggingPosition(null);
                    store.setFocusedTicket(null);
                }
            }
            isDragging.current = false;
            dragState.current = null;
            mouseDownPos.current = null;
            chart.applyOptions({ handleScroll: true, handleScale: true });
        };

        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [symbol, setDraftOrder, setDraggingPosition, handleUpdateAlert, sendMessage]);
}
