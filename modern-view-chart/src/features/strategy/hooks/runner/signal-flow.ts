import { toast } from 'sonner';
import { useMarketStore } from '@/lib/store';
import { ContextCollector } from '../../logic/ContextCollector';
import { RiskCalculator } from '../../logic/RiskCalculator';
import { AiManager } from '../../logic/AiManager';
import { getPriceOffset } from '../../utils/market-utils';
import { soundService } from '../../logic/SoundService';
import { TradeLogger } from '../../logic/TradeLogger';
import type { StrategySignal } from '../../types';
import type { Strategy, VirtualPosition } from '../../types';
import { runAiAuditAndTradeLogging } from './background-jobs';
import { notifyTelegramSignal } from '../../utils/telegram-notifier';
import type { Candle } from '@/lib/store/types';
import { getStrategyLeg } from '../../strategy-helpers';
import { createPositionId } from '../../utils/position-id';

interface StoreLike {
    virtualPositions: VirtualPosition[];
    signals?: StrategySignal[];
    virtualBalance: number;
    addVirtualPosition: (position: VirtualPosition) => void;
    closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number, metadataUpdate?: Record<string, unknown>, direction?: 'BUY' | 'SELL', matrixScopeKey?: string) => void;
    cancelVirtualPosition: (strategyId: string, symbol: string, direction?: 'BUY' | 'SELL', matrixScopeKey?: string) => void;
    addSignal: (signal: StrategySignal) => void;
    updateLastSignalTime: (strategyId: string, timestamp: number, matrixScopeKey?: string) => void;
}

interface CandleLike {
    close: number;
    high: number;
    low: number;
}

