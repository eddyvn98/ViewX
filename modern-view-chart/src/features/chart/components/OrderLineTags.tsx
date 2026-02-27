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
import { dispatchTagRemoveAction } from '../logic/tag-command-dispatcher';
import { TagData } from '../logic/order-tag-utils';
import { OrderTagEditOverlay } from './OrderTagEditOverlay';

interface OrderLineTagsProps {
    symbol: string | undefined;
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
    priceChartRef: React.RefObject<import('lightweight-charts').IChartApi | null>;
    isReady: boolean;
    sendMessage?: (data: any) => void;
    source?: string;
    interval?: string;
}

function setupDraftGroupInteractions(elements: TagElements) {
    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
        (e as PointerEvent).stopPropagation();
        (e as PointerEvent).preventDefault();
        useMarketStore.getState().setDraftOrder(null);
    });

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
}

function setupDraftTagInteractions(elements: TagElements, tag: TagData) {
    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
        (e as PointerEvent).stopPropagation();
        (e as PointerEvent).preventDefault();
        const { draftOrder, setDraftOrder } = useMarketStore.getState();
        if (!draftOrder) return;

        const field = tag.type.includes('sl') ? 'sl' : 'tp';
        setDraftOrder({ ...draftOrder, [field]: 0, [`${field}Touched`]: false });
    });

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
}

function setupRealTagInteractions(elements: TagElements, tag: TagData, sendMessage?: (data: any) => void) {
    elements.el.querySelector('.cancel-btn')?.addEventListener('pointerdown', (e) => {
        dispatchTagRemoveAction({ ticket: tag.ticket, type: tag.type }, sendMessage);
        (e as PointerEvent).stopPropagation();
        (e as PointerEvent).preventDefault();
    });
}

function setupTagInteractions(elements: TagElements, tag: TagData, sendMessage?: (data: any) => void) {
    if (tag.type === 'draft_group') {
        setupDraftGroupInteractions(elements);
        return;
    }

    if (tag.ticket === 'draft') {
        setupDraftTagInteractions(elements, tag);
        return;
    }

    setupRealTagInteractions(elements, tag, sendMessage);
}

export const OrderLineTags = memo(function OrderLineTags({ symbol, seriesRef, priceChartRef, isReady, sendMessage, source, interval }: OrderLineTagsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tagElementsMap = useRef<Map<string, TagElements>>(new Map());

    const { tags, currentPrice, symbolInfo, draftOrder } = useOrderTags(symbol);
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
                updateTagPosition(elements, series, tag.price, priceChartRef.current, tag, latestCandleTime);
            }
        );
    }, [tags, currentPrice, symbolInfo, draftOrder, seriesRef, symbol, sendMessage, latestCandleTime, priceChartRef]);

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
                        updateTagPosition(cached, seriesRef.current, td.price, priceChartRef.current, td, latestCandleTime);
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
    }, [isReady, priceChartRef, seriesRef, latestCandleTime]);

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
