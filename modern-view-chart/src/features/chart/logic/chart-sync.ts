import { IChartApi, ISeriesApi } from 'lightweight-charts';

type SyncLineElement = HTMLDivElement & {
    __lastLogical?: number | null;
    __lastLeft?: number | null;
    __visible?: boolean;
};

type SyncTimeLabelElement = HTMLDivElement & {
    __lastText?: string | null;
    __lastLeft?: number | null;
    __visible?: boolean;
};

const normalizeSeriesTime = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value === 'object' && 'timestamp' in (value as Record<string, unknown>)) {
        const timestamp = (value as { timestamp?: unknown }).timestamp;
        if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
            return timestamp > 10000000000 ? Math.floor(timestamp / 1000) : timestamp;
        }
    }
    return null;
};

const resolveTimeForLogical = (
    logical: number,
    fallbackTime: number | null,
    series: ISeriesApi<"Line">
): number | null => {
    const data = (series as any)?.data?.();
    if (!Array.isArray(data) || data.length === 0) return fallbackTime;

    const safeLogical = Number.isFinite(logical) ? logical : null;
    if (safeLogical === null) return fallbackTime;

    const lowerIndex = Math.floor(safeLogical);
    const upperIndex = Math.ceil(safeLogical);
    const lowerTime = normalizeSeriesTime(data[lowerIndex]?.time);
    const upperTime = normalizeSeriesTime(data[upperIndex]?.time);

    if (lowerTime !== null && upperTime !== null && upperIndex !== lowerIndex) {
        const ratio = safeLogical - lowerIndex;
        return lowerTime + (upperTime - lowerTime) * ratio;
    }

    if (lowerTime !== null) return lowerTime;
    if (upperTime !== null) return upperTime;

    const lastTime = normalizeSeriesTime(data[data.length - 1]?.time);
    const prevTime = normalizeSeriesTime(data[data.length - 2]?.time);
    if (lastTime !== null && prevTime !== null) {
        const step = lastTime - prevTime;
        if (step > 0) {
            return lastTime + step * (safeLogical - (data.length - 1));
        }
    }

    return fallbackTime;
};

/* ================= DOM-BASED CROSSHAIR SYNC ================= */

export const createSyncLine = (container: HTMLElement | null): HTMLDivElement | null => {
    if (!container) return null;
    const line = document.createElement('div');
    line.style.cssText = `
        position: absolute; top: 0; bottom: 0; width: 1px;
        background: #758696; pointer-events: none; z-index: 10;
        display: none; transform: translateX(-0.5px);
    `;
    container.style.position = 'relative';
    container.appendChild(line);
    const syncLine = line as SyncLineElement;
    syncLine.__lastLogical = null;
    syncLine.__lastLeft = null;
    syncLine.__visible = false;
    return syncLine;
};

export const createSyncTimeLabel = (container: HTMLElement | null): HTMLDivElement | null => {
    if (!container) return null;
    const label = document.createElement('div');
    label.dataset.syncTimeLabel = 'true';
    label.style.cssText = `
        position: absolute;
        bottom: 8px;
        left: 0;
        display: none;
        pointer-events: none;
        z-index: 15;
        padding: 4px 10px;
        border-radius: 4px;
        background: #374151;
        color: #ffffff;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        transform: translateZ(0);
    `;
    container.style.position = 'relative';
    container.appendChild(label);
    const syncLabel = label as SyncTimeLabelElement;
    syncLabel.__lastLeft = null;
    syncLabel.__lastText = null;
    syncLabel.__visible = false;
    return syncLabel;
};

