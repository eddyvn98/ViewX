import { Candle } from '@/lib/store/types';
import { Strategy, VirtualPosition, SLTPConfig, LogicMemory } from '@/features/strategy/types';
import { BacktestData } from './BacktestData';
import { BacktestIndicators } from './BacktestIndicators';
import { PositionManager } from './PositionManager';
import { SignalEvaluator } from './SignalEvaluator';
import { getTradingSession } from '@/features/strategy/utils/time-utils';

export class BacktestEngine {
    static run(strategy: Strategy, rawCandles: Candle[], initialBalance: number = 10000, overrideSymbol?: string, memory?: LogicMemory): VirtualPosition[] {
        if (!strategy.active || rawCandles.length < 50) return [];

        const tradeSymbol = overrideSymbol || strategy.symbol || 'BACKTEST';
        console.log(`[Backtest] Running ${strategy.name} on ${tradeSymbol} (${rawCandles.length} candles)...`);

        // 1. Prepare Data
        const candles = BacktestData.prepare(rawCandles);

        // 2. Pre-calculate Indicators
        const indicatorManager = new BacktestIndicators(candles);
        indicatorManager.preCalculate(strategy);
        const indicators = indicatorManager.getAll();
        const atr14 = indicatorManager.getOrCalculate({ type: 'ATR', params: [14] });

        // 3. Initialize State
        const positionManager = new PositionManager(initialBalance);
        let lastExitIndex = -1;
        let lastSignalTime = 0;

        // 4. Simulation Loop
        // Dynamic warmup: 1/3 of data or at least enough for typical indicators (20-50)
        // This ensures the strategy can run even on H1/H4 where we might only have 300 candles.
        const warmupCount = Math.min(150, Math.floor(candles.length / 3));
        console.log(`[Backtest] ${strategy.name} beginning simulation at index ${warmupCount} (Warmup: ${warmupCount})`);

        for (let i = warmupCount; i < candles.length; i++) {
            const candle = candles[i];
            const timestamp = BacktestData.getTimestamp(candle);
            const openPositions = positionManager.getPositions().filter(p => p.status === 'open');

            // A. Manage Open Positions
            positionManager.updateTrailingStops(strategy, candles, i, tradeSymbol);
            positionManager.updateMetrics(candle, tradeSymbol);

            // Check Custom Exit Conditions (Signal Exit)
            let shouldSignalExit = false;
            if (strategy.exit) {
                shouldSignalExit = SignalEvaluator.evaluate(strategy.exit, i, indicators);
            }

            const exitResult = positionManager.processExits(candle, i, timestamp, tradeSymbol, strategy, shouldSignalExit);
            if (exitResult) {
                lastExitIndex = exitResult.lastExitIndex;
                lastSignalTime = exitResult.lastSignalTime;
            }

            // B. Check Entry Conditions
            // Only if we have no open positions (simplification for "single_position" mode implied in original code)
            // Original code: positions.filter(p => p.status === 'open').length === 0
            if (positionManager.getPositions().filter(p => p.status === 'open').length === 0) {
                const isCooledDown = SignalEvaluator.checkCooldown(lastSignalTime, timestamp, strategy.risk.cooldownMinutes);
                const isNewCandle = i > lastExitIndex;

                if (isCooledDown && isNewCandle) {
                    const isEntry = SignalEvaluator.evaluate(strategy.entry, i, indicators);

                    if (isEntry) {
                        const price = Number(candle.close);
                        // Snapshot Construction
                        const snapshot: Record<string, number> = {};
                        // Re-implement snapshot filling logic or simplify?
                        // For faithful refactor, we should try to capture it.
                        // Ideally SignalEvaluator could return it, but for now let's reconstruct simply or skip complex recursion here
                        // to save space, or just loop relevant indicators.
                        // Let's do a simplified snapshot of what we have cached.
                        // (Original code recursively walked the group to pick specific values)
                        const fillSnapshot = (group: any) => {
                            if (!group || !group.conditions) return;
                            group.conditions.forEach((c: any) => {
                                if ('operator' in c) {
                                    fillSnapshot(c);
                                } else if (c.left && c.left.type) {
                                    const key = `${c.left.type}-${c.left.params?.join('-') || ''}`;
                                    const label = `${c.left.type}${JSON.stringify(c.left.params)}${c.left.field ? ':' + c.left.field : ''}`;
                                    const val = indicatorManager.getValue(key, i);
                                    if (val !== undefined) snapshot[label] = val;

                                    if (c.right && typeof c.right !== 'number' && c.right.type) {
                                        const rKey = `${c.right.type}-${c.right.params?.join('-') || ''}`;
                                        const rLabel = `${c.right.type}${JSON.stringify(c.right.params)}${c.right.field ? ':' + c.right.field : ''}`;
                                        const rVal = indicatorManager.getValue(rKey, i);
                                        if (rVal !== undefined) snapshot[rLabel] = rVal;
                                    }
                                }
                            });
                        };
                        fillSnapshot(strategy.entry);


                        const type = strategy.side || 'BUY';

                        // SL/TP Calculation
                        const getRiskValue = (val: number | SLTPConfig | undefined): number => {
                            if (typeof val === 'number') return val;
                            if (val && typeof val === 'object' && typeof val.value === 'number') return val.value;
                            return 0;
                        };

                        const slVal = getRiskValue(strategy.risk.sl || strategy.risk.stopLoss);
                        const tpVal = getRiskValue(strategy.risk.tp || strategy.risk.takeProfit);

                        let sl = 0, tp = 0;
                        if (type === 'BUY') {
                            if (slVal) sl = price - slVal;
                            if (tpVal) tp = price + tpVal;
                        } else {
                            if (slVal) sl = price + slVal;
                            if (tpVal) tp = price - tpVal;
                        }

                        let quantity = 0.1;
                        if (typeof strategy.risk.lotSize === 'number') quantity = strategy.risk.lotSize;
                        else if (typeof strategy.risk.lotSize === 'object') quantity = strategy.risk.lotSize.value;

                        const session = getTradingSession(timestamp);

                        const newPos: VirtualPosition = {
                            id: `bt-${timestamp}-${i}`,
                            strategyId: strategy.id,
                            symbol: tradeSymbol,
                            type: type as 'BUY' | 'SELL',
                            entryPrice: price,
                            lotSize: quantity,
                            timestamp: timestamp,
                            status: 'open',
                            pnl: 0,
                            sl,
                            tp,
                            exitReason: undefined,
                            isHistorical: true,
                            metadata: {
                                session,
                                volatility_atr: atr14[i] || 0,
                                indicators_snapshot: snapshot,
                                mfe: 0,
                                duration_candles: 0
                            },
                            confidence: calculateConfidence(type, candle, timestamp, snapshot, atr14[i], memory)
                        };

                        positionManager.addPosition(newPos);
                        lastSignalTime = timestamp;
                    }
                }
            }
        }

        console.log(`[Backtest] Finished ${strategy.name}. Generated ${positionManager.getPositions().length} positions.`);
        return positionManager.getPositions();
    }
}

