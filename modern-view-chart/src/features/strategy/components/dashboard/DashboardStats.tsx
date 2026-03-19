import React from 'react';
import { PerformanceMetrics } from '../../logic/PerformanceAnalyzer';
import { Target, TrendingUp, Zap, BarChart3, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface Props {
    metrics: PerformanceMetrics;
}

export function DashboardStats({ metrics }: Props) {
    const t = useTranslations('StrategyDashboard.stats');
    const locale = useLocale();
    const numberFormatter = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const compactFormatter = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
    const stats = [
        {
            label: t('netProfit'),
            value: `$${numberFormatter.format(metrics.netProfit)}`,
            sub: `${metrics.netProfit >= 0 ? '+' : ''}${((metrics.netProfit / 10000) * 100).toFixed(2)}%`,
            icon: BarChart3,
            color: metrics.netProfit >= 0 ? 'text-green-500' : 'text-red-400'
        },
        {
            label: t('winRate'),
            value: `${compactFormatter.format(metrics.winRate)}%`,
            sub: `${metrics.winningTrades}${t('wins')} - ${metrics.losingTrades}${t('losses')}`,
            icon: Target,
            color: 'text-primary'
        },
        {
            label: t('profitFactor'),
            value: numberFormatter.format(metrics.profitFactor),
            sub: t('grossRatio'),
            icon: Zap,
            color: metrics.profitFactor >= 1.5 ? 'text-green-400' : (metrics.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400')
        },
        {
            label: t('maxDrawdown'),
            value: `${numberFormatter.format(metrics.maxDrawdown)}%`,
            sub: t('riskMetric'),
            icon: ArrowDownRight,
            color: 'text-orange-400'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
                <div key={i} className="bg-secondary/40 p-5 rounded-xl border border-border flex flex-col gap-2 hover:border-primary/30 transition-all shadow-lg">
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</span>
                        <stat.icon size={16} className={stat.color} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-black text-foreground">{stat.value}</span>
                    </div>
                    <span className={`text-[11px] font-bold uppercase ${stat.color}/80`}>{stat.sub}</span>
                </div>
            ))}

            <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="bg-secondary/40 p-4 rounded-xl border border-border flex justify-between items-center group">
                    <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase">{t('avgWinningTrade')}</span>
                        <span className="text-lg font-mono font-bold text-green-500/90">+${numberFormatter.format(metrics.avgWin)}</span>
                    </div>
                    <ArrowUpRight className="text-green-500/20 group-hover:text-green-500/50 transition-colors" size={32} />
                </div>
                <div className="bg-secondary/40 p-4 rounded-xl border border-border flex justify-between items-center group">
                    <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase">{t('avgLosingTrade')}</span>
                        <span className="text-lg font-mono font-bold text-red-500/90">-${numberFormatter.format(metrics.avgLoss)}</span>
                    </div>
                    <ArrowDownRight className="text-red-500/20 group-hover:text-red-500/50 transition-colors" size={32} />
                </div>
            </div>
        </div>
    );
}
