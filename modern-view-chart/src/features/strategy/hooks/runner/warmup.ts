import { normalizeSymbol } from '@/lib/utils/symbol';
import { normalizeTF } from '../../utils/time-utils';
import type { Strategy } from '../../types';

interface ActiveChartLike {
    symbol?: string;
}

interface ActiveTabLike {
    activeChartId?: string | null;
    charts?: Record<string, ActiveChartLike>;
}

export function getLegacyStrategyPatch(strategy: Strategy): Partial<Strategy> | null {
    if (!strategy.cancelConditions && (strategy.id.includes('hull-ha-gold') || strategy.name.toLowerCase().includes('hull ha'))) {
        const cancelConditions = strategy.side === 'BUY'
            ? { operator: 'OR' as const, conditions: [{ id: 'buy-cancel-rsi', left: { type: 'RSI' as const, params: [14] }, comparator: '<' as const, right: 55 }] }
            : { operator: 'OR' as const, conditions: [{ id: 'sell-cancel-rsi', left: { type: 'RSI' as const, params: [14] }, comparator: '>' as const, right: 45 }] };
        return { cancelConditions };
    }

    if (strategy.id === 'test-trigger-rsi' && strategy.symbol !== '') {
        return { symbol: '' };
    }

    return null;
}

export function resolveWarmupDataKey(
    strategy: Strategy,
    candleData: Record<string, unknown[]>,
    activeTab: ActiveTabLike | null
): string | undefined {
    const interval = strategy.timeframe || '1m';
    const intervalNorm = normalizeTF(interval);
    const availableKeys = Object.keys(candleData);

    if (strategy.symbol) {
        const normSymbol = normalizeSymbol(strategy.symbol).toLowerCase();
        return availableKeys.find((key) => {
            const parts = key.toLowerCase().split(':');
            if (parts.length < 3) return false;
            return parts[1] === normSymbol && normalizeTF(parts[2]) === intervalNorm;
        });
    }

    const activeChart = (activeTab?.activeChartId && activeTab?.charts) ? activeTab.charts[activeTab.activeChartId] : null;
    const activeSymbol = normalizeSymbol(activeChart?.symbol || '').toLowerCase();
    const activeKey = availableKeys.find((key) => {
        const parts = key.toLowerCase().split(':');
        return parts[1] === activeSymbol && normalizeTF(parts[2]) === intervalNorm && candleData[key].length >= 50;
    });
    if (activeKey) return activeKey;

    return availableKeys.find((key) => normalizeTF(key.split(':').pop()) === intervalNorm && candleData[key].length >= 50);
}

export function shouldTriggerWarmup(lastRunAt: number, hasActivePos: boolean, hasHistoricalPos: boolean): boolean {
    return !lastRunAt || (!hasActivePos && !hasHistoricalPos && (Date.now() - lastRunAt > 10000));
}
