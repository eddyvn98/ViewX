import React from 'react';
import { VirtualPosition, TradeContext } from '../../types';
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
}

export function TradeDetailPanel({ position }: Props) {
    const context = position.metadata;

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
                        />
                        <MetricCard
                            label="MFE"
                            value={`${context.mfe?.toFixed(2) || 0} pips`}
                            icon={<TrendingUp size={12} className="text-green-500" />}
                        />
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
                                {Object.entries(context.indicators_snapshot).map(([key, val]) => (
                                    <tr key={key}>
                                        <td className="px-3 py-2 font-bold text-[#d1d4dc]">{key}</td>
                                        <td className="px-3 py-2 font-mono text-white">
                                            {typeof val === 'number' ? val.toFixed(4) : String(val)}
                                        </td>
                                    </tr>
                                ))}
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
                <AIInsightPanel position={position} />
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return (
        <div className="bg-[#1e222d] p-3 rounded-lg border border-[#363a45] flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[#787b86]">
                {icon}
                <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
            </div>
            <span className="text-[12px] font-black text-white">{value}</span>
        </div>
    );
}
