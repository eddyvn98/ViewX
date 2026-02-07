import React, { useEffect, useRef } from 'react';
import { useMarketStore } from '@/lib/store';
import { ISeriesApi } from 'lightweight-charts';
import { cn } from '@/lib/utils';
import { formatPnL, calculatePnL } from '@/lib/utils/pnl';
import { useWebSocket } from '@/hooks/use-websocket';

interface OrderLineTagsProps {
    symbol: string | undefined;
    series: ISeriesApi<"Candlestick"> | null;
    priceChart: import('lightweight-charts').IChartApi | null;
}

export function OrderLineTags({ symbol, series, priceChart }: OrderLineTagsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { sendMessage } = useWebSocket();

    // Store values for manual updates
    const stateRef = useRef({
        symbol,
        positions: [] as any[],
        draftOrder: null as any,
        focusedTicket: null as number | null,
        symbolInfo: null as any,
        draggingPosition: null as any
    });

    // Update refs whenever terminal/market state changes
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

    // INTERNAL: Manual DOM Update Function
    const syncDOM = () => {
        if (!containerRef.current || !series || !symbol) return;
        const { positions, draftOrder, focusedTicket, symbolInfo, draggingPosition } = stateRef.current;
        const currentPrice = useMarketStore.getState().tickers[symbol || '']?.price;

        const container = containerRef.current;
        const existingTags = Array.from(container.children) as HTMLElement[];
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
                    { type: 'entry', price: p.open_price, color: '#22c55e', label: `${p.type.toUpperCase()} ${p.volume}` },
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
        tagsToRender.forEach(tagData => {
            const id = tagData.id;
            activeIds.add(id);
            let el = container.querySelector(`[data-id="${id}"]`) as HTMLElement;

            // Create if not exists
            if (!el) {
                el = document.createElement('div');
                el.setAttribute('data-id', id);
                el.setAttribute('data-tag-type', tagData.type);
                el.setAttribute('data-tag-ticket', tagData.ticket.toString());
                el.className = "absolute right-0 flex items-center transition-transform duration-75 touch-none select-none cursor-grab active:cursor-grabbing z-20 hover:brightness-125";

                // Set fixed pointer events and click for focus
                el.style.pointerEvents = 'auto';
                el.onclick = (e) => {
                    e.stopPropagation();
                    if (tagData.ticket !== 'draft') {
                        const currentFocus = useMarketStore.getState().focusedTicket;
                        useMarketStore.getState().setFocusedTicket(currentFocus === tagData.ticket ? null : tagData.ticket);
                    }
                };

                el.innerHTML = `
                    <div class="tag-body flex items-center h-6 px-2 rounded-l-md shadow-lg border border-r-0 backdrop-blur-sm">
                        <span class="tag-label text-[10px] font-bold text-white mr-2 whitespace-nowrap">${tagData.label}</span>
                        <span class="pnl-text text-[10px] font-medium px-1 rounded bg-black/20"></span>
                    </div>
                    <div class="price-box h-6 flex items-center px-1.5 bg-black text-white text-[10px] font-bold border border-zinc-700 min-w-[70px] justify-center cursor-text">
                        <span class="price-text"></span>
                    </div>
                `;
                container.appendChild(el);
            }

            // Update Dynamic Styles
            const labelSpan = el.querySelector('.tag-label') as HTMLElement;
            if (labelSpan) labelSpan.textContent = tagData.label;

            const y = series.priceToCoordinate(tagData.price);
            if (y !== null) {
                el.style.transform = `translateY(${y - 12}px)`;
                el.style.display = 'flex';
            } else {
                el.style.display = 'none';
            }

            const isDragging = draggingPosition?.ticket === tagData.ticket && draggingPosition.type === tagData.type;
            el.classList.toggle('z-30', !!isDragging);
            el.classList.toggle('scale-105', !!isDragging);
            el.classList.toggle('brightness-125', focusedTicket === tagData.ticket);

            const priceBox = el.querySelector('.price-box') as HTMLElement;
            priceBox.style.backgroundColor = tagData.color;

            const priceText = el.querySelector('.price-text') as HTMLElement;
            const digits = symbolInfo?.digits || 2;
            priceText.textContent = tagData.price.toFixed(digits);

            // Calculate PnL
            const pnlText = el.querySelector('.pnl-text') as HTMLElement;
            if (tagData.ticket !== 'draft' && tagData.pOriginal) {
                const p = tagData.pOriginal;
                const linePrice = (isDragging) ? draggingPosition.price : tagData.price;
                const pnl = (tagData.type === 'entry')
                    ? (p.profit !== undefined ? p.profit : calculatePnL({ type: p.type, openPrice: p.open_price, currentPrice: currentPrice || p.open_price, volume: p.volume, symbolInfo, symbol: p.symbol }))
                    : calculatePnL({ type: p.type, openPrice: p.open_price, currentPrice: linePrice, volume: p.volume, symbolInfo, symbol: p.symbol });

                pnlText.textContent = formatPnL(pnl);
                pnlText.className = `pnl-text text-[10px] font-medium px-1 rounded bg-black/20 ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`;
                pnlText.style.display = 'inline';
            } else {
                pnlText.style.display = 'none';
            }
        });

        // 3. Remove Obsolete Tags
        existingTags.forEach(el => {
            const id = el.getAttribute('data-id');
            if (id && !activeIds.has(id)) {
                el.remove();
            }
        });
    };

    // EFFECT: Orchestrate updates without React rendering
    useEffect(() => {
        if (!priceChart || !series) return;

        // Subscriptions
        const timescale = priceChart.timeScale();
        const onChartMove = () => syncDOM();
        timescale.subscribeVisibleLogicalRangeChange(onChartMove);

        // Price Tick Subscription (Transient)
        const unsub = useMarketStore.subscribe(
            (state) => state.tickers[symbol || '']?.price,
            () => syncDOM()
        );

        // Terminal State Subscription (Positions, Draft, Focus)
        const unsubTerminal = useMarketStore.subscribe(
            (state) => [state.positions, state.draftOrder, state.focusedTicket, state.draggingPosition],
            () => syncDOM()
        );

        syncDOM(); // Initial

        return () => {
            timescale.unsubscribeVisibleLogicalRangeChange(onChartMove);
            unsub();
            unsubTerminal();
        };
    }, [symbol, series, priceChart]);

    return <div ref={containerRef} className="absolute inset-0 pointer-events-none z-20 overflow-hidden" />;
}
