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

interface StoreLike {
    virtualPositions: VirtualPosition[];
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
    source: 'MT5' = 'MT5',
    matrixScopeKey?: string
) {
    const realMetrics = ContextCollector.captureEntryContext(strategy, candles, symbol);
    const mMetrics = {
        spread: realMetrics.spread_at_entry || 2,
        volatility: realMetrics.volatility_atr || 0,
        trendStrength: realMetrics.mtf?.h1_trend === 'UP' ? 30 : 10,
        rsi: realMetrics.indicators_snapshot['RSI[14]'] || 50,
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
        if (store.virtualPositions.some((p) => p.strategyId === strategy.id && p.symbol === symbol && p.type === direction && p.status !== 'closed' && (!matrixScopeKey || p.matrixScopeKey === matrixScopeKey))) return;

        runAiAuditAndTradeLogging(strategy, finalSignal, candles, symbol);

        const side = direction;
        const leg = getStrategyLeg(strategy, side);
        const pip = getPriceOffset(symbol);
        const sl = RiskCalculator.calculateLevel(leg.risk.sl, 'sl', side, candles, lastCandle.close, pip);
        const tp = RiskCalculator.calculateLevel(leg.risk.tp, 'tp', side, candles, lastCandle.close, pip, lastCandle.close);
        const accountBalance = Object.values(useMarketStore.getState().accounts)[0]?.balance || 10000;
        const balance = strategy.executionMode === 'real' ? accountBalance : store.virtualBalance;
        const lot = RiskCalculator.calculateLot(leg.risk.lotSize, sl, lastCandle.close, balance, symbol);

        const positionId = `v-${Date.now()}`;
        const isMarket = (leg.entryType || strategy.entryType) === 'market';
        const entryPrice = isMarket ? lastCandle.close : (side === 'BUY' ? lastCandle.high + (pip * 3) : lastCandle.low);
        const nowSec = Math.floor(Date.now() / 1000);

        store.addVirtualPosition({
            id: positionId,
            strategyId: strategy.id,
            symbol,
            timeframe,
            source,
            matrixScopeKey,
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
        TradeLogger.updateExit(strategy.id, symbol, finalSignal.price, activePos?.metadata).catch((err) => console.error(err));

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
        timeframe,
        source,
        matrixScopeKey,
    });
    toast.info(`[${finalSignal.type}] ${strategy.name} on ${symbol}`);
}
