import React, { useState } from 'react';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { RuleBuilder } from '@/features/strategy/components/RuleBuilder';
import { RiskPanel } from '@/features/strategy/components/RiskPanel';
import { Plus, X as XIcon } from 'lucide-react';
import { Strategy, ConditionGroup, StrategyRisk, SLTPConfig, StrategyDirection, StrategyLeg } from '@/features/strategy/types';
import { PriceConfigRow } from '@/features/strategy/components/PriceConfigRow';
import { getStrategyLeg, strategySupportsDirection } from '../strategy-helpers';
import { StrategyPreview } from '@/features/strategy/components/StrategyPreview';
import { useTranslations } from 'next-intl';
import { useMarketStore } from '@/lib/store';

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
        positionMode: 'single_position',
    };
}

export function StrategyBuilder({ editingStrategy, onClose }: StrategyBuilderProps) {
    const t = useTranslations('Strategy');
    const { addStrategy, updateStrategy } = useStrategyStore();
    const builderDraft = useMarketStore((state) => state.strategyBuilderDraft);
    const setBuilderDraft = useMarketStore((state) => state.setStrategyBuilderDraft);
    const setEditingStrategyId = useMarketStore((state) => state.setStrategyEditingStrategyId);
    const setStrategyPanelView = useMarketStore((state) => state.setStrategyPanelView);
    const [name, setName] = useState(builderDraft?.name || editingStrategy?.name || 'Professional Scalper');
    const [activeDirection, setActiveDirection] = useState<StrategyDirection>(builderDraft?.activeDirection || 'BUY');
    const [buyEnabled, setBuyEnabled] = useState(
        builderDraft?.buyEnabled ?? (editingStrategy ? strategySupportsDirection(editingStrategy, 'BUY') : true)
    );
    const [sellEnabled, setSellEnabled] = useState(
        builderDraft?.sellEnabled ?? (editingStrategy ? strategySupportsDirection(editingStrategy, 'SELL') : false)
    );

    // Ensure editing strategy legs have positionMode if they don't from old version
    const initialBuy = editingStrategy ? getStrategyLeg(editingStrategy, 'BUY') : buildDefaultLeg('BUY');
    const initialSell = editingStrategy ? getStrategyLeg(editingStrategy, 'SELL') : buildDefaultLeg('SELL');
    
    if (editingStrategy && !initialBuy.positionMode) initialBuy.positionMode = editingStrategy.positionMode || 'single_position';
    if (editingStrategy && !initialSell.positionMode) initialSell.positionMode = editingStrategy.positionMode || 'single_position';

    const [buy, setBuy] = useState<StrategyLeg>(builderDraft?.buy || initialBuy);
    const [sell, setSell] = useState<StrategyLeg>(builderDraft?.sell || initialSell);
    const [executionMode, setExecutionMode] = useState<'virtual' | 'real'>(builderDraft?.executionMode || editingStrategy?.executionMode || 'virtual');
    const [comment, setComment] = useState(builderDraft?.comment || editingStrategy?.comment || 'WebEngine');
    const [magic] = useState(builderDraft?.magic || editingStrategy?.magic || 123456);
    const [validationError, setValidationError] = useState<string | null>(null);
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore((state) => (activeTabId ? state.tabs[activeTabId] : null));
    const activeChartId = activeTab?.activeChartId;
    const activeChart = activeChartId ? activeTab?.charts?.[activeChartId] : null;

    const currentLeg = activeDirection === 'BUY' ? buy : sell;
    const setCurrentLeg = (updater: (leg: StrategyLeg) => StrategyLeg) => {
        if (activeDirection === 'BUY') setBuy((leg) => updater(leg));
        else setSell((leg) => updater(leg));
    };

    const handleSave = () => {
        if (!name.trim()) {
            setValidationError('Bot name is required.');
            return;
        }

        if (!buyEnabled && !sellEnabled) {
            setValidationError('Enable at least one trading direction.');
            return;
        }

        if ((buyEnabled && !buy.entry?.conditions?.length) || (sellEnabled && !sell.entry?.conditions?.length)) {
            setValidationError('Each enabled direction needs at least one market filter condition.');
            return;
        }

        setValidationError(null);

        const primaryDirection: StrategyDirection = buyEnabled ? 'BUY' : 'SELL';
        const primaryLeg = primaryDirection === 'BUY' ? buy : sell;
        const enabledDirections: StrategyDirection[] = [
            ...(buyEnabled ? ['BUY' as const] : []),
            ...(sellEnabled ? ['SELL' as const] : []),
        ];

        const newStrategy: Strategy = {
            id: editingStrategy?.id || Math.random().toString(36).substring(7),
            name: name.trim(),
            active: editingStrategy?.active ?? true,
            buy,
            sell,
            enabledDirections,
            risk: primaryLeg.risk,
            entry: primaryLeg.entry,
            exit: primaryLeg.exit,
            trigger: primaryLeg.trigger,
            cancelConditions: primaryLeg.cancelConditions,
            side: primaryDirection,
            symbol: editingStrategy?.symbol || activeChart?.symbol || 'XAUUSDm',
            timeframe: editingStrategy?.timeframe || activeChart?.interval || '5m',
            positionMode: primaryLeg.positionMode || 'single_position',
            executionMode,
            entryType: primaryLeg.entryType || 'stop',
            entryPrice: primaryLeg.entryPrice,
            magic,
            comment,
            sessions: ["London", "NewYork"]
        };

        if (editingStrategy) updateStrategy(editingStrategy.id, newStrategy);
        else addStrategy(newStrategy);
        setBuilderDraft(null);
        setEditingStrategyId(null);
        setStrategyPanelView('list');
        onClose();
    };

    React.useEffect(() => {
        setBuilderDraft({
            editingStrategyId: editingStrategy?.id || null,
            name,
            activeDirection,
            buyEnabled,
            sellEnabled,
            buy,
            sell,
            executionMode,
            comment,
            magic,
        });
    }, [activeDirection, buy, buyEnabled, comment, editingStrategy?.id, executionMode, magic, name, sell, sellEnabled, setBuilderDraft]);

    const handleClose = () => {
        setBuilderDraft(null);
        setEditingStrategyId(null);
        onClose();
    };

    return (
        <div className="flex flex-col gap-2.5 animate-in slide-in-from-right-4 duration-300 w-full">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">{t('builder.botIdentity')}</span>
                        <div className="h-[1px] bg-blue-500/20 w-full" />
                    </div>
                    <button onClick={handleClose} className="ml-3 p-1 text-muted-foreground hover:text-foreground bg-secondary/50 rounded transition-all">
                        <XIcon size={12} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pl-1">
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">{t('builder.botName')}</span>
                        <input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/40 border border-border focus:border-blue-500/40 px-2 h-7 text-[11px] font-bold text-foreground outline-none rounded w-full" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">{t('builder.execution')}</span>
                        <div className="flex bg-secondary/60 rounded p-0.5 border border-border h-7">
                            <button onClick={() => setExecutionMode('virtual')} className={`flex-1 rounded text-[11px] font-semibold ${executionMode === 'virtual' ? 'bg-secondary-foreground/10 text-foreground' : 'text-muted-foreground'}`}>{t('builder.virtual')}</button>
                            <button onClick={() => setExecutionMode('real')} className={`flex-1 rounded text-[11px] font-semibold ${executionMode === 'real' ? 'bg-secondary-foreground/10 text-foreground' : 'text-muted-foreground'}`}>{t('builder.real')}</button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pl-1">
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">{t('builder.directionConfig')}</span>
                        <div className="flex bg-secondary/60 rounded p-0.5 border border-border h-7">
                            <button onClick={() => setActiveDirection('BUY')} className={`flex-1 rounded text-[11px] font-semibold ${activeDirection === 'BUY' ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}>BUY</button>
                            <button onClick={() => setActiveDirection('SELL')} className={`flex-1 rounded text-[11px] font-semibold ${activeDirection === 'SELL' ? 'bg-red-600 text-white' : 'text-muted-foreground'}`}>SELL</button>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mt-1">
                            <button
                                type="button"
                                onClick={() => setBuyEnabled((enabled) => !enabled)}
                                className={`h-6 rounded border text-[10px] font-semibold transition-colors ${buyEnabled ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500' : 'border-border text-muted-foreground'}`}
                            >
                                {t('builder.enableBuy')}: {buyEnabled ? t('builder.on') : t('builder.off')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSellEnabled((enabled) => !enabled)}
                                className={`h-6 rounded border text-[10px] font-semibold transition-colors ${sellEnabled ? 'border-rose-500/50 bg-rose-500/10 text-rose-500' : 'border-border text-muted-foreground'}`}
                            >
                                {t('builder.enableSell')}: {sellEnabled ? t('builder.on') : t('builder.off')}
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">{t('builder.comment')}</span>
                        <input value={comment} onChange={(e) => setComment(e.target.value)} className="bg-secondary/40 border border-border focus:border-blue-500/40 px-2 h-7 text-[11px] font-medium text-muted-foreground outline-none rounded" />
                    </div>
                </div>

            </div>

            <StrategyPreview
                direction={activeDirection}
                marketFilter={currentLeg.entry}
                entrySetup={currentLeg.trigger}
                risk={currentLeg.risk}
                entryType={currentLeg.entryType || 'stop'}
                entryPrice={currentLeg.entryPrice}
                positionMode={currentLeg.positionMode || 'single_position'}
            />
            <RuleBuilder
                entry={currentLeg.entry}
                trigger={currentLeg.trigger}
                side={activeDirection}
                onChangeEntry={(entry) => setCurrentLeg((leg) => ({ ...leg, entry }))}
                onChangeTrigger={(trigger) => setCurrentLeg((leg) => ({ ...leg, trigger }))}
            />

            <div className="rounded-lg border border-border bg-secondary/10 overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-semibold flex items-center justify-center">3</span>
                        <span className="text-[12px] font-semibold uppercase tracking-wide text-yellow-500">{t('builder.executionStep')}</span>
                    </div>
                </div>

                <div className="p-3 flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tighter w-16 shrink-0">{t('builder.orderType')}</span>
                            <div className="flex bg-secondary/80 rounded p-0.5 border border-border h-6 w-[140px]">
                                {(['market', 'stop', 'limit'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setCurrentLeg((leg) => {
                                            const newLeg = { ...leg, entryType: type };
                                            if ((type === 'stop' || type === 'limit') && !newLeg.entryPrice) {
                                                newLeg.entryPrice = { mode: 'candle', candleField: activeDirection === 'BUY' ? 'high' : 'low', candleOffset: 0, offset: 0 };
                                            }
                                            return newLeg;
                                        })}
                                        className={`flex-1 flex justify-center items-center h-full rounded text-[11px] font-semibold transition-all ${(currentLeg.entryType || 'stop') === type ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                                    >
                                        {type.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {((currentLeg.entryType || 'stop') === 'stop' || (currentLeg.entryType || 'stop') === 'limit') && (
                            <PriceConfigRow
                                label={t('builder.executeAt')}
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

            <RiskPanel
                risk={currentLeg.risk}
                positionMode={currentLeg.positionMode || 'single_position'}
                onChangeRisk={(risk) => setCurrentLeg((leg) => ({ ...leg, risk }))}
                onChangeMode={(mode) => setCurrentLeg((leg) => ({ ...leg, positionMode: mode }))}
            />

            <div className="flex flex-col gap-2 border-t border-border/50 pt-3 mt-1">
                {validationError ? (
                    <div className="text-[11px] font-semibold text-red-500 px-1" role="alert">
                        {validationError}
                    </div>
                ) : null}
                <button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-full rounded font-semibold text-[11px] uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-lg shadow-primary/20">
                    {editingStrategy ? t('builder.updateBot') : t('builder.activateBot')}
                </button>
            </div>
        </div>
    );
}


