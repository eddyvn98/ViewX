
import { useEffect, useCallback, useMemo, useRef } from 'react';
import { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { Candle } from '@/lib/store/types';
import { useShallow } from 'zustand/react/shallow';
import { useDrawingPrimitives } from './drawing/use-drawing-primitives';
import { useDrawingCreation } from './drawing/use-drawing-creation';
import { useDrawingEditor } from './drawing/use-drawing-editor';

export function useChartDrawings(
    chartId: string, chart: IChartApi | null, series: ISeriesApi<'Candlestick'> | null, isReady: boolean, containerRef: React.RefObject<HTMLDivElement | null>, symbol: string | undefined, interval: string | undefined, source: string | undefined, candles: Candle[]) {
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
        containerRef,
        candles, // Pass candles for snapping
        drawingContext
    );

    // 3. Editor Layer (Select, Drag, Delete)
    const {
        handleClick: handleEditorClick,
        handleDragStart,
        handleDragMove,
        handleDragEnd
    } = useDrawingEditor(chartId, chart, series, containerRef, isDrawing, primitivesRef, candles);

    // 4. Main Event Handlers (Aggregate logic)
    // Keep one chart click subscription alive. Routing through React state caused a
    // brief unsubscribe/subscribe window whenever drawing state changed, which can
    // drop very fast consecutive clicks.
    const creationClickRef = useRef(handleCreationClick);
    const editorClickRef = useRef(handleEditorClick);
    creationClickRef.current = handleCreationClick;
    editorClickRef.current = handleEditorClick;

    const handleClick = useCallback((param: MouseEventParams) => {
        if (!param.point || !series) return;

        // Drawing placement is handled by native pointerdown below for lower
        // latency and to avoid losing clicks while chart primitives change.
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
        if (!chart || !containerRef.current) return;
        const container = containerRef.current;

        const handlePointerDown = (e: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const param = ({
                point: { x, y },
                time: chart.timeScale().coordinateToTime(x) || undefined,
                seriesData: new Map(),
                sourceEvent: e
            } as unknown) as MouseEventParams;

            if (useMarketStore.getState().isDrawing) {
                creationClickRef.current(param);
                return;
            }
            handleDragStart(param);
        };

        const handlePointerMove = (e: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const param = ({
                point: { x, y },
                time: chart.timeScale().coordinateToTime(x) || undefined,
                seriesData: new Map(),
                sourceEvent: e
            } as unknown) as MouseEventParams;

            handleDragMove(param);
        };

        const handlePointerUp = () => {
            handleDragEnd();
        };

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
    }, [chart, containerRef, handleDragStart, handleDragMove, handleDragEnd]);
}
