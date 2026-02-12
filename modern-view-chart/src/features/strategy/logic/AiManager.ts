import { StrategySignal } from '../types';

export interface MarketMetrics {
    spread: number;
    volatility: number;
    trendStrength: number;
    rsi?: number;
    session?: string;
}

/**
 * AI Manager (Heuristic Expert System)
 * Note: Current implementation uses rule-based heuristic logic, not Machine Learning.
 */
export class AiManager {
    static processSignal(signal: StrategySignal, metrics: MarketMetrics): StrategySignal | null {
        console.log(`[AI Manager] Processing ${signal.type} signal for ${signal.symbol}`);

        // High spread filter
        if (metrics.spread > signal.risk.sl * 0.2) {
            console.warn(`[AI Manager] Signal rejected: Spread too high`);
            return null;
        }

        // Dynamic Lot Size based on volatility
        let adjustedLot = signal.risk.lotSize || 0.01;
        if (metrics.volatility > 50) {
            adjustedLot = Math.max(0.01, adjustedLot * 0.5);
        }

        // Confidence Scoring (Heuristic)
        let confidence = 50;
        if (metrics.trendStrength > 25) confidence += 20;
        if (metrics.volatility < 40) confidence += 10;

        return {
            ...signal,
            confidence,
            risk: { ...signal.risk, lotSize: adjustedLot }
        };
    }

    /**
     * Calculates weighted average entry price for multiple positions
     */
    static calculateAveragePrice(positions: any[]): number {
        if (positions.length === 0) return 0;
        const totalVolume = positions.reduce((sum, p) => sum + (p.lotSize || 0), 0);
        const weightedSum = positions.reduce((sum, p) => sum + (p.entryPrice * (p.lotSize || 0)), 0);
        return weightedSum / totalVolume;
    }

    /**
     * AI-based Dynamic SL logic
     * Moves SL to Break Even or Trailing based on market behavior
     */
    static suggestRiskModification(position: any, currentPrice: number, metrics: MarketMetrics, siblingPositions: any[] = []): any | null {
        const avgPrice = siblingPositions.length > 0
            ? this.calculateAveragePrice(siblingPositions)
            : position.entryPrice;

        const type = position.type === "BUY" ? 1 : -1;
        const profitPips = (currentPrice - avgPrice) * (type * 10000);

        // Move to Break Even if profit > 50% of TP
        if (profitPips > position.tp * 0.5) {
            const bePrice = avgPrice + (type * 2 * 0.0001); // Avg Entry + 2 pips
            if ((type === 1 && (position.sl || 0) < bePrice) || (type === -1 && (position.sl || 999999) > bePrice)) {
                return { type: "MOVE_SL", newPrice: bePrice };
            }
        }

        // Aggressive trailing in high volatility
        if (metrics.volatility > 80 && profitPips > 20) {
            return { type: "TRAIL_SL", distance: 15 };
        }

        return null;
    }

    /**
     * Predictive Early Exit
     */
    static predictEarlyExit(position: any, metrics: MarketMetrics): boolean {
        // If RSI is extremely overbought/oversold against the position
        if (position.type === "BUY" && metrics.rsi && metrics.rsi > 80) return true;
        if (position.type === "SELL" && metrics.rsi && metrics.rsi < 20) return true;

        return false;
    }
}
