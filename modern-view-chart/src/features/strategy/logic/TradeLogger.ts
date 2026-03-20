import { createTradeLog, TradeLogApiError, updateTradeExit } from './trade-log-api';
import type { MarketMetrics } from './AiManager';
import type { StrategySignal } from '../types';

type TradeLogResponse = {
    id?: string;
    [key: string]: unknown;
};

export class TradeLogger {
    static async logEntry(signal: StrategySignal, metrics: MarketMetrics & Record<string, unknown>) {
        if (!signal.type) {
            console.warn('[TradeLogger] Signal type missing, defaulting to BUY. Strategy:', signal.strategyId);
        }

        try {
            const data = (await createTradeLog({
                strategy_id: signal.strategyId,
                symbol: signal.symbol,
                type: (signal.type === 'SELL' ? 'SELL' : 'BUY'),
                entry_price: signal.price,
                lot_size: typeof signal.risk.lotSize === 'object' ? signal.risk.lotSize.value : signal.risk.lotSize,
                volatility: metrics.volatility > 60 ? 'high' : metrics.volatility > 30 ? 'medium' : 'low',
                session: metrics.session || 'Unknown',
                indicators: metrics,
                timestamp: new Date().toISOString(),
            })) as TradeLogResponse;
            return data?.id ? data : undefined;
        } catch (error) {
            console.error('[TradeLogger] Error logging entry:', JSON.stringify(error, null, 2));
            console.error('Signal Data:', JSON.stringify(signal, null, 2));
        }
        return undefined;
    }

    static async updateExit(strategyId: string, symbol: string, exitPrice: number, metadata?: Record<string, unknown>) {
        try {
            await updateTradeExit({
                strategy_id: strategyId,
                symbol,
                exit_price: exitPrice,
                metadata,
            });
        } catch (error) {
            if (
                error instanceof TradeLogApiError
                && error.status === 404
                && error.code === 'trade_log_not_found'
            ) {
                console.warn('[TradeLogger] Skip exit update because no open trade log was found.', {
                    strategyId,
                    symbol,
                    exitPrice,
                });
                return;
            }
            throw error;
        }
    }
}
