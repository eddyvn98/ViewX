import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { RuleBuilder } from '@/features/strategy/components/RuleBuilder';
import { RiskPanel } from '@/features/strategy/components/RiskPanel';
import { Bot, Save, List, Plus, Activity, Layers, Target, Clock, X, Settings } from 'lucide-react';
import { Strategy, ConditionGroup, StrategyRisk, StrategySignal, PositionMode } from '@/features/strategy/types';

export function StrategyPanel() {
    const {
        strategies, addStrategy, toggleStrategy, deleteStrategy, updateStrategy,
        signals, clearSignals, virtualPositions, clearVirtualPositions
    } = useStrategyStore();

    const activeTabId = useMarketStore(state => state.activeTabId);
    const tabs = useMarketStore(state => state.tabs);
    const activeSymbol = activeTabId ? (tabs[activeTabId]?.activeChartId ? tabs[activeTabId].charts[tabs[activeTabId].activeChartId].symbol : 'XAUUSDm') : 'XAUUSDm';

    const [view, setView] = useState<'build' | 'list' | 'signals'>('build');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Draft strategy state
    const [name, setName] = useState('Professional Scalper');
    const [entry, setEntry] = useState<ConditionGroup>({
        operator: 'AND',
        conditions: [{ id: '1', left: { type: 'RSI', params: [14] }, comparator: '<', right: 30 }]
    });
    const [exit, setExit] = useState<ConditionGroup>({
        operator: 'OR',
        conditions: []
    });
    const [risk, setRisk] = useState<StrategyRisk>({
        sl: 200, tp: 400, trailing: true, lotSize: 0.1, maxTrades: 1, cooldownMinutes: 5
    });
    const [positionMode, setPositionMode] = useState<PositionMode>('single_position');
    const [executionMode, setExecutionMode] = useState<'virtual' | 'real'>('virtual');
    const [magic, setMagic] = useState(123456);
    const [comment, setComment] = useState('WebEngine');

    const handleSave = () => {
        const newStrategy: Strategy = {
            id: editingId || Math.random().toString(36).substring(7),
            name, entry, exit, risk, active: true, symbol: activeSymbol,
            positionMode, executionMode, entryType: 'market', magic, comment,
            sessions: ["London", "NewYork"]
        };

        console.log('[StrategyPanel] Saving strategy:', newStrategy);

        if (editingId) updateStrategy(editingId, newStrategy);
        else addStrategy(newStrategy);

        setEditingId(null);
        setName('Professional Scalper');
        setEntry({ operator: 'AND', conditions: [{ id: '1', left: { type: 'RSI', params: [14] }, comparator: '<', right: 30 }] });
        setExit({ operator: 'OR', conditions: [] });
        setRisk({ sl: 200, tp: 400, trailing: true, lotSize: 0.1, maxTrades: 1, cooldownMinutes: 5 });
        setView('list');
    };

    return (
        <div className="flex flex-col h-full bg-[#1e222d] text-[#d1d4dc] overflow-hidden">
            {/* Tabs Header */}
            <div className="flex items-center border-b border-[#2a2e39] bg-[#131722]">
                <button
                    onClick={() => setView('build')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${view === 'build' ? 'text-blue-500 border-b-2 border-blue-500 bg-[#1e222d]' : 'text-[#787b86] hover:text-[#d1d4dc]'}`}
                >
                    <Plus size={14} /> Build
                </button>
                <button
                    onClick={() => setView('list')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${view === 'list' ? 'text-blue-500 border-b-2 border-blue-500 bg-[#1e222d]' : 'text-[#787b86] hover:text-[#d1d4dc]'}`}
                >
                    <List size={14} /> My Strategies
                </button>
                <button
                    onClick={() => setView('signals')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${view === 'signals' ? 'text-blue-500 border-b-2 border-blue-500 bg-[#1e222d]' : 'text-[#787b86] hover:text-[#d1d4dc]'}`}
                >
                    <Activity size={14} /> Signals
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {view === 'build' && (
                    <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-[#787b86] uppercase">Strategy Name</span>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-[#2a2e39] p-3 rounded text-sm font-bold border border-transparent focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-[#787b86] uppercase">Execution Mode</span>
                                <div className="flex bg-[#2a2e39] rounded p-1">
                                    <button
                                        onClick={() => setExecutionMode('virtual')}
                                        className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${executionMode === 'virtual' ? 'bg-blue-600 text-white shadow-lg' : 'text-[#787b86] hover:text-white'}`}
                                    >Virtual</button>
                                    <button
                                        onClick={() => setExecutionMode('real')}
                                        className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${executionMode === 'real' ? 'bg-red-600 text-white shadow-lg' : 'text-[#787b86] hover:text-white'}`}
                                    >Real (MT5)</button>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-[#787b86] uppercase">Magic Number</span>
                                <input
                                    type="number"
                                    value={magic}
                                    onChange={(e) => setMagic(Number(e.target.value))}
                                    className="bg-[#2a2e39] p-3 rounded text-sm font-bold border border-transparent focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-[#787b86] uppercase">Order Comment</span>
                            <input
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="bg-[#2a2e39] p-2 rounded text-[11px] font-bold border border-transparent focus:border-blue-500 outline-none"
                                placeholder="e.g., Scalper_Web"
                            />
                        </div>

                        <RuleBuilder entry={entry} exit={exit} onChangeEntry={setEntry} onChangeExit={setExit} />
                        <RiskPanel risk={risk} positionMode={positionMode} onChangeRisk={setRisk} onChangeMode={setPositionMode} />

                        <button
                            onClick={handleSave}
                            className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            <Save size={18} /> Save & Activate Strategy
                        </button>
                    </div>
                )}

                {view === 'list' && (
                    <div className="flex flex-col gap-3 animate-in slide-in-from-left-4 duration-300">
                        {strategies.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center gap-2">
                                <Bot size={48} />
                                <span className="text-xs">No strategies created.</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="text-[10px] font-bold text-[#787b86] uppercase">Running Strategies</span>
                                    <button
                                        onClick={clearVirtualPositions}
                                        className="text-[9px] font-bold text-red-400/60 hover:text-red-400 flex items-center gap-1 transition-colors"
                                    >
                                        <X size={10} /> Reset Virtual Trades
                                    </button>
                                </div>
                                {strategies.map((s: Strategy) => (
                                    <div key={s.id} className="bg-[#2a2e39] p-4 rounded-xl border border-[#363a45] flex flex-col gap-3 hover:bg-[#2d323e] transition-colors group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{s.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter">{s.positionMode.replace('_', ' ')}</span>
                                                    <div className="w-1 h-1 rounded-full bg-[#363a45]" />
                                                    <span className={`text-[10px] font-bold uppercase ${s.executionMode === 'real' ? 'text-red-500' : 'text-[#787b86]'}`}>
                                                        {s.executionMode}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => toggleStrategy(s.id)}
                                                    className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all active:scale-95 ${s.active ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-[#131722] text-[#787b86] border border-[#363a45]'}`}
                                                >
                                                    {s.active ? 'Active' : 'Paused'}
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setEditingId(s.id);
                                                        setName(s.name);
                                                        setEntry(s.entry || { operator: 'AND', conditions: [] });
                                                        setExit(s.exit || { operator: 'OR', conditions: [] });
                                                        setRisk(s.risk);
                                                        setPositionMode(s.positionMode);
                                                        setExecutionMode(s.executionMode);
                                                        setMagic(s.magic || 123456);
                                                        setComment(s.comment || 'WebEngine');
                                                        setView('build');
                                                    }}
                                                    className="p-1.5 text-[#787b86] hover:text-white hover:bg-[#363a45] rounded-lg transition-all"
                                                >
                                                    <Settings size={14} />
                                                </button>

                                                <button
                                                    onClick={() => deleteStrategy(s.id)}
                                                    className="p-1.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 border-t border-[#363a45] pt-3">
                                            <div className="flex items-center gap-2 text-[10px] text-[#787b86]">
                                                <Target size={12} className="text-red-400" />
                                                <span>SL/TP: {s.risk.sl}/{s.risk.tp}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-[#787b86]">
                                                <Layers size={12} className="text-purple-400" />
                                                <span>Max Tr: {s.risk.maxTrades}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-[#787b86]">
                                                <Clock size={12} className="text-blue-400" />
                                                <span>Cool: {s.risk.cooldownMinutes}m</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {view === 'signals' && (
                    <div className="flex flex-col gap-2 animate-in fade-in duration-300">
                        <div className="flex justify-end gap-2 mb-2 px-1">
                            {virtualPositions.length > 0 && (
                                <button
                                    onClick={clearVirtualPositions}
                                    className="text-[10px] font-bold text-red-400/60 hover:text-red-400 flex items-center gap-1 transition-colors"
                                >
                                    <X size={12} /> Reset Trades
                                </button>
                            )}
                            {signals.length > 0 && (
                                <button
                                    onClick={clearSignals}
                                    className="text-[10px] font-bold text-blue-500/60 hover:text-blue-500 flex items-center gap-1 transition-colors"
                                >
                                    <Activity size={12} /> Clear History
                                </button>
                            )}
                        </div>
                        {signals.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center gap-2">
                                <Activity size={48} />
                                <span className="text-xs">Waiting for triggers...</span>
                            </div>
                        ) : (
                            signals.map((sig: StrategySignal, i: number) => (
                                <div key={i} className={`bg-[#131722] p-4 rounded-xl border-l-4 overflow-hidden flex flex-col gap-3 ${sig.type === 'EXIT' ? 'border-orange-500' : 'border-green-500'}`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${sig.type === 'EXIT' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>
                                                {sig.type} SIGNAL
                                            </span>
                                            {sig.aiAnalysis && (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sig.aiAnalysis.riskLevel === 'low' ? 'bg-blue-500/20 text-blue-400' : sig.aiAnalysis.riskLevel === 'high' ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-400'}`}>
                                                    {sig.aiAnalysis.riskLevel.toUpperCase()} RISK
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-[#787b86]">
                                            {new Date(sig.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-bold text-white">{sig.symbol} @ {sig.price}</span>
                                        <span className="text-xs text-[#787b86]">Lot: <span className="text-white font-bold">{sig.risk.lotSize}</span></span>
                                    </div>

                                    {sig.aiAnalysis && (
                                        <div className="bg-[#1e222d] p-3 rounded-lg border border-[#363a45] flex flex-col gap-2">
                                            <div className="flex items-center gap-2 border-b border-[#363a45] pb-1.5">
                                                <Bot size={12} className="text-blue-400" />
                                                <span className="text-[10px] font-bold text-[#d1d4dc] uppercase">AI Reasoning — {sig.aiAnalysis.confidence}% Match</span>
                                            </div>
                                            <ul className="flex flex-col gap-1.5">
                                                {sig.aiAnalysis.reasoning.map((r, idx) => (
                                                    <li key={idx} className="text-[10px] text-[#787b86] flex gap-2">
                                                        <span className="text-blue-500">•</span>
                                                        {r}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
