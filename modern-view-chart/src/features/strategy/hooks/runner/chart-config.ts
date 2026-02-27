import { normalizeSymbol } from '@/lib/utils/symbol';
import { normalizeTF } from '../../utils/time-utils';
import type { Strategy } from '../../types';

export interface ChartConfig {
    symbol: string;
    interval: string;
    source: string;
}

interface ChartLike {
    symbol: string;
    interval?: string;
    source?: string;
}

interface TabLike {
    charts: Record<string, ChartLike>;
}

export function collectUniqueChartConfigs(tabs: Record<string, TabLike>): ChartConfig[] {
    const uniqueChartConfigs: ChartConfig[] = [];
    const uniqueKeys = new Set<string>();

    Object.values(tabs).forEach((tab) => {
        Object.values(tab.charts).forEach((chart) => {
            const symbol = chart.symbol;
            const interval = chart.interval || '1m';
            const source = chart.source || 'default';
            const key = `${source}:${normalizeSymbol(symbol)}:${interval}`;
            if (uniqueKeys.has(key)) return;
            uniqueKeys.add(key);
            uniqueChartConfigs.push({ symbol, interval, source });
        });
    });

    return uniqueChartConfigs;
}

export function matchActiveStrategiesForChart(
    strategies: Strategy[],
    normalizedSymbol: string,
    interval: string
): Strategy[] {
    return strategies.filter((strategy) => {
        if (!strategy.active) return false;
        const symbolMatch = !strategy.symbol || normalizeSymbol(strategy.symbol) === normalizedSymbol;
        const timeframeMatch = !strategy.timeframe || normalizeTF(strategy.timeframe) === normalizeTF(interval);
        return symbolMatch && timeframeMatch;
    });
}
