import { supabase } from '@/lib/supabase'; // Assuming supabase client exists here

export class TradeLogger {
    static async logEntry(signal: any, metrics: any) {
        const { data, error } = await supabase
            .from('trade_logs')
            .insert([{
                strategy_id: signal.strategyId,
                symbol: signal.symbol,
                type: signal.type,
                entry_price: signal.price,
                lot_size: signal.risk.lotSize,
                volatility: metrics.volatility > 60 ? 'high' : metrics.volatility > 30 ? 'medium' : 'low',
                session: metrics.session || 'Unknown',
                indicators: metrics,
                timestamp: new Date().toISOString()
            }])
            .select();

        if (error) console.error('[TradeLogger] Error logging entry:', error);
        return data?.[0];
    }

    static async updateExit(strategyId: string, symbol: string, exitPrice: number) {
        // Find the last open entry for this strategy/symbol
        const { data: entries } = await supabase
            .from('trade_logs')
            .select('*')
            .eq('strategy_id', strategyId)
            .eq('symbol', symbol)
            .is('exit_price', null)
            .order('timestamp', { ascending: false })
            .limit(1);

        if (entries && entries.length > 0) {
            const entry = entries[0];
            const type = entry.type === 'BUY' ? 1 : -1;
            const pnl = (exitPrice - entry.entry_price) * type * (entry.lot_size * 100000); // Rough PnL

            await supabase
                .from('trade_logs')
                .update({
                    exit_price: exitPrice,
                    pnl,
                    type: 'EXIT'
                })
                .eq('id', entry.id);
        }
    }
}
