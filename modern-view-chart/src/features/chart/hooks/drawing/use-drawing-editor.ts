import { useEffect, useCallback, useMemo } from 'react';
import { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';
import { useMarketStore, RootState } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { Candle } from '@/lib/store/types';
import { createDrawingSelectionHandler } from './editor-selection';
import { createDrawingDragHandlers } from './editor-actions';

const EMPTY_ARRAY: Candle[] = [];
type PrimitiveRecord = Record<string, unknown>;

export function useDrawingEditor(
    chartId: string,
    chart: IChartApi | null,
    series: ISeriesApi<'Candlestick'> | null,
    containerRef: React.RefObject<HTMLDivElement | null>,
    isDrawing: boolean,
    primitivesRef?: React.MutableRefObject<PrimitiveRecord>,
    candles: Candle[] = EMPTY_ARRAY,
) {
    const chartDrawings = useMarketStore(state => state.chartDrawings[chartId] || EMPTY_ARRAY);
    const snapToCandle = useMarketStore(state => state.snapToCandle);
    const { selectedDrawingId, setSelectedDrawing, updateDrawing, removeDrawing } = useMarketStore(useShallow((state: RootState) => ({
        selectedDrawingId: state.selectedDrawingId,
        setSelectedDrawing: state.setSelectedDrawing,
        updateDrawing: state.updateDrawing,
        removeDrawing: state.removeDrawing,
    })));

    const handleClick = useCallback((param: MouseEventParams) => {
        if (!chart || !series) return;
        const run = createDrawingSelectionHandler({
            chartId,
            chart,
            series,
            isDrawing,
            selectedDrawingId,
            chartDrawings,
            removeDrawing,
            setSelectedDrawing,
            containerRef,
        });
        run(param);
    }, [chart, series, chartId, isDrawing, selectedDrawingId, chartDrawings, removeDrawing, setSelectedDrawing, containerRef]);

    const dragHandlers = useMemo(() => {
        if (!chart || !series) return null;
        return createDrawingDragHandlers({
            chartId,
            chart,
            series,
            containerRef,
            isDrawing,
            selectedDrawingId,
            chartDrawings,
            primitivesRef,
            candles,
            snapToCandle,
            updateDrawing,
        });
    }, [chart, series, chartId, containerRef, isDrawing, selectedDrawingId, chartDrawings, primitivesRef, candles, snapToCandle, updateDrawing]);

    useEffect(() => {
        if (!chart || !dragHandlers) return;
        chart.subscribeCrosshairMove(dragHandlers.handleCrosshairMove);
        return () => chart.unsubscribeCrosshairMove(dragHandlers.handleCrosshairMove);
    }, [chart, dragHandlers]);

    return {
        handleClick,
        handleDragStart: useCallback((param: MouseEventParams) => dragHandlers?.handleDragStart(param), [dragHandlers]),
        handleDragMove: useCallback((param: MouseEventParams) => dragHandlers?.handleDragMove(param), [dragHandlers]),
        handleDragEnd: useCallback(() => dragHandlers?.handleDragEnd(), [dragHandlers]),
    };
}

