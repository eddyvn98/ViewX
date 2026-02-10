import React, { useEffect, useLayoutEffect, useRef, useState, memo } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { useOrderTags } from '../hooks/use-order-tags';
import { createTagElement, updateTagVisuals, updateTagPosition, TagElements } from '../logic/tag-renderer';

interface OrderLineTagsProps {
    symbol: string | undefined;
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
    priceChartRef: React.RefObject<import('lightweight-charts').IChartApi | null>;
    isReady: boolean;
    sendMessage?: (data: any) => void;
    source?: string;
}

export const OrderLineTags = memo(function OrderLineTags({ symbol, seriesRef, priceChartRef, isReady, sendMessage }: OrderLineTagsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tagElementsMap = useRef<Map<string, TagElements>>(new Map());

    // ⚡ Hook: Centralized State Management for Tags
    const { tags, currentPrice, symbolInfo, draftOrder } = useOrderTags(symbol);
    const [editingState, setEditingState] = useState<{ id: string, ticket: any, type: string, price: number, value: number, x?: number } | null>(null);

    // 1. Sync Tags (Structure & Visuals)
    useEffect(() => {
        const container = containerRef.current;
        const series = seriesRef.current;
        if (!container || !series || !symbol) return;

        const activeIds = new Set<string>();

        // Create/Update Elements
        tags.forEach(tag => {
            activeIds.add(tag.id);
            let elements = tagElementsMap.current.get(tag.id);

            if (!elements) {
                elements = createTagElement(tag);
                container.appendChild(elements.el);
                tagElementsMap.current.set(tag.id, elements);

                // ⚡ INTERACTION: Attach listeners for special buttons if type is draft_group
                if (tag.type === 'draft_group') {
                    // 1. Cancel
                    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
                        (e as PointerEvent).stopPropagation();
                        (e as PointerEvent).preventDefault();
                        useMarketStore.getState().setDraftOrder(null);
                    });

                    // 2. Lot Plus/Minus Buttons
                    elements.el.querySelector('.lot-minus')?.addEventListener('pointerdown', (e) => {
                        (e as PointerEvent).stopPropagation();
                        const { draftOrder, setDraftOrder } = useMarketStore.getState();
                        if (draftOrder) {
                            const newVal = Math.max(0.01, (draftOrder.volume || 0.01) - 0.01);
                            setDraftOrder({ ...draftOrder, volume: newVal });
                        }
                    });

                    elements.el.querySelector('.lot-plus')?.addEventListener('pointerdown', (e) => {
                        (e as PointerEvent).stopPropagation();
                        const { draftOrder, setDraftOrder } = useMarketStore.getState();
                        if (draftOrder) {
                            const newVal = (draftOrder.volume || 0.01) + 0.01;
                            setDraftOrder({ ...draftOrder, volume: newVal });
                        }
                    });

                    const lotBox = elements.el.querySelector('.lot-box') as HTMLElement;
                    if (lotBox) {
                        lotBox.setAttribute('data-draggable', 'true');
                        lotBox.setAttribute('data-type', 'volume');
                        lotBox.setAttribute('data-ticket', 'draft');
                    }

                    // 3. Identification for Dragging TP/SL/Entry
                    const tpBtn = elements.el.querySelector('.tp-btn') as HTMLElement;
                    if (tpBtn) {
                        tpBtn.setAttribute('data-draggable', 'true');
                        tpBtn.setAttribute('data-type', 'tp');
                        tpBtn.setAttribute('data-ticket', 'draft');
                    }

                    const slBtn = elements.el.querySelector('.sl-btn') as HTMLElement;
                    if (slBtn) {
                        slBtn.setAttribute('data-draggable', 'true');
                        slBtn.setAttribute('data-type', 'sl');
                        slBtn.setAttribute('data-ticket', 'draft');
                    }

                    const priceBox = elements.el.querySelector('.price-box') as HTMLElement;
                    if (priceBox) {
                        priceBox.setAttribute('data-draggable', 'true');
                        priceBox.setAttribute('data-type', 'entry');
                        priceBox.setAttribute('data-ticket', 'draft');
                    }

                    const groupMain = elements.el.querySelector('.group-main') as HTMLElement;
                    if (groupMain) {
                        groupMain.setAttribute('data-draggable', 'true');
                        groupMain.setAttribute('data-type', 'entry');
                        groupMain.setAttribute('data-ticket', 'draft');
                    }
                } else if (tag.ticket === 'draft') {
                    // ⚡ Separate Draft SL/TP Tags
                    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
                        (e as PointerEvent).stopPropagation();
                        (e as PointerEvent).preventDefault();
                        const { draftOrder, setDraftOrder } = useMarketStore.getState();
                        if (draftOrder) {
                            const field = tag.type.includes('sl') ? 'sl' : 'tp';
                            setDraftOrder({ ...draftOrder, [field]: 0, [`${field}Touched`]: false });
                        }
                    });

                    // Drappable Attributes for moving SL/TP independently
                    if (elements.priceBox) {
                        elements.priceBox.setAttribute('data-draggable', 'true');
                        elements.priceBox.setAttribute('data-type', tag.type);
                        elements.priceBox.setAttribute('data-ticket', 'draft');
                    }

                    const tagBody = elements.el.querySelector('.tag-body') as HTMLElement;
                    if (tagBody) {
                        tagBody.setAttribute('data-draggable', 'true');
                        tagBody.setAttribute('data-type', tag.type);
                        tagBody.setAttribute('data-ticket', 'draft');
                    }
                } else if (tag.ticket !== 'draft') {
                    // ⚡ INTERACTION: Close/Cancel/Remove for real items
                    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
                        const store = useMarketStore.getState() as any;
                        const isPos = store.positions.some((p: any) => Number(p.ticket) === Number(tag.ticket));

                        let command: any = null;
                        if (tag.type === 'entry') {
                            // Removing Entry = Removing the entire group (Close Position or Cancel Order)
                            command = {
                                topic: 'mt5_command',
                                command: isPos ? 'close' : 'delete',
                                ticket: String(tag.ticket)
                            };
                        } else if (tag.type === 'sl' || tag.type === 'tp') {
                            // Removing SL/TP = Modifying just that stop to 0
                            command = {
                                topic: 'mt5_command',
                                command: 'modify',
                                ticket: String(tag.ticket),
                                [tag.type === 'sl' ? 'sl' : 'tp']: 0
                            };
                        }

                        if (command) {
                            if (tag.type === 'entry' && store.addPendingDeletion) {
                                store.addPendingDeletion(tag.ticket);
                            }
                            if (sendMessage) sendMessage(command);
                            else {
                                console.warn('sendMessage prop not found in OrderLineTags, falling back to store');
                                store.sendMessage?.(command);
                            }
                        }
                    });
                }
            }

            // Update Visuals (PnL, Color, Label)
            updateTagVisuals(elements, tag, symbolInfo, currentPrice, draftOrder, symbol);

            // Update Position (Y-Axis)
            updateTagPosition(elements, series, tag.price);
        });

        // Cleanup Stale Elements
        tagElementsMap.current.forEach((el, id) => {
            if (!activeIds.has(id)) {
                el.el.remove();
                tagElementsMap.current.delete(id);
            }
        });

    }, [tags, currentPrice, symbolInfo, draftOrder, seriesRef, symbol, sendMessage]);

    // 2. Sync Positions on Chart Interaction (Scroll/Zoom/Crosshair)
    // Use useLayoutEffect for visual sync to avoid flickering on mobile repaint
    useLayoutEffect(() => {
        const priceChart = priceChartRef.current;
        const series = seriesRef.current;
        if (!isReady || !priceChart || !series) return;

        let syncRafId: number | null = null;
        const sync = () => {
            if (syncRafId) return;
            syncRafId = requestAnimationFrame(() => {
                syncRafId = null;
                tagElementsMap.current.forEach((cached) => {
                    const td = (cached.el as any)._tagData;
                    if (td && seriesRef.current) {
                        updateTagPosition(cached, seriesRef.current, td.price);
                    }
                });
            });
        };

        const timescale = priceChart.timeScale();
        timescale.subscribeVisibleLogicalRangeChange(sync);
        timescale.subscribeVisibleTimeRangeChange(sync);
        priceChart.subscribeCrosshairMove(sync);

        window.addEventListener('mousemove', sync);
        window.addEventListener('scroll', sync, { passive: true });

        return () => {
            if (syncRafId) cancelAnimationFrame(syncRafId);
            timescale.unsubscribeVisibleLogicalRangeChange(sync);
            timescale.unsubscribeVisibleTimeRangeChange(sync);
            priceChart.unsubscribeCrosshairMove(sync);
            window.removeEventListener('mousemove', sync);
            window.removeEventListener('scroll', sync);
        };
    }, [isReady, priceChartRef, seriesRef]);

    // ⚡ Logic: Handle Input Submission/Cancel
    const isDeletingRef = useRef(false);
    const editingStateRef = useRef(editingState);
    useEffect(() => {
        editingStateRef.current = editingState;
    }, [editingState]);

    const handleInputFinish = React.useCallback((val: number, save: boolean, sessionId?: string) => {
        const state = editingStateRef.current;
        // 🔒 Security Check: Only close if the session matches the current one
        if (sessionId && state?.id !== sessionId) return;

        if (save && state && !isDeletingRef.current) {
            const { ticket, type } = state;
            if (ticket === 'draft') {
                const draft = useMarketStore.getState().draftOrder;
                if (!draft) return;
                if (type === 'volume') {
                    const finalVal = isNaN(val) || val <= 0 ? 0.01 : val;
                    useMarketStore.getState().setDraftOrder({ ...draft, volume: finalVal });
                } else {
                    const field = type.replace('draft_', '');
                    const mappedField = field === 'entry' ? 'price' : (field === 'sl' ? 'sl' : (field === 'tp' ? 'tp' : field));
                    useMarketStore.getState().setDraftOrder({ ...draft, [mappedField]: val, isMarket: mappedField === 'price' ? false : draft.isMarket });
                }
            } else {
                const mappedType = type === 'entry' ? 'price' : type;
                const command = { topic: 'mt5_command', command: 'modify', ticket, [mappedType]: val };
                if (sendMessage) sendMessage(command);
                else {
                    const store = useMarketStore.getState() as any;
                    store.sendMessage?.(command);
                }
            }
        }
        setEditingState(null);
    }, [sendMessage]);


    useEffect(() => {
        const handleStartEdit = (e: any) => {
            const { ticket, type, price, x } = e.detail;
            let val = price;
            isDeletingRef.current = false;

            if (ticket === 'draft' && type === 'volume') {
                val = useMarketStore.getState().draftOrder?.volume || 0.1;
            }

            // 🆔 Unique ID including timestamp to prevent race conditions with blurs
            setEditingState({ id: `${ticket}-${type}-${Date.now()}`, ticket, type, price, value: val, x });
        };
        window.addEventListener('start-tag-edit', handleStartEdit);
        return () => window.removeEventListener('start-tag-edit', handleStartEdit);
    }, []);

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-[1000] overflow-hidden touch-none">
            {editingState && seriesRef.current && (
                <EditOverlay
                    state={editingState}
                    series={seriesRef.current}
                    isDeletingRef={isDeletingRef}
                    onFinish={handleInputFinish}
                    sendMessage={sendMessage}
                />
            )}
        </div>
    );
});

