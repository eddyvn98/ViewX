import { Candle } from '@/lib/store/types';
import { Strategy, TradeContext } from '../types';
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
        const lastCandle = candles[candles.length - 1];
        const date = new Date(lastCandle.time);
        const hour = date.getUTCHours();

        return {
            session: this.getCurrentSession(hour),
            volatility_atr: this.calculateATR(candles, 14),
            spread_at_entry: 0, // Placeholder if not available in store
            indicators_snapshot: this.snapshotIndicators(strategy, candles),
            mtf: this.captureMTFPlaceholder(symbol),
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
    ): Record<string, any> {
        return this.snapshotIndicators(strategy, candles);
    }

    private static getCurrentSession(hour: number): TradeContext['session'] {
        if (hour >= 8 && hour < 16) return 'London';
        if (hour >= 13 && hour < 21) return 'NewYork';
        if (hour >= 0 && hour < 8) return 'Tokyo';
        if (hour >= 22 || hour < 6) return 'Sydney';
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

    private static snapshotIndicators(strategy: Strategy, candles: Candle[]): Record<string, any> {
        const snapshot: Record<string, any> = {};

        // Snapshot entry conditions
        strategy.entry.conditions.forEach(c => {
            if ('left' in c) {
                const label = `${c.left.type}${JSON.stringify(c.left.params)}${c.left.field ? ':' + c.left.field : ''}`;
                snapshot[label] = IndicatorCalculator.getLastValue(c.left, candles);
            }
        });

        return snapshot;
    }

    private static captureMTFPlaceholder(symbol: string): TradeContext['mtf'] {
        // In a real implementation, this would access the global store to find H1 candles for the symbol
        return {
            h1_trend: 'SIDEWAYS',
            h1_rsi: 50
        };
    }
}
