import { ChartInstance } from '@/lib/store/types';
import { initialMinW } from '../../config/chart-options';

export type PersistedRange = { from: number; to: number };
export type LogicalRangeSource = 'price' | 'sub' | 'foot';

const LOGICAL_RANGE_EPSILON = 0.01;

export const sanitizeRange = (range: PersistedRange | null | undefined): PersistedRange | null => {
    if (!range) return null;
    if (!Number.isFinite(range.from) || !Number.isFinite(range.to) || range.to <= range.from) return null;
    return { from: Number(range.from), to: Number(range.to) };
};

export const logicalRangesEqual = (a: PersistedRange | null, b: PersistedRange | null): boolean => {
    if (!a || !b) return false;
    return Math.abs(a.from - b.from) < LOGICAL_RANGE_EPSILON && Math.abs(a.to - b.to) < LOGICAL_RANGE_EPSILON;
};

export const buildStableTimeScaleViewport = (dataCount: number, viewportWidth: number) => ({
    from: Math.max(0, dataCount - (viewportWidth < 768 ? 40 : 80)),
    to: dataCount + 5,
});

export const resolveLockedScaleWidth = (priceWidth: number, subWidth: number): number | null => {
    const width = Math.max(priceWidth, subWidth, initialMinW);
    if (!Number.isFinite(width) || width <= 0) return null;
    return width;
};

export const readPersistedViewportForChart = (
    tabs: Record<string, { charts: Record<string, ChartInstance> }>,
    chartId: string
): ChartInstance['viewport'] | undefined => {
    for (const tab of Object.values(tabs)) {
        const chart = tab.charts[chartId];
        if (chart) return chart.viewport;
    }
    return undefined;
};