export const syncVerticalLines = (
    sourceChart: IChartApi,
    charts: {
        priceChart: IChartApi,
        subchartChart: IChartApi,
        timescaleChart: IChartApi
    },
    elements: {
        priceLineEl: HTMLDivElement | null,
        subLineEl: HTMLDivElement | null,
        footLineEl: HTMLDivElement | null,
        footTimeLabelEl: HTMLDivElement | null
    },
    series: {
        candleSeries: ISeriesApi<"Candlestick">,
        subSyncSeries: ISeriesApi<"Line">,
        footSyncSeries: ISeriesApi<"Line">
    },
    x: number | null,
    time: number | null,
    logical: number | null,
    formatTimeLabel?: (timestampSec: number) => string
) => {
    if (x !== null && logical !== null) {
        const items = [
            { chart: charts.priceChart, line: elements.priceLineEl as SyncLineElement | null, series: series.candleSeries },
            { chart: charts.subchartChart, line: elements.subLineEl as SyncLineElement | null, series: series.subSyncSeries },
            { chart: charts.timescaleChart, line: elements.footLineEl as SyncLineElement | null, series: series.footSyncSeries }
        ];

        items.forEach(item => {
            if (!item.line) return;
            const resolvedTime = item.chart === charts.timescaleChart
                ? resolveTimeForLogical(logical, time, item.series as ISeriesApi<"Line">)
                : time;
            if (item.line.__lastLogical === logical && item.line.__visible) {
                return;
            }
            const containerWidth = item.line.parentElement?.clientWidth ?? 0;
            const clampedX = containerWidth > 0
                ? Math.max(0, Math.min(x, containerWidth))
                : x;

            if (!item.line.__visible) {
                item.line.style.display = 'block';
                item.line.__visible = true;
            }
            if (item.line.__lastLeft !== clampedX) {
                item.line.style.left = `${clampedX}px`;
                item.line.__lastLeft = clampedX;
            }
            item.line.__lastLogical = logical;

            if (
                item.chart === charts.timescaleChart
                && sourceChart !== charts.timescaleChart
                && resolvedTime !== null
                && elements.footTimeLabelEl
                && formatTimeLabel
            ) {
                const label = elements.footTimeLabelEl as SyncTimeLabelElement;
                const text = formatTimeLabel(resolvedTime);
                if (!label.__visible) {
                    label.style.display = 'block';
                    label.__visible = true;
                }
                if (label.__lastText !== text) {
                    label.textContent = text;
                    label.__lastText = text;
                    label.__lastLeft = null;
                }

                const labelContainerWidth = elements.footLineEl?.parentElement?.clientWidth
                    ?? label.parentElement?.getBoundingClientRect().width
                    ?? containerWidth;
                const labelWidth = label.offsetWidth || 0;
                const centeredLeft = clampedX - (labelWidth / 2);
                const clampedLeft = Math.max(4, Math.min(centeredLeft, Math.max(4, labelContainerWidth - labelWidth - 4)));
                if (label.__lastLeft !== clampedLeft) {
                    label.style.left = `${clampedLeft}px`;
                    label.__lastLeft = clampedLeft;
                }
            }
        });
    } else {
        [elements.priceLineEl, elements.subLineEl, elements.footLineEl].forEach(el => {
            const line = el as SyncLineElement | null;
            if (!line) return;
            if (line.__visible) {
                line.style.display = 'none';
                line.__visible = false;
            }
            line.__lastLogical = null;
            line.__lastLeft = null;
        });
        const label = elements.footTimeLabelEl as SyncTimeLabelElement | null;
        if (label) {
            if (label.__visible) {
                label.style.display = 'none';
                label.__visible = false;
            }
            label.__lastLeft = null;
            label.__lastText = null;
        }
        // Clear except source
        if (charts.priceChart !== sourceChart) charts.priceChart.clearCrosshairPosition();
        if (charts.subchartChart !== sourceChart) charts.subchartChart.clearCrosshairPosition();
        if (charts.timescaleChart !== sourceChart) charts.timescaleChart.clearCrosshairPosition();
    }
};

/* ================= SYNC LAYOUT WIDTH ================= */
export const autoSyncLayout = (
    priceChart: IChartApi,
    subchartChart: IChartApi,
    timescaleChart: IChartApi,
    priceContainer: HTMLElement | null,
    subchartContainer: HTMLElement | null,
    initialMinW: number,
    lastMaxW: number,
    syncRequestId: number | null,
    setSyncRequestId: (id: number | null) => void,
    setLastMaxW: (w: number) => void
) => {
    if (syncRequestId !== null) return;

    const id = requestAnimationFrame(() => {
        setSyncRequestId(null);
        if (!priceContainer || !subchartContainer) return;

        try {
            const priceScale = priceChart?.priceScale('right');
            const subchartScale = subchartChart?.priceScale('right');

            if (!priceScale || !subchartScale) return;

            const priceW = priceScale.width();
            const subW = subchartScale.width();
            const maxW = Math.max(priceW, subW, initialMinW);

            if (Math.abs(maxW - lastMaxW) > 1) {
                setLastMaxW(maxW);
                const opt = { rightPriceScale: { minimumWidth: maxW } };
                priceChart?.applyOptions(opt);
                subchartChart?.applyOptions(opt);
                timescaleChart?.applyOptions(opt);
            }
        } catch (e) {
            // Chart might have been destroyed/removed during RAF
        }
    });

    setSyncRequestId(id);
};
