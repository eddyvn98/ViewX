import { useEffect, useRef } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore, Alert } from '@/lib/store';
import { createPointerHandlers } from './interaction/pointer-handlers';

export function useChartInteraction(
    chartRef: React.RefObject<import('lightweight-charts').IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    coordinateSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    symbol: string | undefined,
    containerRef: React.RefObject<HTMLDivElement | null>,
    coordinateContainerRef: React.RefObject<HTMLDivElement | null>,
    isReady: boolean,
    alerts: Alert[] = [],
    handleUpdateAlert: (id: string, price: number) => void = () => {},
    handleRemoveAlert: (id: string) => void = () => {},
    sendMessage?: (data: Record<string, unknown>) => void,
) {
    void handleRemoveAlert;

    const positions = useMarketStore(state => state.positions);
    const orders = useMarketStore(state => state.orders);
    const draftOrder = useMarketStore(state => state.draftOrder);
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const setDraggingPosition = useMarketStore(state => state.setDraggingPosition);

    const symbolInfo = useMarketStore(state => symbol ? state.symbolInfo[symbol] : undefined);

    const stateRef = useRef({ positions, orders, draftOrder, symbolInfo, alerts, currentPrice: 0 });

    useEffect(() => {
        stateRef.current = { ...stateRef.current, positions, orders, draftOrder, symbolInfo, alerts };
    }, [positions, orders, draftOrder, symbolInfo, alerts]);

    useEffect(() => {
        if (!symbol) return;
        return useMarketStore.subscribe(
            (state) => state.tickers[symbol]?.price,
            (price: number) => { if (price) stateRef.current.currentPrice = price; },
        );
    }, [symbol]);

    const isDragging = useRef(false);
    const dragState = useRef<Record<string, unknown> | null>(null);
    const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isReady || !chartRef.current || !seriesRef.current || !containerRef.current || !symbol) return;
        const chart = chartRef.current;
        const container = containerRef.current;
        const coordinateContainer = coordinateContainerRef.current || container;
        const series = seriesRef.current;
        const coordinateSeries = coordinateSeriesRef.current || series;

        const { handlePointerDown, handlePointerMove, handlePointerUp } = createPointerHandlers({
            chart,
            container,
            coordinateContainer,
            series,
            coordinateSeries,
            symbol,
            stateRef,
            isDragging,
            dragState,
            mouseDownPos,
            longPressTimer,
            setDraftOrder,
            setDraggingPosition,
            handleUpdateAlert,
            sendMessage,
        });

        const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;
        if (supportsPointerEvents) {
            container.addEventListener('pointerdown', handlePointerDown, true);
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            window.addEventListener('pointercancel', handlePointerUp);
            document.addEventListener('pointermove', handlePointerMove, true);
            document.addEventListener('pointerup', handlePointerUp, true);
            document.addEventListener('pointercancel', handlePointerUp, true);
        }

        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.changedTouches[0];
            if (!touch) return;
            handlePointerDown({
                clientX: touch.clientX,
                clientY: touch.clientY,
                pointerType: 'touch',
                pointerId: touch.identifier || 1,
                target: e.target as EventTarget,
                preventDefault: () => e.preventDefault(),
            } as unknown as PointerEvent);
        };
        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.changedTouches[0] || e.touches[0];
            if (!touch) return;
            handlePointerMove({
                clientX: touch.clientX,
                clientY: touch.clientY,
                pointerType: 'touch',
                pointerId: touch.identifier || 1,
                target: (document.elementFromPoint(touch.clientX, touch.clientY) || e.target) as EventTarget,
                preventDefault: () => e.preventDefault(),
            } as unknown as PointerEvent);
        };
        const handleTouchEnd = (e: TouchEvent) => {
            const touch = e.changedTouches[0];
            handlePointerUp({
                clientX: touch?.clientX ?? 0,
                clientY: touch?.clientY ?? 0,
                pointerType: 'touch',
                pointerId: touch?.identifier || 1,
                target: e.target as EventTarget,
                preventDefault: () => e.preventDefault(),
            } as unknown as PointerEvent);
        };

        if (!supportsPointerEvents) {
            container.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd, { passive: false });
            window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        }

        return () => {
            if (supportsPointerEvents) {
                container.removeEventListener('pointerdown', handlePointerDown, true);
                window.removeEventListener('pointermove', handlePointerMove);
                window.removeEventListener('pointerup', handlePointerUp);
                window.removeEventListener('pointercancel', handlePointerUp);
                document.removeEventListener('pointermove', handlePointerMove, true);
                document.removeEventListener('pointerup', handlePointerUp, true);
                document.removeEventListener('pointercancel', handlePointerUp, true);
            } else {
                container.removeEventListener('touchstart', handleTouchStart, true);
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleTouchEnd);
                window.removeEventListener('touchcancel', handleTouchEnd);
            }
        };
    }, [isReady, symbol, setDraftOrder, setDraggingPosition, handleUpdateAlert, sendMessage, chartRef, containerRef, coordinateContainerRef, seriesRef, coordinateSeriesRef]);
}
