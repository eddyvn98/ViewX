import { supabase } from '@/lib/supabase';
import { SignalStats } from '../types';

export class StatsService {
    static async compute(strategyId: string): Promise<SignalStats> {
        const { data: logs } = await supabase
            .from('trade_logs')
            .select('*')
            .eq('strategy_id', strategyId)
            .not('pnl', 'is', null);

        if (!logs || logs.length === 0) {
            return {
                overallWinrate: 0,
                winrateByVolatility: {},
                winrateBySession: {},
                sampleSize: 0
            };
        }

        const wins = logs.filter((l: any) => l.pnl > 0).length;
        const stats: SignalStats = {
            overallWinrate: wins / logs.length,
            winrateByVolatility: this.groupBy(logs, 'volatility'),
            winrateBySession: this.groupBy(logs, 'session'),
            sampleSize: logs.length
        };

        return stats;
    }

    private static groupBy(logs: any[], key: string): Record<string, number> {
        const groups: Record<string, { total: number, wins: number }> = {};
        logs.forEach(log => {
            const val = log[key] || 'unknown';
            if (!groups[val]) groups[val] = { total: 0, wins: 0 };
            groups[val].total++;
            if (log.pnl > 0) groups[val].wins++;
        });

        const result: Record<string, number> = {};
        for (const k in groups) {
            result[k] = groups[k].wins / groups[k].total;
        }
        return result;
    }
}
