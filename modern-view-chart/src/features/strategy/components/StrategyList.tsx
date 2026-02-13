import React from 'react';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { Plus, Trash2, Bot, Settings, Target, Activity, Layers, Clock } from 'lucide-react';
import { Strategy } from '@/features/strategy/types';

interface StrategyListProps {
    onEdit: (strategy: Strategy) => void;
    onAdd: () => void;
}

export function StrategyList({ onEdit, onAdd }: StrategyListProps) {
    const { strategies, toggleStrategy, deleteStrategy } = useStrategyStore();

    return (
        <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 duration-300 w-full">
            <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-[#787b86] uppercase">Running Bot ({strategies.length})</span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onAdd}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-[9px] font-black uppercase transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Plus size={12} /> Add Bot
                    </button>
                </div>
            </div>

            {strategies.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center gap-2">
                    <Bot size={48} />
                    <span className="text-xs">No active bots found.</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {strategies.map((s) => (
                        <div key={s.id} className="bg-[#1e222d] p-4 rounded-xl border border-[#363a45] flex flex-col gap-3 hover:bg-[#232732] transition-colors group">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{s.name}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter">{s.positionMode.replace('_', ' ')}</span>
                                        <div className="w-1 h-1 rounded-full bg-[#363a45]" />
                                        <span className={`text-[10px] font-bold uppercase ${s.executionMode === 'real' ? 'text-red-500' : 'text-[#787b86]'}`}>{s.executionMode}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => toggleStrategy(s.id)} className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all ${s.active ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-[#131722] text-[#787b86] border border-[#363a45]'}`}>
                                        {s.active ? 'Active' : 'Paused'}
                                    </button>
                                    <button onClick={() => onEdit(s)} className="p-1.5 text-[#787b86] hover:text-white hover:bg-[#363a45] rounded transition-all">
                                        <Settings size={14} />
                                    </button>
                                    <button onClick={() => deleteStrategy(s.id)} className="p-1.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded transition-all">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-t border-[#363a45] pt-3 text-[10px] text-[#787b86]">
                                <div className="flex items-center gap-1.5">
                                    <Target size={12} className="text-red-500/50" />
                                    SL: {typeof s.risk.sl === 'object' ? s.risk.sl.mode.toUpperCase() : s.risk.sl}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Target size={12} className="text-green-500/50" />
                                    TP: {typeof s.risk.tp === 'object' ? s.risk.tp.mode.toUpperCase() : s.risk.tp}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Activity size={12} className="text-blue-500/50" />
                                    Lot: {typeof s.risk.lotSize === 'object' ? (s.risk.lotSize.mode === 'fixed' ? s.risk.lotSize.value : s.risk.lotSize.mode.toUpperCase()) : s.risk.lotSize}
                                </div>
                                <div className="flex items-center gap-1.5"><Layers size={12} className="text-purple-500/50" /> Max: {s.risk.maxTrades}</div>
                                <div className="flex items-center gap-1.5"><Clock size={12} className="text-blue-500/50" /> Cool: {s.risk.cooldownMinutes}m</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
