import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { normalizeCrosshairTime } from './normalize-crosshair-time';
import { syncVerticalLines } from '../../logic/chart-sync';
import { useMarketStore } from '@/lib/store';

interface CrosshairSetupArgs {
    priceChart: IChartApi;
    subchartChart: IChartApi;
    timescaleChart: IChartApi;
    chartId: string;
    candleSeries: ISeriesApi<any>;
    subSyncSeries: ISeriesApi<any>;
    footSyncSeries: ISeriesApi<any>;
    markerSeries: ISeriesApi<any>;
    priceLineEl: HTMLDivElement | null;
    subLineEl: HTMLDivElement | null;
    footLineEl: HTMLDivElement | null;
    seriesRef: { current: ISeriesApi<any> | null };
}

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
        seriesRef,
    } = args;

    const charts = { priceChart, subchartChart, timescaleChart };
    const elements = { priceLineEl, subLineEl, footLineEl };
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

    const handleCrosshairMove = (sourceChart: IChartApi, param: any, hasY: boolean) => {
        const sourcePane = sourceChart === priceChart
            ? 'price'
            : sourceChart === subchartChart
                ? 'subchart'
                : 'timescale';
        const logical = param.point ? sourceChart.timeScale().coordinateToLogical(param.point.x) : null;
        const normalizedTime = normalizeCrosshairTime(param.time);
        syncVerticalLines(sourceChart, charts, elements, series as any, param.point?.x ?? null, normalizedTime, Number(logical ?? 0));

        if (normalizedTime !== null && param.point) {
            const curTime = normalizedTime;
            const curX = param.point.x;
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
            if (dispatchRafId !== null) {
                cancelAnimationFrame(dispatchRafId);
                dispatchRafId = null;
            }

            pendingPayload = null;
            lastSyncTime = null;
            lastSyncX = null;
            lastSyncY = null;
            useMarketStore.getState().syncCrosshair(null);
            window.dispatchEvent(new CustomEvent('chart-crosshair', { detail: { time: null, sourceId: chartId, sourcePane } }));
        }
    };

    const onPrice = (p: any) => handleCrosshairMove(priceChart, p, true);
    const onSub = (p: any) => handleCrosshairMove(subchartChart, p, true);
    const onFoot = (p: any) => handleCrosshairMove(timescaleChart, p, false);

    priceChart.subscribeCrosshairMove(onPrice);
    subchartChart.subscribeCrosshairMove(onSub);
    timescaleChart.subscribeCrosshairMove(onFoot);

    return () => {
        if (dispatchRafId !== null) cancelAnimationFrame(dispatchRafId);
        priceChart.unsubscribeCrosshairMove(onPrice);
        subchartChart.unsubscribeCrosshairMove(onSub);
        timescaleChart.unsubscribeCrosshairMove(onFoot);
    };
}
