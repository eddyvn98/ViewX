import React, { useState } from 'react';
import { VirtualPosition } from '../../types';
import { Sparkles, Send, BrainCircuit, Lightbulb, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
    position: VirtualPosition;
}

export function AIInsightPanel({ position }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const [insight, setInsight] = useState<string | null>(null);

    const generatePrompt = () => {
        const context = position.metadata;
        if (!context) return "";

        const prompt = `
            Analyze this trade for strategy refinement:
            - Symbol: ${position.symbol}
            - Type: ${position.type}
            - Result: ${position.pnl && position.pnl > 0 ? 'PROFIT' : 'LOSS'} ($${position.pnl?.toFixed(2)})
            - Exit Reason: ${context.exit_reason || 'Unknown'}
            - Market Session: ${context.session}
            - Max Adverse Excursion (MAE): ${context.mae?.toFixed(2)} pips
            - Max Favorable Excursion (MFE): ${context.mfe?.toFixed(2)} pips
            
            Indicator Snapshot at Entry:
            ${Object.entries(context.indicators_snapshot).map(([k, v]) => `${k}: ${v}`).join('\n')}
            
            Question: Why did this trade behave this way given the MAE/MFE and indicators? What should I adjust?
        `;
        return prompt.trim();
    };

    const handleAskAI = async () => {
        setIsLoading(true);
        // Simulate AI request delay
        setTimeout(() => {
            const isProfit = (position.pnl || 0) > 0;
            const mockResponse = isProfit
                ? "This trade succeeded due to strong momentum confirmation. Notice the low MAE, indicating price never significantly moved against you. Recommendation: Consider increasing lot size when MAE is consistently < 5 pips on this setup."
                : "This trade failed despite indicator confirmation. The high MAE suggests you were caught in a reversal. The volume climax at entry indicates an exhaustion point. Recommendation: Add a volume trend filter to avoid buying at the top of a move.";

            setInsight(mockResponse);
            setIsLoading(false);
        }, 1500);
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
