import { IChartApi, ISeriesApi } from 'lightweight-charts';

function isBenignSeriesRemovalError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '');
    return message.includes('Value is undefined');
}

export function safeRemoveSeries(
    chart: IChartApi,
    series: ISeriesApi<any> | null | undefined,
    label?: string
) {
    if (!series) return;

    try {
        chart.removeSeries(series);
    } catch (error) {
        if (isBenignSeriesRemovalError(error)) return;
        if (label) {
            console.warn(`[${label}] Failed to remove series:`, error);
        }
    }
}
