import { IndicatorCalculator } from '../../logic/IndicatorCalculator';
import { getPipMultiplier, getPriceOffset } from '../../utils/market-utils';
import { getTradingSession } from '../../utils/time-utils';
import { soundService } from '../../logic/SoundService';
import type { Strategy, VirtualPosition } from '../../types';
import type { Candle } from '@/lib/store/types';
import { useMarketStore } from '@/lib/store';
import { getStrategyLeg } from '../../strategy-helpers';
import { createPositionId } from '../../utils/position-id';

interface StoreLike {
    updateVirtualPosition: (id: string, updates: Partial<VirtualPosition>) => void;
    closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number, metadataUpdate?: Record<string, unknown>, direction?: 'BUY' | 'SELL', matrixScopeKey?: string) => void;
}

interface CandleLike {
    low: number;
    high: number;
    close: number;
}

type PositionWithTicket = VirtualPosition & { ticket?: number | string };

export function managePositionOnTick(
    strategy: Strategy,
    position: VirtualPosition,
    symbol: string,
    candles: Candle[],
    lastCandle: CandleLike,
    isNewBar: boolean,
    store: StoreLike,
    sendMessage?: (data: unknown) => void
) {
    if (!(position.status === 'open' || position.status === 'pending')) return;

    if (position.isHistorical && position.status === 'open') {
        store.updateVirtualPosition(position.id, {
            isHistorical: false,
            id: createPositionId('v-taken', position.strategyId, position.symbol, position.timeframe, position.timestamp),
        });
        return;
    }

    const currentPrice = lastCandle.close;
    const leg = getStrategyLeg(strategy, position.type);

    if (leg.risk.trailing) {
        const tSource = leg.risk.trailingSource || (position.type === 'BUY' ? 'HA_Low' : 'HA_High');
        const haLow = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'low' }, candles.slice(0, -1));
        const haHigh = IndicatorCalculator.getLastValue({ type: 'HA', params: [], field: 'high' }, candles.slice(0, -1));

        const priceOffset = getPriceOffset(symbol);
        const moveThreshold = priceOffset * 0.2;

        let targetSl = position.sl;
        let updated = false;

        if (position.type === 'BUY' && tSource === 'HA_Low' && haLow > position.sl + moveThreshold) {
            targetSl = haLow;
            updated = true;
        } else if (position.type === 'SELL' && tSource === 'HA_High') {
            const sellProposedSl = haHigh + priceOffset;
            if (position.sl === 0 || sellProposedSl < position.sl - moveThreshold) {
                targetSl = sellProposedSl;
                updated = true;
            }
        }

        if (updated) {
            const isSafe = position.type === 'BUY' ? targetSl < currentPrice : targetSl > currentPrice;
            if (isSafe || position.status === 'pending') {
                store.updateVirtualPosition(position.id, { sl: targetSl, sl_time: Math.floor(Date.now() / 1000) });
                if (strategy.executionMode === 'real' && sendMessage) {
                    const ticket = (position as PositionWithTicket).ticket;
                    if (ticket !== undefined) {
                        sendMessage({ topic: 'mt5_command', command: 'modify_order', ticket, sl: targetSl, tp: position.tp });
                    }
                }
            }
        }
    }

    if (position.status === 'open') {
        const pipsMultiplier = getPipMultiplier(symbol);
        const meta = position.metadata || { indicators_snapshot: {}, session: getTradingSession(position.timestamp) };
        const nextDuration = (meta.duration_candles || 0) + (isNewBar ? 1 : 0);

        let currentMae = meta.mae || 0;
        let currentMfe = meta.mfe || 0;

        if (position.type === 'BUY') {
            const adverseDist = (position.entryPrice - lastCandle.low) * pipsMultiplier;
            const favorableDist = (lastCandle.high - position.entryPrice) * pipsMultiplier;
            currentMae = Math.max(currentMae, adverseDist);
            currentMfe = Math.max(currentMfe, favorableDist);
        } else {
            const adverseDist = (lastCandle.high - position.entryPrice) * pipsMultiplier;
            const favorableDist = (position.entryPrice - lastCandle.low) * pipsMultiplier;
            currentMae = Math.max(currentMae, adverseDist);
            currentMfe = Math.max(currentMfe, favorableDist);
        }

        if (currentMae !== meta.mae || currentMfe !== meta.mfe || nextDuration !== meta.duration_candles) {
            store.updateVirtualPosition(position.id, {
                metadata: {
                    ...meta,
                    mae: currentMae,
                    mfe: currentMfe,
                    duration_candles: nextDuration
                }
            });
        }

        if (Date.now() - position.timestamp < 5000) return;

        let exitPrice: number | null = null;
        let exitReason = '';
        if (position.type === 'BUY') {
            if (position.sl && currentPrice <= position.sl) { exitPrice = position.sl; exitReason = 'SL'; }
            else if (position.tp && currentPrice >= position.tp) { exitPrice = position.tp; exitReason = 'TP'; }
        } else {
            if (position.sl && currentPrice >= position.sl) { exitPrice = position.sl; exitReason = 'SL'; }
            else if (position.tp && currentPrice <= position.tp) { exitPrice = position.tp; exitReason = 'TP'; }
        }

        if (!exitPrice) return;
        store.closeVirtualPosition(strategy.id, symbol, exitPrice, { exit_reason: exitReason }, position.type, position.matrixScopeKey);
        if (exitReason === 'TP') soundService.playTP();
        else if (exitReason === 'SL') soundService.playSL();
        const closeMsg = `[${exitReason}] ${position.symbol} Closed @ ${exitPrice}`;
        useMarketStore.getState().addNotification(closeMsg, 'warning');
        return;
    }

    if ((position.type === 'BUY' && currentPrice >= position.entryPrice) || (position.type === 'SELL' && currentPrice <= position.entryPrice)) {
        const nowMs = Date.now();
        store.updateVirtualPosition(position.id, {
            status: 'open',
            entryPrice: position.entryPrice,
            timestamp: nowMs,
            entry_time: Math.floor(nowMs / 1000)
        });
        const filledMsg = `[FILLED] ${position.type} ${position.symbol} @ ${position.entryPrice}`;
        useMarketStore.getState().addNotification(filledMsg, 'success');
    }
}
