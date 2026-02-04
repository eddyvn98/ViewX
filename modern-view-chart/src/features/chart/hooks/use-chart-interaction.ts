import { useEffect, useRef, useState, useCallback } from 'react';
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
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const setDraggingPosition = useMarketStore(state => state.setDraggingPosition);
    const { sendMessage } = useWebSocket();

    const dragState = useRef<DragState | null>(null);
    const isDragging = useRef(false);
    const isDeletingZoneRef = useRef(false);

    // Filter alerts for current symbol
    const symbolAlerts = alerts.filter(a => a.symbol === symbol && a.active);

    const getNearElement = useCallback((y: number, x: number) => {
        const series = seriesRef.current;
        const container = containerRef.current;
        if (!series || !container || !symbol) return null;

        const width = container.clientWidth;
        const isNearRightEdge = (width - x) < 60; // Tag Zone
        const pixelTolerance = isNearRightEdge ? 20 : 12;

        // 1. Check Draft Order (highest priority)
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
        }

        // 2. Check Alerts (medium priority)
        for (const alert of symbolAlerts) {
            const coords = series.priceToCoordinate(alert.price);
            if (coords !== null && Math.abs(coords - y) < pixelTolerance) {
                return { type: 'alert' as const, id: alert.id, originalPrice: alert.price };
            }
        }

        // 3. Check Active Positions (SL/TP)
        const activePositions = positions.filter(p => p.symbol === symbol);
        for (const pos of activePositions) {
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
    }, [seriesRef, containerRef, symbol, draftOrder, symbolAlerts, positions]);

    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !containerRef.current || !symbol) return;

        const chart = chartRef.current;
        const series = seriesRef.current;
        const container = containerRef.current;

        const handleCrosshairMove = (param: MouseEventParams) => {
            if (isDragging.current) {
                container.style.cursor = 'grabbing';
                return;
            }

            if (!param.point) {
                container.style.cursor = 'default';
                return;
            }

            const hit = getNearElement(param.point.y, param.point.x);
            container.style.cursor = hit ? 'grab' : 'default';
        };

        const handleMouseDown = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const x = e.clientX - rect.left;

            const hit = getNearElement(y, x);
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

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !dragState.current) return;

            e.preventDefault();
            e.stopPropagation();

            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const x = e.clientX - rect.left;

            const coordinatePrice = series.coordinateToPrice(y);
            if (coordinatePrice === null) return;

            const newPrice = Math.round((coordinatePrice as number) * 100) / 100;

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
                        updates.isMarket = false;
                    } else if (type === 'draft_sl') {
                        updates.sl = newPrice;
                    } else if (type === 'draft_tp') {
                        updates.tp = newPrice;
                    }
                    setDraftOrder({ ...draftOrder, ...updates });
                }
            } else if (type === 'alert') {
                // Update store for real-time visual feedback
                handleUpdateAlert(dragState.current.id!, newPrice);
            } else {
                setDraggingPosition({
                    ticket: dragState.current.ticket!,
                    type: type as 'sl' | 'tp',
                    price: newPrice
                });
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!isDragging.current || !dragState.current) return;

            e.preventDefault();
            e.stopPropagation();

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
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            chart.unsubscribeCrosshairMove(handleCrosshairMove);
            chart.unsubscribeClick(handleClick);
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

    }, [chartRef, seriesRef, containerRef, symbol, positions, sendMessage, draftOrder, setDraftOrder, setDraggingPosition, getNearElement, handleUpdateAlert, handleRemoveAlert]);
}
