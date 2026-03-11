import { Candle } from '@/lib/store/types';
import { IndicatorCalculator as Calc } from './IndicatorCalculator';

export class ConditionEvaluator {
    static evaluate(condition: any, candles: Candle[]): boolean {
        const { left, comparator, right } = condition;

        const leftVal = Calc.getLastValue(left, candles);
        const rightVal = typeof right === 'number' ? right : Calc.getLastValue(right, candles);

        // REMOVED: console.log flooding causing performance issues
        // if (Math.random() < 0.1 || condition.left.type === 'RSI') {
        //     console.log(`[Eval] ${condition.id || 'cond'}: ${leftVal?.toFixed(2)} ${comparator} ${rightVal}`);
        // }

        if (isNaN(leftVal) || (typeof right !== 'number' && isNaN(rightVal))) return false;

        switch (comparator) {
            case ">": return leftVal > rightVal;
            case "<": return leftVal < rightVal;
            case ">=": return leftVal >= rightVal;
            case "<=": return leftVal <= rightVal;
            case "crosses_above": {
                const prevLeft = Calc.getPreviousValue(left, candles);
                const prevRight = typeof right === 'number' ? right : Calc.getPreviousValue(right, candles);
                return prevLeft <= prevRight && leftVal > rightVal;
            }
            case "crosses_below": {
                const prevLeft = Calc.getPreviousValue(left, candles);
                const prevRight = typeof right === 'number' ? right : Calc.getPreviousValue(right, candles);
                return prevLeft >= prevRight && leftVal < rightVal;
            }
            default: return false;
        }
    }
}
