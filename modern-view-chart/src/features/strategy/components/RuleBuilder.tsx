import React from 'react';
import { ConditionGroup, Condition, IndicatorType, Comparator } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface RuleSectionProps {
    title: string;
    group: ConditionGroup;
    onChange: (group: ConditionGroup) => void;
    accentColor: string;
}

function RuleSection({ title, group, onChange, accentColor }: RuleSectionProps) {
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
        <div className="flex flex-col gap-1 overflow-x-hidden">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-black uppercase tracking-widest ${accentColor}`}>{title}</span>
                    <select
                        value={group.operator}
                        onChange={(e) => onChange({ ...group, operator: e.target.value as any })}
                        className="bg-[#131722]/60 text-[8px] font-black px-1 py-0 rounded border border-[#363a45]/20 outline-none text-[#94a3b8] appearance-none cursor-pointer hover:border-blue-500/30"
                    >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                    </select>
                </div>
                <button
                    onClick={addCondition}
                    className="text-[8px] font-black text-blue-500/60 hover:text-blue-500 flex items-center gap-1 transition-colors uppercase"
                >
                    <Plus size={9} /> Add
                </button>
            </div>

            <div className="flex flex-col gap-1 min-h-[10px] justify-center">
                {group.conditions.length === 0 ? (
                    <div className="py-2 flex justify-center border border-dashed border-[#363a45]/20 rounded text-[9px] text-[#2a2e39] font-black uppercase tracking-tighter">
                        No {title} rules defined
                    </div>
                ) : (
                    group.conditions.filter(c => !('operator' in c)).map((c: any) => (
                        <div key={c.id} className="flex items-center gap-1.5 group animate-in slide-in-from-left-2 duration-200">
                            <select
                                value={c.left.type}
                                onChange={(e) => updateCondition(c.id, { left: { ...c.left, type: e.target.value as IndicatorType } })}
                                className="bg-[#131722]/80 text-[11px] h-6 px-1 rounded border border-[#363a45]/40 outline-none w-[64px] font-bold text-zinc-100 appearance-none cursor-pointer"
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
                                className="w-[32px] h-6 bg-[#131722]/80 text-center text-[10px] rounded border border-[#363a45]/40 outline-none font-mono text-blue-400 font-bold"
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
                                value={c.right}
                                onChange={(e) => updateCondition(c.id, { right: parseFloat(e.target.value) })}
                                className="w-[64px] h-6 bg-[#131722]/80 text-center text-[11px] rounded border border-[#363a45]/40 outline-none font-mono font-bold text-zinc-100 px-1 focus:border-blue-500/40"
                            />

                            <button
                                onClick={() => removeCondition(c.id)}
                                className="w-6 h-6 flex items-center justify-center text-zinc-800 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
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
    exit?: ConditionGroup;
    side: 'BUY' | 'SELL';
    onChangeEntry: (group: ConditionGroup) => void;
    onChangeExit: (group: ConditionGroup) => void;
}

export function RuleBuilder({ entry, exit, side, onChangeEntry, onChangeExit }: RuleBuilderProps) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Signal Rules</span>
                <div className="h-[1px] bg-blue-500/10 w-full" />
            </div>

            <div className="flex flex-col gap-1.5 pl-1 bg-black/10 p-1.5 rounded border border-white/5">
                <RuleSection
                    title={`TRIGGER (${side})`}
                    group={entry}
                    onChange={onChangeEntry}
                    accentColor={side === 'BUY' ? "text-blue-500" : "text-red-500"}
                />
                <div className="h-[1px] bg-[#363a45]/10 w-full" />
                <RuleSection
                    title={`EXIT (${side})`}
                    group={exit || { operator: 'OR', conditions: [] }}
                    onChange={onChangeExit}
                    accentColor="text-orange-500"
                />
            </div>
        </div>
    );
}
