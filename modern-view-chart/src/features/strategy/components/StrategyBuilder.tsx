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
        <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300 w-full">
            {/* 1. IDENTITY SECTION */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1 flex-1">
                        <span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">Bot Identity</span>
                        <div className="h-[1px] bg-blue-500/20 w-full" />
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 p-1.5 text-[#787b86] hover:text-white bg-[#2a2e39] rounded transition-all"
                    >
                        <XIcon size={14} />
                    </button>
                </div>

                <div className="flex flex-col gap-3 pl-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 focus-within:z-10">
                            <span className="text-[10px] font-bold text-[#b4b7c1] uppercase">Bot Name</span>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-[#131722]/60 border border-[#363a45]/50 focus:border-blue-500/50 px-2 py-1.5 h-8 text-xs font-bold text-white outline-none rounded w-full"
                                placeholder="My Strategy"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-[#b4b7c1] uppercase">Side</span>
                            <div className="flex bg-[#131722] rounded p-0.5 border border-[#363a45]/50 h-8">
                                <button
                                    onClick={() => setSide('BUY')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[9px] font-black transition-all ${side === 'BUY' ? 'bg-blue-600 text-white' : 'text-[#4a4f5d]'}`}
                                >BUY</button>
                                <button
                                    onClick={() => setSide('SELL')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[9px] font-black transition-all ${side === 'SELL' ? 'bg-red-600 text-white' : 'text-[#4a4f5d]'}`}
                                >SELL</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-[#b4b7c1] uppercase">Symbol</span>
                            <select
                                value={strategySymbol}
                                onChange={(e) => setStrategySymbol(e.target.value)}
                                className="bg-[#131722]/60 border border-[#363a45]/50 focus:border-blue-500/50 px-2 py-1.5 h-8 text-xs font-medium text-[#d1d4dc] outline-none rounded"
                            >
                                <option value="">Active Chart ({activeSymbol})</option>
                                {Object.keys(symbolInfo).sort().map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-[#b4b7c1] uppercase">Timeframe</span>
                            <select
                                value={timeframe}
                                onChange={(e) => setTimeframe(e.target.value)}
                                className="bg-[#131722]/60 border border-[#363a45]/50 focus:border-blue-500/50 px-2 py-1.5 h-8 text-xs font-medium text-[#d1d4dc] outline-none rounded"
                            >
                                <option value="1m">M1</option>
                                <option value="5m">M5</option>
                                <option value="15m">M15</option>
                                <option value="30m">M30</option>
                                <option value="1h">H1</option>
                                <option value="4h">H4</option>
                                <option value="1d">D1</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-[#b4b7c1] uppercase">Execution</span>
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
                            <span className="text-[10px] font-bold text-[#b4b7c1] uppercase">Description</span>
                            <input
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="bg-[#131722]/60 border border-[#363a45]/50 focus:border-blue-500/50 px-2 py-1.5 h-8 text-xs font-medium text-[#d1d4dc] outline-none rounded"
                                placeholder="Optional comment"
                            />
                        </div>
                    </div>
                </div>

                {/* ENTRY EXECUTION SECTION */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">Entry Execution</span>
                        <div className="h-[1px] bg-blue-500/20 w-full" />
                    </div>
                    <div className="flex flex-col gap-1.5 pl-1 bg-black/5 p-2 rounded border border-[#363a45]/10">
                        <div className="flex items-center gap-4 h-7">
                            <span className="text-[10px] font-bold text-[#b4b7c1] uppercase tracking-tighter w-[84px] shrink-0">Order Type</span>
                            <div className="flex bg-[#131722] rounded p-0.5 border border-[#363a45]/50 h-7 w-[160px]">
                                <button
                                    onClick={() => setEntryType('market')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${entryType === 'market' ? 'bg-[#363a45] text-white' : 'text-[#4a4f5d]'}`}
                                >MARKET</button>
                                <button
                                    onClick={() => setEntryType('stop')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${entryType === 'stop' ? 'bg-[#363a45] text-white' : 'text-[#4a4f5d]'}`}
                                >STOP</button>
                                <button
                                    onClick={() => setEntryType('limit')}
                                    className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${entryType === 'limit' ? 'bg-[#363a45] text-white' : 'text-[#4a4f5d]'}`}
                                >LIMIT</button>
                            </div>
                        </div>

                        {(entryType === 'stop' || entryType === 'limit') && (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <PriceConfigRow
                                    label="Execution At"
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
                        {editingStrategy ? 'UPDATE BOT' : 'ACTIVATE BOT'}
                    </button>
                </div>
            </div>
        </div>
    );
}
