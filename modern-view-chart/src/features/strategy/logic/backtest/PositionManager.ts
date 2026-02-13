import { VirtualPosition, Strategy } from '@/features/strategy/types';
import { Candle } from '@/lib/store/types';
import { getPipMultiplier, calculateStandardPnL, getPriceOffset } from '@/features/strategy/utils/market-utils';
import { IndicatorCalculator } from '@/features/strategy/logic/IndicatorCalculator';

export class PositionManager {
    private positions: VirtualPosition[] = [];
    private balance: number;

    constructor(initialBalance: number) {
        this.balance = initialBalance;
    }

    getPositions(): VirtualPosition[] {
        return this.positions;
    }

    getBalance(): number {
        return this.balance;
    }

    addPosition(pos: VirtualPosition) {
        this.positions.push(pos);
    }

    updateTrailingStops(
        strategy: Strategy,
        candles: Candle[],
        currentIndex: number,
        tradeSymbol: string
    ) {
        if (!strategy.risk.trailing) return;

        const source = strategy.risk.trailingSource || (strategy.side === 'BUY' ? 'HA_Low' : 'HA_High');
        const haField = source === 'HA_Low' ? 'low' : 'high';

        // Note: This matches original logic but re-calculating HA every step is inefficient.
        // In a real optimized engine, we'd cache HA.
        // For faithful refactoring, we'll keep it but it should probably use BacktestIndicators.
        const haValues = IndicatorCalculator.getValues({ type: 'HA', params: [], field: haField }, candles.slice(0, currentIndex));
        const currentHaValue = haValues[haValues.length - 1];

        if (!isNaN(currentHaValue)) {
            this.positions.forEach(pos => {
                if (pos.status !== 'open') return;

                const priceOffset = getPriceOffset(tradeSymbol);
                const moveThreshold = priceOffset * 0.1;

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
                    const isSafe = pos.type === 'BUY' ? newSl < candles[currentIndex].close : newSl > candles[currentIndex].close;
                    if (isSafe) {
                        pos.sl = newSl;
                    }
                }
            });
        }
    }

    updateMetrics(candle: Candle, tradeSymbol: string) {
        this.positions.forEach(pos => {
            if (pos.status !== 'open') return;

            const pipsMultiplier = getPipMultiplier(tradeSymbol);

            if (!pos.metadata) {
                pos.metadata = { session: 'Asian', indicators_snapshot: {}, mae: 0, mfe: 0, duration_candles: 0 };
            }

            pos.metadata.duration_candles = (pos.metadata.duration_candles || 0) + 1;

            if (pos.type === 'BUY') {
                const favorableDist = Number(candle.high) - pos.entryPrice;
                const adverseDist = pos.entryPrice - Number(candle.low);
                pos.metadata.mfe = Math.max(pos.metadata.mfe || 0, favorableDist * pipsMultiplier);
                pos.metadata.mae = Math.max(pos.metadata.mae || 0, adverseDist * pipsMultiplier);
            } else {
                const favorableDist = pos.entryPrice - Number(candle.low);
                const adverseDist = Number(candle.high) - pos.entryPrice;
                pos.metadata.mfe = Math.max(pos.metadata.mfe || 0, favorableDist * pipsMultiplier);
                pos.metadata.mae = Math.max(pos.metadata.mae || 0, adverseDist * pipsMultiplier);
            }
        });
    }

    processExits(
        candle: Candle,
        currentIndex: number,
        timestamp: number,
        tradeSymbol: string,
        strategy: Strategy,
        shouldExitSignal: boolean
    ): { lastExitIndex: number, lastSignalTime: number } | null {
        let result = null;

        for (let j = this.positions.length - 1; j >= 0; j--) {
            const pos = this.positions[j];
            if (pos.status !== 'open') continue;

            let exitPrice: number | null = null;
            let exitReason: string | null = null;
            let pnl = 0;

            const low = Number(candle.low);
            const high = Number(candle.high);
            const close = Number(candle.close);

            if (pos.type === 'BUY') {
                if (pos.sl && low <= pos.sl) {
                    exitPrice = pos.sl;
                    exitReason = 'SL';
                } else if (pos.tp && high >= pos.tp) {
                    exitPrice = pos.tp;
                    exitReason = 'TP';
                }
            } else { // SELL
                if (pos.sl && high >= pos.sl) {
                    exitPrice = pos.sl;
                    exitReason = 'SL';
                } else if (pos.tp && low <= pos.tp) {
                    exitPrice = pos.tp;
                    exitReason = 'TP';
                }
            }

            if (!exitPrice && shouldExitSignal) {
                exitPrice = close;
                exitReason = 'Signal';
            }

            if (exitPrice) {
                pos.status = 'closed';
                pos.exitPrice = exitPrice;
                pos.exitTimestamp = timestamp;
                pos.exitReason = exitReason || 'Manual';

                pnl = calculateStandardPnL(pos.type, pos.entryPrice, exitPrice, pos.lotSize, tradeSymbol);
                pos.pnl = pnl;
                this.balance += pnl;

                // Update result only if it's the first exit processed? 
                // Original logic: returns lastExitIndex and lastSignalTime.
                // Since this runs for all positions, we should update mostly once per candle or keep latest.
                result = {
                    lastExitIndex: currentIndex,
                    lastSignalTime: timestamp
                };
            }
        }
        return result;
    }
}
