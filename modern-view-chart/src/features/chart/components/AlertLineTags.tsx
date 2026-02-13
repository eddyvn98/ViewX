import React, { useEffect, useLayoutEffect, useRef, useState, memo } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { useAlertTags } from '../hooks/use-alert-tags';
import { createTagElement, updateTagVisuals, updateTagPosition, TagElements } from '../logic/tag-renderer';

interface AlertLineTagsProps {
    symbol: string | undefined;
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
    priceChartRef: React.RefObject<import('lightweight-charts').IChartApi | null>;
    isReady: boolean;
}

export const AlertLineTags = memo(function AlertLineTags({ symbol, seriesRef, priceChartRef, isReady }: AlertLineTagsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tagElementsMap = useRef<Map<string, TagElements>>(new Map());

    // ⚡ Hook: Alert Tags State
    const { tags } = useAlertTags(symbol);
    const symbolInfo = useMarketStore(state => symbol ? state.symbolInfo[symbol] : undefined);
    const removeAlert = useMarketStore(state => state.removeAlert);
    const updateAlert = useMarketStore(state => state.updateAlert);
    const [editingState, setEditingState] = useState<{ id: string, ticket: any, type: string, price: number, value: number, x?: number } | null>(null);

    // 1. Sync Tags (Structure & Visuals)
    useEffect(() => {
        const container = containerRef.current;
        const series = seriesRef.current;
        if (!container || !series || !symbol) return;

        const activeIds = new Set<string>();

        tags.forEach(tag => {
            activeIds.add(tag.id);
            let elements = tagElementsMap.current.get(tag.id);

            if (!elements) {
                elements = createTagElement(tag);
                container.appendChild(elements.el);
                tagElementsMap.current.set(tag.id, elements);

                // ⚡ INTERACTION: Events
                const alertId = tag.ticket as string;

                // 1. Remove Alert
                elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
                    (e as PointerEvent).stopPropagation();
                    (e as PointerEvent).preventDefault();
                    console.log('[Alert] Removing:', alertId);
                    removeAlert(alertId);
                });

                // 2. Dragging Logic (on price box and body to sure)
                const makeDraggable = (el: HTMLElement | null) => {
                    if (el) {
                        el.setAttribute('data-draggable', 'true');
                        el.setAttribute('data-type', 'alert');
                        el.setAttribute('data-ticket', alertId); // Use Alert ID as ticket
                    }
                };
                makeDraggable(elements.priceBox);
                makeDraggable(elements.el.querySelector('.tag-body') as HTMLElement);
                // Note: Bell icon is made draggable in tag-renderer.ts template
            }

            // Update Visuals
            updateTagVisuals(elements, tag, symbolInfo, tag.price, null, symbol); // Draft is null for alerts

            // Update Position (Y-Axis)
            // If dragging this specific alert, use the drag price (handled in hook/tagData already)
            updateTagPosition(elements, series, tag.price);
        });

        // Cleanup Stale
        tagElementsMap.current.forEach((el, id) => {
            if (!activeIds.has(id)) {
                el.el.remove();
                tagElementsMap.current.delete(id);
            }
        });

    }, [tags, symbolInfo, seriesRef, symbol, removeAlert]);

    // 2. Sync Positions on Interactions (Scroll/Zoom/Crosshair) AND Fast Drag
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

        // ⚡ Fast Drag Sync Subscription
        const unsubDrag = useMarketStore.subscribe(
            state => state.draggingPosition,
            (drag) => {
                if (!drag || drag.type !== 'alert') return;
                const series = seriesRef.current;
                if (!series) return;

                const elements = tagElementsMap.current.get(drag.ticket as string);
                if (elements) {
                    updateTagPosition(elements, series, drag.price);
                    // Also update label if needed
                    const digits = symbolInfo?.digits || 2;
                    if (elements.price) elements.price.textContent = drag.price.toFixed(digits);

                    // Mark as dragging for styling
                    if (!elements.el.classList.contains('dragging')) elements.el.classList.add('dragging');
                }
            }
        );

        // Cleanup dragging class on pointer up (via window listener or store checking)
        // Actually store.draggingPosition becomes null on drop, so we can clean up
        const unsubDragEnd = useMarketStore.subscribe(
            state => state.draggingPosition,
            (drag) => {
                if (!drag) {
                    tagElementsMap.current.forEach(el => el.el.classList.remove('dragging'));
                    sync(); // Re-sync to ensure everything is in place
                }
            }
        );

        return () => {
            if (syncRafId) cancelAnimationFrame(syncRafId);
            timescale.unsubscribeVisibleLogicalRangeChange(sync);
            timescale.unsubscribeVisibleTimeRangeChange(sync);
            priceChart.unsubscribeCrosshairMove(sync);
            window.removeEventListener('mousemove', sync);
            window.removeEventListener('scroll', sync);
            unsubDrag();
            unsubDragEnd();
        };
    }, [isReady, priceChartRef, seriesRef, symbolInfo]);

    // 3. Inline Editing Logic
    const isDeletingRef = useRef(false);
    const editingStateRef = useRef(editingState);
    useEffect(() => { editingStateRef.current = editingState; }, [editingState]);

    const handleInputFinish = React.useCallback((val: number, save: boolean, sessionId?: string) => {
        const state = editingStateRef.current;
        if (sessionId && state?.id !== sessionId) return;

        if (save && state && !isDeletingRef.current) {
            console.log('[Alert] Updating price:', state.ticket, val);
            updateAlert(state.ticket, { price: val });
        }
        setEditingState(null);
    }, [updateAlert]);

    useEffect(() => {
        const handleStartEdit = (e: any) => {
            const { ticket, type, price, x } = e.detail;
            if (type !== 'alert') return; // Only handle alerts

            isDeletingRef.current = false;
            setEditingState({ id: `${ticket}-${type}-${Date.now()}`, ticket, type, price, value: price, x });
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
                />
            )}
        </div>
    );
});

