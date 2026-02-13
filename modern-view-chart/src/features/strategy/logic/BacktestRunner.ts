
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
        let lastExitIndex = -1;
        let lastSignalTime = 0;

        // 1. Pre-calculate Indicators
        const indicators: Record<string, number[]> = {};
        const atr14 = IndicatorCalculator.getValues({ type: 'ATR', params: [14] }, candles);

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

        // Start from index 150 to allow indicators to warm up (especially Wilders RSI)
        if (candles.length > 0) {
            console.log(`[Backtest-Debug] First Candle Time: ${candles[0].time} (Type: ${typeof candles[0].time})`);
        }

        for (let i = 150; i < candles.length; i++) {
            const candle = candles[i];

            // Robust Timestamp Normalization
            let rawTime = 0;
            if (typeof candle.time === 'number') {
                rawTime = candle.time;
            } else if (typeof candle.time === 'string') {
                const parsed = Date.parse(candle.time);
                if (!isNaN(parsed)) rawTime = parsed;
            } else if (typeof candle.time === 'object') {
                rawTime = (candle.time as any).timestamp || 0;
            }

            // Normalization: Ensure we have Milliseconds for the 'timestamp' variable
            const timestamp = rawTime < 10000000000 ? rawTime * 1000 : rawTime;

            if (i === 150) {
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
                const source = strategy.risk.trailingSource || (strategy.side === 'BUY' ? 'HA_Low' : 'HA_High');
                const haField = source === 'HA_Low' ? 'low' : 'high';

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
                            const isSafe = pos.type === 'BUY' ? newSl < candle.close : newSl > candle.close;
                            if (isSafe) {
                                pos.sl = newSl;
                            }
                        }
                    });
                }
            }

            // A. Manage Open Positions (Exit/SL/TP)
            // --- TRACK MAE/MFE & DURATION FOR OPEN POSITIONS ---
            positions.forEach(pos => {
                if (pos.status !== 'open') return;

                const isGold = tradeSymbol.toUpperCase().includes('XAU');
                const isJPY = tradeSymbol.toUpperCase().includes('JPY');
                const pipsMultiplier = isGold ? 10 : (isJPY ? 100 : 10000);

                if (!pos.metadata) {
                    pos.metadata = { session: 'Asian', indicators_snapshot: {}, mae: 0, mfe: 0, duration_candles: 0 };
                }

                pos.metadata.duration_candles = (pos.metadata.duration_candles || 0) + 1;

                if (pos.type === 'BUY') {
                    const favorableDist = candle.high - pos.entryPrice;
                    const adverseDist = pos.entryPrice - candle.low;
                    pos.metadata.mfe = Math.max(pos.metadata.mfe || 0, favorableDist * pipsMultiplier);
                    pos.metadata.mae = Math.max(pos.metadata.mae || 0, adverseDist * pipsMultiplier);
                } else {
                    const favorableDist = pos.entryPrice - candle.low;
                    const adverseDist = candle.high - pos.entryPrice;
                    pos.metadata.mfe = Math.max(pos.metadata.mfe || 0, favorableDist * pipsMultiplier);
                    pos.metadata.mae = Math.max(pos.metadata.mae || 0, adverseDist * pipsMultiplier);
                }
            });

            for (let j = positions.length - 1; j >= 0; j--) {
                const pos = positions[j];
                if (pos.status !== 'open') continue;

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

                if (!exitPrice && strategy.exit) {
                    const shouldExit = this.evaluateGroup(strategy.exit, i, indicators);
                    if (shouldExit) {
                        exitPrice = candle.close;
                        exitReason = 'Signal';
                    }
                }

                if (exitPrice) {
                    pos.status = 'closed';
                    pos.exitPrice = exitPrice;
                    pos.exitTimestamp = timestamp;
                    pos.exitReason = exitReason || 'Manual';

                    // Calculate PnL with multiplier
                    const isGold = tradeSymbol.toUpperCase().includes('XAU');
                    const isJPY = tradeSymbol.toUpperCase().includes('JPY');
                    const multiplier = isGold ? 100 : (isJPY ? 100 : 100000);

                    if (pos.type === 'BUY') {
                        pnl = (exitPrice - pos.entryPrice) * pos.lotSize * multiplier;
                    } else {
                        pnl = (pos.entryPrice - exitPrice) * pos.lotSize * multiplier;
                    }
                    pos.pnl = pnl;
                    balance += pnl;
                    lastExitIndex = i;
                    lastSignalTime = timestamp;
                }
            }

            // B. Check Entry Conditions
            const openPositions = positions.filter(p => p.status === 'open');
            if (openPositions.length === 0) {
                let isCooledDown = true;
                if (lastSignalTime > 0 && strategy.risk.cooldownMinutes) {
                    const elapsedMs = timestamp - lastSignalTime;
                    if (elapsedMs < strategy.risk.cooldownMinutes * 60000) {
                        isCooledDown = false;
                    }
                }

                const isNewCandle = i > lastExitIndex;

                if (isCooledDown && isNewCandle) {
                    const isEntry = this.evaluateGroup(strategy.entry, i, indicators);

                    if (isEntry) {
                        const price = candle.close;
                        const snapshot: Record<string, number> = {};
                        const fillSnapshot = (group: any) => {
                            if (!group || !group.conditions) return;
                            group.conditions.forEach((c: any) => {
                                if ('operator' in c) {
                                    fillSnapshot(c);
                                } else if (c.left && c.left.type) {
                                    const key = `${c.left.type}-${c.left.params?.join('-') || ''}`;
                                    const label = `${c.left.type}${JSON.stringify(c.left.params)}${c.left.field ? ':' + c.left.field : ''}`;
                                    if (indicators[key] && indicators[key][i] !== undefined) {
                                        snapshot[label] = indicators[key][i];
                                    }

                                    if (c.right && typeof c.right !== 'number' && c.right.type) {
                                        const rKey = `${c.right.type}-${c.right.params?.join('-') || ''}`;
                                        const rLabel = `${c.right.type}${JSON.stringify(c.right.params)}${c.right.field ? ':' + c.right.field : ''}`;
                                        if (indicators[rKey] && indicators[rKey][i] !== undefined) {
                                            snapshot[rLabel] = indicators[rKey][i];
                                        }
                                    }
                                }
                            });
                        };
                        fillSnapshot(strategy.entry);

                        const type = strategy.side || 'BUY';

                        // --- DIAGNOSTIC LOG ---
                        const rsiKey = Object.keys(snapshot).find(k => k.includes('RSI'));
                        const rsiVal = rsiKey ? Number(snapshot[rsiKey]).toFixed(2) : 'N/A';
                        if (Math.random() < 0.1 || positions.length < 10) {
                            console.log(`[Backtest-Entry] Trigger: ${strategy.name} | Type: ${type} | RSI: ${rsiVal} | Price: ${price}`);
                        }

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

                        const hour = new Date(timestamp).getUTCHours();
                        let session: any = 'Asian';
                        if (hour >= 8 && hour < 14) session = 'London';
                        else if (hour >= 14 && hour < 21) session = 'NewYork';
                        else if (hour >= 21 || hour < 8) session = 'Asian';

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
                                mae: 0,
                                mfe: 0,
                                duration_candles: 0
                            }
                        };
                        positions.push(newPos);
                        lastSignalTime = timestamp;
                    }
                }
            }
        }

        console.log(`[Backtest] Finished ${strategy.name}. Generated ${positions.length} positions.`);
        return positions;
    }

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
