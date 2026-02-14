import { supabase } from '@/lib/supabase';
import { SignalStats } from '../types';

export class StatsService {
    static async compute(strategyId: string): Promise<SignalStats> {
        const { data: logs } = await supabase
            .from('trade_logs')
            .select('*')
            .eq('strategy_id', strategyId)
            .not('pnl', 'is', null)
            .order('timestamp', { ascending: false });

        if (!logs || logs.length === 0) {
            return {
                overallWinrate: 0,
                buyWinrate: 0,
                sellWinrate: 0,
                recentWinrate: 0,
                avgMae: 0,
                avgMfe: 0,
                winrateByVolatility: {},
                winrateBySession: {},
                trendWinrate: 0,
                rangeWinrate: 0,
                recentPerformance: { wins: 0, losses: 0, total: 0 },
                sampleSize: 0
            };
        }

        const wins = logs.filter((l: any) => l.pnl > 0);
        const buyLogs = logs.filter((l: any) => l.type === 'BUY');
        const sellLogs = logs.filter((l: any) => l.type === 'SELL');

        const trendLogs = logs.filter((l: any) => (l.indicators?.trendStrength || 0) >= 25);
        const rangeLogs = logs.filter((l: any) => (l.indicators?.trendStrength || 0) < 25);

        const recentLogs = logs.slice(0, 10);
        const recentWins = recentLogs.filter((l: any) => l.pnl > 0).length;

        let totalMae = 0;
        let totalMfe = 0;
        let countWithExcursion = 0;

        logs.forEach((l: any) => {
            if (l.mae !== undefined || l.mfe !== undefined) {
                totalMae += l.mae || 0;
                totalMfe += l.mfe || 0;
                countWithExcursion++;
            }
        });

        const stats: SignalStats = {
            overallWinrate: wins.length / logs.length,
            buyWinrate: buyLogs.length > 0 ? buyLogs.filter(l => l.pnl > 0).length / buyLogs.length : 0,
            sellWinrate: sellLogs.length > 0 ? sellLogs.filter(l => l.pnl > 0).length / sellLogs.length : 0,
            recentWinrate: recentLogs.length > 0 ? recentWins / recentLogs.length : 0,
            avgMae: countWithExcursion > 0 ? totalMae / countWithExcursion : 0,
            avgMfe: countWithExcursion > 0 ? totalMfe / countWithExcursion : 0,
            winrateByVolatility: this.groupBy(logs, 'volatility'),
            winrateBySession: this.groupBy(logs, 'session'),
            trendWinrate: trendLogs.length > 0 ? trendLogs.filter(l => l.pnl > 0).length / trendLogs.length : 0,
            rangeWinrate: rangeLogs.length > 0 ? rangeLogs.filter(l => l.pnl > 0).length / rangeLogs.length : 0,
            recentPerformance: {
                wins: recentWins,
                losses: recentLogs.length - recentWins,
                total: recentLogs.length
            },
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
