import React, { useEffect, useLayoutEffect, useRef, useState, memo } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { useAlertTags } from '../hooks/use-alert-tags';
import { createTagElement, updateTagVisuals, updateTagPosition, TagElements } from '../logic/tag-renderer';
import { AlertEditOverlay } from './alert-line-tags/AlertEditOverlay';
import { setupAlertTagInteractions } from './alert-line-tags/alert-tag-interactions';

interface AlertLineTagsProps {
    symbol: string | undefined;
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
    priceChartRef: React.RefObject<import('lightweight-charts').IChartApi | null>;
    isReady: boolean;
}

export const AlertLineTags = memo(function AlertLineTags({ symbol, seriesRef, priceChartRef, isReady }: AlertLineTagsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tagElementsMap = useRef<Map<string, TagElements>>(new Map());

    const { tags } = useAlertTags(symbol);
    const symbolInfo = useMarketStore(state => symbol ? state.symbolInfo[symbol] : undefined);
    const removeAlert = useMarketStore(state => state.removeAlert);
    const updateAlert = useMarketStore(state => state.updateAlert);
    const [overlaySeries, setOverlaySeries] = useState<ISeriesApi<'Candlestick'> | null>(null);
    const [editingState, setEditingState] = useState<{ id: string, ticket: any, type: string, price: number, value: number, x?: number } | null>(null);

    useEffect(() => {
        setOverlaySeries(editingState ? seriesRef.current : null);
    }, [editingState, seriesRef]);

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
                setupAlertTagInteractions(elements, String(tag.ticket), removeAlert);
            }

            updateTagVisuals(elements, tag, symbolInfo, tag.price, null, symbol);
            updateTagPosition(elements, series, tag.price);
        });

        tagElementsMap.current.forEach((el, id) => {
            if (!activeIds.has(id)) {
                el.el.remove();
                tagElementsMap.current.delete(id);
            }
        });
    }, [tags, symbolInfo, seriesRef, symbol, removeAlert]);

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
                    if (td && seriesRef.current) updateTagPosition(cached, seriesRef.current, td.price);
                });
            });
        };

        const timescale = priceChart.timeScale();
        timescale.subscribeVisibleLogicalRangeChange(sync);
        timescale.subscribeVisibleTimeRangeChange(sync);
        window.addEventListener('scroll', sync, { passive: true });

        const unsubDrag = useMarketStore.subscribe(
            state => state.draggingPosition,
            (drag) => {
                if (!drag || drag.type !== 'alert') return;
                const s = seriesRef.current;
                if (!s) return;

                const dragKey = String(drag.ticket);
                const elements = tagElementsMap.current.get(dragKey) || tagElementsMap.current.get(`alert-${dragKey}`);
                if (elements) {
                    updateTagPosition(elements, s, drag.price);
                    const digits = symbolInfo?.digits || 2;
                    if (elements.price) elements.price.textContent = drag.price.toFixed(digits);
                    if (!elements.el.classList.contains('dragging')) elements.el.classList.add('dragging');
                }
            }
        );

        const unsubDragEnd = useMarketStore.subscribe(
            state => state.draggingPosition,
            (drag) => {
                if (!drag) {
                    tagElementsMap.current.forEach(el => el.el.classList.remove('dragging'));
                    sync();
                }
            }
        );

        return () => {
            if (syncRafId) cancelAnimationFrame(syncRafId);
            timescale.unsubscribeVisibleLogicalRangeChange(sync);
            timescale.unsubscribeVisibleTimeRangeChange(sync);
            window.removeEventListener('scroll', sync);
            unsubDrag();
            unsubDragEnd();
        };
    }, [isReady, priceChartRef, seriesRef, symbolInfo]);

    const isDeletingRef = useRef(false);
    const editingStateRef = useRef(editingState);
    useEffect(() => {
        editingStateRef.current = editingState;
    }, [editingState]);

    const handleInputFinish = React.useCallback((val: number, save: boolean, sessionId?: string) => {
        const state = editingStateRef.current;
        if (sessionId && state?.id !== sessionId) return;

        if (save && state && !isDeletingRef.current) updateAlert(state.ticket, { price: val });
        setEditingState(null);
    }, [updateAlert]);

    useEffect(() => {
        const handleStartEdit = (e: any) => {
            const { ticket, type, price, x } = e.detail;
            if (type !== 'alert') return;
            isDeletingRef.current = false;
            setEditingState({ id: `${ticket}-${type}-${Date.now()}`, ticket, type, price, value: price, x });
        };
        window.addEventListener('start-tag-edit', handleStartEdit);
        return () => window.removeEventListener('start-tag-edit', handleStartEdit);
    }, []);

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-[5] overflow-hidden touch-none">
            {editingState && overlaySeries && (
                <AlertEditOverlay
                    state={editingState}
                    series={overlaySeries}
                    isDeletingRef={isDeletingRef}
                    onFinish={handleInputFinish}
                />
            )}
        </div>
    );
});
