import type {
    ConditionGroup,
    Strategy,
    StrategyDirection,
    StrategyLeg,
    StrategyRisk,
} from './types';

function createEmptyGroup(operator: 'AND' | 'OR' = 'AND'): ConditionGroup {
    return { operator, conditions: [] };
}

function createDefaultRisk(direction: StrategyDirection): StrategyRisk {
    return {
        sl: { mode: 'candle', candleField: direction === 'BUY' ? 'low' : 'high', candleOffset: 1, offset: 0 },
        tp: undefined,
        trailing: true,
        slSource: direction === 'BUY' ? 'HA_Low' : 'HA_High',
        trailingSource: direction === 'BUY' ? 'HA_Low' : 'HA_High',
        lotSize: { mode: 'fixed', value: 0.1 },
        maxTrades: 1,
        cooldownMinutes: 5,
    };
}

export function getStrategyLeg(strategy: Strategy, direction: StrategyDirection): StrategyLeg {
    const explicitLeg = direction === 'BUY' ? strategy.buy : strategy.sell;
    if (explicitLeg) {
        return {
            entry: explicitLeg.entry || createEmptyGroup('AND'),
            trigger: explicitLeg.trigger,
            exit: explicitLeg.exit,
            cancelConditions: explicitLeg.cancelConditions,
            risk: explicitLeg.risk || createDefaultRisk(direction),
            entryType: explicitLeg.entryType || strategy.entryType,
            entryPrice: explicitLeg.entryPrice || strategy.entryPrice,
        };
    }

    const isLegacyMatch = !strategy.side || strategy.side === direction;
    return {
        entry: isLegacyMatch && strategy.entry ? strategy.entry : createEmptyGroup('AND'),
        trigger: isLegacyMatch ? strategy.trigger : undefined,
        exit: isLegacyMatch ? strategy.exit : undefined,
        cancelConditions: isLegacyMatch ? strategy.cancelConditions : undefined,
        risk: (isLegacyMatch && strategy.risk) || createDefaultRisk(direction),
        entryType: strategy.entryType,
        entryPrice: strategy.entryPrice,
    };
}

export function strategySupportsDirection(strategy: Strategy, direction: StrategyDirection): boolean {
    if (direction === 'BUY' && strategy.buy) return true;
    if (direction === 'SELL' && strategy.sell) return true;
    if (strategy.buy || strategy.sell) return false;
    return !strategy.side || strategy.side === direction;
}

export function getStrategyDirections(strategy: Strategy): StrategyDirection[] {
    const directions: StrategyDirection[] = [];
    if (strategySupportsDirection(strategy, 'BUY')) directions.push('BUY');
    if (strategySupportsDirection(strategy, 'SELL')) directions.push('SELL');
    return directions;
}

export function getPrimaryStrategyRisk(strategy: Strategy): StrategyRisk {
    if (strategy.buy?.risk) return strategy.buy.risk;
    if (strategy.sell?.risk) return strategy.sell.risk;
    return strategy.risk || createDefaultRisk('BUY');
}
