import React from 'react';
import { PerformanceMetrics } from '../../logic/PerformanceAnalyzer';
import { Target, TrendingUp, Zap, BarChart3, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface Props {
    metrics: PerformanceMetrics;
}

export function DashboardStats({ metrics }: Props) {
    const stats = [
        {
            label: 'Net Profit',
            value: `$${metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            sub: `${metrics.netProfit >= 0 ? '+' : ''}${((metrics.netProfit / 10000) * 100).toFixed(2)}%`,
            icon: BarChart3,
            color: metrics.netProfit >= 0 ? 'text-green-500' : 'text-red-400'
        },
        {
            label: 'Win Rate',
            value: `${metrics.winRate.toFixed(1)}%`,
            sub: `${metrics.winningTrades}W - ${metrics.losingTrades}L`,
            icon: Target,
            color: 'text-blue-400'
        },
        {
            label: 'Profit Factor',
            value: metrics.profitFactor.toFixed(2),
            sub: 'Gross Ratio',
            icon: Zap,
            color: metrics.profitFactor >= 1.5 ? 'text-green-400' : (metrics.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400')
        },
        {
            label: 'Max Drawdown',
            value: `${metrics.maxDrawdown.toFixed(2)}%`,
            sub: 'Risk Metric',
            icon: ArrowDownRight,
            color: 'text-orange-400'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
                <div key={i} className="bg-[#1e222d] p-5 rounded-xl border border-[#363a45] flex flex-col gap-2 hover:border-blue-500/30 transition-all shadow-lg">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-[#787b86] uppercase tracking-widest">{stat.label}</span>
                        <stat.icon size={16} className={stat.color} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-black text-white">{stat.value}</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${stat.color}/80`}>{stat.sub}</span>
                </div>
            ))}

            <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="bg-[#1e222d]/50 p-4 rounded-xl border border-[#363a45] flex justify-between items-center group">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-[#4a4f5d] uppercase">Avg Winning Trade</span>
                        <span className="text-lg font-mono font-bold text-green-500/90">+${metrics.avgWin.toFixed(2)}</span>
                    </div>
                    <ArrowUpRight className="text-green-500/20 group-hover:text-green-500/50 transition-colors" size={32} />
                </div>
                <div className="bg-[#1e222d]/50 p-4 rounded-xl border border-[#363a45] flex justify-between items-center group">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-[#4a4f5d] uppercase">Avg Losing Trade</span>
                        <span className="text-lg font-mono font-bold text-red-500/90">-${metrics.avgLoss.toFixed(2)}</span>
                    </div>
                    <ArrowDownRight className="text-red-500/20 group-hover:text-red-500/50 transition-colors" size={32} />
                </div>
            </div>
        </div>
    );
}
