/* eslint-disable @typescript-eslint/no-explicit-any */
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { TagData } from './order-tag-utils';
import { TagElements, TagOriginalMeta } from './tag-renderer.types';

function toEpochSec(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n > 100000000000 ? Math.floor(n / 1000) : Math.floor(n);
}

export function resolveTagAnchorTime(tag: TagData | undefined, liveAnchorTime?: number): number | null {
    if (!tag) return null;
    const original = ((tag.pOriginal as any) || {}) as TagOriginalMeta;
    const isHistory = !!original.isHistorical || original.status === 'closed';
    const isPending = original.status === 'pending';
    const isLiveEntry = tag.type === 'entry' && tag.ticket !== 'draft' && !isHistory && !isPending;

    const originalTime =
        tag.anchorTime ??
        original.time ??
        original.timestamp ??
        original.createdAt;
    const rawTime = originalTime ?? (isLiveEntry ? liveAnchorTime : undefined);

    return toEpochSec(rawTime);
}

export function resolveTagXCoordinate(timeScale: ReturnType<IChartApi['timeScale']>, timestampSec: number): number | null {
    const direct = timeScale.timeToCoordinate(timestampSec as Time);
    if (direct !== null) return direct;

    const buckets = [60, 300, 900, 1800, 3600, 14400, 86400];
    for (const bucket of buckets) {
        const floorTs = Math.floor(timestampSec / bucket) * bucket;
        const ceilTs = floorTs + bucket;

        const xf = timeScale.timeToCoordinate(floorTs as Time);
        if (xf !== null) return xf;

        const xc = timeScale.timeToCoordinate(ceilTs as Time);
        if (xc !== null) return xc;
    }

    for (let delta = 1; delta <= 3; delta++) {
        const x1 = timeScale.timeToCoordinate((timestampSec - delta) as Time);
        if (x1 !== null) return x1;
        const x2 = timeScale.timeToCoordinate((timestampSec + delta) as Time);
        if (x2 !== null) return x2;
    }

    return null;
}

export function applyTagFallbackPosition(elements: TagElements) {
    elements.el.style.opacity = '1';
    elements.el.style.left = 'auto';
    elements.el.style.right = '120px';
}

export function updateTagPosition(
    elements: TagElements,
    series: ISeriesApi<'Candlestick'>,
    price: number,
    chart?: IChartApi | null,
    tag?: TagData,
    liveAnchorTime?: number
) {
    const y = series.priceToCoordinate(price);
    if (y === null) return;
    (elements.el as HTMLElement).dataset.yCoord = `${Math.round(y)}`;

    const yOffset = elements.priceBox?.classList.contains('dot-marker') ? 6 : 12;
    elements.el.style.transform = `translateY(${y - yOffset}px)`;

    const td = (tag || (elements.el as any)._tagData) as TagData | undefined;
    const timestampSec = resolveTagAnchorTime(td, liveAnchorTime);

    if (chart && timestampSec) {
        const x = resolveTagXCoordinate(chart.timeScale(), timestampSec);
        if (x !== null) {
            elements.el.style.left = `${x + 8}px`;
            elements.el.style.right = 'auto';
            elements.el.style.opacity = '1';
            return;
        }

        elements.el.style.opacity = '0';
        return;
    }

    applyTagFallbackPosition(elements);
}