export function processStrategySignal(
    strategy: Strategy,
    signal: StrategySignal,
    symbol: string,
    timeframe: string,
    candles: Candle[],
    lastCandle: CandleLike,
    currentVirtualPositions: VirtualPosition[],
    store: StoreLike,
    lastTime?: number,
    source: 'MT5' | 'BINANCE' = 'MT5',
    matrixScopeKey?: string
) {
    const realMetrics = ContextCollector.captureEntryContext(strategy, candles, symbol);
    const mMetrics = {
        spread: realMetrics.spread_at_entry || 2,
        volatility: realMetrics.volatility_atr || 0,
        trendStrength: realMetrics.mtf?.h1_trend === 'UP' ? 30 : 10,
        rsi: typeof realMetrics.indicators_snapshot['RSI[14]'] === 'number' ? realMetrics.indicators_snapshot['RSI[14]'] : 50,
        session: realMetrics.session
    };

    const finalSignal = AiManager.processSignal(signal, mMetrics);
    if (!finalSignal) {
        console.warn(`[Runner] ${strategy.name} signal rejected by AiManager heuristics.`);
        return;
    }

    if (finalSignal.type === 'CANCEL') {
        const pending = currentVirtualPositions.find(
            (p) => p.strategyId === strategy.id && p.symbol === symbol && p.type === finalSignal.direction && p.status === 'pending' && (!matrixScopeKey || p.matrixScopeKey === matrixScopeKey)
        );
        if (pending) {
            store.cancelVirtualPosition(strategy.id, symbol, finalSignal.direction, matrixScopeKey);
            void notifyTelegramSignal({
                strategyName: strategy.name,
                symbol,
                timeframe,
                signalType: 'CANCEL',
                orderStatus: 'CANCELLED',
                price: finalSignal.price,
            });
            toast.warning(`[CANCEL] ${strategy.name} order killed.`);
        }
        return;
    }

    if (finalSignal.type !== 'EXIT') {
        const direction = (finalSignal.direction || finalSignal.type) as 'BUY' | 'SELL';
        const leg = getStrategyLeg(strategy, direction);
        const currentMode = leg.positionMode || strategy.positionMode || 'single_position';
        const scopedLivePositions = store.virtualPositions.filter(
            (p) => p.strategyId === strategy.id && p.symbol === symbol && p.status !== 'closed' && (!matrixScopeKey || p.matrixScopeKey === matrixScopeKey)
        );
        const lockMatrixScopeWhileOpen = leg.lockMatrixScopeWhileOpen ?? strategy.lockMatrixScopeWhileOpen ?? false;
        const hasSameBarSignal =
            typeof lastTime === 'number' &&
            (store.signals || []).some(
                (existingSignal) =>
                    existingSignal.strategyId === strategy.id &&
                    existingSignal.symbol === symbol &&
                    existingSignal.type === direction &&
                    existingSignal.barTime === lastTime &&
                    ((!matrixScopeKey && !existingSignal.matrixScopeKey) || existingSignal.matrixScopeKey === matrixScopeKey)
            );
        const hasSameBarPosition =
            typeof lastTime === 'number' &&
            currentVirtualPositions.some(
                (position) =>
                    position.strategyId === strategy.id &&
                    position.symbol === symbol &&
                    position.type === direction &&
                    position.status !== 'closed' &&
                    position.openedBarTime === lastTime &&
                    ((!matrixScopeKey && !position.matrixScopeKey) || position.matrixScopeKey === matrixScopeKey)
            );

        if (hasSameBarSignal || hasSameBarPosition) {
            if (typeof lastTime === 'number') store.updateLastSignalTime(strategy.id, lastTime, matrixScopeKey);
            return;
        }

        // Matrix scanner execution is one live trade per symbol/timeframe cell.
        // After reload, persisted open/pending trades must block any fresh entry
        // until that existing trade is closed/cancelled.
        if (matrixScopeKey && lockMatrixScopeWhileOpen && scopedLivePositions.length >= 1) {
            if (typeof lastTime === 'number') store.updateLastSignalTime(strategy.id, lastTime, matrixScopeKey);
            return;
        }

        const activePositions = store.virtualPositions.filter(
            (p) => p.strategyId === strategy.id && p.symbol === symbol && p.type === direction && p.status !== 'closed' && (!matrixScopeKey || p.matrixScopeKey === matrixScopeKey)
        );

        if (currentMode === 'scale_in') {
            const max = leg.risk.maxTrades || 1;
            if (activePositions.length >= max) return;
        } else {
            if (activePositions.length >= 1) return;
        }

        runAiAuditAndTradeLogging(strategy, finalSignal, candles, symbol);

        const side = direction;
        const pip = getPriceOffset(symbol);
        const sl = RiskCalculator.calculateLevel(leg.risk.sl, 'sl', side, candles, lastCandle.close, pip);
        const tp = RiskCalculator.calculateLevel(leg.risk.tp, 'tp', side, candles, lastCandle.close, pip, lastCandle.close);
        const accountBalance = Object.values(useMarketStore.getState().accounts)[0]?.balance || 10000;
        const balance = strategy.executionMode === 'real' ? accountBalance : store.virtualBalance;
        const lot = RiskCalculator.calculateLot(leg.risk.lotSize, sl, lastCandle.close, balance, symbol);

        const positionId = createPositionId('v', strategy.id, symbol, timeframe, direction, lastTime);
        const isMarket = (leg.entryType || strategy.entryType) === 'market';
        const entryPrice = isMarket ? lastCandle.close : RiskCalculator.calculateEntry(leg.entryPrice || strategy.entryPrice, side, candles, lastCandle.close, pip);
        const nowSec = Math.floor(Date.now() / 1000);

        store.addVirtualPosition({
            id: positionId,
            strategyId: strategy.id,
            symbol,
            timeframe,
            source,
            matrixScopeKey,
            openedBarTime: lastTime,
            type: side,
            entryPrice,
            sl: Number(sl.toFixed(5)),
            tp: Number(tp.toFixed(5)),
            lotSize: lot,
            timestamp: Date.now(),
            entry_time: nowSec,
            sl_time: sl > 0 ? nowSec : undefined,
            tp_time: tp > 0 ? nowSec : undefined,
            status: isMarket ? 'open' : 'pending',
            metadata: finalSignal.context,
            confidence: finalSignal.confidence
        });

        void notifyTelegramSignal({
            strategyName: strategy.name,
            symbol,
            timeframe,
            signalType: side,
            orderStatus: isMarket ? 'OPEN' : 'PENDING',
            price: entryPrice,
        });

        if (side === 'BUY') soundService.playBuy();
        else soundService.playSell();

        if (typeof lastTime === 'number') store.updateLastSignalTime(strategy.id, lastTime, matrixScopeKey);
    } else {
        const activePos = currentVirtualPositions.find(
            (p) => p.strategyId === strategy.id && p.symbol === symbol && p.type === finalSignal.direction && p.status !== 'closed' && (!matrixScopeKey || p.matrixScopeKey === matrixScopeKey)
        );
        TradeLogger.updateExit(strategy.id, symbol, finalSignal.price, activePos?.metadata as unknown as Record<string, unknown> | undefined).catch((err) => console.error(err));

        const pending = currentVirtualPositions.find(
            (p) => p.strategyId === strategy.id && p.symbol === symbol && p.type === finalSignal.direction && p.status === 'pending' && (!matrixScopeKey || p.matrixScopeKey === matrixScopeKey)
        );
        if (pending) {
            store.cancelVirtualPosition(strategy.id, symbol, finalSignal.direction, matrixScopeKey);
            void notifyTelegramSignal({
                strategyName: strategy.name,
                symbol,
                timeframe,
                signalType: 'CANCEL',
                orderStatus: 'CANCELLED',
                price: finalSignal.price,
            });
        } else {
            store.closeVirtualPosition(strategy.id, symbol, finalSignal.price, { exit_reason: 'SIGNAL' }, finalSignal.direction, matrixScopeKey);
            void notifyTelegramSignal({
                strategyName: strategy.name,
                symbol,
                timeframe,
                signalType: 'EXIT',
                orderStatus: 'CLOSED',
                price: finalSignal.price,
            });
        }
    }

    store.addSignal({
        ...finalSignal,
        entrySource: finalSignal.type === 'BUY' || finalSignal.type === 'SELL' ? 'bot' : finalSignal.entrySource,
        triggerReason: finalSignal.type === 'EXIT' ? 'strategy_exit_signal' : 'strategy_entry_signal',
        barTime: lastTime,
        timeframe,
        source,
        matrixScopeKey,
    });
    toast.info(`[${finalSignal.type}] ${strategy.name} on ${symbol}`);
}
