import { Candle } from '@/lib/store/types';
import { Strategy, ConditionGroup, StrategySignal, Condition } from '../types';
import { ConditionEvaluator as Eval } from './ConditionEvaluator';

export interface EngineContext {
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
        if (!strategy.active || candles.length < 2) return null;

        const { activePositions, currentPrice, symbol, lastSignalTime } = context;
        const strategyPositions = activePositions.filter(p => p.symbol === symbol && p.strategyId === strategy.id);
        const hasPosition = strategyPositions.length > 0;

        if (Math.random() < 0.1) console.log(`[RuleEngine] Checking ${strategy.name} (${strategy.id}) pos=${hasPosition} mode=${strategy.positionMode}`);

        // 1. EXIT PRIORITY: If we have position, check Exit rules first
        if (hasPosition && strategy.exit) {
            const shouldExit = this.evaluateGroup(strategy.exit, candles);
            if (shouldExit) {
                return {
                    type: "EXIT",
                    symbol,
                    strategyId: strategy.id,
                    timestamp: Date.now(),
                    price: currentPrice,
                    risk: strategy.risk
                };
            }
        }

        // 2. ENTRY EVALUATION (Only if flat or scaling)
        const canEnter =
            !hasPosition ||
            (strategy.positionMode === "scale_in" && strategyPositions.length < (strategy.risk.maxTrades || 1));

        if (!canEnter) {
            if (Math.random() < 0.1) console.log(`[RuleEngine] Cannot Enter: ${strategy.name} (HasPos: ${hasPosition}, Mode: ${strategy.positionMode})`);
            return null;
        }

        // 3. COOLDOWN CHECK (Wait minutes since last signal)
        if (lastSignalTime && strategy.risk.cooldownMinutes) {
            const elapsedMs = Date.now() - lastSignalTime;
            if (elapsedMs < strategy.risk.cooldownMinutes * 60000) {
                if (Math.random() < 0.1) console.log(`[RuleEngine] Cooldown active: ${strategy.name} (${(elapsedMs / 1000).toFixed(0)}s < ${strategy.risk.cooldownMinutes * 60}s)`);
                return null;
            }
        }

        const isEntry = this.evaluateGroup(strategy.entry, candles);
        if (!isEntry) {
            if (Math.random() < 0.1) console.log(`[RuleEngine] Entry conditions FAILED for ${strategy.name}`);
        }
        if (isEntry) {
            return {
                type: "BUY",
                symbol,
                strategyId: strategy.id,
                timestamp: Date.now(),
                price: currentPrice,
                risk: strategy.risk
            };
        }

        return null;
    }
}
