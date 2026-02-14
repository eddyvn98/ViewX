import React, { useState, useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { RuleBuilder } from '@/features/strategy/components/RuleBuilder';
import { RiskPanel } from '@/features/strategy/components/RiskPanel';
import { Plus, X as XIcon } from 'lucide-react';
import { Strategy, ConditionGroup, StrategyRisk, PositionMode, SLTPConfig } from '@/features/strategy/types';
import { PriceConfigRow } from '@/features/strategy/components/PriceConfigRow';

interface StrategyBuilderProps {
    editingStrategy?: Strategy | null;
    onClose: () => void;
}

export function StrategyBuilder({ editingStrategy, onClose }: StrategyBuilderProps) {
    const { addStrategy, updateStrategy } = useStrategyStore();
    const symbolInfo = useMarketStore(state => state.symbolInfo);

    // Get active chart info for defaults
    const activeTabId = useMarketStore(state => state.activeTabId);
    const tabs = useMarketStore(state => state.tabs);
    const activeTab = activeTabId ? tabs[activeTabId] : null;
    const activeChart = (activeTab?.activeChartId && activeTab?.charts) ? activeTab.charts[activeTab.activeChartId] : null;
    const activeSymbol = activeChart?.symbol || 'XAUUSDm';
    const activeInterval = activeChart?.interval || '1m';

    // State initialization from editingStrategy or defaults
    const [name, setName] = useState(editingStrategy?.name || 'Professional Scalper');
    const [strategySymbol, setStrategySymbol] = useState(editingStrategy?.symbol || '');
    const [timeframe, setTimeframe] = useState(editingStrategy?.timeframe || '1m');
    const [side, setSide] = useState<'BUY' | 'SELL'>(editingStrategy?.side || 'BUY');
    const [entry, setEntry] = useState<ConditionGroup>(editingStrategy?.entry || {
        operator: 'AND',
        conditions: [{ id: '1', left: { type: 'RSI', params: [14] }, comparator: '<', right: 30 }]
    });
    const [exit, setExit] = useState<ConditionGroup>(editingStrategy?.exit || {
        operator: 'OR',
        conditions: []
    });
    const [risk, setRisk] = useState<StrategyRisk>(editingStrategy?.risk || {
        sl: { mode: 'candle', candleField: 'low', candleOffset: 1, offset: 0 },
        tp: undefined,
        trailing: true,
        lotSize: { mode: 'fixed', value: 0.1 },
        maxTrades: 1,
        cooldownMinutes: 5
    });
    const [positionMode, setPositionMode] = useState<PositionMode>(editingStrategy?.positionMode || 'single_position');
    const [executionMode, setExecutionMode] = useState<'virtual' | 'real'>(editingStrategy?.executionMode || 'virtual');
    const [entryType, setEntryType] = useState<'market' | 'stop' | 'limit'>(editingStrategy?.entryType || 'stop');
    const [entryPrice, setEntryPrice] = useState<SLTPConfig>(editingStrategy?.entryPrice || { mode: 'candle', candleField: 'high', candleOffset: 0, offset: 0 });
    const [comment, setComment] = useState(editingStrategy?.comment || 'WebEngine');
    const [magic, setMagic] = useState(editingStrategy?.magic || 123456);

    // Update defaults if creating new and active chart changes (optional, maybe distracting)
    useEffect(() => {
        if (!editingStrategy && !strategySymbol) {
            // If user hasn't selected a symbol, we could potentially default to active,
            // but strategySymbol='' implies "Active Chart" already.
        }
    }, [activeSymbol, activeInterval, editingStrategy, strategySymbol]);

    const handleSave = () => {
        const newStrategy: Strategy = {
            id: editingStrategy?.id || Math.random().toString(36).substring(7),
            name, side, entry, exit, risk, active: true,
            symbol: strategySymbol || activeSymbol, // Use active symbol if empty
            timeframe: timeframe || activeInterval,
            positionMode, executionMode, entryType, entryPrice, magic, comment,
            sessions: ["London", "NewYork"]
        };

        if (editingStrategy) {
            updateStrategy(editingStrategy.id, newStrategy);
        } else {
            addStrategy(newStrategy);
        }
        onClose();
    };

    return (
        <div className="flex flex-col gap-2.5 animate-in slide-in-from-right-4 duration-300 w-full">
            {/* 1. IDENTITY SECTION */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Bot Identity</span>
                        <div className="h-[1px] bg-blue-500/10 w-full" />
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-3 p-1 text-zinc-600 hover:text-white bg-zinc-800/50 rounded transition-all"
                    >
                        <XIcon size={12} />
                    </button>
                </div>

                <div className="flex flex-col gap-2 pl-1">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1 focus-within:z-10">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tight">Bot Name</span>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-[#131722]/40 border border-[#363a45]/30 focus:border-blue-500/40 px-2 h-7 text-[11px] font-bold text-zinc-100 outline-none rounded w-full"
                                placeholder="Strategy Name"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tight">Side</span>
                            <div className="flex bg-[#131722]/60 rounded p-0.5 border border-[#363a45]/30 h-7">
                                <button
                                    onClick={() => setSide('BUY')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${side === 'BUY' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-600'}`}
                                >BUY</button>
                                <button
                                    onClick={() => setSide('SELL')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${side === 'SELL' ? 'bg-red-600 text-white shadow-sm' : 'text-zinc-600'}`}
                                >SELL</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tight">Symbol</span>
                            <select
                                value={strategySymbol}
                                onChange={(e) => setStrategySymbol(e.target.value)}
                                className="bg-[#131722]/40 border border-[#363a45]/30 focus:border-blue-500/40 px-2 h-7 text-[11px] font-bold text-zinc-300 outline-none rounded appearance-none"
                            >
                                <option value="">Active ({activeSymbol})</option>
                                {Object.keys(symbolInfo).sort().map(s => (
                                    <option key={s} value={s} className="bg-[#1e222d]">{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tight">Timeframe</span>
                            <select
                                value={timeframe}
                                onChange={(e) => setTimeframe(e.target.value)}
                                className="bg-[#131722]/40 border border-[#363a45]/30 focus:border-blue-500/40 px-2 h-7 text-[11px] font-bold text-zinc-400 outline-none rounded appearance-none"
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

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tight">Execution</span>
                            <div className="flex bg-[#131722]/60 rounded p-0.5 border border-[#363a45]/30 h-7">
                                <button
                                    onClick={() => setExecutionMode('virtual')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${executionMode === 'virtual' ? 'bg-[#363a45] text-white shadow-sm' : 'text-zinc-600'}`}
                                >VIRTUAL</button>
                                <button
                                    onClick={() => setExecutionMode('real')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${executionMode === 'real' ? 'bg-[#363a45] text-white shadow-sm' : 'text-zinc-600'}`}
                                >REAL</button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tight">Comment</span>
                            <input
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="bg-[#131722]/40 border border-[#363a45]/30 focus:border-blue-500/40 px-2 h-7 text-[11px] font-medium text-zinc-400 outline-none rounded"
                                placeholder="..."
                            />
                        </div>
                    </div>
                </div>

                {/* ENTRY EXECUTION SECTION */}
                <div className="flex flex-col gap-2 mt-1">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Entry Mode</span>
                        <div className="h-[1px] bg-blue-500/10 w-full" />
                    </div>
                    <div className="flex flex-col gap-1.5 pl-1 py-1 px-1.5 rounded bg-black/10 border border-white/5">
                        <div className="flex items-center gap-3 h-6">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter w-16 shrink-0">Order Type</span>
                            <div className="flex bg-[#131722]/80 rounded p-0.5 border border-white/5 h-6 w-[140px]">
                                <button
                                    onClick={() => setEntryType('market')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${entryType === 'market' ? 'bg-zinc-700 text-white' : 'text-zinc-600'}`}
                                >MKT</button>
                                <button
                                    onClick={() => setEntryType('stop')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${entryType === 'stop' ? 'bg-zinc-700 text-white' : 'text-zinc-600'}`}
                                >STP</button>
                                <button
                                    onClick={() => setEntryType('limit')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${entryType === 'limit' ? 'bg-zinc-700 text-white' : 'text-zinc-600'}`}
                                >LMT</button>
                            </div>
                        </div>

                        {(entryType === 'stop' || entryType === 'limit') && (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <PriceConfigRow
                                    label="Execute At"
                                    icon={<Plus size={10} />}
                                    config={entryPrice}
                                    onChange={setEntryPrice}
                                    accentColor="text-blue-500"
                                    modes={['fixed', 'candle']}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. STRATEGY RULES */}
            <RuleBuilder entry={entry} exit={exit} side={side} onChangeEntry={setEntry} onChangeExit={setExit} />

            {/* 3. RISK CONTROL */}
            <RiskPanel risk={risk} positionMode={positionMode} onChangeRisk={setRisk} onChangeMode={setPositionMode} />

            {/* 4. SUMMARY & ACTIONS */}
            <div className="flex flex-col gap-2 border-t border-white/5 pt-3 mt-1">
                <div className="flex flex-col gap-3 bg-[#131722]/50 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center justify-around gap-2 px-1">
                        <div className="flex flex-col items-center">
                            <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Est. Risk</span>
                            <span className="text-[10px] font-mono font-black text-zinc-100">1.8% / T</span>
                        </div>
                        <div className="h-4 w-[1px] bg-white/5" />
                        <div className="flex flex-col items-center">
                            <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">R/R Ratio</span>
                            <span className="text-[10px] font-mono font-black text-zinc-100">1:2.2</span>
                        </div>
                        <div className="h-4 w-[1px] bg-white/5" />
                        <div className="flex flex-col items-center">
                            <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Safety</span>
                            <span className="text-[10px] font-mono font-black text-green-500">8.5</span>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        className="bg-white hover:bg-blue-600 hover:text-white text-black h-8 w-full rounded font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-lg shadow-black/20"
                    >
                        {editingStrategy ? 'UPDATE BOT' : 'ACTIVATE BOT'}
                    </button>
                </div>
            </div>
        </div>
    );
}