// Reusing EditOverlay simplified for alerts
const EditOverlay = memo(function EditOverlay({ state, series, isDeletingRef, onFinish }: {
    state: any, series: any, isDeletingRef: React.RefObject<boolean>, onFinish: (val: number, save: boolean, sessionId?: string) => void
}) {
    const isInteractingRef = useRef(false);
    const removeAlert = useMarketStore(state => state.removeAlert);

    // Sync with fast drag
    const [livePrice, setLivePrice] = useState(state.price);
    useEffect(() => {
        return useMarketStore.subscribe(s => s.draggingPosition, (drag) => {
            if (drag && drag.ticket === state.ticket && drag.type === 'alert') {
                setLivePrice(drag.price);
            }
        });
    }, [state.ticket]);

    const coord = series.priceToCoordinate(livePrice) || 0;

    return (
        <div
            className="edit-overlay absolute z-[2000] flex flex-col items-center gap-1.5 pointer-events-auto touch-action-none"
            onContextMenu={e => e.preventDefault()}
            style={{
                transform: `translateY(${coord - 13}px)`, // Centered vertically on input
                left: state.x !== undefined ? `${state.x}px` : 'auto', // Align left with click
                right: state.x !== undefined ? 'auto' : '10px', // Fallback right
            }}
            onPointerDown={e => {
                if (e.pointerType === 'touch') e.preventDefault();
                e.stopPropagation();
                isInteractingRef.current = true;
            }}
            onPointerUp={e => {
                e.stopPropagation();
                isInteractingRef.current = false;
            }}
        >
            <div className="h-7 min-w-[70px] w-[80px] bg-zinc-950 border border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] overflow-hidden rounded text-center shrink-0">
                <input
                    autoFocus
                    type="number"
                    step="0.00001"
                    defaultValue={state.value}
                    className="w-full h-full bg-transparent text-white text-[12px] font-mono font-bold text-center outline-none px-1"
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
                title="Delete Alert"
                className="delete-btn flex items-center justify-center h-8 w-8 bg-black/60 backdrop-blur-md border border-red-500/50 hover:bg-red-500 hover:border-red-500 rounded-full shadow-lg transition-all active:scale-90 group"
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isDeletingRef.current = true;
                    removeAlert(state.ticket);
                    onFinish(0, false, state.id);
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 group-hover:text-white transition-colors">
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    );
});
