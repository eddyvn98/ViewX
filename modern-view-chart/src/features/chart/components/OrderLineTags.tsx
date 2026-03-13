/* eslint-disable react-hooks/refs */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useLayoutEffect, useRef, memo } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { useOrderTags } from '../hooks/use-order-tags';
import { useTagEditSession } from '../hooks/use-tag-edit-session';
import { createTagElement, updateTagVisuals, updateTagPosition, TagElements } from '../logic/tag-renderer';
import { syncTagElements } from '../logic/tag-dom-registry';
import { OrderTagEditOverlay } from './OrderTagEditOverlay';
import { setupTagInteractions } from './order-line-tags/tag-interactions';
import { applyTagCaptionDeclutter } from './order-line-tags/tag-priority';

interface OrderLineTagsProps {
    symbol: string | undefined;
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
    priceChartRef: React.RefObject<import('lightweight-charts').IChartApi | null>;
    isReady: boolean;
    sendMessage?: (data: any) => void;
    source?: string;
    interval?: string;
}

export const OrderLineTags = memo(function OrderLineTags({ symbol, seriesRef, priceChartRef, isReady, sendMessage, source, interval }: OrderLineTagsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tagElementsMap = useRef<Map<string, TagElements>>(new Map());
    const dragVisualRafRef = useRef<number | null>(null);
    const latestCandleTimeRef = useRef<number | undefined>(undefined);
    const focusedTicketRef = useRef<number | null>(null);
    const hoveredTicketRef = useRef<number | null>(null);
    const focusedTicket = useMarketStore((state) => state.focusedTicket);
    const hoveredTicket = useMarketStore((state) => state.hoveredTicket);

    const { tags, currentPrice, symbolInfo, draftOrder } = useOrderTags(symbol);
    const symbolInfoRef = useRef(symbolInfo);
    const latestCandleTime = useMarketStore(state => {
        if (!symbol || !source || !interval) return undefined;
        const key = `${source}:${normalizeSymbol(symbol)}:${interval}`;
        const candles = state.candleData[key];
        if (!candles || candles.length === 0) return undefined;
        const t = (candles[candles.length - 1] as any).time;
        return typeof t === 'object' ? (t as any).timestamp : Number(t);
    });
    const { editingState, isDeletingRef, handleInputFinish } = useTagEditSession({ sendMessage });

    useEffect(() => {
        latestCandleTimeRef.current = latestCandleTime;
    }, [latestCandleTime]);

    useEffect(() => {
        focusedTicketRef.current = focusedTicket;
    }, [focusedTicket]);

    useEffect(() => {
        hoveredTicketRef.current = hoveredTicket;
    }, [hoveredTicket]);

    useEffect(() => {
        symbolInfoRef.current = symbolInfo;
    }, [symbolInfo]);

    useEffect(() => {
        const container = containerRef.current;
        const series = seriesRef.current;
        if (!container || !series || !symbol) return;

        syncTagElements(
            container,
            tags,
            tagElementsMap.current,
            createTagElement,
            (elements, tag) => setupTagInteractions(elements, tag, sendMessage),
            (elements, tag) => {
                updateTagVisuals(elements, tag, symbolInfo, currentPrice, draftOrder, symbol);
                updateTagPosition(elements, series, tag.price, priceChartRef.current, tag, latestCandleTimeRef.current);
            }
        );
        applyTagCaptionDeclutter(tagElementsMap.current, focusedTicket, hoveredTicket);
    }, [tags, currentPrice, symbolInfo, draftOrder, seriesRef, symbol, sendMessage, priceChartRef, focusedTicket, hoveredTicket]);

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
                        updateTagPosition(cached, seriesRef.current, td.price, priceChartRef.current, td, latestCandleTimeRef.current);
                    }
                });
                applyTagCaptionDeclutter(tagElementsMap.current, focusedTicketRef.current, hoveredTicketRef.current);
            });
        };

        const timescale = priceChart.timeScale();
        timescale.subscribeVisibleLogicalRangeChange(sync);
        timescale.subscribeVisibleTimeRangeChange(sync);
        window.addEventListener('scroll', sync, { passive: true });

        return () => {
            if (syncRafId) cancelAnimationFrame(syncRafId);
            timescale.unsubscribeVisibleLogicalRangeChange(sync);
            timescale.unsubscribeVisibleTimeRangeChange(sync);
            window.removeEventListener('scroll', sync);
        };
    }, [isReady, priceChartRef, seriesRef]);

    useEffect(() => {
        const unsub = useMarketStore.subscribe(
            s => s.draggingPosition,
            (drag) => {
                if (dragVisualRafRef.current) cancelAnimationFrame(dragVisualRafRef.current);
                dragVisualRafRef.current = requestAnimationFrame(() => {
                    dragVisualRafRef.current = null;
                    if (!drag) return;

                    const tagId = `${drag.ticket}-${drag.type}`;
                    const cached = tagElementsMap.current.get(tagId);
                    const series = seriesRef.current;
                    if (!cached || !series) return;

                    const nextTag = {
                        ...(cached.el as any)._tagData,
                        price: drag.price,
                    };
                    (cached.el as any)._tagData = nextTag;
                    updateTagPosition(cached, series, drag.price, priceChartRef.current, nextTag, latestCandleTimeRef.current);

                    const priceText = cached.el.querySelector('.price-text');
                    if (priceText instanceof HTMLElement) {
                        const digits = Math.max(0, symbolInfoRef.current?.digits ?? 2);
                        priceText.textContent = Number(drag.price).toFixed(digits);
                    }
                });
            }
        );

        return () => {
            if (dragVisualRafRef.current) {
                cancelAnimationFrame(dragVisualRafRef.current);
                dragVisualRafRef.current = null;
            }
            unsub();
        };
    }, [priceChartRef, seriesRef]);

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-[5] overflow-hidden touch-none">
            {editingState && seriesRef.current && (
                <OrderTagEditOverlay
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
