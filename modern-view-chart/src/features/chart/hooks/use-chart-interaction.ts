import { useEffect, useRef } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore, Alert } from '@/lib/store';
import { createPointerHandlers } from './interaction/pointer-handlers';

export function useChartInteraction(
    chartRef: React.RefObject<import('lightweight-charts').IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    symbol: string | undefined,
    containerRef: React.RefObject<HTMLDivElement | null>,
    alerts: Alert[] = [],
    handleUpdateAlert: (id: string, price: number) => void = () => {},
    handleRemoveAlert: (id: string) => void = () => {},
    sendMessage?: (data: any) => void,
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
            (state: any) => state.tickers[symbol]?.price,
            (price: number) => { if (price) stateRef.current.currentPrice = price; },
        );
    }, [symbol]);

    const isDragging = useRef(false);
    const dragState = useRef<any>(null);
    const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !containerRef.current || !symbol) return;
        const chart = chartRef.current;
        const container = containerRef.current;
        const series = seriesRef.current;

        const { handlePointerDown, handlePointerMove, handlePointerUp } = createPointerHandlers({
            chart,
            container,
            series,
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

        container.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            container.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [symbol, setDraftOrder, setDraggingPosition, handleUpdateAlert, sendMessage]);
}
