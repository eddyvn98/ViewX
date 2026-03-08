import React, { useState } from 'react';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { RuleBuilder } from '@/features/strategy/components/RuleBuilder';
import { RiskPanel } from '@/features/strategy/components/RiskPanel';
import { Plus, X as XIcon } from 'lucide-react';
import { Strategy, ConditionGroup, StrategyRisk, PositionMode, SLTPConfig, StrategyDirection, StrategyLeg } from '@/features/strategy/types';
import { PriceConfigRow } from '@/features/strategy/components/PriceConfigRow';
import { getStrategyLeg } from '../strategy-helpers';

interface StrategyBuilderProps {
    editingStrategy?: Strategy | null;
    onClose: () => void;
}

function defaultEntry(): ConditionGroup {
    return {
        operator: 'AND',
        conditions: [{ id: Math.random().toString(36).substring(7), left: { type: 'RSI', params: [14] }, comparator: '<', right: 30 }]
    };
}

function defaultRisk(direction: StrategyDirection): StrategyRisk {
    return {
        sl: { mode: 'candle', candleField: direction === 'BUY' ? 'low' : 'high', candleOffset: 1, offset: 0 },
        tp: undefined,
        trailing: true,
        lotSize: { mode: 'fixed', value: 0.1 },
        maxTrades: 1,
        cooldownMinutes: 5,
        slSource: direction === 'BUY' ? 'HA_Low' : 'HA_High',
        trailingSource: direction === 'BUY' ? 'HA_Low' : 'HA_High',
    };
}

function buildDefaultLeg(direction: StrategyDirection): StrategyLeg {
    return {
        entry: defaultEntry(),
        trigger: { operator: 'AND', conditions: [] },
        exit: { operator: 'OR', conditions: [] },
        risk: defaultRisk(direction),
        entryType: 'stop',
        entryPrice: { mode: 'candle', candleField: direction === 'BUY' ? 'high' : 'low', candleOffset: 0, offset: 0 },
    };
}

