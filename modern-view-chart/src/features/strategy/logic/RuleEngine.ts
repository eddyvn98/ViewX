import { Candle } from '@/lib/store/types';
import { Strategy, ConditionGroup, StrategySignal, Condition } from '../types';
import { ConditionEvaluator as Eval } from './ConditionEvaluator';
import { ContextCollector } from './ContextCollector';
import { getStrategyDirections, getStrategyLeg } from '../strategy-helpers';

export interface EngineContext {
    // ... existing interface
    activePositions: any[];
    currentPrice: number;
    symbol: string;
    lastSignalTime?: number; // Last time a signal was generated for this strategy
}

export class RuleEngine {
    static evaluateGroup(group: ConditionGroup, candles: Candle[]): boolean {
        if (!group || !group.conditions || group.conditions.length === 0) return false;

        if (group.operator === "AND") {
            return group.conditions.every(c => {
                if ('operator' in c) return this.evaluateGroup(c as ConditionGroup, candles);
                return Eval.evaluate(c as Condition, candles);
            });
        } else {
            return group.conditions.some(c => {
                if ('operator' in c) return this.evaluateGroup(c as ConditionGroup, candles);
                return Eval.evaluate(c as Condition, candles);
            });
        }
    }

    static run(strategy: Strategy, candles: Candle[], context: EngineContext): StrategySignal | null {
        if (candles.length < 2) return null;

        const { activePositions, currentPrice, symbol, lastSignalTime } = context;
        for (const direction of getStrategyDirections(strategy)) {
            const leg = getStrategyLeg(strategy, direction);
            const strategyPositions = activePositions.filter(
                p => p.symbol === symbol && p.strategyId === strategy.id && p.type === direction
            );
            const hasOpenPosition = strategyPositions.some(p => p.status === 'open');
            const pendingPosition = strategyPositions.find(p => p.status === 'pending');

            if (pendingPosition && leg.cancelConditions) {
                const shouldCancel = this.evaluateGroup(leg.cancelConditions, candles);
                if (shouldCancel) {
                    return {
                        type: "CANCEL",
                        symbol,
                        strategyId: strategy.id,
                        timestamp: Date.now(),
                        price: currentPrice,
                        risk: leg.risk,
                        direction,
                    };
                }
            }

            if (hasOpenPosition && leg.exit) {
                const shouldExit = this.evaluateGroup(leg.exit, candles);
                if (shouldExit) {
                    return {
                        type: "EXIT",
                        symbol,
                        strategyId: strategy.id,
                        timestamp: Date.now(),
                        price: currentPrice,
                        risk: leg.risk,
                        direction,
                    };
                }
            }

            const canEnter =
                (!hasOpenPosition && !pendingPosition) ||
                (strategy.positionMode === "scale_in" && strategyPositions.length < (leg.risk.maxTrades || 1));
            if (!canEnter) continue;

            if (lastSignalTime && leg.risk.cooldownMinutes) {
                const elapsedMs = Date.now() - lastSignalTime;
                if (elapsedMs < leg.risk.cooldownMinutes * 60000) continue;
            }

            const triggerOk = !leg.trigger || this.evaluateGroup(leg.trigger, candles);
            const entryOk = this.evaluateGroup(leg.entry, candles);
            if (!triggerOk || !entryOk) continue;

            const contextData = ContextCollector.captureEntryContext(strategy, candles, symbol);
            return {
                type: direction,
                symbol,
                strategyId: strategy.id,
                timestamp: Date.now(),
                price: currentPrice,
                risk: leg.risk,
                direction,
                context: contextData
            };
        }

        return null;
    }
}
