import { IChartApi } from 'lightweight-charts';
import type { ChartInstance } from '@/lib/store/types';
import type { MutableRefObject } from 'react';
import { sanitizeRange, PersistedRange } from '../chart-init-helpers';

type ViewportPersistenceDeps = {
    priceChart: IChartApi;
    subchartChart: IChartApi;
    currentContextKeyRef: MutableRefObject<string | undefined>;
    viewportSaveTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    updateChart: (chartId: string, patch: Partial<ChartInstance>) => void;
    chartId: string;
    getIsPointerInteracting: () => boolean;
};

export type ViewportPersistence = {
    scheduleViewportPersist: () => void;
    flushPendingViewportPersist: () => void;
};

function readVisibleRange(getRange: (() => PersistedRange | null) | undefined): PersistedRange | null {
    try {
        return sanitizeRange(getRange?.() ?? null);
    } catch {
        // A timeframe switch can briefly leave Lightweight Charts without a scale range.
        return null;
    }
}

export function createViewportPersistence({
    priceChart,
    subchartChart,
    currentContextKeyRef,
    viewportSaveTimeoutRef,
    updateChart,
    chartId,
    getIsPointerInteracting,
}: ViewportPersistenceDeps): ViewportPersistence {
    let lastViewportSnapshot = '';
    let hasPendingViewportPersist = false;

    const persistViewport = () => {
        const logicalRange = readVisibleRange(
            () => priceChart.timeScale().getVisibleLogicalRange() as PersistedRange | null,
        );
        const mainPriceScale = priceChart.priceScale('right') as {
            getVisibleRange?: () => PersistedRange | null;
            options?: () => { autoScale?: boolean };
        };
        const subPriceScale = subchartChart.priceScale('right') as {
            getVisibleRange?: () => PersistedRange | null;
            setVisibleRange?: (range: PersistedRange) => void;
        };
        const mainPriceRange = mainPriceScale.options?.().autoScale === false
            ? readVisibleRange(mainPriceScale.getVisibleRange)
            : null;
        const subPriceRange = readVisibleRange(subPriceScale.getVisibleRange);

        const nextViewport: NonNullable<ChartInstance['viewport']> = {
            contextKey: currentContextKeyRef.current,
            savedAt: Date.now(),
        };

        if (logicalRange) nextViewport.logicalRange = logicalRange;
        if (mainPriceRange) nextViewport.mainPriceRange = mainPriceRange;
        if (subPriceRange) nextViewport.subPriceRange = subPriceRange;

        const nextSnapshot = JSON.stringify(nextViewport);
        if (nextSnapshot === lastViewportSnapshot) return;

        lastViewportSnapshot = nextSnapshot;
        updateChart(chartId, { viewport: nextViewport });
    };

    const scheduleViewportPersist = () => {
        if (getIsPointerInteracting()) {
            hasPendingViewportPersist = true;
            return;
        }
        if (viewportSaveTimeoutRef.current) clearTimeout(viewportSaveTimeoutRef.current);
        viewportSaveTimeoutRef.current = setTimeout(() => {
            viewportSaveTimeoutRef.current = null;
            persistViewport();
        }, 180);
    };

    const flushPendingViewportPersist = () => {
        if (!hasPendingViewportPersist) return;
        hasPendingViewportPersist = false;
        scheduleViewportPersist();
    };

    return {
        scheduleViewportPersist,
        flushPendingViewportPersist,
    };
}