function calculateConfidence(
    type: string,
    candle: Candle,
    timestamp: number,
    snapshot: Record<string, number>,
    atr: number,
    memory?: LogicMemory
): number {
    let score = 50; // Neutral start

    // 1. Session Factor (Adaptive Learning)
    const hour = new Date(timestamp).getUTCHours();
    const session = hour >= 8 && hour <= 16 ? 'London' : (hour >= 0 && hour <= 6 ? 'Tokyo' : 'Other');

    // Base heuristic
    if (session === 'London') score += 15;
    else if (session === 'Tokyo') score -= 10;

    // "Memory Bias" Integration (Rút kinh nghiệm từ quá khứ)
    if (memory?.sessionBias[session]) {
        score += memory.sessionBias[session];
    }

    // 2. Volatility Factor
    if (atr > 0) {
        const bodySize = Math.abs(Number(candle.close) - Number(candle.open));
        if (bodySize > atr * 0.5) score += 10; // Decisive move
        if (bodySize > atr * 2) score -= 15; // Overextended
    }

    // 3. Confluence (Simplified example)
    // If multiple indicators are showing extreme/clean breakout
    const rsi = snapshot['RSI[14]'];
    if (rsi !== undefined) {
        if (type === 'BUY' && rsi < 40) score += 10; // Oversold entry
        if (type === 'SELL' && rsi > 60) score += 10; // Overbought entry
    }

    return Math.min(98, Math.max(15, score));
}
