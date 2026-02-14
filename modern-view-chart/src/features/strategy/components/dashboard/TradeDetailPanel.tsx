import React from 'react';
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
    const context = position.metadata;
    console.log(`[TradeDetail] Inspecting Trade: ${position.id} | Metadata keys:`, context ? Object.keys(context) : 'NULL');
    if (context && context.indicators_snapshot) {
        console.log(`[TradeDetail] Snapshot Indicators count:`, Object.keys(context.indicators_snapshot).length);
    }

    if (!context) {
        return (
            <div className="p-8 text-center text-[#787b86] text-xs">
                No advanced context available for this trade.
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

    return (
        <div className="bg-[#131722] p-6 border-t border-[#363a45] space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* 1. Snapshot Grid */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} className="text-blue-500" />
                        Market Dynamics
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <MetricCard
                            label="Session"
                            value={context.session}
                            icon={<Clock size={12} />}
                        />
                        <MetricCard
                            label="Volatility (ATR)"
                            value={context.volatility_atr?.toFixed(2) || 'N/A'}
                            icon={<Zap size={12} />}
                        />
                        <MetricCard
                            label="MAE"
                            value={`${context.mae?.toFixed(2) || 0} pips`}
                            icon={<TrendingDown size={12} className="text-red-500" />}
                            tooltip="Maximum Adverse Excursion: The furthest price moved against you."
                        />
                        <MetricCard
                            label="MFE"
                            value={`${context.mfe?.toFixed(2) || 0} pips`}
                            icon={<TrendingUp size={12} className="text-green-500" />}
                            tooltip="Maximum Favorable Excursion: The furthest price moved in your favor."
                        />
                    </div>

                    {/* Trade Efficiency */}
                    <div className="bg-[#1e222d] p-4 rounded-lg border border-[#363a45]">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-bold text-[#787b86] uppercase">Trade Efficiency</span>
                            <span className={`text-[11px] font-black ${getEfficiencyColor(
                                (Math.max(0, position.pnl || 0) / (context.mfe || 1)) * 100
                            )}`}>
                                {context.mfe && context.mfe > 0
                                    ? ((Math.max(0, (position.exitPrice! - position.entryPrice) * (position.type === 'BUY' ? 1 : -1) * 10) / context.mfe) * 100).toFixed(1)
                                    : '0.0'}%
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-[#363a45] rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${(position.pnl || 0) > 0 ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                                style={{
                                    width: `${Math.min(100, (Math.max(0, position.pnl || 0) / (context.mfe || 1)) * 100)}%`
                                }}
                            />
                        </div>
                        <p className="text-[9px] text-[#4a4f5d] mt-2 italic leading-tight">
                            Measures how much of the potential move (MFE) was captured as profit.
                        </p>
                    </div>

                    {context.exit_reason && (
                        <div className={`mt-4 p-2 rounded flex items-center gap-2 border ${context.exit_reason === 'TP' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                            context.exit_reason === 'SL' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                'bg-blue-500/10 border-blue-500/20 text-blue-500'
                            }`}>
                            <Target size={14} />
                            <span className="text-[10px] font-black uppercase">Exit Reason: {context.exit_reason}</span>
                        </div>
                    )}

                    <button
                        onClick={handleFocusOnChart}
                        className="w-full mt-4 flex items-center justify-center gap-2 bg-[#2a2e39] hover:bg-[#363a45] text-white py-2 rounded-lg text-[10px] font-bold uppercase transition-colors"
                    >
                        <Search size={14} className="text-blue-400" />
                        Inspect on Chart
                    </button>
                </div>

                {/* 2. Indicator Reality Check */}
                <div className="space-y-4 md:col-span-2">
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 size={14} className="text-purple-500" />
                        Entry Reality Check (Snapshot)
                    </h4>
                    <div className="bg-[#1e222d] rounded-lg border border-[#363a45] overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                            <thead>
                                <tr className="bg-[#131722]/50 text-[#787b86] uppercase">
                                    <th className="px-3 py-2 font-black">Indicator</th>
                                    <th className="px-3 py-2 font-black">Condition Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#363a45]/30">
                                {context.indicators_snapshot ? (
                                    Object.entries(context.indicators_snapshot).map(([key, val]) => (
                                        <tr key={key}>
                                            <td className="px-3 py-2 font-bold text-[#d1d4dc]">{key}</td>
                                            <td className="px-3 py-2 font-mono text-white">
                                                {typeof val === 'number' ? val.toFixed(4) : String(val)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="px-3 py-8 text-center text-[#787b86] italic">
                                            No indicator snapshot available for this trade.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {context.post_exit && (
                        <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Info size={14} className="text-blue-400" />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Post-Trade Analysis</span>
                            </div>
                            <p className="text-[11px] text-[#787b86]">
                                Trade closure efficiency analyzed. Post-exit price behavior captured for performance review.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. AI Insights Section */}
            <div className="pt-6 border-t border-[#363a45]/50">
                <AIInsightPanel position={position} metrics={metrics} />
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon, tooltip }: { label: string; value: string; icon: React.ReactNode; tooltip?: string }) {
    return (
        <div className="bg-[#1e222d] p-3 rounded-lg border border-[#363a45] flex flex-col gap-1 group relative">
            <div className="flex items-center gap-1.5 text-[#787b86]">
                {icon}
                <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
            </div>
            <span className="text-[12px] font-black text-white">{value}</span>

            {tooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-[#2a2e39] text-[9px] text-[#d1d4dc] rounded shadow-xl border border-[#363a45] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {tooltip}
                </div>
            )}
        </div>
    );
}
