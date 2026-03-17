import { Candle } from '@/lib/store/types';
import { ConditionGroup, Strategy, VirtualPosition } from '../types';
import { BacktestEngine } from './backtest/BacktestEngine';
import { SignalEvaluator } from './backtest/SignalEvaluator';

/**
 * BacktestRunner
 * Facade for the BacktestEngine to maintain backward compatibility.
 */
export class BacktestRunner {
    static run(strategy: Strategy, candles: Candle[], initialBalance: number = 10000, overrideSymbol?: string): VirtualPosition[] {
        return BacktestEngine.run(strategy, candles, initialBalance, overrideSymbol);
    }

    /**
     * @deprecated Use SignalEvaluator.evaluate directly if possible
     */
    static evaluateGroup(group: ConditionGroup | undefined, index: number, indicators: Record<string, number[]>): boolean {
        return SignalEvaluator.evaluate(group, index, indicators);
    }
}
