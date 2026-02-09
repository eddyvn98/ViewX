import { useEffect, useRef } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore, Alert, Order } from '@/lib/store';
import { getNearElement } from '../logic/chart-hit-test';

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
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const setDraggingPosition = useMarketStore(state => state.setDraggingPosition);

    // Subscribe to symbol info changes separately to avoid unnecessary re-renders of the hook
    const symbolInfo = useMarketStore(state => symbol ? state.symbolInfo[symbol] : undefined);

    const stateRef = useRef({
        positions, orders, draftOrder, symbolInfo, alerts, currentPrice: 0
    });

    useEffect(() => {
        stateRef.current = { ...stateRef.current, positions, orders, draftOrder, symbolInfo, alerts };
    }, [positions, orders, draftOrder, symbolInfo, alerts]);

    useEffect(() => {
        if (!symbol) return;
        return useMarketStore.subscribe(
            (state: any) => state.tickers[symbol]?.price,
            (price: number) => { if (price) stateRef.current.currentPrice = price; }
        );
    }, [symbol]);

    const isDragging = useRef(false);
    const dragState = useRef<any>(null);
    const mouseDownPos = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !containerRef.current || !symbol) return;
        const chart = chartRef.current;
        const container = containerRef.current;
        const series = seriesRef.current;

        const handleMouseDown = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hit = getNearElement(y, x, series, container, symbol, stateRef.current);

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

            // Validation logic simplified in this view for brevity, but retaining core logic
            let validatedPrice = finalPrice;
            const digits = stateRef.current.symbolInfo?.digits || 2;
            const currentItemIdx = dragState.current;

            // Logic to validate entry/sl/tp relationships
            if (currentItemIdx.ticket === 'draft') {
                const dr = stateRef.current.draftOrder;
                if (dr) {
                    const isBuy = dr.type === 'buy';
                    // Gap safety to prevent 10016 error
                    const digits = stateRef.current.symbolInfo?.digits || 2;
                    const minGap = 5 * Math.pow(10, -digits);

                    if (currentItemIdx.type === 'entry') {
                        // Validate Entry against SL/TP
                        let min = -Infinity;
                        let max = Infinity;

                        if (dr.sl && dr.sl > 0) {
                            if (isBuy) min = dr.sl + minGap; // Entry must be > SL + gap
                            else max = dr.sl - minGap;       // Entry must be < SL - gap
                        }

                        if (dr.tp && dr.tp > 0) {
                            if (isBuy) max = dr.tp - minGap; // Entry must be < TP - gap
                            else min = dr.tp + minGap;       // Entry must be > TP + gap
                        }

                        validatedPrice = Math.max(min, Math.min(max, finalPrice));

                    } else if (currentItemIdx.type === 'sl') {
                        const entry = dr.isMarket ? stateRef.current.currentPrice : (dr.price || stateRef.current.currentPrice);
                        validatedPrice = isBuy ? Math.min(finalPrice, entry - minGap) : Math.max(finalPrice, entry + minGap);
                    } else if (currentItemIdx.type === 'tp') {
                        const entry = dr.isMarket ? stateRef.current.currentPrice : (dr.price || stateRef.current.currentPrice);
                        validatedPrice = isBuy ? Math.max(finalPrice, entry + minGap) : Math.min(finalPrice, entry - minGap);
                    }
                }
            } else if (currentItemIdx.type !== 'alert' && currentItemIdx.type !== 'entry') {
                const item = [...stateRef.current.positions, ...stateRef.current.orders].find(i => i.ticket === currentItemIdx.ticket);
                if (item) {
                    const isPos = 'open_price' in item;
                    const entry = isPos ? (item as any).open_price : (item as any).price_open;
                    const isBuy = item.type.toLowerCase().includes('buy');
                    // Gap safety to prevent 10016 error
                    const digits = stateRef.current.symbolInfo?.digits || 2;
                    const minGap = 5 * Math.pow(10, -digits);

                    if (currentItemIdx.type === 'sl') {
                        validatedPrice = isBuy ? Math.min(finalPrice, entry - minGap) : Math.max(finalPrice, entry + minGap);
                    } else if (currentItemIdx.type === 'tp') {
                        validatedPrice = isBuy ? Math.max(finalPrice, entry + minGap) : Math.min(finalPrice, entry - minGap);
                    }
                }
            }

            dragState.current.currentPrice = validatedPrice;

            // DOM Update for dragging item
            const tagId = dragState.current.ticket === 'draft' ? `draft-${dragState.current.type}` : `${dragState.current.ticket}-${dragState.current.type}`;
            const tagElement = container.querySelector(`[data-tag-id="${tagId}"]`) as HTMLElement;

            if (tagElement) {
                (tagElement as any)._tagData = { ...(tagElement as any)._tagData, price: validatedPrice };
                const newY = series.priceToCoordinate(validatedPrice);
                if (newY !== null) {
                    tagElement.style.transform = `translateY(${newY - 12}px)`;
                    const priceText = tagElement.querySelector('.price-text');
                    if (priceText) priceText.textContent = validatedPrice.toFixed(digits);
                }
            }

            window.dispatchEvent(new CustomEvent('order-line-drag', {
                detail: { ticket: dragState.current.ticket, type: dragState.current.type, price: validatedPrice, symbol }
            }));

            if (dragState.current.ticket === 'draft') {
                const { draftOrder } = stateRef.current;
                // Type guarded updates
                const updates: Partial<typeof draftOrder> = {};
                if (dragState.current.type === 'entry') { (updates as any).price = validatedPrice; (updates as any).isMarket = false; }
                else if (dragState.current.type === 'sl') { (updates as any).sl = validatedPrice; (updates as any).slTouched = true; }
                else if (dragState.current.type === 'tp') { (updates as any).tp = validatedPrice; (updates as any).tpTouched = true; }
                if (draftOrder) setDraftOrder({ ...draftOrder, ...updates });
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

                    const store = useMarketStore.getState();
                    const isPos = store.positions.some(p => p.ticket === ticket);

                    if (isPos) {
                        const field = type === 'entry' ? 'open_price' : type;
                        store.addPendingModification(Number(ticket), field, currentPrice);
                        store.setPositions(prev => prev.map(p => p.ticket === ticket ? { ...p, [field]: currentPrice } : p));
                    } else {
                        const field = type === 'entry' ? 'price_open' : type;
                        store.addPendingModification(Number(ticket), field, currentPrice);
                        store.setOrders(prev => prev.map(o => o.ticket === ticket ? { ...o, [field as keyof Order]: currentPrice } : o));
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
