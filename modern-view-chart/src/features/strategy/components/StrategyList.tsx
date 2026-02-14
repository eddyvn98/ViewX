import React from 'react';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { useMarketStore } from '@/lib/store';
import { Plus, Trash2, Bot, Settings, Target, Activity, Layers, Clock, BrainCircuit } from 'lucide-react';
import { Strategy } from '@/features/strategy/types';

interface StrategyListProps {
    onEdit: (strategy: Strategy) => void;
    onAdd: () => void;
}

export function StrategyList({ onEdit, onAdd }: StrategyListProps) {
    const { strategies, toggleStrategy, toggleAiGuard, deleteStrategy, updateStrategy } = useStrategyStore();
    const symbolInfo = useMarketStore(state => state.symbolInfo);

    const handleUpdate = (id: string, updates: any) => {
        updateStrategy(id, updates);
    };

    return (
        <div className="flex flex-col gap-2 animate-in slide-in-from-left-4 duration-300 w-full">
            <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Running Bot ({strategies.length})</span>
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
                        <div key={s.id} className="bg-[#1e222d]/60 p-2.5 rounded-lg border border-[#363a45]/50 flex flex-col gap-2 hover:bg-[#232732]/80 transition-colors group">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col flex-1">
                                    <span className="text-[11px] font-bold text-zinc-100 group-hover:text-blue-400 transition-colors tracking-tight">{s.name}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {/* Quick Symbol Edit */}
                                        <select
                                            value={s.symbol || ''}
                                            onChange={(e) => handleUpdate(s.id, { symbol: e.target.value })}
                                            className="bg-transparent text-[8px] font-black text-blue-500/80 uppercase outline-none border-b border-transparent focus:border-blue-500/30 cursor-pointer tracking-wider"
                                        >
                                            <option value="" className="bg-[#1e222d]">Symbol</option>
                                            {Object.keys(symbolInfo).sort().map(sym => (
                                                <option key={sym} value={sym} className="bg-[#1e222d] uppercase">{sym}</option>
                                            ))}
                                        </select>

                                        <div className="w-1 h-1 rounded-full bg-zinc-800" />

                                        {/* Quick Timeframe Edit */}
                                        <select
                                            value={s.timeframe || '1m'}
                                            onChange={(e) => handleUpdate(s.id, { timeframe: e.target.value })}
                                            className="bg-transparent text-[8px] font-black text-zinc-600 uppercase outline-none border-b border-transparent focus:border-[#787b86]/30 cursor-pointer tracking-wider"
                                        >
                                            <option value="1m" className="bg-[#1e222d]">M1</option>
                                            <option value="5m" className="bg-[#1e222d]">M5</option>
                                            <option value="15m" className="bg-[#1e222d]">M15</option>
                                            <option value="30m" className="bg-[#1e222d]">M30</option>
                                            <option value="1h" className="bg-[#1e222d]">H1</option>
                                            <option value="4h" className="bg-[#1e222d]">H4</option>
                                            <option value="1d" className="bg-[#1e222d]">D1</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => toggleStrategy(s.id)} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${s.active ? 'bg-green-600 text-white shadow-lg shadow-green-900/40' : 'bg-[#131722] text-zinc-600 border border-zinc-800'}`}>
                                        {s.active ? 'Active' : 'Paused'}
                                    </button>
                                    <button
                                        onClick={() => toggleAiGuard(s.id)}
                                        className={`p-1 rounded transition-all flex items-center gap-1 ${s.aiGuard ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-zinc-600 hover:text-blue-400 hover:bg-blue-500/5'}`}
                                        title={s.aiGuard ? "AI Guard Active" : "Enable AI Guard"}
                                    >
                                        <BrainCircuit size={11} className={s.aiGuard ? 'animate-pulse' : ''} />
                                        <span className="text-[8px] font-black uppercase">{s.aiGuard ? 'On' : 'Off'}</span>
                                    </button>
                                    <button onClick={() => onEdit(s)} className="p-1 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded transition-all">
                                        <Settings size={11} />
                                    </button>
                                    <button onClick={() => deleteStrategy(s.id)} className="p-1 text-red-500/40 hover:text-red-500 hover:bg-red-500/5 rounded transition-all">
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 border-t border-zinc-800/50 pt-2 text-[8px] text-zinc-600 font-bold uppercase tracking-tight">
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
                                        className="bg-[#131722]/50 border border-zinc-800/50 rounded px-1 py-0 w-[40px] text-zinc-200 font-mono font-bold outline-none focus:border-blue-500/30 h-4"
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
