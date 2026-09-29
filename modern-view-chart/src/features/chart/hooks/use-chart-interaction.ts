import { useEffect, useMemo, useRef } from 'react';
import { ISeriesApi } from 'lightweight-charts';
import { useMarketStore, Alert } from '@/lib/store';
import { createPointerHandlers } from './interaction/pointer-handlers';
import { resolveChartIdentityDataSource } from '@/lib/mt5/account-scope';
import { normalizeSymbol } from '@/lib/utils/symbol';
import type { Mt5TradingIdentity } from '@/lib/mt5/trading-request';

export function useChartInteraction(
    chartRef: React.RefObject<import('lightweight-charts').IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    coordinateSeriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    symbol: string | undefined,
    source: string | undefined,
    mt5Identity: Mt5TradingIdentity | undefined,
    containerRef: React.RefObject<HTMLDivElement | null>,
    coordinateContainerRef: React.RefObject<HTMLDivElement | null>,
    isReady: boolean,
    alerts: Alert[] = [],
    handleUpdateAlert: (id: string, price: number) => void = () => {},
    handleRemoveAlert: (id: string) => void = () => {},
    sendMessage?: (data: Record<string, unknown>) => void,
) {
    void handleRemoveAlert;

    const allPositions = useMarketStore(state => state.positions);
    const allOrders = useMarketStore(state => state.orders);
    const rawDraftOrder = useMarketStore(state => state.draftOrder);
    const dataSource = useMemo(
        () => resolveChartIdentityDataSource(source, mt5Identity),
        [source, mt5Identity],
    );
    const positions = useMemo(
        () => allPositions.filter((item) => String(item.source || 'MT5') === dataSource),
        [allPositions, dataSource],
    );
    const orders = useMemo(
        () => allOrders.filter((item) => String(item.source || 'MT5') === dataSource),
        [allOrders, dataSource],
    );
    const draftOrder = useMemo(() => {
        if (!rawDraftOrder) return null;
        const draftSource = rawDraftOrder.source
            ? resolveChartIdentityDataSource(rawDraftOrder.source || undefined, rawDraftOrder)
            : dataSource;
        return draftSource === dataSource ? rawDraftOrder : null;
    }, [rawDraftOrder, dataSource]);
    const setDraftOrder = useMarketStore(state => state.setDraftOrder);
    const setDraggingPosition = useMarketStore(state => state.setDraggingPosition);

    const symbolInfo = useMarketStore(state => {
        if (!symbol) return undefined;
        const normalized = normalizeSymbol(symbol);
        const scoped = state.symbolInfo[`${dataSource}:${symbol}`]
            || state.symbolInfo[`${dataSource}:${normalized}`];
        if (String(source || '').toUpperCase() === 'MT5_PERSONAL') return scoped;
        return scoped || state.symbolInfo[normalized];
    });

    const stateRef = useRef({ positions, orders, draftOrder, symbolInfo, alerts, currentPrice: 0 });

    useEffect(() => {
        stateRef.current = { ...stateRef.current, positions, orders, draftOrder, symbolInfo, alerts };
    }, [positions, orders, draftOrder, symbolInfo, alerts]);

    useEffect(() => {
        if (!symbol) return;
        const normalized = normalizeSymbol(symbol);
        const personalMt5 = String(source || '').toUpperCase() === 'MT5_PERSONAL';
        return useMarketStore.subscribe(
            (state) => {
                const scoped = state.tickers[`${dataSource}:${symbol}`]
                    || state.tickers[`${dataSource}:${normalized}`];
                if (personalMt5) return scoped?.price;
                return scoped?.price || state.tickers[symbol]?.price || state.tickers[normalized]?.price;
            },
            (price: number | undefined) => {
                if (price) stateRef.current.currentPrice = price;
            },
        );
    }, [dataSource, source, symbol]);

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
            source,
            dataSource,
            identity: mt5Identity,
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
    }, [isReady, symbol, source, dataSource, mt5Identity, setDraftOrder, setDraggingPosition, handleUpdateAlert, sendMessage, chartRef, containerRef, coordinateContainerRef, seriesRef, coordinateSeriesRef]);
}