const EditOverlay = memo(function EditOverlay({ state, series, isDeletingRef, onFinish, sendMessage }: {
    state: any, series: any, isDeletingRef: React.RefObject<boolean>, onFinish: (val: number, save: boolean, sessionId?: string) => void, sendMessage?: (msg: any) => void
}) {
    const [livePrice, setLivePrice] = useState(state.price);
    const isInteractingRef = useRef(false);

    useEffect(() => {
        const unsub = useMarketStore.subscribe(
            s => s.draggingPosition,
            (drag) => {
                if (drag && drag.ticket === state.ticket && drag.type === state.type) {
                    setLivePrice(drag.price);
                }
            }
        );
        const unsubDraft = useMarketStore.subscribe(
            s => s.draftOrder,
            (draft: any) => {
                if (state.ticket === 'draft' && draft) {
                    const field = state.type === 'entry' ? 'price' : state.type;
                    if (draft[field] !== undefined) setLivePrice(draft[field]);
                }
            }
        );
        return () => { unsub(); unsubDraft(); };
    }, [state.ticket, state.type]);

    const coord = series.priceToCoordinate(livePrice) || 0;

    return (
        <div
            className="edit-overlay absolute z-[2000] flex flex-col items-center gap-2 pointer-events-auto touch-action-none"
            onContextMenu={e => e.preventDefault()}
            style={{
                transform: `translateY(${coord - 13}px)`,
                left: state.x !== undefined ? `${state.x - 30}px` : 'auto',
                right: state.x !== undefined ? 'auto' : '0px',
            }}
            onPointerDown={e => {
                if (e.pointerType === 'touch') e.preventDefault(); // 🛡️ CRITICAL: Block ghost clicks
                e.stopPropagation();
                isInteractingRef.current = true;
            }}
            onPointerUp={e => {
                e.stopPropagation();
                isInteractingRef.current = false;
            }}
        >
            <div
                className="h-7 min-w-[85px] bg-zinc-950 border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] overflow-hidden rounded-md"
            >
                <input
                    autoFocus
                    type="number"
                    step="0.00001"
                    defaultValue={state.value}
                    className="w-full h-full bg-transparent text-white text-[13px] font-mono font-bold text-center outline-none px-2"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onFinish(parseFloat((e.target as HTMLInputElement).value), true, state.id);
                        if (e.key === 'Escape') {
                            isDeletingRef.current = true;
                            onFinish(0, false, state.id);
                        }
                    }}
                    onFocus={(e) => (e.target as HTMLInputElement).select()}
                    onBlur={(e) => {
                        if (isDeletingRef.current || isInteractingRef.current) return;
                        setTimeout(() => {
                            if (isDeletingRef.current || isInteractingRef.current) return;
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            onFinish(isNaN(val) ? 0 : val, !isNaN(val), state.id);
                        }, 200);
                    }}
                />
            </div>

            <button
                type="button"
                data-no-drag="true"
                className="delete-btn flex items-center gap-1.5 px-3 py-1.5 bg-red-600/90 backdrop-blur-md border border-red-500/50 rounded-lg shadow-lg active:scale-95 transition-all"
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isDeletingRef.current = true;

                    const { ticket, type } = state;
                    const store = useMarketStore.getState();
                    if (ticket === 'draft') {
                        if (type === 'volume' || type.includes('entry')) store.setDraftOrder(null);
                        else {
                            const field = type.replace('draft_', '') === 'sl' ? 'sl' : 'tp';
                            if (store.draftOrder) store.setDraftOrder({ ...store.draftOrder, [field]: 0, [`${field}Touched`]: false });
                        }
                    } else {
                        const isPos = store.positions.some(p => p.ticket === ticket);
                        const cmd = { topic: 'mt5_command', command: (type === 'entry' ? (isPos ? 'close' : 'delete') : 'modify'), ticket, [type === 'entry' ? 'price' : type]: 0 };
                        if (type === 'entry' && (store as any).addPendingDeletion) {
                            (store as any).addPendingDeletion(ticket);
                        }
                        sendMessage?.(cmd);
                    }
                    onFinish(0, false, state.id);
                }}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
                <span className="text-[11px] font-black text-white uppercase tracking-wider">Xoá lệnh</span>
            </button>
        </div>
    );
});
