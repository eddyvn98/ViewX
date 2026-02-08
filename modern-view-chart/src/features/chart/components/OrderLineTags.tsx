import React, { useEffect, useRef, useState, memo } from 'react';
import { useMarketStore, Position, Order } from '@/lib/store';
import { ISeriesApi } from 'lightweight-charts';
import { formatPnL, calculatePnL } from '@/lib/utils/pnl';

interface OrderLineTagsProps {
    symbol: string | undefined;
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
    priceChartRef: React.RefObject<import('lightweight-charts').IChartApi | null>;
    isReady: boolean;
    sendMessage?: (data: any) => void;
}

interface TagElements {
    el: HTMLElement;
    label: HTMLElement;
    pnl: HTMLElement;
    price: HTMLElement;
    priceBox: HTMLElement;
}

export const OrderLineTags = memo(function OrderLineTags({ symbol, seriesRef, priceChartRef, isReady, sendMessage }: OrderLineTagsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [editingState, setEditingState] = useState<{ id: string, ticket: any, type: string, price: number } | null>(null);

    const stateRef = useRef({
        symbol,
        positions: [] as Position[],
        orders: [] as Order[],
        draftOrder: null as any,
        focusedTicket: null as number | null,
        symbolInfo: null as any,
        draggingPosition: null as any,
        currentPrice: 0
    });

    const norm = (sym: string | undefined) => (sym || '').toUpperCase().replace('.M', '').replace('.H', '');
    const targetSymbol = norm(symbol);

    const tagElementsMap = useRef<Map<string, TagElements>>(new Map());
    const isSyncScheduled = useRef(false);

    const hotUpdateTag = (id: string, price: number) => {
        const cached = tagElementsMap.current.get(id);
        const series = seriesRef.current;
        if (!cached || !series) return;
        const y = series.priceToCoordinate(price);
        if (y === null) return;

        cached.el.style.transform = `translateY(${y - 12}px)`;

        const digits = stateRef.current.symbolInfo?.digits || 2;
        const pStr = price.toFixed(digits);
        if (cached.price.textContent !== pStr) cached.price.textContent = pStr;

        const tagData = (cached.el as any)._tagData;
        if (tagData && (tagData.pOriginal || tagData.ticket === 'draft')) {
            const s = stateRef.current;
            let pnlVal = 0;
            const isBuy = tagData.pOriginal?.type?.toLowerCase()?.includes('buy') ?? s.draftOrder?.type === 'buy';
            const op = tagData.pOriginal ? (('open_price' in tagData.pOriginal) ? tagData.pOriginal.open_price : tagData.pOriginal.price_open) : (s.draftOrder?.price || s.currentPrice);

            pnlVal = (tagData.type === 'entry' || tagData.type === 'draft_entry')
                ? calculatePnL({ type: isBuy ? 'buy' : 'sell', openPrice: op, currentPrice: s.currentPrice, volume: tagData.pOriginal?.volume || s.draftOrder?.volume || 0, symbolInfo: s.symbolInfo, symbol: s.symbol })
                : calculatePnL({ type: isBuy ? 'buy' : 'sell', openPrice: op, currentPrice: price, volume: tagData.pOriginal?.volume || s.draftOrder?.volume || 0, symbolInfo: s.symbolInfo, symbol: s.symbol });

            const pStrFormatted = formatPnL(pnlVal);
            if (cached.pnl.textContent !== pStrFormatted) {
                cached.pnl.textContent = pStrFormatted;
                cached.pnl.className = `pnl-text text-[10px] font-bold px-1 rounded bg-black/40 ${pnlVal >= 0 ? 'text-green-400' : 'text-red-400'}`;
            }
        }
    };

    useEffect(() => {
        if (!symbol) return;
        const unsub = useMarketStore.subscribe(
            state => [
                state.positions.length,
                state.orders.length,
                state.draftOrder,
                state.focusedTicket,
                // 🚀 Monitor ANY price change for sync (Fixes snap-back)
                state.positions.filter(p => norm(p.symbol) === norm(symbol)).map(p => `${p.ticket}:${p.sl}:${p.tp}:${p.open_price}`).join('|'),
                state.orders.filter(o => norm(o.symbol) === norm(symbol)).map(o => `${o.ticket}:${o.sl}:${o.tp}:${o.price_open}`).join('|')
            ],
            () => syncStructure()
        );
        return unsub;
    }, [symbol]);

    useEffect(() => {
        if (!symbol) return;
        const unsub = useMarketStore.subscribe(
            state => [
                state.tickers[symbol]?.price,
                state.symbolInfo[symbol],
            ] as const,
            ([price, info]) => {
                const s = stateRef.current;
                s.currentPrice = price as number || s.currentPrice;
                s.symbolInfo = info as any;

                // Update entry tags on price change (non-dragging)
                if (price) {
                    requestAnimationFrame(() => {
                        tagElementsMap.current.forEach((cached, id) => {
                            const td = (cached.el as any)._tagData;
                            if (td && (td.type === 'entry' || td.type === 'draft_entry')) hotUpdateTag(id, td.price);
                        });
                    });
                }
            }
        );
        return unsub;
    }, [symbol]);

    useEffect(() => {
        const handleStartEdit = (e: any) => {
            const { ticket, type, price } = e.detail;
            const isEntryOfActivePos = stateRef.current.positions.some(p => p.ticket === ticket && type === 'entry');
            if (!isEntryOfActivePos) setEditingState({ id: `${ticket}-${type}`, ticket, type, price });
        };
        window.addEventListener('start-tag-edit', handleStartEdit);
        return () => window.removeEventListener('start-tag-edit', handleStartEdit);
    }, []);

    const syncStructure = () => {
        if (isSyncScheduled.current) return;
        isSyncScheduled.current = true;

        requestAnimationFrame(() => {
            isSyncScheduled.current = false;
            const container = containerRef.current;
            const series = seriesRef.current;
            if (!container || !series || !symbol) return;

            const s = useMarketStore.getState();

            const pos = s.positions.filter(p => norm(p.symbol) === targetSymbol);
            const ord = s.orders.filter(o => norm(o.symbol) === targetSymbol);
            const focusedTicket = s.focusedTicket;
            const dr = s.draftOrder;

            // Update local state for calculations
            stateRef.current.positions = pos;
            stateRef.current.orders = ord;
            stateRef.current.draftOrder = dr;

            const activeIds = new Set<string>();
            const tagsToRender: any[] = [];

            // 1. Draft tags
            if (dr && norm(dr.symbol) === targetSymbol && !focusedTicket) {
                const entryVal = dr.isMarket ? (stateRef.current.currentPrice || dr.price || 0) : (dr.price || stateRef.current.currentPrice || 0);

                [{ t: 'entry', v: entryVal, c: '#3b82f6' }, { t: 'sl', v: dr.sl, c: '#ef4444' }, { t: 'tp', v: dr.tp, c: '#22c55e' }].forEach(l => {
                    if (l.v && l.v > 0) {
                        tagsToRender.push({ id: `draft-${l.t}`, type: `draft_${l.t}`, ticket: 'draft', price: l.v, label: l.t.toUpperCase(), color: l.c });
                    }
                });
            }

            // 2. Real tags
            const dragging = s.draggingPosition;
            const hasActiveDraft = dr && norm(dr.symbol) === targetSymbol;
            if (!hasActiveDraft) {
                const itemsToProcess = focusedTicket
                    ? [...s.positions.filter(p => p.ticket === focusedTicket), ...s.orders.filter(o => o.ticket === focusedTicket)]
                    : [...pos, ...ord];

                itemsToProcess.forEach(item => {
                    const isPos = 'open_price' in item;
                    const entryP = isPos ? (item as Position).open_price : (item as Order).price_open;

                    [{ t: 'entry', v: entryP, lb: isPos ? 'POS' : 'ORD', c: isPos ? (item.profit >= 0 ? '#22c55e' : '#71717a') : '#FF9800' },
                    { t: 'sl', v: item.sl, lb: 'SL', c: '#ef4444' },
                    { t: 'tp', v: item.tp, lb: 'TP', c: '#22c55e' }].forEach(l => {
                        let finalVal = l.v;
                        if (dragging && dragging.ticket === item.ticket && dragging.type === l.t) {
                            finalVal = dragging.price;
                        }

                        if (finalVal && finalVal > 0) {
                            tagsToRender.push({ id: `${item.ticket}-${l.t}`, type: l.t, ticket: item.ticket, price: finalVal, label: l.lb, color: l.c, pOriginal: item });
                        }
                    });
                });
            }

            // Render and sync
            tagsToRender.forEach(tag => {
                activeIds.add(tag.id);
                let cached = tagElementsMap.current.get(tag.id);
                if (!cached) {
                    const el = document.createElement('div');
                    el.className = "absolute right-0 flex items-center pointer-events-none z-[100] group";
                    el.setAttribute('data-tag-id', tag.id);
                    el.innerHTML = `
                        <div class="tag-body flex items-center h-6 px-2 rounded-l-md shadow-2xl border border-white/10 backdrop-blur-md bg-black/60">
                            <span class="tag-label text-[10px] font-black text-white mr-2 uppercase"></span>
                            <span class="pnl-text text-[10px] font-bold px-1 rounded bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                        </div>
                        <div class="price-box h-6 flex items-center px-1.5 bg-black text-white text-[10px] font-bold border border-white/20 min-w-[75px] justify-center">
                            <span class="price-text font-mono"></span>
                        </div>`;
                    cached = { el, label: el.querySelector('.tag-label') as HTMLElement, pnl: el.querySelector('.pnl-text') as HTMLElement, price: el.querySelector('.price-text') as HTMLElement, priceBox: el.querySelector('.price-box') as HTMLElement };
                    container.appendChild(el);
                    tagElementsMap.current.set(tag.id, cached);
                }

                (cached.el as any)._tagData = tag;
                cached.label.textContent = tag.label;
                cached.priceBox.style.backgroundColor = tag.color;
                hotUpdateTag(tag.id, tag.price);
            });

            // Cleanup
            tagElementsMap.current.forEach((cached, id) => {
                if (!activeIds.has(id)) {
                    cached.el.remove();
                    tagElementsMap.current.delete(id);
                }
            });
        });
    };

    const handleInputFinish = (val: number, save: boolean) => {
        if (save && editingState) {
            const { ticket, type } = editingState;
            if (ticket === 'draft') {
                const f = type.replace('draft_', '');
                useMarketStore.getState().setDraftOrder({ ...stateRef.current.draftOrder, [f === 'entry' ? 'price' : f]: val });
            } else {
                const mappedType = type === 'entry' ? 'price' : type;
                const command = { topic: 'mt5_command', command: 'modify', ticket, [mappedType]: val };
                if (sendMessage) sendMessage(command);
            }
        }
        setEditingState(null);
    };

    useEffect(() => {
        const series = seriesRef.current;
        const priceChart = priceChartRef.current;
        if (!isReady || !priceChart || !series) return;

        let syncRafId: number | null = null;
        const sync = () => {
            if (syncRafId) return;
            syncRafId = requestAnimationFrame(() => {
                syncRafId = null;
                tagElementsMap.current.forEach((cached, id) => {
                    const td = (cached.el as any)._tagData;
                    if (td && seriesRef.current) {
                        const y = seriesRef.current.priceToCoordinate(td.price);
                        if (y !== null) {
                            cached.el.style.transform = `translateY(${y - 12}px)`;
                        }
                    }
                });
            });
        };

        const timescale = priceChart.timeScale();

        // Standard LWC events
        timescale.subscribeVisibleLogicalRangeChange(sync);
        timescale.subscribeVisibleTimeRangeChange(sync);
        priceChart.subscribeCrosshairMove(sync);

        // 🚀 ULTIMATE SYNC: Monitor ANY chart movement (Panning, Price Scale Scaling)
        let isInteracting = false;
        const startSync = () => { isInteracting = true; tick(); };
        const stopSync = () => { isInteracting = false; };

        const tick = () => {
            if (!isInteracting) return;
            sync();
            requestAnimationFrame(tick);
        };

        const chartContainer = priceChart.chartElement();
        // 🚀 CAPTURE ALL INTERACTION: Use window listener to ensure we catch price scale dragging
        window.addEventListener('mousedown', startSync, true);
        window.addEventListener('mouseup', stopSync);
        window.addEventListener('mousemove', sync); // 🚀 Ultimate global sync on any mouse move

        syncStructure();

        return () => {
            if (syncRafId) cancelAnimationFrame(syncRafId);
            isInteracting = false;
            window.removeEventListener('mousedown', startSync, true);
            window.removeEventListener('mouseup', stopSync);
            window.removeEventListener('mousemove', sync);
            timescale.unsubscribeVisibleLogicalRangeChange(sync);
            timescale.unsubscribeVisibleTimeRangeChange(sync);
            priceChart.unsubscribeCrosshairMove(sync);
        };
    }, [isReady, symbol, seriesRef, priceChartRef]);

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
