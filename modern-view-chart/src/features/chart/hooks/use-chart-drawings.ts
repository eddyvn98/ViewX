
import { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { useDrawingPrimitives } from './drawing/use-drawing-primitives';
import { useDrawingCreation } from './drawing/use-drawing-creation';
import { useDrawingEditor } from './drawing/use-drawing-editor';

export function useChartDrawings(
    chartId: string,
    chart: IChartApi | null,
    series: ISeriesApi<any> | null,
    isReady: boolean,
    containerRef: React.RefObject<HTMLDivElement | null>
) {
    const {
        currentDrawingTool,
        isDrawing
    } = useMarketStore(useShallow(state => ({
        currentDrawingTool: state.currentDrawingTool,
        isDrawing: state.isDrawing,
    })));

    // 1. Render Layer (Sync primitives with state)
    useDrawingPrimitives(chartId, chart, series, isReady);

    // 2. Creation Layer (Drafting new drawings)
    const { handleCreationClick } = useDrawingCreation(
        chartId,
        chart,
        series,
        isReady,
        currentDrawingTool
    );

    // 3. Editor Layer (Select, Drag, Delete)
    const {
        handleClick: handleEditorClick,
        handleDragStart,
        handleDragMove,
        handleDragEnd
    } = useDrawingEditor(chartId, chart, series, containerRef, isDrawing);

    // 4. Main Event Handlers (Aggregate logic)
    const handleClick = (param: MouseEventParams) => {
        if (!param.point || !series) return;

        if (isDrawing) {
            handleCreationClick(param);
        } else {
            handleEditorClick(param);
        }
    };

    return {
        handleClick,
        handleDragStart,
        handleDragMove,
        handleDragEnd
    };
}
