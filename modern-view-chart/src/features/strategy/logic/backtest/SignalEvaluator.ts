import { ConditionGroup } from '@/features/strategy/types';
import { BacktestEvaluator } from '@/features/strategy/logic/BacktestEvaluator';

export class SignalEvaluator {
    static evaluate(
        group: ConditionGroup | undefined,
        index: number,
        indicators: Record<string, number[]>
    ): boolean {
        if (!group || !group.conditions || group.conditions.length === 0) return false;

        if (group.operator === "AND") {
            return group.conditions.every((c: any) => {
                if ('operator' in c) return this.evaluate(c, index, indicators);
                return BacktestEvaluator.evaluate(c, index, indicators);
            });
        } else {
            return group.conditions.some((c: any) => {
                if ('operator' in c) return this.evaluate(c, index, indicators);
                return BacktestEvaluator.evaluate(c, index, indicators);
            });
        }
    }

    static checkCooldown(
        lastSignalTime: number,
        currentTime: number,
        cooldownMinutes: number | undefined
    ): boolean {
        if (lastSignalTime > 0 && cooldownMinutes) {
            const elapsedMs = currentTime - lastSignalTime;
            if (elapsedMs < cooldownMinutes * 60000) {
                return false;
            }
        }
        return true;
    }
}
