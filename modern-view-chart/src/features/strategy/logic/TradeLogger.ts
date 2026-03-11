import { createTradeLog, updateTradeExit } from './trade-log-api';

export class TradeLogger {
    static async logEntry(signal: any, metrics: any) {
        if (!signal.type) {
            console.warn('[TradeLogger] Signal type missing, defaulting to BUY. Strategy:', signal.strategyId);
        }

        try {
            const data = await createTradeLog({
                strategy_id: signal.strategyId,
                symbol: signal.symbol,
                type: signal.type || 'BUY',
                entry_price: signal.price,
                lot_size: typeof signal.risk.lotSize === 'object' ? signal.risk.lotSize.value : signal.risk.lotSize,
                volatility: metrics.volatility > 60 ? 'high' : metrics.volatility > 30 ? 'medium' : 'low',
                session: metrics.session || 'Unknown',
                indicators: metrics,
                timestamp: new Date().toISOString(),
            });
            return (data as any)?.id ? data : undefined;
        } catch (error) {
            console.error('[TradeLogger] Error logging entry:', JSON.stringify(error, null, 2));
            console.error('Signal Data:', JSON.stringify(signal, null, 2));
        }
        return undefined;
    }

    static async updateExit(strategyId: string, symbol: string, exitPrice: number, metadata?: any) {
        await updateTradeExit({
            strategy_id: strategyId,
            symbol,
            exit_price: exitPrice,
            metadata,
        });
    }
}
