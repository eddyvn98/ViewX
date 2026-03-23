/* eslint-disable @typescript-eslint/no-explicit-any */
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore, Order } from '@/lib/store';
import { getNearElement } from '../../logic/chart-hit-test';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';

interface PointerHandlerArgs {
    chart: any;
    container: HTMLDivElement;
    coordinateContainer: HTMLDivElement;
    series: ISeriesApi<'Candlestick'>;
    coordinateSeries: ISeriesApi<'Candlestick'>;
    symbol: string;
    stateRef: React.MutableRefObject<any>;
    isDragging: React.MutableRefObject<boolean>;
    dragState: React.MutableRefObject<any>;
    mouseDownPos: React.MutableRefObject<{ x: number; y: number } | null>;
    longPressTimer: React.MutableRefObject<NodeJS.Timeout | null>;
    setDraftOrder: (value: any) => void;
    setDraggingPosition: (value: any) => void;
    handleUpdateAlert: (id: string, price: number) => void;
    sendMessage?: (data: any) => void;
}

export function createPointerHandlers(args: PointerHandlerArgs) {
    const {
        chart,
        container,
        coordinateContainer,
        series,
        coordinateSeries,
        symbol,
        stateRef,
        isDragging,
        dragState,
        mouseDownPos,
        longPressTimer,
        setDraftOrder,
        setDraggingPosition,
        handleUpdateAlert,
        sendMessage,
    } = args;

    let dragStoreRafId: number | null = null;
    let pendingDragStoreUpdate: any = null;
    let activePointerId: number | null = null;
    let capturedDragElement: HTMLElement | null = null;

    const flushDragStoreUpdate = () => {
        dragStoreRafId = null;
        const nextUpdate = pendingDragStoreUpdate;
        pendingDragStoreUpdate = null;
        if (!nextUpdate) return;

        if (nextUpdate.kind === 'draft') {
            const currentDraft = useMarketStore.getState().draftOrder;
            if (!currentDraft) return;
            setDraftOrder({ ...currentDraft, ...nextUpdate.updates });
            return;
        }

        if (nextUpdate.kind === 'drag') {
            setDraggingPosition(nextUpdate.value);
        }
    };

    const scheduleDragStoreUpdate = (nextUpdate: any) => {
        pendingDragStoreUpdate = nextUpdate;
        if (dragStoreRafId !== null) return;
        dragStoreRafId = window.requestAnimationFrame(flushDragStoreUpdate);
    };

    const cancelPendingDragStoreUpdate = () => {
        pendingDragStoreUpdate = null;
        if (dragStoreRafId !== null) {
            window.cancelAnimationFrame(dragStoreRafId);
            dragStoreRafId = null;
        }
    };

    const handlePointerDown = (e: PointerEvent) => {
        const rect = coordinateContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const target = e.target as HTMLElement;
        const isDraggable = target.closest('[data-draggable="true"]');
        const isNoDrag = target.closest('[data-no-drag="true"]');
        const isInteractive = target.closest('button, input, .cancel-btn, .lot-minus, .lot-plus, .confirm-btn');

        if (isNoDrag || (isInteractive && !isDraggable)) return;

        if (!isDraggable && (document.querySelector('.delete-btn') || document.activeElement?.tagName === 'INPUT')) {
            if (target.closest('.delete-btn') || target.tagName === 'INPUT') return;
            useMarketStore.getState().setFocusedTicket(null);
            return;
        }

        let hit: any = null;
        if (isDraggable) {
            const el = isDraggable as HTMLElement;
            const ticketAttr = el.getAttribute('data-ticket');
            let type = el.getAttribute('data-type');
            // Draft group has nested draggable nodes; prefer explicit button intent.
            if (target.closest('.tp-btn')) type = 'tp';
            else if (target.closest('.sl-btn')) type = 'sl';
            else if (target.closest('.price-box') && type !== 'alert') type = 'entry';
            const tagEl = el.closest('[data-tag-id]') as any;
            const tagData = tagEl?._tagData;
            if (ticketAttr && type) {
                const parsedTicket = (ticketAttr === 'draft' || type === 'alert') ? ticketAttr : Number(ticketAttr);

                if (tagData) {
                    hit = { type, ticket: parsedTicket, price: tagData.price, id: tagData.id };
                } else {
                    const idAttr = (tagEl as HTMLElement | null)?.getAttribute('data-tag-id') || undefined;
                    const priceTextEl = (tagEl as HTMLElement | null)?.querySelector('.price-text') as HTMLElement | null;
                    const parsedPrice = Number(priceTextEl?.textContent || '');
                    const fallbackPrice = Number.isFinite(parsedPrice)
                        ? parsedPrice
                        : Number((coordinateSeries.coordinateToPrice(y) ?? 0).toFixed(stateRef.current.symbolInfo?.digits || 2));

                    hit = { type, ticket: parsedTicket, price: fallbackPrice, id: idAttr };
                }
            }
        }

        // On touch devices, only start dragging when the user actually touches a draggable tag.
        // Fuzzy line hit-testing from empty chart space makes pan/crosshair gestures snap to active orders.
        if (!hit && e.pointerType !== 'touch') {
            hit = getNearElement(y, x, series, container, symbol, stateRef.current, false);
        }

        if (hit) {
            e.preventDefault();
            mouseDownPos.current = { x, y };
            dragState.current = { ...hit, originalPrice: hit.price, currentPrice: hit.price };
            activePointerId = typeof e.pointerId === 'number' ? e.pointerId : null;
            container.style.touchAction = 'none';

            const captureTarget = (isDraggable as HTMLElement | null) ?? container;
            if (captureTarget instanceof HTMLElement && typeof captureTarget.setPointerCapture === 'function') {
                try {
                    captureTarget.setPointerCapture(e.pointerId);
                    capturedDragElement = captureTarget;
                } catch {
                    capturedDragElement = null;
                }
            }

            if (hit.ticket !== 'draft' && hit.ticket) useMarketStore.getState().setFocusedTicket(hit.ticket as number);

            if (e.pointerType === 'touch') {
                if (longPressTimer.current) clearTimeout(longPressTimer.current);
                longPressTimer.current = setTimeout(() => {
                    if (dragState.current && !isDragging.current) {
                        window.dispatchEvent(new CustomEvent('start-tag-edit', {
                            detail: { ticket: dragState.current.ticket, type: dragState.current.type, price: dragState.current.price, x: mouseDownPos.current?.x },
                        }));
                        if (navigator.vibrate) navigator.vibrate(50);
                    }
                }, 450);
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
        if (
            activePointerId !== null &&
            typeof e.pointerId === 'number' &&
            e.pointerId !== activePointerId
        ) return;
        if (e.pointerType === 'touch') e.preventDefault();
        const rect = coordinateContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const deltaX = x - mouseDownPos.current.x;
        const deltaY = y - mouseDownPos.current.y;

        if (!isDragging.current) {
            const dist = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
            const threshold = e.pointerType === 'touch' ? 1.5 : 5;
            if (dist > threshold) {
                isDragging.current = true;
                e.preventDefault();
                if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                }
            } else return;
        }

        let price: any = coordinateSeries.coordinateToPrice(y);
        if (price === null) {
            const clampedY = Math.max(0, Math.min(coordinateContainer.clientHeight - 1, y));
            price = coordinateSeries.coordinateToPrice(clampedY);
        }
        if (price === null) {
            const priceScale = (coordinateSeries as any).priceScale?.();
            const visibleRange = priceScale?.getVisibleRange?.();
            if (
                visibleRange &&
                Number.isFinite(visibleRange.from) &&
                Number.isFinite(visibleRange.to)
            ) {
                const topCoord = coordinateSeries.priceToCoordinate(visibleRange.to as number);
                const bottomCoord = coordinateSeries.priceToCoordinate(visibleRange.from as number);
                if (
                    topCoord !== null &&
                    bottomCoord !== null &&
                    Number.isFinite(topCoord) &&
                    Number.isFinite(bottomCoord) &&
                    Math.abs(bottomCoord - topCoord) > 1e-6
                ) {
                    const t = (y - topCoord) / (bottomCoord - topCoord);
                    const clampedT = Math.max(0, Math.min(1, t));
                    price = (visibleRange.to as number) + ((visibleRange.from as number) - (visibleRange.to as number)) * clampedT;
                }
            }
        }
        if (price === null) return;
        if (isDragging.current) e.preventDefault();
        const finalPrice = Number((price as number).toFixed(stateRef.current.symbolInfo?.digits || 2));

        let validatedPrice = finalPrice;
        const digits = stateRef.current.symbolInfo?.digits || 2;
        const currentItemIdx = dragState.current;

        if (currentItemIdx.ticket === 'draft') {
            const dr = stateRef.current.draftOrder;
            if (dr) {
                const isBuy = dr.type === 'buy';
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
                const minGap = 5 * Math.pow(10, -digits);

                if (currentItemIdx.type === 'sl') validatedPrice = isBuy ? Math.min(finalPrice, entry - minGap) : Math.max(finalPrice, entry + minGap);
                else if (currentItemIdx.type === 'tp') validatedPrice = isBuy ? Math.max(finalPrice, entry + minGap) : Math.min(finalPrice, entry - minGap);
            }
        }

        dragState.current.currentPrice = validatedPrice;

        const isDraft = dragState.current.ticket === 'draft';
        const dragType = dragState.current.type;
        const tagId = (isDraft && dragType === 'entry') ? 'draft-group' : (dragType === 'alert' ? `alert-${dragState.current.ticket}` : `${dragState.current.ticket}-${dragState.current.type}`);
        const tagElement = container.querySelector(`[data-tag-id="${tagId}"]`) as HTMLElement;

        if (tagElement) {
            (tagElement as any)._tagData = { ...(tagElement as any)._tagData, price: validatedPrice };
            const newY = coordinateSeries.priceToCoordinate(validatedPrice);
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
                        symbol,
                    });

                    const pnlEl = tagElement.querySelector('.pnl-text') as HTMLElement;
                    if (pnlEl) {
                        pnlEl.textContent = formatPnL(pnlVal);
                        pnlEl.className = `pnl-text text-[11px] font-bold px-1 rounded bg-black/40 ${pnlVal >= 0 ? 'text-green-400' : 'text-red-400'} max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 [[dragging]_&]:max-w-[120px] [[dragging]_&]:opacity-100 transition-all duration-300 ease-in-out`;
                    }
                    tagElement.setAttribute('dragging', '');
                }
            }
        }

        window.dispatchEvent(new CustomEvent('order-line-drag', {
            detail: { ticket: dragState.current.ticket, type: dragState.current.type, price: validatedPrice, symbol },
        }));

        if (dragState.current.ticket === 'draft') {
            const { draftOrder } = stateRef.current;
            const updates: Partial<typeof draftOrder> = {};
            if (dragState.current.type === 'entry') { (updates as any).price = validatedPrice; (updates as any).isMarket = false; }
            else if (dragState.current.type === 'sl') { (updates as any).sl = validatedPrice; (updates as any).slTouched = true; }
            else if (dragState.current.type === 'tp') { (updates as any).tp = validatedPrice; (updates as any).tpTouched = true; }
            if (draftOrder) scheduleDragStoreUpdate({ kind: 'draft', updates });
        } else {
            scheduleDragStoreUpdate({
                kind: 'drag',
                value: { ticket: dragState.current.ticket, type: dragState.current.type as any, price: validatedPrice }
            });
        }
    };

    const handlePointerUp = (e: PointerEvent) => {
        if (
            activePointerId !== null &&
            typeof e.pointerId === 'number' &&
            e.pointerId !== activePointerId
        ) return;
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (!dragState.current) return;

        flushDragStoreUpdate();

        const { ticket, type, currentPrice } = dragState.current;

        if (!isDragging.current) {
            const isDraftTap = ticket === 'draft';
            if (e.pointerType === 'mouse' && !isDraftTap) {
                window.dispatchEvent(new CustomEvent('start-tag-edit', {
                    detail: { ticket: dragState.current.ticket, type: dragState.current.type, price: dragState.current.price, x: mouseDownPos.current?.x },
                }));
            }
        } else {
            if (type === 'alert') {
                handleUpdateAlert(String(ticket), currentPrice);
                setDraggingPosition(null);
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
            const tagId = (isDraft && dragState.current.type === 'entry') ? 'draft-group' : (dragState.current.type === 'alert' ? `alert-${dragState.current.ticket}` : `${dragState.current.ticket}-${dragState.current.type}`);
            const tagElement = container.querySelector(`[data-tag-id="${tagId}"]`) as HTMLElement;
            if (tagElement) {
                tagElement.removeAttribute('dragging');
                tagElement.style.opacity = '1';
            }
        }

        isDragging.current = false;
        dragState.current = null;
        mouseDownPos.current = null;
        activePointerId = null;
        if (capturedDragElement && typeof capturedDragElement.releasePointerCapture === 'function') {
            try {
                if (e.pointerId !== undefined && capturedDragElement.hasPointerCapture?.(e.pointerId)) {
                    capturedDragElement.releasePointerCapture(e.pointerId);
                }
            } catch {
                // no-op
            }
        }
        capturedDragElement = null;
        cancelPendingDragStoreUpdate();

        const drawingSelected = useMarketStore.getState().selectedDrawingId;
        container.style.touchAction = '';
        if (!drawingSelected) chart.applyOptions({ handleScroll: true, handleScale: true });
    };

    return { handlePointerDown, handlePointerMove, handlePointerUp };
}
