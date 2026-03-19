import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { VirtualPosition, PerformanceMetrics, ConditionGroup, Strategy, Condition } from '../../types';
import { Sparkles, BrainCircuit, Lightbulb, AlertCircle, Loader2, Check, ArrowRight, Wrench } from 'lucide-react';
import { AiAnalyzer, AnalysisType } from '../../logic/AiAnalyzer';
import { StatsService } from '../../logic/StatsService';
import { useStrategyStore } from '../../store/strategy-store';
import { soundService } from '../../logic/SoundService';
import { toast } from 'sonner';
import { getPrimaryStrategyRisk, getStrategyLeg } from '../../strategy-helpers';

interface Props {
    position: VirtualPosition;
    metrics?: PerformanceMetrics;
}

type AiSuggestion = {
    field: string;
    value: unknown;
    reason: string;
};

const cloneConditionGroup = (group: ConditionGroup): ConditionGroup =>
    JSON.parse(JSON.stringify(group)) as ConditionGroup;

const isCondition = (value: ConditionGroup['conditions'][number]): value is Condition => !('operator' in value);

export function AIInsightPanel({ position }: Props) {
    const t = useTranslations('StrategyDashboard.aiInsight');
    const [isLoading, setIsLoading] = useState(false);
    const [insight, setInsight] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
    const updateStrategy = useStrategyStore(state => state.updateStrategy);
    const strategies = useStrategyStore(state => state.strategies);
    const context = position.metadata;

    const handleAskAI = async () => {
        if (!context) return;
        setIsLoading(true);
        soundService.playAIThinking();
        try {
            const stats = await StatsService.compute(position.strategyId);
            const strategy: Strategy = {
                id: position.strategyId,
                name: 'Manual Inspection',
                active: true,
                positionMode: 'single_position',
                executionMode: 'virtual',
                entryType: 'market',
            };

            const aiMetrics = {
                spread: context.spread_at_entry || 0,
                volatility: context.volatility_atr || 0,
                trendStrength: context.mtf?.h1_trend === 'UP' ? 30 : 10,
                rsi: Number((context.indicators_snapshot?.['RSI[14]'] as number | undefined) ?? 50),
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
            setSuggestion((response.suggestedFix ?? null) as AiSuggestion | null);
            toast.success(t('toast.analysisComplete'));
        } catch (error) {
            console.error('[AIInsight] Analysis failed:', error);
            toast.error(t('toast.bridgeFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyFix = () => {
        if (!suggestion || !position.strategyId) return;

        try {
            const strategy = strategies.find(s => s.id === position.strategyId);
            if (!strategy) return;

            if (suggestion.field === 'rsi_threshold') {
                const leg = getStrategyLeg(strategy, position.type);
                const newEntry = cloneConditionGroup(leg.entry);
                const rsiCond = newEntry.conditions.find((c): c is Condition => isCondition(c) && c.left.type === 'RSI');
                if (rsiCond) {
                    rsiCond.right = typeof suggestion.value === 'number' ? suggestion.value : Number(suggestion.value);
                    updateStrategy(strategy.id, {
                        entry: position.type === 'BUY' ? newEntry : strategy.entry,
                        buy: position.type === 'BUY' && strategy.buy ? { ...strategy.buy, entry: newEntry } : strategy.buy,
                        sell: position.type === 'SELL' && strategy.sell ? { ...strategy.sell, entry: newEntry } : strategy.sell,
                    });
                    toast.success(t('toast.updatedRsi', { value: String(suggestion.value) }));
                }
            } else if (suggestion.field === 'trailing_stop') {
                const risk = getPrimaryStrategyRisk(strategy);
                const isOn = suggestion.value === 'on';
                updateStrategy(strategy.id, {
                    risk: { ...risk, trailing: isOn },
                    buy: position.type === 'BUY' && strategy.buy ? { ...strategy.buy, risk: { ...strategy.buy.risk, trailing: isOn } } : strategy.buy,
                    sell: position.type === 'SELL' && strategy.sell ? { ...strategy.sell, risk: { ...strategy.sell.risk, trailing: isOn } } : strategy.sell,
                });
                toast.success(t('toast.trailingStop', { state: isOn ? t('enabled') : t('disabled') }));
            } else {
                toast.info(t('toast.manualUpdateRequired', { field: suggestion.field }));
            }
            setSuggestion(null);
        } catch {
            toast.error(t('toast.applyFailed'));
        }
    };

    return (
        <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <BrainCircuit size={14} className="text-primary" />
                    {t('title')}
                </h4>
                {!insight && !isLoading && (
                    <button
                        onClick={handleAskAI}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full text-[11px] font-black uppercase transition-all shadow-lg shadow-primary/20 active:scale-95"
                    >
                        <Sparkles size={12} />
                        {t('analyzeWithAi')}
                    </button>
                )}
            </div>

            {isLoading && (
                <div className="bg-secondary/40 border border-border/50 rounded-xl p-6 flex flex-col items-center justify-center gap-3 animate-pulse">
                    <Loader2 size={24} className="text-primary animate-spin" />
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tighter">{t('readingTape')}</span>
                </div>
            )}

            {insight && (
                <div className="relative group overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5 backdrop-blur-md border border-border rounded-xl" />

                    <div className="relative p-5 space-y-3">
                        <div className="flex items-center gap-2 text-primary">
                            <Lightbulb size={16} />
                            <span className="text-[11px] font-black uppercase tracking-widest">{t('keyTakeaway')}</span>
                        </div>

                        <p className="text-[12px] text-foreground/80 leading-relaxed italic">
                            &quot;{insight}&quot;
                        </p>

                        {suggestion && (
                            <div className="mt-4 bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-2 animate-in zoom-in-95 duration-300">
                                <div className="flex items-center gap-2 text-primary">
                                    <Wrench size={14} />
                                    <span className="text-[11px] font-black uppercase tracking-wider">{t('aiRecommendation')}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <p className="text-[11px] text-foreground font-bold">{suggestion.reason}</p>
                                        <div className="flex items-center gap-2 mt-1 text-[11px] text-primary font-mono">
                                            <span className="bg-primary/20 px-1.5 py-0.5 rounded uppercase">{suggestion.field.replace('_', ' ')}</span>
                                            <ArrowRight size={10} />
                                            <span className="bg-primary/20 px-1.5 py-0.5 rounded text-foreground font-black">{String(suggestion.value)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleApplyFix}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded text-[11px] font-black uppercase transition-all flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                        <Check size={12} />
                                        {t('applyFix')}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="pt-2 flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase">
                                <AlertCircle size={12} className="text-primary" />
                                {t('actionableFeedback')}
                            </div>
                        </div>
                    </div>

                    <div className="absolute -inset-0.5 bg-primary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                </div>
            )}

            {!insight && !isLoading && (
                <div className="p-4 bg-secondary/20 border border-dashed border-border rounded-xl flex flex-col items-center gap-2">
                    <p className="text-[11px] text-muted-foreground text-center max-w-[200px]">
                        {t('emptyHint')}
                    </p>
                </div>
            )}
        </div>
    );
}
