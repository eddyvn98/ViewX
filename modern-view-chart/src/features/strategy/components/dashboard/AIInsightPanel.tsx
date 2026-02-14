import React, { useState } from 'react';
import { VirtualPosition, PerformanceMetrics } from '../../types';
import { Sparkles, Send, BrainCircuit, Lightbulb, AlertCircle, Loader2, RefreshCcw, Check, ArrowRight, Wrench } from 'lucide-react';
import { AiAnalyzer, AnalysisType } from '../../logic/AiAnalyzer';
import { StatsService } from '../../logic/StatsService';
import { useStrategyStore } from '../../store/strategy-store';
import { soundService } from '../../logic/SoundService';
import { toast } from 'sonner';

interface Props {
    position: VirtualPosition;
    metrics?: PerformanceMetrics;
}

export function AIInsightPanel({ position, metrics }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const [insight, setInsight] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<any | null>(null);
    const updateStrategy = useStrategyStore(state => state.updateStrategy);
    const strategies = useStrategyStore(state => state.strategies);
    const context = position.metadata;

    const generatePrompt = () => {
        if (!context) return "";

        const currentPnl = position.pnl || 0;
        const pnlPips = currentPnl * 10; // Simple pipe conversion, ideally should use getPipMultiplier
        const efficiency = context.mfe && context.mfe > 0 ? (Math.max(0, pnlPips) / context.mfe) * 100 : 0;

        return `
            [TRADE] ${position.symbol}:${position.type} | PnL:${pnlPips.toFixed(1)} | Exit:${context.exit_reason} | Sess:${context.session} | ATR:${context.volatility_atr?.toFixed(4)}
            [METRICS] MAE:${context.mae?.toFixed(1)} | MFE:${context.mfe?.toFixed(1)} | Eff:${efficiency.toFixed(0)}%
            [ENTRY_STATE] ${Object.entries(context.indicators_snapshot || {}).map(([k, v]) => `${k.split('[')[0]}:${typeof v === 'number' ? v.toFixed(2) : v}`).join(', ')}
            
            Audit logic: 1. MAE heat too high? 2. Efficiency gap? 3. Volatility fit?
        `;
    };

    const handleAskAI = async () => {
        if (!context) return;
        setIsLoading(true);
        soundService.playAIThinking();
        try {
            const stats = await StatsService.compute(position.strategyId);
            const strategy = { name: "Manual Inspection", id: position.strategyId } as any; // Fallback or fetch full strat

            const aiMetrics = {
                spread: context.spread_at_entry || 0,
                volatility: context.volatility_atr || 0,
                trendStrength: context.mtf?.h1_trend === 'UP' ? 30 : 10,
                rsi: context.indicators_snapshot?.['RSI[14]'] || 50,
                session: context.session
            };

            const response = await AiAnalyzer.analyzeSignal(
                strategy,
                { ...position, type: position.type },
                aiMetrics,
                stats,
                AnalysisType.POST_TRADE
            );
            setInsight(response.reasoning.join('. '));
            setSuggestion(response.suggestedFix);
            toast.success("AI Analysis Complete");
        } catch (error) {
            console.error('[AIInsight] Analysis failed:', error);
            toast.error("AI Bridge communication failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyFix = () => {
        if (!suggestion || !position.strategyId) return;

        // Logic to translate suggestion field name to actual strategy object path
        // For simplicity, we'll handle RSI threshold and SL/TP
        try {
            const strategy = strategies.find(s => s.id === position.strategyId);
            if (!strategy) return;

            if (suggestion.field === 'rsi_threshold') {
                const newEntry = JSON.parse(JSON.stringify(strategy.entry));
                // Find RSI condition and update value
                const rsiCond = newEntry.conditions.find((c: any) => c.left?.type === 'RSI');
                if (rsiCond) {
                    rsiCond.right = suggestion.value;
                    updateStrategy(strategy.id, { entry: newEntry });
                    toast.success(`Updated RSI threshold to ${suggestion.value}`);
                }
            } else if (suggestion.field === 'trailing_stop') {
                updateStrategy(strategy.id, { risk: { ...strategy.risk, trailing: suggestion.value === 'on' } });
                toast.success(`Trailing Stop ${suggestion.value === 'on' ? 'Enabled' : 'Disabled'}`);
            } else {
                toast.info(`Manual update required for: ${suggestion.field}`);
            }
            setSuggestion(null); // Clear after apply
        } catch (err) {
            toast.error("Failed to apply recommendation automatically.");
        }
    };

    return (
        <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <BrainCircuit size={14} className="text-pink-500" />
                    AI Strategic Insight
                </h4>
                {!insight && !isLoading && (
                    <button
                        onClick={handleAskAI}
                        className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all shadow-lg shadow-pink-500/20 active:scale-95"
                    >
                        <Sparkles size={12} />
                        Analyze with AI
                    </button>
                )}
            </div>

            {isLoading && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center gap-3 animate-pulse">
                    <Loader2 size={24} className="text-pink-500 animate-spin" />
                    <span className="text-[10px] font-bold text-[#787b86] uppercase tracking-tighter">AI is reading the tape...</span>
                </div>
            )}

            {insight && (
                <div className="relative group overflow-hidden">
                    {/* Glassmorphism Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-purple-500/5 backdrop-blur-md border border-white/10 rounded-xl" />

                    <div className="relative p-5 space-y-3">
                        <div className="flex items-center gap-2 text-pink-400">
                            <Lightbulb size={16} />
                            <span className="text-[11px] font-black uppercase tracking-widest">Key Takeaway</span>
                        </div>

                        <p className="text-[12px] text-[#d1d4dc] leading-relaxed italic">
                            "{insight}"
                        </p>

                        {suggestion && (
                            <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2 animate-in zoom-in-95 duration-300">
                                <div className="flex items-center gap-2 text-blue-400">
                                    <Wrench size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">AI Recommendation</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <p className="text-[11px] text-white font-bold">{suggestion.reason}</p>
                                        <div className="flex items-center gap-2 mt-1 text-[9px] text-blue-300/70 font-mono">
                                            <span className="bg-blue-500/20 px-1.5 py-0.5 rounded uppercase">{suggestion.field.replace('_', ' ')}</span>
                                            <ArrowRight size={10} />
                                            <span className="bg-blue-500/20 px-1.5 py-0.5 rounded text-white">{String(suggestion.value)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleApplyFix}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase transition-all flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                        <Check size={12} />
                                        Apply Fix
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="pt-2 flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#787b86] uppercase">
                                <AlertCircle size={12} className="text-blue-400" />
                                Actionable Feedback
                            </div>
                        </div>
                    </div>

                    {/* Animated Border/Glow */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                </div>
            )}

            {!insight && !isLoading && (
                <div className="p-4 bg-[#1e222d]/50 border border-dashed border-[#363a45] rounded-xl flex flex-col items-center gap-2">
                    <p className="text-[10px] text-[#787b86] text-center max-w-[200px]">
                        Click the button above to generate a deep-dive analysis of this trade's characteristics.
                    </p>
                </div>
            )}
        </div>
    );
}
