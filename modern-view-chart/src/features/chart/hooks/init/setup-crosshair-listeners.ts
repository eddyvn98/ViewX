import { IChartApi, ISeriesApi, MouseEventParams, Time } from 'lightweight-charts';
import { normalizeCrosshairTime } from './normalize-crosshair-time';
import { syncVerticalLines } from '../../logic/chart-sync';
import { useMarketStore } from '@/lib/store';

interface CrosshairSetupArgs {
    priceChart: IChartApi;
    subchartChart: IChartApi;
    timescaleChart: IChartApi;
    chartId: string;
    candleSeries: ISeriesApi<'Candlestick'>;
    subSyncSeries: ISeriesApi<'Line'>;
    footSyncSeries: ISeriesApi<'Line'>;
    markerSeries: ISeriesApi<'Candlestick'>;
    priceLineEl: HTMLDivElement | null;
    subLineEl: HTMLDivElement | null;
    footLineEl: HTMLDivElement | null;
    footTimeLabelEl: HTMLDivElement | null;
    seriesRef: { current: ISeriesApi<'Candlestick'> | null };
    formatTimeLabel: (timestampSec: number) => string;
}

type CrosshairEventLike = MouseEventParams<Time> & {
    sourceEvent?: {
        clientX?: number;
        clientY?: number;
        pointerType?: string;
        touches?: ArrayLike<unknown>;
        changedTouches?: ArrayLike<unknown>;
    };
};

