
import { Candle } from '@/lib/store/types';
import { Strategy, VirtualPosition, SLTPConfig, LotConfig } from '../types';
import { IndicatorCalculator } from '@/features/strategy/logic/IndicatorCalculator';
import { BacktestEvaluator } from './BacktestEvaluator';

/**
 * BacktestRunner
 * Simulation engine to run strategies on historical data.
 */
export class BacktestRunner {
    static run(strategy: Strategy, candles: Candle[], initialBalance: number = 10000, overrideSymbol?: string): VirtualPosition[] {
        if (!strategy.active || candles.length < 50) return [];

        // Determine symbol: Priority Override > Strategy Config > 'BACKTEST'
        const tradeSymbol = overrideSymbol || strategy.symbol || 'BACKTEST';

        console.log(`[Backtest] Running ${strategy.name} on ${tradeSymbol} (${candles.length} candles)...`);
        const positions: VirtualPosition[] = [];
        let balance = initialBalance;

        // 1. Pre-calculate Indicators
        // Map indicator configurations to their computed arrays
        const indicators: Record<string, number[]> = {};

        // Helper to cache indicator
        const cacheIndicator = (cond: any) => {
            if (cond.left && cond.left.type) {
                const key = `${cond.left.type}-${cond.left.params?.join('-') || ''}`;
                if (!indicators[key]) {
                    indicators[key] = IndicatorCalculator.getValues(cond.left, candles);
                }
            }
            if (cond.right && typeof cond.right !== 'number' && cond.right.type) {
                const key = `${cond.right.type}-${cond.right.params?.join('-') || ''}`;
                if (!indicators[key]) {
                    indicators[key] = IndicatorCalculator.getValues(cond.right, candles);
                }
            }
        };

        // Scan strategy for required indicators (Entry)
        const scanGroup = (group: any) => {
            if (!group || !group.conditions) return;
            group.conditions.forEach((cond: any) => {
                if ('operator' in cond) {
                    scanGroup(cond);
                } else {
                    cacheIndicator(cond);
                }
            });
        };

        if (strategy.entry) scanGroup(strategy.entry);
        if (strategy.exit) scanGroup(strategy.exit);

        // 2. Simulation Loop
        // Ensure candles are sorted by time (Oldest first)
        candles.sort((a, b) => {
            const getTime = (c: any) => {
                if (typeof c.time === 'number') return c.time;
                if (typeof c.time === 'string') return Date.parse(c.time) / 1000;
                return (c.time as any).timestamp || 0;
            };
            return getTime(a) - getTime(b);
        });

        // Start from index 50 to allow indicators to warm up
        if (candles.length > 0) {
            console.log(`[Backtest-Debug] First Candle Time: ${candles[0].time} (Type: ${typeof candles[0].time})`);
        }

        for (let i = 50; i < candles.length; i++) {
            const candle = candles[i];

            // Robust Timestamp Normalization
            let rawTime = 0;
            if (typeof candle.time === 'number') {
                rawTime = candle.time;
            } else if (typeof candle.time === 'string') {
                // Try parsing string date
                const parsed = Date.parse(candle.time);
                if (!isNaN(parsed)) rawTime = parsed / 1000; // Assume string is ISO, Date.parse returns MS, convert to Sec for rawTime consistency? 
                // Wait, if rawTime is sec (< 10B), we mul 1000 later. 
                // If Date.parse gives MS (> 10B), we keep it.
                // Let's just use MS directly for clarity.
                rawTime = parsed;
            } else if (typeof candle.time === 'object') {
                rawTime = (candle.time as any).timestamp || 0;
            }

            // Normalization: Ensure we have Milliseconds for the 'timestamp' variable
            // If rawTime is small (Seconds), multiply by 1000.
            // If rawTime is huge (Milliseconds), keep it.
            const timestamp = rawTime < 10000000000 ? rawTime * 1000 : rawTime;

            if (i === 50) {
                console.log(`[Backtest-Debug] Sample Time Parsing:`, {
                    original: candle.time,
                    type: typeof candle.time,
                    parsedRaw: rawTime,
                    finalState: timestamp,
                    dateString: new Date(timestamp).toISOString()
                });
            }

            // --- TRAILING STOP LOGIC ---
            if (strategy.risk.trailing) {
                // Determine source: use strategy config OR default based on side
                const source = strategy.risk.trailingSource || (strategy.side === 'BUY' ? 'HA_Low' : 'HA_High');
                const haField = source === 'HA_Low' ? 'low' : 'high';

                // We calculate HA up to the PREVIOUS candle to follow standard practice (avoiding lookahead bias for trail)
                const haValues = IndicatorCalculator.getValues({ type: 'HA', params: [], field: haField }, candles.slice(0, i));
                const currentHaValue = haValues[haValues.length - 1];

                if (!isNaN(currentHaValue)) {
                    positions.forEach(pos => {
                        if (pos.status !== 'open') return;

                        const priceOffset = tradeSymbol.includes('XAU') ? 0.3 : (tradeSymbol.includes('JPY') ? 0.01 : 0.0001);
                        const moveThreshold = tradeSymbol.includes('XAU') ? 0.1 : (priceOffset * 0.1);

                        let shouldUpdate = false;
                        let newSl = pos.sl;

                        if (pos.type === 'BUY' && source === 'HA_Low') {
                            if (currentHaValue > pos.sl + moveThreshold) {
                                newSl = currentHaValue;
                                shouldUpdate = true;
                            }
                        } else if (pos.type === 'SELL' && source === 'HA_High') {
                            const proposedSl = currentHaValue + priceOffset;
                            if (pos.sl === 0 || proposedSl < pos.sl - moveThreshold) {
                                newSl = proposedSl;
                                shouldUpdate = true;
                            }
                        }

                        if (shouldUpdate) {
                            // Safeguard: Don't move SL across current price
                            const isSafe = pos.type === 'BUY' ? newSl < candle.close : newSl > candle.close;
                            if (isSafe) {
                                pos.sl = newSl;
                            }
                        }
                    });
                }
            }

            // A. Manage Open Positions (Exit/SL/TP)
            for (let j = positions.length - 1; j >= 0; j--) {
                const pos = positions[j];
                if (pos.status !== 'open') continue;

                // 1. Check SL/TP (Hit detection using High/Low)
                // We assume SL/TP are hit if price ranges overlap
                let exitPrice: number | null = null;
                let exitReason: string | null = null;
                let pnl = 0;

                if (pos.type === 'BUY') {
                    if (pos.sl && candle.low <= pos.sl) {
                        exitPrice = pos.sl;
                        exitReason = 'SL';
                    } else if (pos.tp && candle.high >= pos.tp) {
                        exitPrice = pos.tp;
                        exitReason = 'TP';
                    }
                } else { // SELL
                    if (pos.sl && candle.high >= pos.sl) {
                        exitPrice = pos.sl;
                        exitReason = 'SL';
                    } else if (pos.tp && candle.low <= pos.tp) {
                        exitPrice = pos.tp;
                        exitReason = 'TP';
                    }
                }

                // 2. Check Exit Rules (if not hit SL/TP)
                if (!exitPrice && strategy.exit) {
                    const shouldExit = this.evaluateGroup(strategy.exit, i, indicators);
                    if (shouldExit) {
                        exitPrice = candle.close;
                        exitReason = 'Signal';
                    }
                }

                // 3. Process Exit
                if (exitPrice) {
                    pos.status = 'closed';
                    pos.exitPrice = exitPrice;
                    pos.exitTimestamp = timestamp;
                    pos.exitReason = exitReason || 'Manual';

                    if (pos.type === 'BUY') {
                        pnl = (exitPrice - pos.entryPrice) * pos.lotSize;
                    } else {
                        pnl = (pos.entryPrice - exitPrice) * pos.lotSize;
                    }
                    pos.pnl = pnl;
                    balance += pnl;
                }
            }

            // B. Check Entry Conditions
            // Only enter if no open positions (or scaling allowed - simplified to 1 for now)
            const openPositions = positions.filter(p => p.status === 'open');
            if (openPositions.length === 0) {
                const isEntry = this.evaluateGroup(strategy.entry, i, indicators);

                if (isEntry) {
                    const price = candle.close;

                    // Calculate SL/TP logic (Simplified)
                    // Helper to get numeric value from risk config (handling number | SLTPConfig)
                    const getRiskValue = (val: number | SLTPConfig | undefined): number => {
                        if (typeof val === 'number') return val;
                        if (val && typeof val === 'object' && typeof val.value === 'number') return val.value;
                        return 0;
                    };

                    const slVal = getRiskValue(strategy.risk.sl || strategy.risk.stopLoss);
                    const tpVal = getRiskValue(strategy.risk.tp || strategy.risk.takeProfit);

                    let sl = 0, tp = 0;

                    // Simple fixed point calculation for now (mock)
                    // Real implementation needs pip value based on symbol
                    if (strategy.side === 'BUY') {
                        if (slVal) sl = price - slVal;
                        if (tpVal) tp = price + tpVal;
                    } else {
                        // SELL
                        if (slVal) sl = price + slVal;
                        if (tpVal) tp = price - tpVal;
                    }

                    // Fallback side if undefined
                    const type = strategy.side || 'BUY';

                    // Handle lotSize (number | LotConfig)
                    let quantity = 0.1;
                    if (typeof strategy.risk.lotSize === 'number') quantity = strategy.risk.lotSize;
                    else if (typeof strategy.risk.lotSize === 'object') quantity = strategy.risk.lotSize.value;

                    const newPos: VirtualPosition = {
                        id: `bt-${timestamp}-${i}`,
                        strategyId: strategy.id,
                        symbol: tradeSymbol,
                        type: type as 'BUY' | 'SELL',
                        entryPrice: price,
                        lotSize: quantity,
                        // quantity: quantity, // Removed to match VirtualPosition type
                        timestamp: timestamp, // Always normalized MS
                        status: 'open',
                        pnl: 0,
                        // entryTimestamp: timestamp, // VirtualPosition uses timestamp for entry time? Yes.
                        sl,
                        tp,
                        exitReason: undefined
                    };
                    positions.push(newPos);
                }
            }
        }

        console.log(`[Backtest] Finished. Generated ${positions.length} positions.`);
        return positions;
    }

    // Helper to evaluate condition groups recursively
    static evaluateGroup(group: any, index: number, indicators: Record<string, number[]>): boolean {
        if (!group || !group.conditions || group.conditions.length === 0) return false;

        if (group.operator === "AND") {
            return group.conditions.every((c: any) => {
                if ('operator' in c) return this.evaluateGroup(c, index, indicators);
                return BacktestEvaluator.evaluate(c, index, indicators);
            });
        } else {
            return group.conditions.some((c: any) => {
                if ('operator' in c) return this.evaluateGroup(c, index, indicators);
                return BacktestEvaluator.evaluate(c, index, indicators);
            });
        }
    }
}
