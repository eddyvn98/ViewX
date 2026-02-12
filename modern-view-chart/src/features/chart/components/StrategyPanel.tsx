import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { RuleBuilder } from '@/features/strategy/components/RuleBuilder';
import { RiskPanel } from '@/features/strategy/components/RiskPanel';
import {
    Plus, Trash2, List, Activity, Bot, History, TrendingUp, TrendingDown, X, Settings, Clock, Target, Layers
} from 'lucide-react';
import { StrategyHistoryToggle } from '@/features/strategy/components/StrategyHistoryToggle';
import { VirtualBalanceCard } from '@/features/strategy/components/VirtualBalanceCard';
import { Strategy, ConditionGroup, StrategyRisk, StrategySignal, PositionMode, VirtualPosition } from '@/features/strategy/types';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';

export function StrategyPanel() {
    const {
        strategies, addStrategy, toggleStrategy, deleteStrategy, updateStrategy,
        signals, clearSignals, virtualPositions, clearVirtualPositions,
        closeVirtualPosition, cancelVirtualPosition,
    } = useStrategyStore();

    const tickers = useMarketStore(state => state.tickers);
    const symbolInfo = useMarketStore(state => state.symbolInfo);
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
        sl: { mode: 'fixed', value: 200 },
        tp: { mode: 'fixed', value: 400 },
        trailing: true,
        lotSize: { mode: 'fixed', value: 0.1 },
        maxTrades: 1,
        cooldownMinutes: 5
    });
    const [positionMode, setPositionMode] = useState<PositionMode>('single_position');
    const [executionMode, setExecutionMode] = useState<'virtual' | 'real'>('virtual');
    const [magic, setMagic] = useState(123456);
    const [comment, setComment] = useState('WebEngine');

    const handleSave = () => {
        const newStrategy: Strategy = {
            id: editingId || Math.random().toString(36).substring(7),
            name, side: 'BUY', entry, exit, risk, active: true, symbol: activeSymbol,
            positionMode, executionMode, entryType: 'market', magic, comment,
            sessions: ["London", "NewYork"]
        };

        if (editingId) updateStrategy(editingId, newStrategy);
        else addStrategy(newStrategy);

        setEditingId(null);
        setName('Professional Scalper');
        setEntry({ operator: 'AND', conditions: [{ id: '1', left: { type: 'RSI', params: [14] }, comparator: '<', right: 30 }] });
        setExit({ operator: 'OR', conditions: [] });
        setRisk({
            sl: { mode: 'fixed', value: 200 },
            tp: { mode: 'fixed', value: 400 },
            trailing: true,
            lotSize: { mode: 'fixed', value: 0.1 },
            maxTrades: 1,
            cooldownMinutes: 5
        });
        setView('list');
    };

    const activePositions = virtualPositions.filter(p => p.status === 'open' || p.status === 'pending');

    return (
        <div className="flex flex-col h-full bg-[#1e222d] text-[#d1d4dc] overflow-hidden font-sans">
            {/* Tabs Header */}
            <div className="flex items-center border-b border-[#2a2e39] bg-[#131722] h-10 px-1">
                <button
                    onClick={() => setView('build')}
                    className={`flex items-center gap-1.5 px-3 h-full text-[10px] font-bold transition-all border-b-2 ${view === 'build' ? 'text-blue-500 border-blue-500 bg-[#1e222d]' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]'}`}
                >
                    <Plus size={12} /> BUILD
                </button>
                <button
                    onClick={() => setView('list')}
                    className={`flex items-center gap-1.5 px-3 h-full text-[10px] font-bold transition-all border-b-2 ${view === 'list' ? 'text-blue-500 border-blue-500 bg-[#1e222d]' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]'}`}
                >
                    <List size={12} /> MY BOT
                </button>
                <button
                    onClick={() => setView('signals')}
                    className={`flex items-center gap-1.5 px-3 h-full text-[10px] font-bold transition-all border-b-2 ${view === 'signals' ? 'text-blue-500 border-blue-500 bg-[#1e222d]' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]'}`}
                >
                    <Activity size={12} /> SIGNALS
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col items-center bg-[#131722]/20">
                <div className="w-full max-w-[800px] flex flex-col gap-8 pb-10">
                    {view === 'build' && (
                        <div className="flex flex-col gap-8 animate-in slide-in-from-right-4 duration-300">
                            {/* 1. IDENTITY SECTION - Optimized for narrow panels */}
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-[#5d606b] uppercase tracking-widest">Bot Identity</span>
                                    <div className="h-[1px] bg-[#363a45]/30 w-full" />
                                </div>

                                <div className="flex flex-col gap-4 pl-1">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-bold text-[#4a4f5d] uppercase">Bot Name</span>
                                        <input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="bg-[#131722]/60 border border-[#363a45]/50 focus:border-blue-500/50 px-2 py-1.5 h-8 text-sm font-bold text-white outline-none rounded w-full"
                                            placeholder="Hull HA Gold Scalper"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[9px] font-bold text-[#4a4f5d] uppercase">Execution</span>
                                            <div className="flex bg-[#131722] rounded p-0.5 border border-[#363a45]/50 h-8">
                                                <button
                                                    onClick={() => setExecutionMode('virtual')}
                                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${executionMode === 'virtual' ? 'bg-[#363a45] text-white' : 'text-[#4a4f5d]'}`}
                                                >VIRTUAL</button>
                                                <button
                                                    onClick={() => setExecutionMode('real')}
                                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${executionMode === 'real' ? 'bg-[#363a45] text-white' : 'text-[#4a4f5d]'}`}
                                                >REAL</button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[9px] font-bold text-[#4a4f5d] uppercase">Description</span>
                                            <input
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                className="bg-[#131722]/60 border border-[#363a45]/50 focus:border-blue-500/50 px-2 py-1.5 h-8 text-[11px] font-medium text-[#d1d4dc] outline-none rounded"
                                                placeholder="WebHA_Buy"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. STRATEGY RULES */}
                            <RuleBuilder entry={entry} exit={exit} onChangeEntry={setEntry} onChangeExit={setExit} />

                            {/* 3. RISK CONTROL */}
                            <RiskPanel risk={risk} positionMode={positionMode} onChangeRisk={setRisk} onChangeMode={setPositionMode} />

                            {/* 4. SUMMARY & ACTIONS - Fixed Overflow */}
                            <div className="flex flex-col gap-4 border-t border-[#363a45]/30 pt-6 mt-4">
                                <div className="flex flex-col gap-5 bg-[#131722]/40 p-4 rounded border border-[#363a45]/30">
                                    <div className="flex items-center justify-around gap-2">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-black text-[#4a4f5d] uppercase tracking-tighter">Est. Risk</span>
                                            <span className="text-[11px] font-mono font-black text-white">1.8% / T</span>
                                        </div>
                                        <div className="h-4 w-[1px] bg-[#363a45]/30" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-black text-[#4a4f5d] uppercase tracking-tighter">R/R Ratio</span>
                                            <span className="text-[11px] font-mono font-black text-white">1:2.2</span>
                                        </div>
                                        <div className="h-4 w-[1px] bg-[#363a45]/30" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-black text-[#4a4f5d] uppercase tracking-tighter">Safety</span>
                                            <span className="text-[11px] font-mono font-black text-green-500">8.5</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSave}
                                        className="bg-white hover:bg-blue-500 hover:text-white text-black h-9 w-full rounded font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-lg shadow-black/20"
                                    >
                                        ACTIVATE BOT
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'list' && (
                        <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 duration-300">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-bold text-[#787b86] uppercase">Running Bot ({strategies.length})</span>
                                <div className="flex items-center gap-3">
                                    <StrategyHistoryToggle />
                                    <button onClick={clearVirtualPositions} className="text-[9px] font-bold text-red-400/60 hover:text-red-400 flex items-center gap-1 transition-colors uppercase">
                                        <X size={10} /> Reset Trades
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
                                                    <button onClick={() => { setEditingId(s.id); setName(s.name); setEntry(s.entry); setExit(s.exit || { operator: 'OR', conditions: [] }); setRisk(s.risk); setPositionMode(s.positionMode); setExecutionMode(s.executionMode); setComment(s.comment || ''); setView('build'); }} className="p-1.5 text-[#787b86] hover:text-white hover:bg-[#363a45] rounded transition-all">
                                                        <Settings size={14} />
                                                    </button>
                                                    <button onClick={() => deleteStrategy(s.id)} className="p-1.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded transition-all">
                                                        <X size={14} />
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
                    )}

                    {view === 'signals' && (
                        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                            {/* VIRTUAL ACCOUNT DASHBOARD */}
                            <VirtualBalanceCard />

                            {/* ACTIVE POSITIONS SECTION */}
                            {activePositions.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <History size={12} /> Active ({activePositions.length})
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {activePositions.map((pos) => {
                                            const ticker = tickers[pos.symbol];
                                            const currentPrice = ticker?.price || pos.entryPrice;
                                            const pnl = pos.status === 'open' ? calculatePnL({ type: pos.type.toLowerCase() as any, openPrice: pos.entryPrice, currentPrice, volume: pos.lotSize, symbol: pos.symbol, symbolInfo: symbolInfo[pos.symbol] }) : 0;
                                            return (
                                                <div key={pos.id} className="bg-[#131722] rounded-lg border border-[#2a2e39] overflow-hidden">
                                                    <div className="flex items-center justify-between p-2.5 border-b border-[#2a2e39]/50">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-black text-white">{pos.symbol}</span>
                                                            <span className={`text-[9px] font-black px-1 rounded ${pos.type === 'BUY' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>{pos.type}</span>
                                                        </div>
                                                        <div className={`font-mono text-xs font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatPnL(pnl)}</div>
                                                        <button onClick={() => pos.status === 'open' ? closeVirtualPosition(pos.strategyId, pos.symbol, currentPrice) : cancelVirtualPosition(pos.strategyId, pos.symbol)} className="text-[#4a4f5d] hover:text-red-500 transition-colors"><X size={12} /></button>
                                                    </div>
                                                    <div className="grid grid-cols-3 p-2 text-[9px] text-[#787b86] bg-[#1e222d]/20">
                                                        <div>Entry: <span className="text-white font-mono">{pos.entryPrice.toFixed(2)}</span></div>
                                                        <div className="text-center">SL: <span className="text-red-400/80 font-mono">{pos.sl || '---'}</span></div>
                                                        <div className="text-right">TP: <span className="text-green-400/80 font-mono">{pos.tp || '---'}</span></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* SIGNAL HISTORY */}
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-bold text-[#787b86] uppercase tracking-widest flex items-center gap-1.5"><Activity size={12} /> Recent Signals</span>
                                    {signals.length > 0 && <button onClick={clearSignals} className="text-[9px] font-bold text-blue-500/50 hover:text-blue-500 transition-colors uppercase">Clear</button>}
                                </div>
                                <div className="flex flex-col gap-2">
                                    {signals.length === 0 ? (
                                        <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center gap-2">
                                            <Activity size={32} />
                                            <span className="text-[10px] uppercase font-bold tracking-tighter">No signals yet</span>
                                        </div>
                                    ) : (
                                        signals.map((sig, i) => (
                                            <div key={i} className={`bg-[#131722] p-3 rounded-lg border-l-2 ${sig.type === 'EXIT' ? 'border-orange-500' : 'border-green-500'} flex flex-col gap-1.5`}>
                                                <div className="flex justify-between items-center text-[9px]">
                                                    <span className={`font-black uppercase ${sig.type === 'EXIT' ? 'text-orange-400' : 'text-green-400'}`}>{sig.type} SIGNAL</span>
                                                    <span className="text-[#4a4f5d]">{new Date(sig.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center"><span className="text-xs font-bold text-white">{sig.symbol} @ {sig.price}</span><span className="text-[10px] text-[#787b86]">Vol: {typeof sig.risk.lotSize === 'object' ? (sig.risk.lotSize.mode === 'fixed' ? sig.risk.lotSize.value : sig.risk.lotSize.mode.toUpperCase()) : sig.risk.lotSize}</span></div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
