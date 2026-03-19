import React from 'react';
import { useTranslations } from 'next-intl';
import { VirtualPosition, TradeContext, PerformanceMetrics } from '../../types';
import {
    Clock,
    TrendingUp,
    TrendingDown,
    Zap,
    Activity,
    Target,
    BarChart3,
    CheckCircle2,
    XCircle,
    Info,
    MoveUpRight,
    Search
} from 'lucide-react';
import { AIInsightPanel } from './AIInsightPanel';

interface Props {
    position: VirtualPosition;
    metrics?: PerformanceMetrics;
}

const getEfficiencyColor = (eff: number) => {
    if (eff >= 80) return 'text-green-500';
    if (eff >= 50) return 'text-yellow-500';
    return 'text-red-500';
};

export function TradeDetailPanel({ position, metrics }: Props) {
    const t = useTranslations('StrategyDashboard.tradeDetail');
    const context = position.metadata;
    console.log(`[TradeDetail] Inspecting Trade: ${position.id} | Metadata keys:`, context ? Object.keys(context) : 'NULL');
    if (context && context.indicators_snapshot) {
        console.log(`[TradeDetail] Snapshot Indicators count:`, Object.keys(context.indicators_snapshot).length);
    }

    if (!context) {
        return (
                <div className="p-8 text-center text-muted-foreground text-xs">
                {t('noAdvancedContext')}
                </div>
            );
    }

    const handleFocusOnChart = () => {
        // Broadcast event or update store to jump to timestamp
        console.log(`[Navigation] Jumping to ${position.symbol} at ${position.timestamp}`);
        window.dispatchEvent(new CustomEvent('chart_focus_request', {
            detail: {
                symbol: position.symbol,
                timestamp: position.timestamp,
                exitTimestamp: position.exitTimestamp
            }
        }));
    };

    const sessionLabel = context.session ? t(`sessions.${String(context.session).toLowerCase()}`) : 'N/A';

    return (
        <div className="bg-secondary p-6 border-t border-border space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* 1. Snapshot Grid */}
                <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} className="text-primary" />
                        {t('marketDynamics')}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <MetricCard
                            label={t('session')}
                            value={sessionLabel}
                            icon={<Clock size={12} />}
                        />
                        <MetricCard
                            label={t('volatilityAtr')}
                            value={context.volatility_atr?.toFixed(2) || 'N/A'}
                            icon={<Zap size={12} />}
                        />
                        <MetricCard
                            label="MAE"
                            value={`${context.mae?.toFixed(2) || 0} ${t('pips')}`}
                            icon={<TrendingDown size={12} className="text-red-500" />}
                            tooltip={t('maeTooltip')}
                        />
                        <MetricCard
                            label="MFE"
                            value={`${context.mfe?.toFixed(2) || 0} ${t('pips')}`}
                            icon={<TrendingUp size={12} className="text-green-500" />}
                            tooltip={t('mfeTooltip')}
                        />
                    </div>

                    {/* Trade Efficiency */}
                    <div className="bg-secondary/60 p-4 rounded-lg border border-border">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase">{t('tradeEfficiency')}</span>
                            <span className={`text-[11px] font-black ${getEfficiencyColor(
                                (Math.max(0, position.pnl || 0) / (context.mfe || 1)) * 100
                            )}`}>
                                {context.mfe && context.mfe > 0
                                    ? ((Math.max(0, (position.exitPrice! - position.entryPrice) * (position.type === 'BUY' ? 1 : -1) * 10) / context.mfe) * 100).toFixed(1)
                                    : '0.0'}%
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${(position.pnl || 0) > 0 ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                                style={{
                                    width: `${Math.min(100, (Math.max(0, position.pnl || 0) / (context.mfe || 1)) * 100)}%`
                                }}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2 italic leading-tight">
                            {t('tradeEfficiencyDesc')}
                        </p>
                    </div>

                    {context.exit_reason && (
                        <div className={`mt-4 p-2 rounded flex items-center gap-2 border ${context.exit_reason === 'TP' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                            context.exit_reason === 'SL' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                'bg-primary/10 border-primary/20 text-primary'
                            }`}>
                            <Target size={14} />
                            <span className="text-[11px] font-black uppercase">{t('exitReason')}: {context.exit_reason}</span>
                        </div>
                    )}

                    <button
                        onClick={handleFocusOnChart}
                        className="w-full mt-4 flex items-center justify-center gap-2 bg-secondary/80 hover:bg-secondary text-foreground py-2 rounded-lg text-[11px] font-bold uppercase transition-colors border border-border"
                    >
                        <Search size={14} className="text-primary" />
                        {t('inspectOnChart')}
                    </button>
                </div>

                {/* 2. Indicator Reality Check */}
                <div className="space-y-4 md:col-span-2">
                    <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 size={14} className="text-primary" />
                        {t('entryRealityCheck')}
                    </h4>
                    <div className="bg-secondary/60 rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                            <thead>
                                <tr className="bg-secondary/80 text-muted-foreground uppercase">
                                    <th className="px-3 py-2 font-black">{t('indicator')}</th>
                                    <th className="px-3 py-2 font-black">{t('conditionValue')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {context.indicators_snapshot ? (
                                    Object.entries(context.indicators_snapshot).map(([key, val]) => (
                                        <tr key={key}>
                                            <td className="px-3 py-2 font-bold text-muted-foreground">{key}</td>
                                            <td className="px-3 py-2 font-mono text-foreground">
                                                {typeof val === 'number' ? val.toFixed(4) : String(val)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground italic">
                                            {t('noIndicatorSnapshot')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {context.post_exit && (
                        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Info size={14} className="text-primary" />
                                <span className="text-[11px] font-black text-primary uppercase tracking-widest">{t('postTradeAnalysis')}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                {t('postTradeAnalysisDesc')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. AI Insights Section */}
            <div className="pt-6 border-t border-border/50">
                <AIInsightPanel position={position} metrics={metrics} />
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon, tooltip }: { label: string; value: string; icon: React.ReactNode; tooltip?: string }) {
    return (
        <div className="bg-secondary/60 p-3 rounded-lg border border-border flex flex-col gap-1 group relative">
            <div className="flex items-center gap-1.5 text-muted-foreground">
                {icon}
                <span className="text-[11px] font-bold uppercase tracking-tight">{label}</span>
            </div>
            <span className="text-[12px] font-black text-foreground">{value}</span>

            {tooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-popover text-[11px] text-foreground rounded shadow-xl border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {tooltip}
                </div>
            )}
        </div>
    );
}
