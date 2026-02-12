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
        const hasOpenPosition = strategyPositions.some(p => p.status === 'open');
        const pendingPosition = strategyPositions.find(p => p.status === 'pending');

        if (Math.random() < 0.1) console.log(`[RuleEngine] Checking ${strategy.name} (${strategy.id}) open=${hasOpenPosition} pending=${!!pendingPosition}`);

        // 0. CANCEL PRIORITY: If we have PENDING order, check Cancel rules
        if (pendingPosition && strategy.cancelConditions) {
            const shouldCancel = this.evaluateGroup(strategy.cancelConditions, candles);
            console.log(`[RuleEngine] Checking Cancel for ${strategy.name}: result=${shouldCancel}`);

            if (shouldCancel) {
                return {
                    type: "CANCEL",
                    symbol,
                    strategyId: strategy.id,
                    timestamp: Date.now(),
                    price: currentPrice,
                    risk: strategy.risk
                };
            }
        } else if (pendingPosition) {
            // Log if we have a pending position but NO cancel conditions
            if (Math.random() < 0.05) console.warn(`[RuleEngine] ${strategy.name} has PENDING order but NO cancel conditions defined.`);
        }


        // 1. EXIT PRIORITY: If we have OPEN position, check Exit rules
        if (hasOpenPosition && strategy.exit) {
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
            (!hasOpenPosition && !pendingPosition) ||
            (strategy.positionMode === "scale_in" && strategyPositions.length < (strategy.risk.maxTrades || 1));

        if (!canEnter) {
            if (Math.random() < 0.1) console.log(`[RuleEngine] Cannot Enter: ${strategy.name} (Open: ${hasOpenPosition}, Pending: ${!!pendingPosition}, Mode: ${strategy.positionMode})`);
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
            // FIX: Smart fallback for legacy strategies
            let type = strategy.side;

            if (!type) {
                const nameLower = strategy.name.toLowerCase();
                if (nameLower.includes('sell') || nameLower.includes('short')) type = 'SELL';
                else if (nameLower.includes('buy') || nameLower.includes('long')) type = 'BUY';
                else type = 'BUY'; // Final fallback

                console.warn(`[RuleEngine] Strategy ${strategy.name} missing side. Inferred: ${type}`);
            }


            return {
                type,
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
