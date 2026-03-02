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
    let lastSideEffectsAt = 0;

    const handleCrosshairMove = (sourceChart: IChartApi, param: any, hasY: boolean) => {
        const logical = param.point ? sourceChart.timeScale().coordinateToLogical(param.point.x) : null;
        const normalizedTime = normalizeCrosshairTime(param.time);
        syncVerticalLines(sourceChart, charts, elements, series as any, param.point?.x ?? null, normalizedTime, Number(logical ?? 0));

        if (normalizedTime !== null && param.point) {
            const curTime = normalizedTime;
            const curX = param.point.x;
            const curY = hasY ? param.point.y : 0;
            const now = Date.now();

            if ((curTime !== lastSyncTime || curX !== lastSyncX || curY !== lastSyncY) && (now - lastSideEffectsAt > 32)) {
                lastSyncTime = curTime;
                lastSyncX = curX;
                lastSyncY = curY;
                lastSideEffectsAt = now;

                const store = useMarketStore.getState();
                const payload = {
                    time: curTime,
                    price: hasY ? Number(seriesRef.current?.coordinateToPrice(curY) ?? 0) : null,
                    sourceId: chartId,
                    point: { x: curX, y: curY },
                    logical: logical !== null ? Number(logical) : null,
                    sourceEvent: param.sourceEvent
                        ? {
                            clientX: Number(param.sourceEvent.clientX),
                            clientY: Number(param.sourceEvent.clientY),
                        }
                        : undefined,
                };

                store.syncCrosshair(payload);
                window.dispatchEvent(new CustomEvent('chart-crosshair', { detail: { ...payload, point: { x: curX, y: curY } } }));
            }
        } else if (!param.point && lastSyncTime !== null) {
            lastSyncTime = null;
            lastSyncX = null;
            lastSyncY = null;
            lastSideEffectsAt = 0;
            useMarketStore.getState().syncCrosshair(null);
            window.dispatchEvent(new CustomEvent('chart-crosshair', { detail: { time: null, sourceId: chartId } }));
        }
    };

    const onPrice = (p: any) => handleCrosshairMove(priceChart, p, true);
    const onSub = (p: any) => handleCrosshairMove(subchartChart, p, true);
    const onFoot = (p: any) => handleCrosshairMove(timescaleChart, p, false);

    priceChart.subscribeCrosshairMove(onPrice);
    subchartChart.subscribeCrosshairMove(onSub);
    timescaleChart.subscribeCrosshairMove(onFoot);

    return () => {
        priceChart.unsubscribeCrosshairMove(onPrice);
        subchartChart.unsubscribeCrosshairMove(onSub);
        timescaleChart.unsubscribeCrosshairMove(onFoot);
    };
}

