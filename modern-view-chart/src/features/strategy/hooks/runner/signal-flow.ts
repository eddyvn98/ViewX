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
import type { Candle } from '@/lib/store/types';

interface StoreLike {
    virtualPositions: VirtualPosition[];
    virtualBalance: number;
    addVirtualPosition: (position: VirtualPosition) => void;
    closeVirtualPosition: (strategyId: string, symbol: string, exitPrice: number, metadataUpdate?: Record<string, unknown>) => void;
    cancelVirtualPosition: (strategyId: string, symbol: string) => void;
    addSignal: (signal: StrategySignal) => void;
    updateLastSignalTime: (strategyId: string, timestamp: number) => void;
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
    candles: Candle[],
    lastCandle: CandleLike,
    currentVirtualPositions: VirtualPosition[],
    store: StoreLike,
    sendMessage?: (data: unknown) => void,
    lastTime?: number
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
        const pending = currentVirtualPositions.find((p) => p.strategyId === strategy.id && p.symbol === symbol && p.status === 'pending');
        if (pending) {
            store.cancelVirtualPosition(strategy.id, symbol);
            if (strategy.executionMode === 'real' && sendMessage) {
                sendMessage({ topic: 'mt5_command', command: 'close_by_magic', symbol, magic: strategy.magic || 0 });
            }
            toast.warning(`[CANCEL] ${strategy.name} order killed.`);
        }
        return;
    }

    if (finalSignal.type !== 'EXIT') {
        if (store.virtualPositions.some((p) => p.strategyId === strategy.id && p.symbol === symbol && p.status !== 'closed')) return;

        runAiAuditAndTradeLogging(strategy, finalSignal, candles, symbol);

        const side = finalSignal.type as 'BUY' | 'SELL';
        const pip = getPriceOffset(symbol);
        const sl = RiskCalculator.calculateLevel(strategy.risk.sl, 'sl', side, candles, lastCandle.close, pip);
        const tp = RiskCalculator.calculateLevel(strategy.risk.tp, 'tp', side, candles, lastCandle.close, pip, lastCandle.close);
        const accountBalance = Object.values(useMarketStore.getState().accounts)[0]?.balance || 10000;
        const balance = strategy.executionMode === 'real' ? accountBalance : store.virtualBalance;
        const lot = RiskCalculator.calculateLot(strategy.risk.lotSize, sl, lastCandle.close, balance, symbol);

        const positionId = `v-${Date.now()}`;
        const isMarket = strategy.entryType === 'market';
        const entryPrice = isMarket ? lastCandle.close : (side === 'BUY' ? lastCandle.high + (pip * 3) : lastCandle.low);
        const nowSec = Math.floor(Date.now() / 1000);

        store.addVirtualPosition({
            id: positionId,
            strategyId: strategy.id,
            symbol,
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

        if (side === 'BUY') soundService.playBuy();
        else soundService.playSell();

        if (strategy.executionMode === 'real' && sendMessage) {
            sendMessage({
                topic: 'mt5_command',
                command: 'order',
                symbol,
                is_market: isMarket,
                type: isMarket ? side.toLowerCase() : (side === 'BUY' ? 'buy_stop' : 'sell_stop'),
                price: entryPrice,
                volume: lot,
                sl,
                tp,
                magic: strategy.magic || 0,
                comment: strategy.comment || 'Web'
            });
        }

        if (typeof lastTime === 'number') store.updateLastSignalTime(strategy.id, lastTime);
    } else {
        const activePos = currentVirtualPositions.find((p) => p.strategyId === strategy.id && p.symbol === symbol && p.status !== 'closed');
        TradeLogger.updateExit(strategy.id, symbol, finalSignal.price, activePos?.metadata).catch((err) => console.error(err));

        const pending = currentVirtualPositions.find((p) => p.strategyId === strategy.id && p.symbol === symbol && p.status === 'pending');
        if (pending) store.cancelVirtualPosition(strategy.id, symbol);
        else store.closeVirtualPosition(strategy.id, symbol, finalSignal.price, { exit_reason: 'SIGNAL' });

        if (strategy.executionMode === 'real' && sendMessage) {
            sendMessage({ topic: 'mt5_command', command: 'close_by_magic', symbol, magic: strategy.magic || 0 });
        }
    }

    store.addSignal(finalSignal);
    toast.info(`[${finalSignal.type}] ${strategy.name} on ${symbol}`);
}
