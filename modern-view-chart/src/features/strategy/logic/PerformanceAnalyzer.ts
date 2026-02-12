import { VirtualPosition } from '../types';

export interface PerformanceMetrics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalProfit: number;
    totalLoss: number;
    netProfit: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    equityCurve: { time: number; value: number }[];
}

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

        // Sort by exit time to build equity curve
        const sortedTrades = [...closedTrades].sort((a, b) => (a.exitTimestamp || 0) - (b.exitTimestamp || 0));

        sortedTrades.forEach(p => {
            const pnl = p.pnl || 0;
            if (pnl > 0) {
                winningTrades++;
                totalProfit += pnl;
            } else if (pnl < 0) {
                losingTrades++;
                totalLoss += Math.abs(pnl);
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
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 100 : 0;
        const avgWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
        const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;

        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            totalProfit,
            totalLoss,
            netProfit: currentBalance - initialBalance,
            profitFactor,
            avgWin,
            avgLoss,
            maxDrawdown,
            equityCurve
        };
    }
}
