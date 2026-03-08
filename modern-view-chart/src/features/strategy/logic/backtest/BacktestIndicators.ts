import { Candle } from '@/lib/store/types';
import { IndicatorCalculator } from '@/features/strategy/logic/IndicatorCalculator';
import { Strategy } from '@/features/strategy/types';
import { getStrategyDirections, getStrategyLeg } from '@/features/strategy/strategy-helpers';

export class BacktestIndicators {
    private indicators: Record<string, number[]> = {};

    constructor(private candles: Candle[]) { }

    public preCalculate(strategy: Strategy) {
        // Always calculate ATR for metrics
        this.getOrCalculate({ type: 'ATR', params: [14] });

        const scanGroup = (group: any) => {
            if (!group || !group.conditions) return;
            group.conditions.forEach((cond: any) => {
                if ('operator' in cond) {
                    scanGroup(cond);
                } else {
                    this.cacheIndicator(cond);
                }
            });
        };

        for (const direction of getStrategyDirections(strategy)) {
            const leg = getStrategyLeg(strategy, direction);
            scanGroup(leg.entry);
            scanGroup(leg.trigger);
            scanGroup(leg.exit);
            scanGroup(leg.cancelConditions);
        }
    }

    private cacheIndicator(cond: any) {
        if (cond.left && cond.left.type) {
            this.getOrCalculate(cond.left);
        }
        if (cond.right && typeof cond.right !== 'number' && cond.right.type) {
            this.getOrCalculate(cond.right);
        }
    }

    public getOrCalculate(indicatorDef: any): number[] {
        const key = `${indicatorDef.type}-${indicatorDef.params?.join('-') || ''}`;
        if (!this.indicators[key]) {
            this.indicators[key] = IndicatorCalculator.getValues(indicatorDef, this.candles);
        }
        return this.indicators[key];
    }

    public getAll(): Record<string, number[]> {
        return this.indicators;
    }

    public getValue(key: string, index: number): number | undefined {
        return this.indicators[key]?.[index];
    }
}
