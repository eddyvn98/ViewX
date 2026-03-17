import { Candle } from '@/lib/store/types';
import { Condition, ConditionGroup, Indicator, Strategy, TradeContext } from '../types';
import { IndicatorCalculator } from './IndicatorCalculator';

export class ContextCollector {
    /**
     * Captures the full context of a trade at the moment of entry.
     */
    static captureEntryContext(
        strategy: Strategy,
        candles: Candle[],
        symbol: string
    ): TradeContext {
        if (!candles || candles.length === 0) {
            console.warn(`[ContextCollector] No candles provided for ${symbol}`);
            return {
                session: 'Asian',
                volatility_atr: 0,
                spread_at_entry: 0,
                indicators_snapshot: {},
                volume_analysis: { value: 0, relative_to_avg: 1 }
            };
        }
        const lastCandle = candles[candles.length - 1];
        const date = new Date(lastCandle.time);
        const hour = date.getUTCHours();

        return {
            session: this.getCurrentSession(hour),
            volatility_atr: this.calculateATR(candles, 14),
            spread_at_entry: 0, // Placeholder if not available in store
            indicators_snapshot: this.snapshotIndicators(strategy, candles),
            mtf: this.captureMTFPlaceholder(),
            volume_analysis: {
                value: lastCandle.volume || 0,
                relative_to_avg: this.calculateRelativeVolume(candles),
                is_climax: false
            }
        };
    }

    /**
     * Captures a snapshot of indicators some time after the trade has closed.
     */
    static capturePostExitContext(
        strategy: Strategy,
        candles: Candle[]
    ): Record<string, unknown> {
        return this.snapshotIndicators(strategy, candles);
    }

    private static getCurrentSession(hour: number): TradeContext['session'] {
        // Hour is expected in UTC (0-23)
        // New York: 13:00 - 21:00 UTC
        if (hour >= 13 && hour < 21) return 'NewYork';
        // London: 08:00 - 16:00 UTC
        if (hour >= 8 && hour < 16) return 'London';
        // Tokyo: 00:00 - 08:00 UTC
        if (hour >= 0 && hour < 8) return 'Tokyo';
        // Sydney: 21:00 - 05:00 UTC
        if (hour >= 21 || hour < 5) return 'Sydney';

        return 'Asian';
    }

    private static calculateATR(candles: Candle[], period: number): number {
        if (candles.length < period + 1) return 0;
        let sumTR = 0;
        for (let i = candles.length - period; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;
            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            sumTR += tr;
        }
        return sumTR / period;
    }

    private static calculateRelativeVolume(candles: Candle[]): number {
        if (candles.length < 20) return 1;
        const lastVol = candles[candles.length - 1].volume || 0;
        const avgVol = candles.slice(-21, -1).reduce((sum, c) => sum + (c.volume || 0), 0) / 20;
        return avgVol > 0 ? lastVol / avgVol : 1;
    }

    private static snapshotIndicators(strategy: Strategy, candles: Candle[]): Record<string, unknown> {
        const snapshot: Record<string, unknown> = {};

        const findIndicators = (group: ConditionGroup | undefined) => {
            if (!group || !group.conditions) return;
            group.conditions.forEach((c) => {
                if ('operator' in c) {
                    findIndicators(c);
                } else if ((c as Condition).left && (c as Condition).left.type) {
                    const condition = c as Condition;
                    const left = condition.left as Indicator;
                    const label = `${left.type}${JSON.stringify(left.params)}${left.field ? ':' + left.field : ''}`;
                    if (!snapshot[label]) {
                        snapshot[label] = IndicatorCalculator.getLastValue(left, candles);
                    }

                    if (condition.right && typeof condition.right !== 'number' && condition.right.type) {
                        const right = condition.right as Indicator;
                        const rLabel = `${right.type}${JSON.stringify(right.params)}${right.field ? ':' + right.field : ''}`;
                        if (!snapshot[rLabel]) {
                            snapshot[rLabel] = IndicatorCalculator.getLastValue(right, candles);
                        }
                    }
                }
            });
        };

        findIndicators(strategy.entry);
        return snapshot;
    }

    private static captureMTFPlaceholder(): TradeContext['mtf'] {
        // In a real implementation, this would access the global store to find H1 candles for the symbol
        return {
            h1_trend: 'SIDEWAYS',
            h1_rsi: 50
        };
    }
}
