export type ChartPerfCounters = {
    historySetDataBatches: number;
    tickerMessages: number;
    tickerFrames: number;
    realtimeSeriesUpdates: number;
    indicatorWorkerBatches: number;
    indicatorConfigsCalculated: number;
};

const initialCounters = (): ChartPerfCounters => ({
    historySetDataBatches: 0,
    tickerMessages: 0,
    tickerFrames: 0,
    realtimeSeriesUpdates: 0,
    indicatorWorkerBatches: 0,
    indicatorConfigsCalculated: 0,
});

let counters = initialCounters();

function enabled(): boolean {
    return process.env.NEXT_PUBLIC_E2E === '1';
}

export function bumpChartPerfCounter(
    key: keyof ChartPerfCounters,
    amount = 1,
): void {
    if (!enabled()) return;
    counters[key] += amount;
}

export function resetChartPerfCounters(): void {
    counters = initialCounters();
}

export function getChartPerfCounters(): ChartPerfCounters {
    return { ...counters };
}