export function StrategyBuilder({ editingStrategy, onClose }: StrategyBuilderProps) {
    const { addStrategy, updateStrategy } = useStrategyStore();
    const [name, setName] = useState(editingStrategy?.name || 'Professional Scalper');
    const [activeDirection, setActiveDirection] = useState<StrategyDirection>('BUY');
    const [buy, setBuy] = useState<StrategyLeg>(editingStrategy ? getStrategyLeg(editingStrategy, 'BUY') : buildDefaultLeg('BUY'));
    const [sell, setSell] = useState<StrategyLeg>(editingStrategy ? getStrategyLeg(editingStrategy, 'SELL') : buildDefaultLeg('SELL'));
    const [positionMode, setPositionMode] = useState<PositionMode>(editingStrategy?.positionMode || 'single_position');
    const [executionMode, setExecutionMode] = useState<'virtual' | 'real'>(editingStrategy?.executionMode || 'virtual');
    const [comment, setComment] = useState(editingStrategy?.comment || 'WebEngine');
    const [magic] = useState(editingStrategy?.magic || 123456);

    const currentLeg = activeDirection === 'BUY' ? buy : sell;
    const setCurrentLeg = (updater: (leg: StrategyLeg) => StrategyLeg) => {
        if (activeDirection === 'BUY') setBuy((leg) => updater(leg));
        else setSell((leg) => updater(leg));
    };

    const handleSave = () => {
        const newStrategy: Strategy = {
            id: editingStrategy?.id || Math.random().toString(36).substring(7),
            name,
            active: true,
            buy,
            sell,
            risk: buy.risk,
            entry: buy.entry,
            exit: buy.exit,
            trigger: buy.trigger,
            cancelConditions: buy.cancelConditions,
            side: 'BUY',
            symbol: editingStrategy?.symbol,
            timeframe: editingStrategy?.timeframe,
            positionMode,
            executionMode,
            entryType: buy.entryType || 'stop',
            entryPrice: buy.entryPrice,
            magic,
            comment,
            sessions: ["London", "NewYork"]
        };

        if (editingStrategy) updateStrategy(editingStrategy.id, newStrategy);
        else addStrategy(newStrategy);
        onClose();
    };

    return (
        <div className="flex flex-col gap-2.5 animate-in slide-in-from-right-4 duration-300 w-full">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Bot Identity</span>
                        <div className="h-[1px] bg-blue-500/20 w-full" />
                    </div>
                    <button onClick={onClose} className="ml-3 p-1 text-muted-foreground hover:text-foreground bg-secondary/50 rounded transition-all">
                        <XIcon size={12} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pl-1">
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tight">Bot Name</span>
                        <input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/40 border border-border focus:border-blue-500/40 px-2 h-7 text-[11px] font-bold text-foreground outline-none rounded w-full" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tight">Execution</span>
                        <div className="flex bg-secondary/60 rounded p-0.5 border border-border h-7">
                            <button onClick={() => setExecutionMode('virtual')} className={`flex-1 rounded text-[8px] font-black ${executionMode === 'virtual' ? 'bg-secondary-foreground/10 text-foreground' : 'text-muted-foreground'}`}>VIRTUAL</button>
                            <button onClick={() => setExecutionMode('real')} className={`flex-1 rounded text-[8px] font-black ${executionMode === 'real' ? 'bg-secondary-foreground/10 text-foreground' : 'text-muted-foreground'}`}>REAL</button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pl-1">
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tight">Direction Config</span>
                        <div className="flex bg-secondary/60 rounded p-0.5 border border-border h-7">
                            <button onClick={() => setActiveDirection('BUY')} className={`flex-1 rounded text-[8px] font-black ${activeDirection === 'BUY' ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}>BUY</button>
                            <button onClick={() => setActiveDirection('SELL')} className={`flex-1 rounded text-[8px] font-black ${activeDirection === 'SELL' ? 'bg-red-600 text-white' : 'text-muted-foreground'}`}>SELL</button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tight">Comment</span>
                        <input value={comment} onChange={(e) => setComment(e.target.value)} className="bg-secondary/40 border border-border focus:border-blue-500/40 px-2 h-7 text-[11px] font-medium text-muted-foreground outline-none rounded" />
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-1">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">{activeDirection} Execution</span>
                        <div className="h-[1px] bg-blue-500/10 w-full" />
                    </div>
                    <div className="flex flex-col gap-1.5 pl-1 py-1 px-1.5 rounded bg-black/10 border border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter w-16 shrink-0">Order Type</span>
                            <div className="flex bg-secondary/80 rounded p-0.5 border border-border h-6 w-[140px]">
                                {(['market', 'stop', 'limit'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setCurrentLeg((leg) => ({ ...leg, entryType: type }))}
                                        className={`flex-1 flex justify-center items-center h-full rounded text-[8px] font-black transition-all ${(currentLeg.entryType || 'stop') === type ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                                    >
                                        {type.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {((currentLeg.entryType || 'stop') === 'stop' || (currentLeg.entryType || 'stop') === 'limit') && (
                            <PriceConfigRow
                                label="Execute At"
                                icon={<Plus size={10} />}
                                config={currentLeg.entryPrice || { mode: 'candle', candleField: activeDirection === 'BUY' ? 'high' : 'low', candleOffset: 0, offset: 0 }}
                                onChange={(entryPrice: SLTPConfig) => setCurrentLeg((leg) => ({ ...leg, entryPrice }))}
                                accentColor="text-blue-500"
                                modes={['fixed', 'candle']}
                            />
                        )}
                    </div>
                </div>
            </div>

            <RuleBuilder
                entry={currentLeg.entry}
                trigger={currentLeg.trigger}
                exit={currentLeg.exit}
                side={activeDirection}
                onChangeEntry={(entry) => setCurrentLeg((leg) => ({ ...leg, entry }))}
                onChangeTrigger={(trigger) => setCurrentLeg((leg) => ({ ...leg, trigger }))}
                onChangeExit={(exit) => setCurrentLeg((leg) => ({ ...leg, exit }))}
            />

            <RiskPanel
                risk={currentLeg.risk}
                positionMode={positionMode}
                onChangeRisk={(risk) => setCurrentLeg((leg) => ({ ...leg, risk }))}
                onChangeMode={setPositionMode}
            />

            <div className="flex flex-col gap-2 border-t border-border/50 pt-3 mt-1">
                <button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-full rounded font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-lg shadow-primary/20">
                    {editingStrategy ? 'UPDATE BOT' : 'ACTIVATE BOT'}
                </button>
            </div>
        </div>
    );
}
