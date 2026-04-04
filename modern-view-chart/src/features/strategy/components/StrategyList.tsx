import React from 'react';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { Plus, Trash2, Bot, Settings, BrainCircuit } from 'lucide-react';
import { Strategy, Condition, ConditionGroup, StrategyDirection, SLTPConfig } from '@/features/strategy/types';
import { getPrimaryStrategyRisk, getStrategyDirections, getStrategyLeg } from '../strategy-helpers';
import { useTranslations } from 'next-intl';
import { useMarketStore } from '@/lib/store';

interface StrategyListProps {
    onEdit: (strategy: Strategy) => void;
    onAdd: () => void;
}

function formatComparator(op: string): string {
    if (op === 'crosses_above') return 'crosses above';
    if (op === 'crosses_below') return 'crosses below';
    return op;
}

function summarizeGroup(group?: ConditionGroup): string[] {
    if (!group || group.conditions.length === 0) return [];
    return group.conditions
        .filter((c): c is Condition => !('operator' in c))
        .map((c) => `${c.left?.type || 'Rule'} (${c.left?.params?.[0] ?? '-'}) ${formatComparator(c.comparator)} ${typeof c.right === 'number' ? c.right : 'indicator'}`);
}

function formatOffset(offset: number | undefined): string {
    const val = offset ?? 0;
    if (val === 0) return 'Signal';
    if (val === 1) return 'Prev';
    return `${val} ago`;
}

function summarizeSL(sl: number | SLTPConfig | undefined, disabledText: string, candleText: string): string {
    if (!sl) return disabledText;
    if (typeof sl === 'number') return `${sl} pts`;
    if (sl.mode === 'candle') return `${candleText} ${sl.candleField || 'low'} (${formatOffset(sl.candleOffset)})`;
    if (sl.mode === 'fixed') return `${sl.value ?? 0} pts`;
    return sl.mode;
}

function summarizeTP(tp: number | SLTPConfig | undefined, trailing: boolean, disabledText: string, trailingText: string, candleText: string): string {
    if (trailing) return trailingText;
    if (!tp) return disabledText;
    if (typeof tp === 'number') return `${tp} pts`;
    if (tp.mode === 'candle') return `${candleText} ${tp.candleField || 'high'} (${formatOffset(tp.candleOffset)})`;
    if (tp.mode === 'fixed') return `${tp.value ?? 0} pts`;
    return tp.mode;
}

export function StrategyList({ onEdit, onAdd }: StrategyListProps) {
    const t = useTranslations('Strategy');
    const { strategies, toggleStrategy, toggleAiGuard, deleteStrategy } = useStrategyStore();
    const setStrategyPanelView = useMarketStore((state) => state.setStrategyPanelView);
    const aiEnabled = process.env.NEXT_PUBLIC_AI_ENABLED === '1' || process.env.NEXT_PUBLIC_AI_ENABLED === 'true';

    const handleToggleAi = (strategyId: string) => {
        if (!aiEnabled) return;
        toggleAiGuard(strategyId);
        setStrategyPanelView('ai_chat');
    };

    return (
        <div className="flex flex-col gap-2 animate-in slide-in-from-left-4 duration-300 w-full">
            <div className="flex justify-between items-center px-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{t('list.runningBot')} ({strategies.length})</span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onAdd}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[11px] font-semibold uppercase transition-all shadow-lg shadow-blue-500/10"
                    >
                        <Plus size={10} /> {t('list.addBot')}
                    </button>
                </div>
            </div>

            {strategies.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center opacity-20 text-center gap-2">
                    <Bot size={32} />
                    <span className="text-[11px] uppercase font-semibold tracking-widest">{t('list.noActiveBots')}</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-2">
                    {strategies.map((s) => (
                        (() => {
                            const previewByDirection = getStrategyDirections(s).map((direction) => {
                                const leg = getStrategyLeg(s, direction as StrategyDirection);
                                const marketLines = summarizeGroup(leg.entry);
                                const entryLines = summarizeGroup(leg.trigger);
                                const lines = [...marketLines, ...entryLines];
                                return {
                                    direction,
                                    firstLine: lines[0] || t('preview.noRules'),
                                    risk: leg.risk || getPrimaryStrategyRisk(s),
                                };
                            });
                            const directions = getStrategyDirections(s).join('/');
                            return (
                        <div key={s.id} className="bg-secondary/40 p-2.5 rounded-lg border border-border flex flex-col gap-2 hover:bg-secondary/60 transition-colors group">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col flex-1">
                                    <span className="text-[11px] font-bold text-foreground group-hover:text-blue-500 transition-colors tracking-tight">{s.name}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">
                                            {directions || t('list.generic')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => toggleStrategy(s.id)} className={`px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase transition-all ${s.active ? 'bg-green-600 text-white shadow-lg shadow-green-900/40' : 'bg-secondary text-muted-foreground border border-border'}`}>
                                        {s.active ? t('list.active') : t('list.paused')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleAi(s.id)}
                                        disabled={!aiEnabled}
                                        aria-disabled={!aiEnabled}
                                        className={`p-1 rounded transition-all flex items-center gap-1 border ${s.aiGuard ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-muted-foreground border-border/40 hover:text-foreground hover:bg-secondary'} ${!aiEnabled ? 'cursor-not-allowed opacity-60' : ''}`}
                                        title={!aiEnabled ? 'AI chưa bật ở môi trường hiện tại' : (s.aiGuard ? 'Tắt AI theo dõi cho bot này' : 'Bật AI theo dõi và mở AI chat')}
                                    >
                                        <BrainCircuit size={11} />
                                        <span className="text-[11px] font-semibold uppercase">{s.aiGuard ? 'AI Bật' : 'AI Tắt'}</span>
                                    </button>
                                    <button onClick={() => onEdit(s)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-all">
                                        <Settings size={11} />
                                    </button>
                                    <button onClick={() => deleteStrategy(s.id)} className="p-1 text-red-500/40 hover:text-red-500 hover:bg-red-500/5 rounded transition-all">
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            </div>
                            <div className="border-t border-border/50 pt-2 flex flex-col gap-1 text-[11px]">
                                {previewByDirection.map((item) => (
                                    <React.Fragment key={`${s.id}-${item.direction}`}>
                                        <p className="text-foreground">
                                            <span className="font-semibold">{item.direction} {t('preview.when')}</span>{' '}
                                            <span className="text-muted-foreground">{item.firstLine}</span>
                                        </p>
                                        <p className="text-foreground">
                                            <span className="font-semibold">{t('preview.sl')}</span>{' '}
                                            <span className="text-muted-foreground">{summarizeSL(item.risk.sl, t('preview.disabled'), t('builder.candle'))}</span>
                                            <span className="mx-2 text-border">|</span>
                                            <span className="font-semibold">{t('preview.tp')}</span>{' '}
                                            <span className="text-muted-foreground">{summarizeTP(item.risk.tp, item.risk.trailing, t('preview.disabled'), t('preview.trailing'), t('builder.candle'))}</span>
                                            <span className="mx-2 text-border">|</span>
                                            <span className="font-semibold">{t('preview.maxTrades')}</span>{' '}
                                            <span className="text-muted-foreground">{item.risk.maxTrades ?? 1}</span>
                                        </p>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                            );
                        })()
                    ))}
                </div>
            )}
        </div>
    );
}

