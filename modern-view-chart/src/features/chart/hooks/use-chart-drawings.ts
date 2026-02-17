
import { useEffect } from 'react';
import { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { useDrawingPrimitives } from './drawing/use-drawing-primitives';
import { useDrawingCreation } from './drawing/use-drawing-creation';
import { useDrawingEditor } from './drawing/use-drawing-editor';

export function useChartDrawings(
    chartId: string, chart: IChartApi | null, series: ISeriesApi<any> | null, isReady: boolean, containerRef: React.RefObject<HTMLDivElement | null>, symbol: string | undefined, interval: string | undefined, source: string | undefined, candles: any[]) {
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
    const { handleCreationClick } = useDrawingCreation(
        chartId,
        chart,
        series,
        isReady,
        currentDrawingTool,
        containerRef,
        candles // Pass candles for snapping
    );

    // 3. Editor Layer (Select, Drag, Delete)
    const {
        handleClick: handleEditorClick,
        handleDragStart,
        handleDragMove,
        handleDragEnd
    } = useDrawingEditor(chartId, chart, series, containerRef, isDrawing, primitivesRef, candles);

    // 4. Main Event Handlers (Aggregate logic)
    const handleClick = (param: MouseEventParams) => {
        if (!param.point || !series) return;

        if (isDrawing) {
            handleCreationClick(param);
        } else {
            handleEditorClick(param);
        }
    };

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

            const param = {
                point: { x: x as any, y: y as any },
                time: chart.timeScale().coordinateToTime(x) || undefined,
                seriesData: new Map(),
                sourceEvent: { ...e, localX: x, localY: y } as any
            } as MouseEventParams;

            handleDragStart(param);
        };

        const handlePointerMove = (e: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const param = {
                point: { x: x as any, y: y as any },
                time: chart.timeScale().coordinateToTime(x) || undefined,
                seriesData: new Map(),
                sourceEvent: { ...e, localX: x, localY: y } as any
            } as MouseEventParams;

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
