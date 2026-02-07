import React, { useEffect, useRef } from 'react';
import { useMarketStore } from '@/lib/store';
import { ISeriesApi } from 'lightweight-charts';
import { formatPnL, calculatePnL } from '@/lib/utils/pnl';

interface OrderLineTagsProps {
    symbol: string | undefined;
    series: ISeriesApi<"Candlestick"> | null;
    priceChart: import('lightweight-charts').IChartApi | null;
}

export function OrderLineTags({ symbol, series, priceChart }: OrderLineTagsProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Store values for manual updates
    const stateRef = useRef({
        symbol,
        positions: [] as any[],
        draftOrder: null as any,
        focusedTicket: null as number | null,
        symbolInfo: null as any,
        draggingPosition: null as any
    });

    useEffect(() => {
        const unsub = useMarketStore.subscribe(state => {
            stateRef.current = {
                symbol,
                positions: state.positions.filter(p => p.symbol === symbol),
                draftOrder: state.draftOrder,
                focusedTicket: state.focusedTicket,
                symbolInfo: state.symbolInfo[symbol || ''],
                draggingPosition: state.draggingPosition
            };
        });
        return unsub;
    }, [symbol]);

    const isSyncRequested = useRef(false);

    const tagRefs = useRef<Map<string, HTMLElement>>(new Map());
    const lastRenderedTags = useRef<Set<string>>(new Set());

    const syncDOM = (isPan = false) => {
        if (isSyncRequested.current) return;
        isSyncRequested.current = true;

        requestAnimationFrame(() => {
            isSyncRequested.current = false;
            const container = containerRef.current;
            if (!container || !series || !symbol) return;

            const { positions, draftOrder, focusedTicket, symbolInfo, draggingPosition } = stateRef.current;
            const currentPrice = useMarketStore.getState().tickers[symbol || '']?.price;
            const activeIds = new Set<string>();

            // 1. Generate Target Tags Data
            const tagsToRender: any[] = [];
            if (draftOrder && draftOrder.symbol === symbol) {
                ['entry', 'sl', 'tp'].forEach(type => {
                    const price = (draftOrder as any)[type];
                    if (price > 0) {
                        tagsToRender.push({
                            id: `draft-${type}`,
                            type: `draft_${type}`,
                            ticket: 'draft',
                            price,
                            label: type === 'entry' ? `NEW ${draftOrder.type.toUpperCase()}` : `${type.toUpperCase()} (DRAFT)`,
                            color: type === 'entry' ? '#3b82f6' : (type === 'sl' ? '#ef5350' : '#26a69a')
                        });
                    }
                });
            } else {
                const activePos = focusedTicket ? positions.filter(p => p.ticket === focusedTicket) : positions;
                activePos.forEach(p => {
                    const lines = [
                        { type: 'entry', price: p.open_price, color: p.profit >= 0 ? '#22c55e' : '#71717a', label: `${p.type.toUpperCase()} ${p.volume}` },
                        { type: 'sl', price: p.sl, color: '#ef5350', label: 'SL' },
                        { type: 'tp', price: p.tp, color: '#26a69a', label: 'TP' },
                    ];
                    lines.forEach(line => {
                        if (line.price > 0) {
                            tagsToRender.push({
                                id: `${p.ticket}-${line.type}`,
                                type: line.type,
                                ticket: p.ticket,
                                price: line.price,
                                label: line.label,
                                color: line.color,
                                pOriginal: p
                            });
                        }
                    });
                });
            }

            // 2. Diff & Update DOM
            const digits = symbolInfo?.digits || 2;

            tagsToRender.forEach(tagData => {
                const id = tagData.id;
                activeIds.add(id);
                let el = tagRefs.current.get(id);

                if (!el) {
                    el = document.createElement('div');
                    el.className = "absolute right-0 flex items-center transition-transform duration-75 touch-none select-none cursor-grab active:cursor-grabbing z-20 hover:brightness-110";
                    el.style.pointerEvents = 'auto';
                    el.setAttribute('data-id', id);
                    el.onclick = (e) => {
                        e.stopPropagation();
                        if (tagData.ticket !== 'draft') {
                            const currentFocus = useMarketStore.getState().focusedTicket;
                            useMarketStore.getState().setFocusedTicket(currentFocus === tagData.ticket ? null : tagData.ticket);
                        }
                    };
                    el.innerHTML = `
                        <div class="tag-body flex items-center h-6 px-2 rounded-l-md shadow-lg border border-r-0 backdrop-blur-sm bg-black/40">
                            <span class="tag-label text-[10px] font-bold text-white mr-2 whitespace-nowrap"></span>
                            <span class="pnl-text text-[10px] font-medium px-1 rounded bg-black/20"></span>
                        </div>
                        <div class="price-box h-6 flex items-center px-1.5 bg-black text-white text-[10px] font-bold border border-zinc-700 min-w-[70px] justify-center">
                            <span class="price-text"></span>
                        </div>
                    `;
                    container.appendChild(el);
                    tagRefs.current.set(id, el);
                }

                // Update Y position (Always do this on pan)
                const y = series.priceToCoordinate(tagData.price);
                if (y !== null) {
                    el.style.transform = `translateY(${y - 12}px)`;
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }

                // If it's just a pan event, we can skip updating the content (PnL, text) if nothing changed
                if (isPan && lastRenderedTags.current.has(id)) return;

                const labelSpan = el.querySelector('.tag-label') as HTMLElement;
                let displayText = tagData.label;
                if (tagData.ticket === 'draft') {
                    const isSL = tagData.type.includes('sl');
                    const isTP = tagData.type.includes('tp');
                    const isTouched = isSL ? draftOrder?.slTouched : (isTP ? draftOrder?.tpTouched : true);
                    el.style.opacity = isTouched ? '1' : '0.4';
                    if (!isTouched) displayText += ' (OFF)';
                } else {
                    el.style.opacity = '1';
                }
                if (labelSpan.textContent !== displayText) labelSpan.textContent = displayText;

                const priceText = el.querySelector('.price-text') as HTMLElement;
                const formattedPrice = tagData.price.toFixed(digits);
                if (priceText.textContent !== formattedPrice) priceText.textContent = formattedPrice;

                const priceBox = el.querySelector('.price-box') as HTMLElement;
                if (priceBox.style.backgroundColor !== tagData.color) priceBox.style.backgroundColor = tagData.color;

                const pnlText = el.querySelector('.pnl-text') as HTMLElement;
                if (tagData.ticket !== 'draft' && tagData.pOriginal) {
                    const p = tagData.pOriginal;
                    const isDragging = draggingPosition?.ticket === tagData.ticket && draggingPosition.type === tagData.type;
                    const linePrice = isDragging ? draggingPosition.price : tagData.price;
                    const pnl = (tagData.type === 'entry')
                        ? (p.profit ?? calculatePnL({ type: p.type, openPrice: p.open_price, currentPrice: currentPrice || p.open_price, volume: p.volume, symbolInfo, symbol: p.symbol }))
                        : calculatePnL({ type: p.type, openPrice: p.open_price, currentPrice: linePrice, volume: p.volume, symbolInfo, symbol: p.symbol });

                    const pnlContent = formatPnL(pnl);
                    if (pnlText.textContent !== pnlContent) {
                        pnlText.textContent = pnlContent;
                        pnlText.className = `pnl-text text-[10px] font-medium px-1 rounded bg-black/20 ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`;
                    }
                    pnlText.style.display = 'inline';
                } else {
                    pnlText.style.display = 'none';
                }
            });

            // Cleanup removed tags
            lastRenderedTags.current.forEach(id => {
                if (!activeIds.has(id)) {
                    const el = tagRefs.current.get(id);
                    if (el) {
                        el.remove();
                        tagRefs.current.delete(id);
                    }
                }
            });
            lastRenderedTags.current = activeIds;
        });
    };

    useEffect(() => {
        if (!priceChart || !series) return;

        const timescale = priceChart.timeScale();
        const onChartMove = () => syncDOM(true);

        timescale.subscribeVisibleLogicalRangeChange(onChartMove);
        timescale.subscribeVisibleTimeRangeChange(onChartMove);

        const unsub = useMarketStore.subscribe(
            state => [state.tickers[symbol || '']?.price, state.positions, state.draftOrder, state.focusedTicket, state.draggingPosition],
            () => syncDOM(false)
        );

        syncDOM(false);

        return () => {
            timescale.unsubscribeVisibleLogicalRangeChange(onChartMove);
            timescale.unsubscribeVisibleTimeRangeChange(onChartMove);
            unsub();
        };
    }, [symbol, series, priceChart]);

    return <div ref={containerRef} className="absolute inset-0 pointer-events-none z-20 overflow-hidden" />;
}
