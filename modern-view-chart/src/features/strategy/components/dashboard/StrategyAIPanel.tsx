import React, { useState } from 'react';
import { PerformanceMetrics } from '../../logic/PerformanceAnalyzer';
import { Sparkles, BrainCircuit, Target, Zap, Loader2 } from 'lucide-react';

interface Props {
    metrics: PerformanceMetrics;
}

export function StrategyAIPanel({ metrics }: Props) {
    const aiEnabled = false;
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);

    const bestSession = Object.entries(metrics.sessionStats).sort((a, b) => b[1].winRate - a[1].winRate)[0];
    const avgConfidence = metrics.avgConfidence || 0;

    const handleMacroAnalyze = async () => {
        if (!aiEnabled) return;
        setIsLoading(true);
        setTimeout(() => {
            let mockAnalysis = "";
            const pf = metrics.profitFactor;
            const conf = avgConfidence;

            if (conf > 75 && pf > 1.2) {
                mockAnalysis = `System high-trust phase: AI Confidence is high (${conf.toFixed(0)}%) and aligning with profitability. Signals with >80% confidence are prime candidates for MT5 execution. Logic behavior is highly consistent in ${bestSession?.[0] || 'London'} session.`;
            } else if (conf < 50) {
                mockAnalysis = `Low confidence phase: The bot is currently entering in high-noise conditions. Most signals are below 50% confidence. Recommendation: Monitor only; avoid MT5 execution until MAE stabilizes and Confidence returns to >70%.`;
            } else {
                mockAnalysis = `Optimization needed: Bot is profitable but "shaky". Average confidence is ${conf.toFixed(0)}%. You are capturing profit but taking too much "Logic Heat" (MAE). Tighten entry triggers to boost confidence scores.`;
            }

            setAnalysis(mockAnalysis);
            setIsLoading(false);
        }, 1800);
    };

    return (
        <div className="bg-secondary/20 rounded-2xl border border-blue-500/20 overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <BrainCircuit size={20} className="text-blue-400" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-sm font-black text-foreground uppercase tracking-widest">AI Strategy Coach</h3>
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Bot → MT5 Signal Guidance</span>
                        </div>
                    </div>

                    {!analysis && !isLoading && (
                        <button
                            onClick={handleMacroAnalyze}
                            disabled={!aiEnabled}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all shadow-lg shadow-blue-500/25 active:scale-95 group disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Sparkles size={14} className="group-hover:animate-pulse" />
                            Perform System Audit
                        </button>
                    )}
                </div>

                {isLoading && (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                            <Loader2 size={32} className="text-blue-400 animate-spin relative" />
                        </div>
                        <span className="text-[10px] font-black text-blue-400/80 uppercase tracking-widest animate-pulse">Aggregating trade data...</span>
                    </div>
                )}

                {analysis && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-secondary/40 p-4 rounded-xl border border-border/50 flex items-start gap-4">
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                    <Target size={16} className="text-green-400" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase">System Strength</span>
                                    <p className="text-[11px] text-foreground/80 leading-relaxed italic">
                                        &quot;{analysis}&quot;
                                    </p>
                                </div>
                            </div>

                            <div className="bg-secondary/40 p-4 rounded-xl border border-border/50 flex items-start gap-4">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <Zap size={16} className="text-purple-400" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase">Actionable Refinement</span>
                                    <div className="space-y-2 mt-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-blue-400" />
                                            <span className="text-[10px] font-bold text-foreground/90">Filter MT5 trades by AI Confidence &gt; 80%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-blue-400" />
                                            <span className="text-[10px] font-bold text-foreground/90">Audit ${bestSession?.[0] || 'Current'} Logic for MAE spikes</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <button
                                onClick={() => setAnalysis(null)}
                                className="text-[10px] font-black text-muted-foreground hover:text-blue-500 uppercase tracking-widest transition-colors flex items-center gap-2"
                            >
                                <RefreshCcw width={12} height={12} />
                                Recalculate with New Data
                            </button>
                        </div>
                    </div>
                )}

                {!analysis && !isLoading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <MacroChip label="Avg Confidence" value={`${avgConfidence.toFixed(0)}%`} color="text-blue-400" />
                        <MacroChip label="Avg MAE" value={`${metrics.avgMae.toFixed(2)} pips`} color="text-red-400" />
                        <MacroChip label="Avg MFE" value={`${metrics.avgMfe.toFixed(2)} pips`} color="text-green-400" />
                        <MacroChip label="Prediction Accuracy" value="In Testing" color="text-purple-400" />
                    </div>
                )}
            </div>
        </div>
    );
}

function MacroChip({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="bg-secondary/40 px-4 py-2 rounded-xl border border-border/30 flex flex-col">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">{label}</span>
            <span className={`text-[11px] font-mono font-black ${color}`}>{value}</span>
        </div>
    );
}

function RefreshCcw(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
        </svg>
    )
}

