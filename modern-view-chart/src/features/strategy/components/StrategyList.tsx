import React from 'react';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { Plus, Trash2, Bot, Settings, Target, Activity, Layers, Clock, BrainCircuit } from 'lucide-react';
import { Strategy } from '@/features/strategy/types';

interface StrategyListProps {
    onEdit: (strategy: Strategy) => void;
    onAdd: () => void;
}

export function StrategyList({ onEdit, onAdd }: StrategyListProps) {
    const { strategies, toggleStrategy, toggleAiGuard, deleteStrategy, updateStrategy } = useStrategyStore();

    const handleUpdate = (id: string, updates: Partial<Strategy>) => {
        updateStrategy(id, updates);
    };

    return (
        <div className="flex flex-col gap-2 animate-in slide-in-from-left-4 duration-300 w-full">
            <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Running Bot ({strategies.length})</span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onAdd}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase transition-all shadow-lg shadow-blue-500/10"
                    >
                        <Plus size={10} /> Add Bot
                    </button>
                </div>
            </div>

            {strategies.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center opacity-20 text-center gap-2">
                    <Bot size={32} />
                    <span className="text-[9px] uppercase font-bold tracking-widest">No active bots</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-2">
                    {strategies.map((s) => (
                        <div key={s.id} className="bg-secondary/40 p-2.5 rounded-lg border border-border flex flex-col gap-2 hover:bg-secondary/60 transition-colors group">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col flex-1">
                                    <span className="text-[11px] font-bold text-foreground group-hover:text-blue-500 transition-colors tracking-tight">{s.name}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">
                                            Generic Strategy
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => toggleStrategy(s.id)} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${s.active ? 'bg-green-600 text-white shadow-lg shadow-green-900/40' : 'bg-secondary text-muted-foreground border border-border'}`}>
                                        {s.active ? 'Active' : 'Paused'}
                                    </button>
                                    <button
                                        onClick={() => toggleAiGuard(s.id)}
                                        className={`p-1 rounded transition-all flex items-center gap-1 ${s.aiGuard ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'text-muted-foreground hover:text-blue-500 hover:bg-blue-500/5'}`}
                                        title={s.aiGuard ? "AI Guard Active" : "Enable AI Guard"}
                                    >
                                        <BrainCircuit size={11} className={s.aiGuard ? 'animate-pulse' : ''} />
                                        <span className="text-[8px] font-black uppercase">{s.aiGuard ? 'On' : 'Off'}</span>
                                    </button>
                                    <button onClick={() => onEdit(s)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-all">
                                        <Settings size={11} />
                                    </button>
                                    <button onClick={() => deleteStrategy(s.id)} className="p-1 text-red-500/40 hover:text-red-500 hover:bg-red-500/5 rounded transition-all">
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 border-t border-border/50 pt-2 text-[8px] text-muted-foreground font-bold uppercase tracking-tight">
                                <div className="flex items-center gap-1">
                                    <Target size={10} className="text-red-500/40" />
                                    SL: {typeof s.risk.sl === 'object' ? s.risk.sl.mode.toUpperCase() : (s.risk.sl || 'Fixed')}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Target size={10} className="text-green-500/40" />
                                    TP: {typeof s.risk.tp === 'object' ? s.risk.tp.mode.toUpperCase() : (s.risk.tp || 'N/A')}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Activity size={10} className="text-blue-500/40" />
                                    Lot:
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={typeof s.risk.lotSize === 'object' ? s.risk.lotSize.value : s.risk.lotSize}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val)) {
                                                const newLot = typeof s.risk.lotSize === 'object'
                                                    ? { ...s.risk.lotSize, value: val }
                                                    : val;
                                                handleUpdate(s.id, { risk: { ...s.risk, lotSize: newLot } });
                                            }
                                        }}
                                        className="bg-secondary/50 border border-border rounded px-1 py-0 w-[40px] text-foreground font-mono font-bold outline-none focus:border-blue-500/30 h-4"
                                    />
                                </div>
                                <div className="flex items-center gap-1"><Layers size={10} className="text-purple-500/40" /> Max: {s.risk.maxTrades}</div>
                                <div className="flex items-center gap-1"><Clock size={10} className="text-blue-500/40" /> Cool: {s.risk.cooldownMinutes}m</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
