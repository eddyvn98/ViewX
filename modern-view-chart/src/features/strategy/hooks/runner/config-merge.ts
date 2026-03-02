import { normalizeSymbol } from '@/lib/utils/symbol';

export interface RunnerChartConfig {
    symbol: string;
    interval: string;
    source: string;
}

export function mergeRunnerConfigs(base: RunnerChartConfig[], extra: RunnerChartConfig[]): RunnerChartConfig[] {
    const dedupedByKey = new Map<string, RunnerChartConfig>();
    for (const cfg of [...base, ...extra]) {
        dedupedByKey.set(`${cfg.source}:${normalizeSymbol(cfg.symbol)}:${cfg.interval}`, cfg);
    }
    return Array.from(dedupedByKey.values());
}

