import { useEffect, useRef } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore, Alert, Order } from '@/lib/store';
import { getNearElement } from '../logic/chart-hit-test';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';

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
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !containerRef.current || !symbol) return;
        const chart = chartRef.current;
        const container = containerRef.current;
        const series = seriesRef.current;

        const handlePointerDown = (e: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const target = e.target as HTMLElement;
            const isDraggable = target.closest('[data-draggable="true"]');
            const isNoDrag = target.closest('[data-no-drag="true"]');
            const isInteractive = target.closest('button, input, .cancel-btn, .lot-minus, .lot-plus, .confirm-btn');

            if (isNoDrag || (isInteractive && !isDraggable)) {
                return;
            }

            if (!isDraggable && (document.querySelector('.delete-btn') || document.activeElement?.tagName === 'INPUT')) {
                if (target.closest('.delete-btn') || target.tagName === 'INPUT') return;
                useMarketStore.getState().setFocusedTicket(null);
                return;
            }

            let hit: any = null;
            if (isDraggable) {
                const el = isDraggable as HTMLElement;
                const ticketAttr = el.getAttribute('data-ticket');
                const type = el.getAttribute('data-type');
                const tagEl = el.closest('[data-tag-id]') as any;
                const tagData = tagEl?._tagData;

                if (ticketAttr && type && tagData) {
                    hit = {
                        type,
                        ticket: ticketAttr === 'draft' ? 'draft' : Number(ticketAttr),
                        price: tagData.price,
                        id: tagData.id
                    };
                }
            }

            // Fallback to price-based hit test if no specific button clicked
            if (!hit) {
                hit = getNearElement(y, x, series, container, symbol, stateRef.current, e.pointerType === 'touch');
            }

            if (hit) {
                mouseDownPos.current = { x, y };
                dragState.current = { ...hit, originalPrice: hit.price, currentPrice: hit.price };

                if (hit.ticket !== 'draft' && hit.ticket) {
                    useMarketStore.getState().setFocusedTicket(hit.ticket as number);
                }

                // ⏱️ Start Long Press Timer for Mobile
                if (e.pointerType === 'touch') {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    longPressTimer.current = setTimeout(() => {
                        if (dragState.current && !isDragging.current) {
                            window.dispatchEvent(new CustomEvent('start-tag-edit', {
                                detail: {
                                    ticket: dragState.current.ticket,
                                    type: dragState.current.type,
                                    price: dragState.current.price,
                                    x: mouseDownPos.current?.x
                                }
                            }));
                            if (navigator.vibrate) navigator.vibrate(50); // Optional haptic feedback
                        }
                    }, 450); // Long press threshold
                }

                chart.applyOptions({ handleScroll: false, handleScale: false });
            } else {
                const isTagBody = target.closest('.tag-body');
                const isOverlay = target.closest('.delete-btn') || target.tagName === 'INPUT';
                if (isTagBody || isOverlay) return;
                useMarketStore.getState().setFocusedTicket(null);
            }
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!dragState.current || !mouseDownPos.current) return;
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const deltaX = x - mouseDownPos.current.x;
            const deltaY = y - mouseDownPos.current.y;

            if (!isDragging.current) {
                const dist = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
                if (dist > 5) {
                    isDragging.current = true;
                    if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                    }
                }
                else return;
            }

            const price = series.coordinateToPrice(y);
            if (price === null) return;
            const finalPrice = Number((price as number).toFixed(stateRef.current.symbolInfo?.digits || 2));

            let validatedPrice = finalPrice;
            const digits = stateRef.current.symbolInfo?.digits || 2;
            const currentItemIdx = dragState.current;

            if (currentItemIdx.ticket === 'draft') {
                const dr = stateRef.current.draftOrder;
                if (dr) {
                    const isBuy = dr.type === 'buy';
                    const digits = stateRef.current.symbolInfo?.digits || 2;
                    const minGap = 5 * Math.pow(10, -digits);

                    if (currentItemIdx.type === 'entry') {
                        let min = -Infinity;
                        let max = Infinity;
                        if (dr.sl && dr.sl > 0) {
                            if (isBuy) min = dr.sl + minGap;
                            else max = dr.sl - minGap;
                        }
                        if (dr.tp && dr.tp > 0) {
                            if (isBuy) max = dr.tp - minGap;
                            else min = dr.tp + minGap;
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

            const isDraft = dragState.current.ticket === 'draft';
            const dragType = dragState.current.type;
            const tagId = (isDraft && dragType === 'entry') ? 'draft-group' : `${dragState.current.ticket}-${dragType}`;
            const tagElement = container.querySelector(`[data-tag-id="${tagId}"]`) as HTMLElement;

            if (tagElement) {
                (tagElement as any)._tagData = { ...(tagElement as any)._tagData, price: validatedPrice };
                const newY = series.priceToCoordinate(validatedPrice);
                if (newY !== null) {
                    tagElement.style.transform = `translateY(${newY - 12}px)`;
                    const priceText = tagElement.querySelector('.price-text');
                    if (priceText) priceText.textContent = validatedPrice.toFixed(digits);

                    if (dragType === 'sl' || dragType === 'tp') {
                        const isBuy = (dragState.current.pOriginal as any)?.type?.toLowerCase()?.includes('buy') ?? stateRef.current.draftOrder?.type === 'buy';
                        const op = dragState.current.pOriginal
                            ? (('open_price' in dragState.current.pOriginal) ? (dragState.current.pOriginal as any).open_price : (('price_open' in dragState.current.pOriginal) ? (dragState.current.pOriginal as any).price_open : (('price' in dragState.current.pOriginal) ? (dragState.current.pOriginal as any).price : 0)))
                            : (stateRef.current.draftOrder?.price || stateRef.current.currentPrice);

                        const pnlVal = calculatePnL({
                            type: isBuy ? 'buy' : 'sell',
                            openPrice: op,
                            currentPrice: validatedPrice,
                            volume: (dragState.current.pOriginal as any)?.volume || stateRef.current.draftOrder?.volume || 0,
                            symbolInfo: stateRef.current.symbolInfo,
                            symbol: symbol
                        });

                        const pnlEl = tagElement.querySelector('.pnl-text') as HTMLElement;
                        if (pnlEl) {
                            pnlEl.textContent = formatPnL(pnlVal);
                            pnlEl.className = `pnl-text text-[10px] font-bold px-1 rounded bg-black/40 ${pnlVal >= 0 ? 'text-green-400' : 'text-red-400'} max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 [[dragging]_&]:max-w-[120px] [[dragging]_&]:opacity-100 transition-all duration-300 ease-in-out`;
                        }
                        tagElement.setAttribute('dragging', '');
                    }
                }
            }

            window.dispatchEvent(new CustomEvent('order-line-drag', {
                detail: { ticket: dragState.current.ticket, type: dragState.current.type, price: validatedPrice, symbol }
            }));

            if (dragState.current.ticket === 'draft') {
                const { draftOrder } = stateRef.current;
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

        const handlePointerUp = (e: PointerEvent) => {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }

            if (!dragState.current) return;

            const { ticket, id, type, currentPrice } = dragState.current;

            if (!isDragging.current) {
                // 🐭 Desktop Only: Trigger edit on simple click
                if (e.pointerType === 'mouse') {
                    window.dispatchEvent(new CustomEvent('start-tag-edit', {
                        detail: {
                            ticket: dragState.current.ticket,
                            type: dragState.current.type,
                            price: dragState.current.price,
                            x: mouseDownPos.current?.x
                        }
                    }));
                }
                // 📱 Mobile: Tap is ignored for editing (long press handled it)
            } else {
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

            if (dragState.current) {
                const isDraft = dragState.current.ticket === 'draft';
                const tagId = (isDraft && dragState.current.type === 'entry') ? 'draft-group' : `${dragState.current.ticket}-${dragState.current.type}`;
                const tagElement = container.querySelector(`[data-tag-id="${tagId}"]`) as HTMLElement;
                if (tagElement) {
                    tagElement.removeAttribute('dragging');
                    tagElement.style.opacity = '1';
                }
            }
            isDragging.current = false;
            dragState.current = null;
            mouseDownPos.current = null;
            chart.applyOptions({ handleScroll: true, handleScale: true });
        };

        container.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            container.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [symbol, setDraftOrder, setDraggingPosition, handleUpdateAlert, sendMessage]);
}
