
import { useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { Candle } from '@/lib/store/types';
import { useShallow } from 'zustand/react/shallow';
import { useDrawingPrimitives } from './drawing/use-drawing-primitives';
import { useDrawingCreation } from './drawing/use-drawing-creation';
import { useDrawingEditor } from './drawing/use-drawing-editor';

export function useChartDrawings(
    chartId: string,
    chart: IChartApi | null,
    series: ISeriesApi<'Candlestick'> | null,
    isReady: boolean,
    eventContainerRef: React.RefObject<HTMLDivElement | null>,
    coordinateContainerRef: React.RefObject<HTMLDivElement | null>,
    symbol: string | undefined,
    interval: string | undefined,
    source: string | undefined,
    candles: Candle[]
) {
    const {
        currentDrawingTool,
        isDrawing
    } = useMarketStore(useShallow(state => ({
        currentDrawingTool: state.currentDrawingTool,
        isDrawing: state.isDrawing,
    })));

    // 1. Render Layer (Sync primitives with state)
    const { primitivesRef } = useDrawingPrimitives(chartId, chart, series, isReady);

    // 2. Creation Layer (Drafting new drawings)
    // Keep context identity stable so temp-point renders do not tear down and
    // re-subscribe the chart click listener between two fast drawing clicks.
    const drawingContext = useMemo<{
        symbol?: string;
        interval?: string;
        source?: 'BINANCE' | 'MT5' | 'VN_GOLD';
    }>(() => ({
        symbol,
        interval,
        source: source === 'BINANCE' || source === 'MT5' || source === 'VN_GOLD' ? source : undefined,
    }), [symbol, interval, source]);

    const { handleCreationClick } = useDrawingCreation(
        chartId,
        chart,
        series,
        isReady,
        currentDrawingTool,
        coordinateContainerRef,
        candles, // Pass candles for snapping
        drawingContext
    );

    // 3. Editor Layer (Select, Drag, Delete)
    const {
        handleClick: handleEditorClick,
        handleDragStart,
        handleDragMove,
        handleDragEnd
    } = useDrawingEditor(chartId, chart, series, coordinateContainerRef, isDrawing, primitivesRef, candles);

    // 4. Main Event Handlers (Aggregate logic)
    // Keep one chart click subscription alive. Routing through React state caused a
    // brief unsubscribe/subscribe window whenever drawing state changed, which can
    // drop very fast consecutive clicks.
    const creationClickRef = useRef(handleCreationClick);
    const editorClickRef = useRef(handleEditorClick);
    const dragStartRef = useRef(handleDragStart);
    const dragMoveRef = useRef(handleDragMove);
    const dragEndRef = useRef(handleDragEnd);
    const suppressEditorClickRef = useRef(false);

    useLayoutEffect(() => {
        creationClickRef.current = handleCreationClick;
        editorClickRef.current = handleEditorClick;
        dragStartRef.current = handleDragStart;
        dragMoveRef.current = handleDragMove;
        dragEndRef.current = handleDragEnd;
    }, [handleCreationClick, handleEditorClick, handleDragStart, handleDragMove, handleDragEnd]);

    const handleClick = useCallback((param: MouseEventParams) => {
        if (!param.point || !series) return;

        // Native pointerdown owns drawing placement. The Lightweight Charts click
        // generated from the same pointer gesture arrives afterwards; suppress it
        // so the newly-created primitive is not immediately routed into editing.
        if (suppressEditorClickRef.current) {
            suppressEditorClickRef.current = false;
            return;
        }
        if (useMarketStore.getState().isDrawing) return;
        editorClickRef.current(param);
    }, [series]);

    // 5. Subscribe Click Events to Chart
    useEffect(() => {
        if (!chart) return;
        chart.subscribeClick(handleClick);
        return () => chart.unsubscribeClick(handleClick);
    }, [chart, handleClick]);

    // 6. Subscribe Drag Events to Container
    useEffect(() => {
        if (!chart || !eventContainerRef.current || !coordinateContainerRef.current) return;
        const eventContainer = eventContainerRef.current;
        const coordinateContainer = coordinateContainerRef.current;

        const handlePointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;

            const rect = coordinateContainer.getBoundingClientRect();
            if (
                e.clientX < rect.left ||
                e.clientX > rect.right ||
                e.clientY < rect.top ||
                e.clientY > rect.bottom
            ) return;

            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const param = ({
                point: { x, y },
                time: chart.timeScale().coordinateToTime(x) || undefined,
                seriesData: new Map(),
                sourceEvent: e
            } as unknown) as MouseEventParams;

            if (useMarketStore.getState().isDrawing) {
                suppressEditorClickRef.current = true;
                creationClickRef.current(param);
                return;
            }
            dragStartRef.current(param);
        };

        const handlePointerMove = (e: PointerEvent) => {
            const rect = coordinateContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const param = ({
                point: { x, y },
                time: chart.timeScale().coordinateToTime(x) || undefined,
                seriesData: new Map(),
                sourceEvent: e
            } as unknown) as MouseEventParams;

            dragMoveRef.current(param);
        };

        const handlePointerUp = () => {
            dragEndRef.current();
        };

        // Capture phase is intentional: Lightweight Charts / attached primitives
        // may stop pointer propagation once a draft exists. Capture guarantees the
        // second fast placement click is observed by the drawing engine.
        eventContainer.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            eventContainer.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    // Keep native pointer listeners mounted across drawing-state transitions.
    // Handler refs above are refreshed every render, so rapid tool changes cannot
    // create an unsubscribe/re-subscribe gap that drops the next pointerdown.
    }, [chart, eventContainerRef, coordinateContainerRef]);
}
