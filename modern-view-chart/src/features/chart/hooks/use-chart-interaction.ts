import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ISeriesApi, IPriceLine, MouseEventParams } from 'lightweight-charts';
import { Position, useMarketStore, Alert } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';

interface DragState {
    type: 'sl' | 'tp' | 'limit' | 'draft_entry' | 'draft_sl' | 'draft_tp' | 'alert';
    ticket?: number;
    id?: string;
    originalPrice: number;
    currentPrice: number;
}

export function useChartInteraction(
    chartRef: React.RefObject<import('lightweight-charts').IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
    symbol: string | undefined,
    containerRef: React.RefObject<HTMLDivElement | null>,
    // Add Alert props
    alerts: Alert[] = [],
    handleUpdateAlert: (id: string, price: number) => void = () => { },
    handleRemoveAlert: (id: string) => void = () => { }
) {
    const positions = useMarketStore(state => state.positions);
    const draftOrder = useMarketStore(state => state.draftOrder);
    const symbolInfo = useMarketStore(state => symbol ? state.symbolInfo[symbol] : undefined);
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const setDraggingPosition = useMarketStore(state => state.setDraggingPosition);
    const { sendMessage } = useWebSocket();

    // Use Refs to keep store data stable within handlers without triggering re-renders
    const stateRef = useRef({
        positions: positions,
        draftOrder: draftOrder,
        symbolInfo: symbolInfo
    });

    useEffect(() => {
        stateRef.current = { positions, draftOrder, symbolInfo };
    }, [positions, draftOrder, symbolInfo]);

    const dragState = useRef<DragState | null>(null);
    const isDragging = useRef(false);
    const isDeletingZoneRef = useRef(false);

    // Filter alerts for current symbol
    const symbolAlerts = useMemo(() =>
        alerts.filter(a => a.symbol === symbol && a.active),
        [alerts, symbol]);

    const activePositions = useMemo(() =>
        positions.filter(p => p.symbol === symbol),
        [positions, symbol]);

    const getNearElement = useCallback((y: number, x: number, isTouch: boolean = false) => {
        const series = seriesRef.current;
        const container = containerRef.current;
        if (!series || !container || !symbol) return null;

        const { positions, draftOrder } = stateRef.current;
        const currentAlerts = useMarketStore.getState().alerts.filter(a => a.symbol === symbol && a.active);
        const currentPositions = positions.filter(p => p.symbol === symbol);

        const width = container.clientWidth;
        const isNearRightEdge = (width - x) < 60; // Tag Zone

        // Early exit: Only check when near interactive areas
        if (!isNearRightEdge && (width - x) > 120) {
            return null;
        }

        let pixelTolerance = isNearRightEdge ? 20 : 12;

        if (isTouch) {
            pixelTolerance = 25;
        }

        // 1. Check Draft Order
        if (draftOrder && draftOrder.symbol === symbol) {
            const draftLines = [
                { type: 'draft_entry' as const, price: draftOrder.price || 0 },
                { type: 'draft_sl' as const, price: draftOrder.sl || 0 },
                { type: 'draft_tp' as const, price: draftOrder.tp || 0 }
            ];

            for (const line of draftLines) {
                if (line.price <= 0) continue;
                const coords = series.priceToCoordinate(line.price);
                if (coords !== null && Math.abs(coords - y) < pixelTolerance) {
                    return { type: line.type, originalPrice: line.price };
                }
            }
            return null;
        }

        // 2. Check Alerts
        for (const alert of currentAlerts) {
            const coords = series.priceToCoordinate(alert.price);
            if (coords !== null && Math.abs(coords - y) < pixelTolerance) {
                return { type: 'alert' as const, id: alert.id, originalPrice: alert.price };
            }
        }

        // 3. Check Active Positions
        for (const pos of currentPositions) {
            const lines = [
                { type: 'sl' as const, price: pos.sl },
                { type: 'tp' as const, price: pos.tp },
            ];
            for (const line of lines) {
                if (line.price <= 0) continue;
                const coords = series.priceToCoordinate(line.price);
                if (coords !== null && Math.abs(coords - y) < pixelTolerance) {
                    return { type: line.type, ticket: pos.ticket, originalPrice: line.price };
                }
            }
        }

        return null;
    }, [seriesRef, containerRef, symbol]);


    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !containerRef.current || !symbol) return;

        const chart = chartRef.current;
        const series = seriesRef.current;
        const container = containerRef.current;

        let lastCursorCheck = 0;
        let frameSkip = 0;
        const handleCrosshairMove = (param: MouseEventParams) => {
            if (isDragging.current) {
                container.style.cursor = 'grabbing';
                return;
            }

            if (!param.point) {
                container.style.cursor = 'default';
                return;
            }

            // Aggressive throttle: 100ms + frame skipping for cursor check
            frameSkip++;
            if (frameSkip % 2 !== 0) return; // Skip every other frame

            const now = Date.now();
            if (now - lastCursorCheck < 100) return;
            lastCursorCheck = now;

            const hit = getNearElement(param.point.y, param.point.x);
            container.style.cursor = hit ? 'grab' : 'default';
        };


        const handleMouseDown = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const x = e.clientX - rect.left;

            // Check if dragging from a Tag element
            const target = e.target as HTMLElement;
            const tagContainer = target.closest('[data-tag-type]');

            let hit: any = null;
            if (tagContainer) {
                const type = tagContainer.getAttribute('data-tag-type');
                const ticket = tagContainer.getAttribute('data-tag-ticket');
                const activePositions = positions.filter(p => p.symbol === symbol);
                const pos = activePositions.find(p => p.ticket.toString() === ticket);

                if (pos && type) {
                    hit = {
                        type: type === 'entry' ? 'entry' : type,
                        ticket: pos.ticket,
                        originalPrice: type === 'entry' ? pos.open_price : (type === 'sl' ? pos.sl : pos.tp)
                    };
                }
            }

            if (!hit) hit = getNearElement(y, x);

            if (hit) {
                e.preventDefault();
                e.stopPropagation();

                isDragging.current = true;
                dragState.current = {
                    type: hit.type as any,
                    ticket: (hit as any).ticket,
                    id: (hit as any).id,
                    originalPrice: hit.originalPrice,
                    currentPrice: hit.originalPrice
                };
                chart.applyOptions({ handleScroll: false, handleScale: false });
            }
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const rect = container.getBoundingClientRect();
            const y = e.touches[0].clientY - rect.top;
            const x = e.touches[0].clientX - rect.left;

            // Check if dragging from a Tag element
            const target = e.target as HTMLElement;
            const tagContainer = target.closest('[data-tag-type]');

            let hit: any = null;
            if (tagContainer) {
                const type = tagContainer.getAttribute('data-tag-type');
                const ticket = tagContainer.getAttribute('data-tag-ticket');
                const activePositions = positions.filter(p => p.symbol === symbol);
                const pos = activePositions.find(p => p.ticket.toString() === ticket);

                if (pos && type) {
                    hit = {
                        type: type === 'entry' ? 'entry' : type,
                        ticket: pos.ticket,
                        originalPrice: type === 'entry' ? pos.open_price : (type === 'sl' ? pos.sl : pos.tp)
                    };
                }
            }

            if (!hit) hit = getNearElement(y, x, true);

            if (hit) {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                isDragging.current = true;
                dragState.current = {
                    type: hit.type as any,
                    ticket: (hit as any).ticket,
                    id: (hit as any).id,
                    originalPrice: hit.originalPrice,
                    currentPrice: hit.originalPrice
                };
                chart.applyOptions({ handleScroll: false, handleScale: false });
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !dragState.current) return;

            e.preventDefault();
            e.stopPropagation();

            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const x = e.clientX - rect.left;

            updateDragPosition(y, x);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging.current || !dragState.current || e.touches.length !== 1) return;

            if (e.cancelable) e.preventDefault();
            e.stopPropagation();

            const rect = container.getBoundingClientRect();
            const y = e.touches[0].clientY - rect.top;
            const x = e.touches[0].clientX - rect.left;

            updateDragPosition(y, x);
        };

        const updateDragPosition = (y: number, x: number) => {
            if (!dragState.current) return;
            const coordinatePrice = series.coordinateToPrice(y);
            if (coordinatePrice === null) return;

            const digits = symbolInfo?.digits || 2;
            const factor = Math.pow(10, digits);
            const newPrice = Math.round((coordinatePrice as number) * factor) / factor;

            // Skip update if price hasn't changed (reduces store noise)
            if (newPrice === dragState.current.currentPrice) return;

            dragState.current.currentPrice = newPrice;

            isDeletingZoneRef.current = x < 80;

            const type = dragState.current.type;

            if (type.startsWith('draft_')) {
                if (draftOrder) {
                    const updates: any = {};
                    if (type === 'draft_entry') {
                        updates.price = newPrice;
                        updates.isMarket = false; // Convert to Limit when dragged
                    } else if (type === 'draft_sl') {
                        updates.sl = newPrice;
                        updates.slTouched = true; // Mark as touched so it's sent on confirm
                    } else if (type === 'draft_tp') {
                        updates.tp = newPrice;
                        updates.tpTouched = true; // Mark as touched so it's sent on confirm
                    }
                    setDraftOrder({ ...draftOrder, ...updates });
                }
            } else if (type === 'alert') {
                handleUpdateAlert(dragState.current.id!, newPrice);
            } else {
                setDraggingPosition({
                    ticket: dragState.current.ticket!,
                    type: type as 'sl' | 'tp',
                    price: newPrice
                });
            }
        };

        const handleMouseUp = (e: MouseEvent) => finalizeDrag();
        const handleTouchEnd = (e: TouchEvent) => finalizeDrag();

        const finalizeDrag = () => {
            if (!isDragging.current || !dragState.current) return;

            const { ticket, id, type, currentPrice } = dragState.current;

            if (type === 'alert') {
                if (isDeletingZoneRef.current) {
                    handleRemoveAlert(id!);
                } else {
                    handleUpdateAlert(id!, currentPrice);
                }
            } else if (!type.startsWith('draft_')) {
                sendMessage({
                    topic: 'mt5_command',
                    command: 'modify',
                    ticket: ticket,
                    [type]: currentPrice
                });
                setDraggingPosition(null);
            }

            isDragging.current = false;
            dragState.current = null;
            isDeletingZoneRef.current = false;

            chart.applyOptions({ handleScroll: true, handleScale: true });
            container.style.cursor = 'default';
        };

        const handleClick = (param: MouseEventParams) => {
            if (!param.point || !param.time || isDragging.current) return;

            const seriesData = param.seriesData;
            if (seriesData.size === 0) return;

            let checked = 0;
            const maxCheck = 5;
            for (const [s, data] of seriesData) {
                if (checked++ >= maxCheck) break;
                if ((data as any).value !== undefined) {
                    const coords = (s as any).priceToCoordinate((data as any).value);
                    if (coords !== null && Math.abs(coords - param.point.y) < 15) {
                        useMarketStore.getState().setActiveRightSidebarTab('indicators');
                        return;
                    }
                }
            }
        };

        chart.subscribeCrosshairMove(handleCrosshairMove);
        chart.subscribeClick(handleClick);
        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove, { passive: false }); // Still need false for dragging
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            chart.unsubscribeCrosshairMove(handleCrosshairMove);
            chart.unsubscribeClick(handleClick);
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [chartRef, seriesRef, containerRef, symbol]); // STABLE!
}
