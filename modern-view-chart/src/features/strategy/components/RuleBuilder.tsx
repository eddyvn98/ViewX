import React, { useState } from 'react';
import { ConditionGroup, Condition, IndicatorType, Comparator } from '../types';
import { Plus, Trash2, Settings2 } from 'lucide-react';

interface RuleBuilderProps {
    entry: ConditionGroup;
    exit?: ConditionGroup;
    onChangeEntry: (group: ConditionGroup) => void;
    onChangeExit: (group: ConditionGroup) => void;
}

export function RuleBuilder({ entry, exit, onChangeEntry, onChangeExit }: RuleBuilderProps) {
    const [activeTab, setActiveTab] = useState<'entry' | 'exit'>('entry');

    const currentGroup = activeTab === 'entry' ? entry : (exit || { operator: 'AND', conditions: [] });
    const setCurrentGroup = activeTab === 'entry' ? onChangeEntry : onChangeExit;

    const addCondition = () => {
        const newCondition: Condition = {
            id: Math.random().toString(36).substring(7),
            left: { type: 'RSI', params: [14] },
            comparator: '<',
            right: 30
        };
        setCurrentGroup({
            ...currentGroup,
            conditions: [...currentGroup.conditions, newCondition]
        });
    };

    const removeCondition = (id: string) => {
        setCurrentGroup({
            ...currentGroup,
            conditions: currentGroup.conditions.filter(c => !('id' in c) || c.id !== id)
        });
    };

    const updateCondition = (id: string, updates: Partial<Condition>) => {
        setCurrentGroup({
            ...currentGroup,
            conditions: currentGroup.conditions.map(c =>
                ('id' in c && c.id === id) ? { ...(c as Condition), ...updates } : c
            )
        });
    };

    return (
        <div className="flex flex-col gap-4 bg-[#2a2e39]/30 p-4 rounded-lg border border-[#363a45]">
            <div className="flex bg-[#131722] p-1 rounded-md mb-2">
                <button
                    onClick={() => setActiveTab('entry')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded transition-all ${activeTab === 'entry' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-[#787b86] hover:text-[#d1d4dc]'}`}
                >
                    Entry Rules
                </button>
                <button
                    onClick={() => setActiveTab('exit')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded transition-all ${activeTab === 'exit' ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' : 'text-[#787b86] hover:text-[#d1d4dc]'}`}
                >
                    Exit Rules
                </button>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Settings2 size={14} className="text-blue-500" />
                    <span className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider">
                        {activeTab === 'entry' ? 'Buy/Long Conditions' : 'Close/Exit Conditions'}
                    </span>
                </div>
                <select
                    value={currentGroup.operator}
                    onChange={(e) => setCurrentGroup({ ...currentGroup, operator: e.target.value as any })}
                    className="bg-[#131722] text-[10px] font-bold border border-[#363a45] rounded px-2 py-1 outline-none text-blue-400"
                >
                    <option value="AND">ALL (AND)</option>
                    <option value="OR">ANY (OR)</option>
                </select>
            </div>

            <div className="flex flex-col gap-2">
                {currentGroup.conditions.length === 0 && (activeTab === 'exit') && (
                    <div className="py-4 text-center border-2 border-dashed border-[#363a45] rounded-md">
                        <span className="text-[10px] text-[#787b86]">Optional: Use exit rules for flexible closure</span>
                    </div>
                )}

                {currentGroup.conditions.filter(c => !('operator' in c)).map((c: any) => (
                    <div key={c.id} className="flex flex-col gap-2 bg-[#131722] p-3 rounded border border-[#363a45] hover:border-blue-500/30 transition-colors">
                        <div className="flex items-center gap-2">
                            <select
                                value={c.left.type}
                                onChange={(e) => updateCondition(c.id, { left: { ...c.left, type: e.target.value as IndicatorType } })}
                                className="bg-[#2a2e39] text-xs p-1.5 rounded border border-[#363a45] outline-none flex-1"
                            >
                                <option value="RSI">RSI</option>
                                <option value="EMA">EMA</option>
                                <option value="SMA">SMA</option>
                                <option value="MACD">MACD</option>
                                <option value="HMA">HMA</option>
                            </select>
                            <input
                                type="number"
                                value={c.left.params[0]}
                                onChange={(e) => updateCondition(c.id, { left: { ...c.left, params: [parseInt(e.target.value)] } })}
                                className="w-14 bg-[#2a2e39] text-center text-xs p-1.5 rounded border border-[#363a45] outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={c.comparator}
                                onChange={(e) => updateCondition(c.id, { comparator: e.target.value as Comparator })}
                                className="bg-[#1e222d] text-xs p-1.5 rounded border border-blue-500/20 text-blue-400 font-bold outline-none flex-1"
                            >
                                <option value=">">{'>'}</option>
                                <option value="<">{'<'}</option>
                                <option value="==">{'=='}</option>
                                <option value="crosses_above">Crosses Above</option>
                                <option value="crosses_below">Crosses Below</option>
                            </select>

                            <div className="flex items-center gap-1 flex-1">
                                {typeof c.right === 'number' ? (
                                    <input
                                        type="number"
                                        value={c.right}
                                        onChange={(e) => updateCondition(c.id, { right: parseFloat(e.target.value) })}
                                        className="w-full bg-[#2a2e39] text-xs p-1.5 rounded border border-[#363a45] outline-none"
                                    />
                                ) : (
                                    <span className="text-xs text-[#787b86]">Indicator...</span>
                                )}
                            </div>

                            <button
                                onClick={() => removeCondition(c.id)}
                                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                title="Remove condition"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={addCondition}
                className="flex items-center justify-center gap-2 py-2 border-2 border-dashed border-[#363a45] hover:border-blue-500/50 hover:bg-blue-500/5 rounded-md text-[10px] font-bold text-[#787b86] hover:text-blue-400 transition-all uppercase tracking-widest"
            >
                <Plus size={14} /> Add Condition
            </button>
        </div>
    );
}
