import { VirtualPosition, LogicMemory, PerformanceMetrics } from '../types';

export class PerformanceAnalyzer {
    static analyze(positions: VirtualPosition[], initialBalance: number): PerformanceMetrics {
        const closedTrades = positions.filter(p => p.status === 'closed');

        let winningTrades = 0;
        let losingTrades = 0;
        let totalProfit = 0;
        let totalLoss = 0;
        let currentBalance = initialBalance;
        let maxBalance = initialBalance;
        let maxDrawdown = 0;

        const equityCurve: { time: number; value: number }[] = [];

        // Add initial point only if we have trades, otherwise it's just a flat line at initialBalance
        if (closedTrades.length > 0) {
            equityCurve.push({ time: (closedTrades[0].timestamp / 1000) - 60, value: initialBalance });
        } else {
            equityCurve.push({ time: Date.now() / 1000, value: initialBalance });
        }

        const sortedTrades = [...closedTrades].sort((a, b) => (a.exitTimestamp || 0) - (b.exitTimestamp || 0));

        let totalMae = 0;
        let totalMfe = 0;
        let totalConfidence = 0;
        const sessionMap: Record<string, { wins: number; total: number }> = {};

        // New granular metrics
        let buyWins = 0, buyTotal = 0;
        let sellWins = 0, sellTotal = 0;
        let trendWins = 0, trendTotal = 0;
        let rangeWins = 0, rangeTotal = 0;

        sortedTrades.forEach(p => {
            const pnl = p.pnl || 0;
            const meta = p.metadata;
            const isWin = pnl > 0;

            if (pnl > 0) {
                winningTrades++;
                totalProfit += pnl;
            } else if (pnl < 0) {
                losingTrades++;
                totalLoss += Math.abs(pnl);
            }

            // Direction stats
            if (p.type === 'BUY') {
                buyTotal++;
                if (isWin) buyWins++;
            } else {
                sellTotal++;
                if (isWin) sellWins++;
            }

            if (meta) {
                totalMae += meta.mae || 0;
                totalMfe += meta.mfe || 0;
                totalConfidence += p.confidence || 0;

                const session = meta.session || 'Unknown';
                if (!sessionMap[session]) sessionMap[session] = { wins: 0, total: 0 };
                sessionMap[session].total++;
                if (isWin) sessionMap[session].wins++;

                // Regime stats (Simple heuristic for now)
                const trend = meta.mtf?.h1_trend;
                if (trend && trend !== 'SIDEWAYS') {
                    trendTotal++;
                    if (isWin) trendWins++;
                } else {
                    rangeTotal++;
                    if (isWin) rangeWins++;
                }
            }

            currentBalance += pnl;
            equityCurve.push({
                time: Math.floor((p.exitTimestamp || Date.now()) / 1000),
                value: currentBalance
            });

            if (currentBalance > maxBalance) maxBalance = currentBalance;
            const drawdown = ((maxBalance - currentBalance) / maxBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });

        const totalTrades = closedTrades.length;
        const recentTrades = sortedTrades.slice(-10);
        const recentWins = recentTrades.filter(t => (t.pnl || 0) > 0).length;

        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            totalProfit,
            totalLoss,
            netProfit: currentBalance - initialBalance,
            profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 100 : 0,
            avgWin: winningTrades > 0 ? totalProfit / winningTrades : 0,
            avgLoss: losingTrades > 0 ? totalLoss / losingTrades : 0,
            avgMae: totalTrades > 0 ? totalMae / totalTrades : 0,
            avgMfe: totalTrades > 0 ? totalMfe / totalTrades : 0,
            avgConfidence: totalTrades > 0 ? totalConfidence / totalTrades : 0,
            sessionStats: Object.fromEntries(
                Object.entries(sessionMap).map(([s, d]) => [s, { winRate: (d.wins / d.total) * 100, totalTrades: d.total }])
            ),
            // We could add the new metrics to PerformanceMetrics if needed, 
            // but for now they are used to build SignalStats for AI.
            // PerformanceAnalyzer is mostly for the dashboard UI.
            memory: calculateLogicMemory(
                Object.fromEntries(Object.entries(sessionMap).map(([s, d]) => [s, { winRate: (d.wins / d.total) * 100, totalTrades: d.total }])),
                totalTrades > 0 ? totalMae / totalTrades : 0,
                totalTrades
            ),
            maxDrawdown,
            equityCurve,
            // Extended helper for AI (optional enrichment)
            extra: {
                buyWinrate: buyTotal > 0 ? (buyWins / buyTotal) * 100 : 0,
                sellWinrate: sellTotal > 0 ? (sellWins / sellTotal) * 100 : 0,
                recentWinrate: recentTrades.length > 0 ? (recentWins / recentTrades.length) * 100 : 0,
                trendWinrate: trendTotal > 0 ? (trendWins / trendTotal) * 100 : 0,
                rangeWinrate: rangeTotal > 0 ? (rangeWins / rangeTotal) * 100 : 0,
            }
        } as any; // Cast as any to allow extra fields for now if types aren't updated everywhere
    }
}

function calculateLogicMemory(sessionStats: any, avgMae: number, totalTrades: number): LogicMemory {
    const sessionBias: Record<string, number> = {};

    Object.entries(sessionStats).forEach(([session, data]: [string, any]) => {
        // If winrate is > 60%, add bias. If < 40%, subtract bias.
        const winrate = data.winRate;
        if (winrate > 60) sessionBias[session] = 10;
        else if (winrate < 40) sessionBias[session] = -15;
        else sessionBias[session] = 0;
    });

    return {
        sessionBias,
        maeThresholds: { critical: avgMae * 1.5, warning: avgMae },
        efficiencyTarget: 70
    };
}
export type { PerformanceMetrics };