export function setupCrosshairListeners(args: CrosshairSetupArgs) {
    const {
        priceChart,
        subchartChart,
        timescaleChart,
        chartId,
        candleSeries,
        subSyncSeries,
        footSyncSeries,
        markerSeries,
        priceLineEl,
        subLineEl,
        footLineEl,
        footTimeLabelEl,
        seriesRef,
        formatTimeLabel,
    } = args;

    const charts = { priceChart, subchartChart, timescaleChart };
    const elements = { priceLineEl, subLineEl, footLineEl, footTimeLabelEl };
    const series = { candleSeries, subSyncSeries, footSyncSeries, markerSeries };

    let lastSyncTime: number | null = null;
    let lastSyncX: number | null = null;
    let lastSyncY: number | null = null;
    let pendingPayload: {
        time: number;
        price: number | null;
        sourceId: string;
        sourcePane: 'price' | 'subchart' | 'timescale';
        point: { x: number; y: number };
        logical: number | null;
        sourceRect?: {
            left: number;
            top: number;
            width: number;
            height: number;
        };
        sourceEvent?: {
            clientX: number;
            clientY: number;
            pointerType?: string;
            isTouch?: boolean;
        };
    } | null = null;
    let dispatchRafId: number | null = null;
    let wasSyncEnabled = useMarketStore.getState().isCrosshairSyncEnabled;

    const clearCrosshairSyncState = (sourceChart: IChartApi, sourcePane: 'price' | 'subchart' | 'timescale') => {
        if (dispatchRafId !== null) {
            cancelAnimationFrame(dispatchRafId);
            dispatchRafId = null;
        }
        pendingPayload = null;
        lastSyncTime = null;
        lastSyncX = null;
        lastSyncY = null;
        syncVerticalLines(sourceChart, charts, elements, series, null, null, null, formatTimeLabel);
        useMarketStore.getState().syncCrosshair(null);
        window.dispatchEvent(new CustomEvent('chart-crosshair', { detail: { time: null, sourceId: chartId, sourcePane } }));
    };

    const flushPendingPayload = () => {
        if (!pendingPayload) {
            dispatchRafId = null;
            return;
        }

        const payload = pendingPayload;
        pendingPayload = null;
        dispatchRafId = null;
        lastSyncTime = payload.time;
        lastSyncX = payload.point.x;
        lastSyncY = payload.point.y;

        const store = useMarketStore.getState();
        store.syncCrosshair(payload);
        window.dispatchEvent(new CustomEvent('chart-crosshair', { detail: payload }));
    };

    const getSourceContainer = (sourceChart: IChartApi) => {
        if (sourceChart === priceChart) return priceLineEl?.parentElement ?? null;
        if (sourceChart === subchartChart) return subLineEl?.parentElement ?? null;
        if (sourceChart === timescaleChart) return footLineEl?.parentElement ?? null;
        return null;
    };

    const getSnappedCrosshairX = (
        sourceChart: IChartApi,
        normalizedTime: number | null,
        fallbackX: number | null,
    ) => {
        if (normalizedTime === null) return fallbackX;

        try {
            const snappedX = sourceChart.timeScale().timeToCoordinate(normalizedTime as Time);
            if (snappedX !== null && Number.isFinite(snappedX)) {
                return snappedX;
            }
        } catch {
            // Fall back to the raw pointer coordinate if the time cannot be resolved yet.
        }

        return fallbackX;
    };

    const handleCrosshairMove = (sourceChart: IChartApi, param: CrosshairEventLike, hasY: boolean) => {
        const sourcePane = sourceChart === priceChart
            ? 'price'
            : sourceChart === subchartChart
                ? 'subchart'
                : 'timescale';
        const isCrosshairSyncEnabled = useMarketStore.getState().isCrosshairSyncEnabled;

        if (!isCrosshairSyncEnabled) {
            if (lastSyncTime !== null || pendingPayload || dispatchRafId !== null) {
                clearCrosshairSyncState(sourceChart, sourcePane);
            }
            return;
        }

        const logical = param.point ? sourceChart.timeScale().coordinateToLogical(param.point.x) : null;
        const normalizedTime = normalizeCrosshairTime(param.time);
        const snappedX = getSnappedCrosshairX(sourceChart, normalizedTime, param.point?.x ?? null);
        syncVerticalLines(
            sourceChart,
            charts,
            elements,
            series,
            snappedX,
            normalizedTime,
            logical !== null && Number.isFinite(Number(logical)) ? Number(logical) : null,
            formatTimeLabel
        );

        // Footer timescale only needs local visual sync while dragging.
        // Broadcasting every move through the store/window adds overhead
        // without improving the interaction.
        if (sourcePane === 'timescale') {
            if (!param.point && lastSyncTime !== null) {
                clearCrosshairSyncState(sourceChart, sourcePane);
            }
            return;
        }

        if (normalizedTime !== null && param.point) {
            const curTime = normalizedTime;
            const curX = snappedX ?? param.point.x;
            const curY = hasY ? param.point.y : 0;
            const sourceContainer = getSourceContainer(sourceChart);
            const sourceRect = sourceContainer?.getBoundingClientRect();

            if (curTime !== lastSyncTime || curX !== lastSyncX || curY !== lastSyncY) {
                pendingPayload = {
                    time: curTime,
                    price: hasY ? Number(seriesRef.current?.coordinateToPrice(curY) ?? 0) : null,
                    sourceId: chartId,
                    sourcePane,
                    point: { x: curX, y: curY },
                    logical: logical !== null ? Number(logical) : null,
                    sourceRect: sourceRect
                        ? {
                            left: sourceRect.left,
                            top: sourceRect.top,
                            width: sourceRect.width,
                            height: sourceRect.height,
                        }
                        : undefined,
                    sourceEvent: param.sourceEvent
                        ? {
                            clientX: Number(param.sourceEvent.clientX),
                            clientY: Number(param.sourceEvent.clientY),
                            pointerType: typeof param.sourceEvent.pointerType === 'string'
                                ? param.sourceEvent.pointerType
                                : undefined,
                            isTouch: Boolean(
                                param.sourceEvent.pointerType === 'touch'
                                || ('touches' in param.sourceEvent && param.sourceEvent.touches?.length)
                                || ('changedTouches' in param.sourceEvent && param.sourceEvent.changedTouches?.length)
                            ),
                        }
                        : undefined,
                };

                if (dispatchRafId === null) {
                    dispatchRafId = requestAnimationFrame(flushPendingPayload);
                }
            }
        } else if (!param.point && lastSyncTime !== null) {
            clearCrosshairSyncState(sourceChart, sourcePane);
        }
    };

    const onPrice = (p: MouseEventParams<Time>) => handleCrosshairMove(priceChart, p, true);
    const onSub = (p: MouseEventParams<Time>) => handleCrosshairMove(subchartChart, p, true);
    const onFoot = (p: MouseEventParams<Time>) => handleCrosshairMove(timescaleChart, p, false);

    priceChart.subscribeCrosshairMove(onPrice);
    subchartChart.subscribeCrosshairMove(onSub);
    timescaleChart.subscribeCrosshairMove(onFoot);

    const unsubscribeCrosshairSync = useMarketStore.subscribe(
        (state) => state.isCrosshairSyncEnabled,
        (enabled) => {
            if (enabled === wasSyncEnabled) return;
            wasSyncEnabled = enabled;
            if (!enabled) {
                clearCrosshairSyncState(priceChart, 'price');
            }
        }
    );

    return () => {
        if (dispatchRafId !== null) cancelAnimationFrame(dispatchRafId);
        unsubscribeCrosshairSync();
        priceChart.unsubscribeCrosshairMove(onPrice);
        subchartChart.unsubscribeCrosshairMove(onSub);
        timescaleChart.unsubscribeCrosshairMove(onFoot);
    };
}
