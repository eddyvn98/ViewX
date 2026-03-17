import React from 'react';
import { ConditionGroup, Condition, IndicatorType, Comparator } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

const isCondition = (value: Condition | ConditionGroup): value is Condition => !('operator' in value);

interface RuleSectionProps {
    title: string;
    group: ConditionGroup;
    onChange: (group: ConditionGroup) => void;
    accentColor: string;
    stepNumber?: number;
}

function RuleSection({ title, group, onChange, accentColor, stepNumber }: RuleSectionProps) {
    const t = useTranslations('Strategy');
    const addCondition = () => {
        const newCondition: Condition = {
            id: Math.random().toString(36).substring(7),
            left: { type: 'RSI', params: [14] },
            comparator: '>',
            right: 60
        };
        onChange({
            ...group,
            conditions: [...group.conditions, newCondition]
        });
    };

    const removeCondition = (id: string) => {
        onChange({
            ...group,
            conditions: group.conditions.filter(c => !('id' in c) || c.id !== id)
        });
    };

    const updateCondition = (id: string, updates: Partial<Condition>) => {
        onChange({
            ...group,
            conditions: group.conditions.map(c =>
                ('id' in c && c.id === id) ? { ...(c as Condition), ...updates } : c
            )
        });
    };

    return (
        <div className="rounded-lg border border-border bg-secondary/10 overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {typeof stepNumber === 'number' && (
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center">
                            {stepNumber}
                        </span>
                    )}
                    <span className={`text-[12px] font-black uppercase tracking-wide ${accentColor}`}>{title}</span>
                    <select
                        value={group.operator}
                        onChange={(e) => onChange({ ...group, operator: e.target.value as ConditionGroup['operator'] })}
                        className="bg-secondary/60 text-[10px] font-black px-1.5 py-0.5 rounded border border-border outline-none text-muted-foreground appearance-none cursor-pointer hover:border-blue-500/30"
                    >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                    </select>
                </div>
                <button
                    onClick={addCondition}
                    className="text-[11px] font-black text-blue-500/80 hover:text-blue-500 flex items-center gap-1 transition-colors uppercase"
                >
                    <Plus size={12} /> {t('builder.addRule')}
                </button>
            </div>

            <div className="p-3 flex flex-col gap-2 min-h-[10px] justify-center">
                {group.conditions.length === 0 ? (
                    <div className="py-3 flex justify-center border border-dashed border-border rounded text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
                        {t('builder.noRules')}
                    </div>
                ) : (
                    group.conditions.filter(isCondition).map((c) => (
                        <div key={c.id} className="flex items-center gap-1.5 group animate-in slide-in-from-left-2 duration-200">
                            <select
                                value={c.left.type}
                                onChange={(e) => updateCondition(c.id, { left: { ...c.left, type: e.target.value as IndicatorType } })}
                                className="bg-secondary/80 text-[11px] h-6 px-1 rounded border border-border outline-none w-[64px] font-bold text-foreground appearance-none cursor-pointer"
                            >
                                <option value="RSI">RSI</option>
                                <option value="EMA">EMA</option>
                                <option value="SMA">SMA</option>
                                <option value="MACD">MACD</option>
                                <option value="HMA">HMA</option>
                                <option value="Price">Price</option>
                            </select>

                            <input
                                type="number"
                                value={c.left.params[0]}
                                onChange={(e) => updateCondition(c.id, { left: { ...c.left, params: [parseInt(e.target.value)] } })}
                                className="w-[32px] h-6 bg-secondary/80 text-center text-[10px] rounded border border-border outline-none font-mono text-blue-500 font-bold"
                            />

                            <select
                                value={c.comparator}
                                onChange={(e) => updateCondition(c.id, { comparator: e.target.value as Comparator })}
                                className="bg-transparent text-[11px] h-6 text-blue-500 font-black outline-none w-5 text-center appearance-none cursor-pointer"
                            >
                                <option value=">">{'>'}</option>
                                <option value="<">{'<'}</option>
                                <option value="==">{'='}</option>
                                <option value="crosses_above">↑</option>
                                <option value="crosses_below">↓</option>
                            </select>

                            <input
                                type="number"
                                value={typeof c.right === 'number' ? c.right : ''}
                                onChange={(e) => updateCondition(c.id, { right: parseFloat(e.target.value) })}
                                className="w-[64px] h-6 bg-secondary/80 text-center text-[11px] rounded border border-border outline-none font-mono font-bold text-foreground px-1 focus:border-blue-500/40"
                            />

                            <button
                                onClick={() => removeCondition(c.id)}
                                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={11} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

interface RuleBuilderProps {
    entry: ConditionGroup;
    trigger?: ConditionGroup;
    side: 'BUY' | 'SELL';
    onChangeEntry: (group: ConditionGroup) => void;
    onChangeTrigger?: (group: ConditionGroup) => void;
}

export function RuleBuilder({ entry, trigger, side, onChangeEntry, onChangeTrigger }: RuleBuilderProps) {
    const t = useTranslations('Strategy');
    return (
        <div className="flex flex-col gap-3">
            <RuleSection
                title={`${t('builder.marketFilter')} (${side})`}
                group={entry}
                onChange={onChangeEntry}
                accentColor={side === 'BUY' ? "text-blue-500" : "text-red-500"}
                stepNumber={1}
            />
            <RuleSection
                title={`${t('builder.entrySetup')} (${side})`}
                group={trigger || { operator: 'AND', conditions: [] }}
                onChange={onChangeTrigger || (() => undefined)}
                accentColor={side === 'BUY' ? "text-emerald-500" : "text-orange-500"}
                stepNumber={2}
            />
        </div>
    );
}
