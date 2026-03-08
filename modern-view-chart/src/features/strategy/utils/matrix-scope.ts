import { normalizeSymbol } from '@/lib/utils/symbol';
import { normalizeTF } from './time-utils';

export function buildMatrixScopeKey(strategyId: string, symbol: string, timeframe: string): string {
    return `${strategyId}:${normalizeSymbol(symbol)}:${normalizeTF(timeframe)}`;
}

export function normalizeMatrixScopeKey(
    strategyId: string | undefined,
    symbol: string | undefined,
    timeframe: string | undefined,
    existingKey?: string
): string | undefined {
    if (existingKey) return existingKey;
    if (!strategyId || !symbol || !timeframe) return undefined;
    return buildMatrixScopeKey(strategyId, symbol, timeframe);
}
