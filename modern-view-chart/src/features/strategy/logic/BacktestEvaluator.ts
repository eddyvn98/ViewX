
import { Candle } from '@/lib/store/types';

/**
 * BacktestEvaluator
 * Optimized version of ConditionEvaluator for batch processing.
 * Instead of calculating indicators on the fly, it expects pre-calculated arrays of values.
 */
export class BacktestEvaluator {
    static evaluate(condition: any, index: number, indicatorValues: Record<string, number[]>): boolean {
        const { left, comparator, right } = condition;

        // Construct key for pre-calculated values (e.g., "RSI-14")
        const leftKey = `${left.type}-${left.params?.join('-') || ''}`;
        const leftArr = indicatorValues[leftKey];

        // If data is missing or index out of bounds, fail safe
        if (!leftArr || index >= leftArr.length || index < 0) return false;

        const leftVal = leftArr[index];

        let rightVal = 0;
        if (typeof right === 'number') {
            rightVal = right;
        } else {
            // Right side is also an indicator
            const rightKey = `${right.type}-${right.params?.join('-') || ''}`;
            const rightArr = indicatorValues[rightKey];
            if (!rightArr || index >= rightArr.length) return false;
            rightVal = rightArr[index];
        }

        if (isNaN(leftVal) || isNaN(rightVal)) return false;

        switch (comparator) {
            case ">": return leftVal > rightVal;
            case "<": return leftVal < rightVal;
            case ">=": return leftVal >= rightVal;
            case "<=": return leftVal <= rightVal;
            case "crosses_above": {
                // Check previous index
                if (index === 0) return false;
                const prevLeft = leftArr[index - 1];
                const prevRight = typeof right === 'number' ? right : (indicatorValues[`${right.type}-${right.params?.join('-')}`]?.[index - 1] ?? 0);
                return prevLeft <= prevRight && leftVal > rightVal;
            }
            case "crosses_below": {
                if (index === 0) return false;
                const prevLeft = leftArr[index - 1];
                const prevRight = typeof right === 'number' ? right : (indicatorValues[`${right.type}-${right.params?.join('-')}`]?.[index - 1] ?? 0);
                return prevLeft >= prevRight && leftVal < rightVal;
            }
            default: return false;
        }
    }
}
