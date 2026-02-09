import React, { useEffect, useRef, useState, memo } from 'react';
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
}

export const OrderLineTags = memo(function OrderLineTags({ symbol, seriesRef, priceChartRef, isReady, sendMessage }: OrderLineTagsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tagElementsMap = useRef<Map<string, TagElements>>(new Map());

    // ⚡ Hook: Centralized State Management for Tags
    const { tags, currentPrice, symbolInfo, draftOrder } = useOrderTags(symbol);
    const [editingState, setEditingState] = useState<{ id: string, ticket: any, type: string, price: number } | null>(null);

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
            }

            // Update Visuals (PnL, Color, Label)
            updateTagVisuals(elements, tag, symbolInfo, currentPrice, draftOrder, symbol);

            // Update Position (Y-Axis)
            // Note: If dragging, the hook usually provides the dragged price in tag.price
            updateTagPosition(elements, series, tag.price);
        });

        // Cleanup Stale Elements
        tagElementsMap.current.forEach((el, id) => {
            if (!activeIds.has(id)) {
                el.el.remove();
                tagElementsMap.current.delete(id);
            }
        });

    }, [tags, currentPrice, symbolInfo, draftOrder, seriesRef, symbol]);

    // 2. Sync Positions on Chart Interaction (Scroll/Zoom/Crosshair)
    useEffect(() => {
        const priceChart = priceChartRef.current;
        const series = seriesRef.current;
        if (!isReady || !priceChart || !series) return;

        let syncRafId: number | null = null;
        const sync = () => {
            if (syncRafId) return;
            syncRafId = requestAnimationFrame(() => {
                syncRafId = null;
                tagElementsMap.current.forEach((cached) => {
                    // We use the price stored on the element data, or fetch from hook if we had access.
                    // Since we don't have direct access to 'tags' in this closure without re-binding,
                    // we rely on the fact that updateTagVisuals stores _tagData on the element.
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

        // Global Sync for Panning/Scaling
        window.addEventListener('mousemove', sync);

        return () => {
            if (syncRafId) cancelAnimationFrame(syncRafId);
            timescale.unsubscribeVisibleLogicalRangeChange(sync);
            timescale.unsubscribeVisibleTimeRangeChange(sync);
            priceChart.unsubscribeCrosshairMove(sync);
            window.removeEventListener('mousemove', sync);
        };
    }, [isReady, priceChartRef, seriesRef]);

    // 3. Inline Editing Logic
    const handleInputFinish = (val: number, save: boolean) => {
        if (save && editingState) {
            const { ticket, type } = editingState;
            if (ticket === 'draft') {
                if (!draftOrder) return;
                const f = type.replace('draft_', '');
                useMarketStore.getState().setDraftOrder({ ...draftOrder, [f === 'entry' ? 'price' : f]: val });
            } else {
                const mappedType = type === 'entry' ? 'price' : type;
                const command = { topic: 'mt5_command', command: 'modify', ticket, [mappedType]: val };
                if (sendMessage) sendMessage(command);
            }
        }
        setEditingState(null);
    };

    useEffect(() => {
        const handleStartEdit = (e: any) => {
            const { ticket, type, price } = e.detail;
            setEditingState({ id: `${ticket}-${type}`, ticket, type, price });
        };
        window.addEventListener('start-tag-edit', handleStartEdit);
        return () => window.removeEventListener('start-tag-edit', handleStartEdit);
    }, []);


    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            {editingState && isReady && seriesRef.current && (
                <div
                    className="absolute right-0 z-[110] flex items-center"
                    style={{
                        transform: `translateY(${(seriesRef.current.priceToCoordinate(editingState.price) || 0) - 12}px)`,
                        pointerEvents: 'auto'
                    }}
                >
                    <div className="h-6 w-[75px] bg-black border border-blue-500 shadow-2xl overflow-hidden">
                        <input
                            autoFocus
                            type="number"
                            step="any"
                            defaultValue={editingState.price}
                            className="w-full h-full bg-transparent text-white text-[10px] font-mono text-center outline-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleInputFinish(parseFloat((e.target as HTMLInputElement).value), true);
                                if (e.key === 'Escape') handleInputFinish(0, false);
                            }}
                            onBlur={(e) => handleInputFinish(parseFloat(e.target.value), true)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});
