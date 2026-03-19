import React from 'react';
import { ConditionGroup, Condition, IndicatorType, Comparator } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { STRATEGY_INDICATOR_OPTIONS, getDefaultParamsForIndicator, getEditableParamCount } from '../indicator-options';
import { IndicatorSelect } from './IndicatorSelect';

const isCondition = (value: Condition | ConditionGroup): value is Condition => !('operator' in value);
const normalizeType = (type: string): string => {
    if (type === 'BOLLINGER_BANDS') return 'BollingerBands';
    if (type === 'STOCHASTIC') return 'Stochastic';
    if (type === 'SUPERTREND') return 'SuperTrend';
    if (type === 'ICHIMOKU') return 'Ichimoku';
    return type;
};

const getFieldOptions = (type: string): string[] => {
    switch (normalizeType(type)) {
        case 'Price': return ['close', 'open', 'high', 'low'];
        case 'BollingerBands': return ['middle', 'upper', 'lower'];
        case 'MACD': return ['macd', 'signal', 'histogram'];
        case 'Stochastic': return ['k', 'd'];
        case 'Ichimoku': return ['kijun', 'tenkan', 'spanA', 'spanB', 'chikou'];
        case 'ADX': return ['adx', 'plusDI', 'minusDI'];
        case 'SuperTrend': return ['superTrend', 'trend'];
        default: return [];
    }
};
const getFieldLabel = (t: (key: string) => string, field: string): string => {
    const map: Record<string, string> = {
        close: t('builder.fieldClose'),
        open: t('builder.fieldOpen'),
        high: t('builder.fieldHigh'),
        low: t('builder.fieldLow'),
        middle: t('builder.fieldMiddle'),
        upper: t('builder.fieldUpper'),
        lower: t('builder.fieldLower'),
        macd: 'MACD',
        signal: t('builder.fieldSignal'),
        histogram: t('builder.fieldHistogram'),
        k: '%K',
        d: '%D',
        kijun: t('builder.fieldKijun'),
        tenkan: t('builder.fieldTenkan'),
        spanA: t('builder.fieldSpanA'),
        spanB: t('builder.fieldSpanB'),
        chikou: t('builder.fieldChikou'),
        adx: 'ADX',
        plusDI: '+DI',
        minusDI: '-DI',
        superTrend: t('builder.fieldSuperTrend'),
        trend: t('builder.fieldTrend'),
    };
    return map[field] || field;
};

interface RuleSectionProps {
    title: string;
    group: ConditionGroup;
    onChange: (group: ConditionGroup) => void;
    accentColor: string;
    stepNumber?: number;
}

function RuleSection({ title, group, onChange, accentColor, stepNumber }: RuleSectionProps) {
    const t = useTranslations('Strategy');
    const addCondition = () => {
        const newCondition: Condition = {
            id: Math.random().toString(36).substring(7),
            left: { type: 'RSI', params: [14] },
            comparator: '>',
            right: 60
        };
        onChange({
            ...group,
            conditions: [...group.conditions, newCondition]
        });
    };

    const removeCondition = (id: string) => {
        onChange({
            ...group,
            conditions: group.conditions.filter(c => !('id' in c) || c.id !== id)
        });
    };

    const updateCondition = (id: string, updates: Partial<Condition>) => {
        onChange({
            ...group,
            conditions: group.conditions.map(c =>
                ('id' in c && c.id === id) ? { ...(c as Condition), ...updates } : c
            )
        });
    };
    const renderParamInputs = (
        type: string,
        params: number[],
        onUpdate: (nextParams: number[]) => void
    ) => {
        const count = getEditableParamCount(type);
        if (count <= 0) return null;
        return (
            <>
                {Array.from({ length: count }).map((_, idx) => (
                    <input
                        key={`${type}-${idx}`}
                        type="number"
                        value={params[idx] ?? ''}
                        onChange={(e) => {
                            const next = [...params];
                            next[idx] = parseInt(e.target.value, 10);
                            onUpdate(next);
                        }}
                        className="w-[36px] h-6 bg-secondary/80 text-center text-[11px] rounded border border-border outline-none font-mono text-blue-500 font-bold"
                    />
                ))}
            </>
        );
    };

    return (
        <div className="rounded-lg border border-border bg-secondary/10 overflow-visible">
            <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {typeof stepNumber === 'number' && (
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-semibold flex items-center justify-center">
                            {stepNumber}
                        </span>
                    )}
                    <span className={`text-[12px] font-semibold uppercase tracking-wide ${accentColor}`}>{title}</span>
                    <select
                        value={group.operator}
                        onChange={(e) => onChange({ ...group, operator: e.target.value as ConditionGroup['operator'] })}
                        className="bg-secondary/60 text-[11px] font-semibold px-1.5 py-0.5 rounded border border-border outline-none text-muted-foreground appearance-none cursor-pointer hover:border-blue-500/30"
                    >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                    </select>
                </div>
                <button
                    onClick={addCondition}
                    className="text-[11px] font-semibold text-blue-500/80 hover:text-blue-500 flex items-center gap-1 transition-colors uppercase"
                >
                    <Plus size={12} /> {t('builder.addRule')}
                </button>
            </div>

            <div className="p-3 flex flex-col gap-2 min-h-[10px] justify-center">
                {group.conditions.length === 0 ? (
                    <div className="py-3 flex justify-center border border-dashed border-border rounded text-[11px] text-muted-foreground font-semibold uppercase tracking-tighter">
                        {t('builder.noRules')}
                    </div>
                ) : (
                    group.conditions.filter(isCondition).map((c) => (
                        <div key={c.id} className="flex items-center gap-1.5 group animate-in slide-in-from-left-2 duration-200">
                            {(() => {
                                const rightIndicator = typeof c.right === 'number' ? null : c.right;
                                return (
                                    <>
                            <IndicatorSelect
                                value={c.left.type}
                                options={STRATEGY_INDICATOR_OPTIONS}
                                className="w-[108px]"
                                searchPlaceholder={t('builder.searchIndicatorPlaceholder')}
                                emptyText={t('builder.noIndicatorFound')}
                                onChange={(nextType) => {
                                    updateCondition(c.id, {
                                        left: {
                                            ...c.left,
                                            type: nextType as IndicatorType,
                                            params: getDefaultParamsForIndicator(nextType),
                                            field: normalizeType(nextType) === 'Ichimoku' ? 'kijun' : c.left.field,
                                        }
                                    });
                                }}
                            />

                            {renderParamInputs(c.left.type, c.left.params, (nextParams) =>
                                updateCondition(c.id, { left: { ...c.left, params: nextParams } })
                            )}
                            {getFieldOptions(c.left.type).length > 0 && (
                                <select
                                    value={c.left.field || getFieldOptions(c.left.type)[0]}
                                    onChange={(e) => updateCondition(c.id, { left: { ...c.left, field: e.target.value } })}
                                    className="bg-secondary/80 text-[11px] h-6 px-1 rounded border border-border outline-none w-[64px] font-bold text-foreground appearance-none cursor-pointer"
                                >
                                    {getFieldOptions(c.left.type).map((field) => (
                                        <option key={field} value={field}>{getFieldLabel(t, field)}</option>
                                    ))}
                                </select>
                            )}

                            <select
                                value={c.comparator}
                                onChange={(e) => updateCondition(c.id, { comparator: e.target.value as Comparator })}
                                className="bg-transparent text-[11px] h-6 text-blue-500 font-semibold outline-none w-5 text-center appearance-none cursor-pointer"
                            >
                                <option value=">">{'>'}</option>
                                <option value="<">{'<'}</option>
                                <option value="==">{'='}</option>
                                <option value="crosses_above">â†‘</option>
                                <option value="crosses_below">â†“</option>
                            </select>

                            <select
                                value={typeof c.right === 'number' ? 'number' : 'indicator'}
                                onChange={(e) => {
                                    if (e.target.value === 'indicator') {
                                        updateCondition(c.id, { right: { type: 'EMA', params: getDefaultParamsForIndicator('EMA') } });
                                    } else {
                                        updateCondition(c.id, { right: 0 });
                                    }
                                }}
                                className="bg-secondary/80 text-[11px] h-6 px-1 rounded border border-border outline-none w-[90px] font-bold text-foreground appearance-none cursor-pointer"
                            >
                                <option value="number">{t('builder.numberValue')}</option>
                                <option value="indicator">{t('builder.indicatorValue')}</option>
                            </select>

                            {typeof c.right === 'number' ? (
                                <input
                                    type="number"
                                    value={c.right}
                                    onChange={(e) => updateCondition(c.id, { right: parseFloat(e.target.value) })}
                                    className="w-[64px] h-6 bg-secondary/80 text-center text-[11px] rounded border border-border outline-none font-mono font-bold text-foreground px-1 focus:border-blue-500/40"
                                />
                            ) : (
                                <>
                                    <IndicatorSelect
                                        value={rightIndicator!.type as IndicatorType}
                                        options={STRATEGY_INDICATOR_OPTIONS}
                                        className="w-[108px]"
                                        searchPlaceholder={t('builder.searchIndicatorPlaceholder')}
                                        emptyText={t('builder.noIndicatorFound')}
                                        onChange={(nextType) => {
                                            updateCondition(c.id, {
                                                right: {
                                                    ...rightIndicator!,
                                                    type: nextType,
                                                    params: getDefaultParamsForIndicator(nextType),
                                                    field: normalizeType(nextType) === 'Ichimoku' ? 'kijun' : rightIndicator!.field,
                                                }
                                            });
                                        }}
                                    />
                                    {renderParamInputs(rightIndicator!.type, rightIndicator!.params || [], (nextParams) =>
                                        updateCondition(c.id, { right: { ...rightIndicator!, params: nextParams } })
                                    )}
                                    {getFieldOptions(rightIndicator!.type).length > 0 && (
                                        <select
                                            value={rightIndicator!.field || getFieldOptions(rightIndicator!.type)[0]}
                                            onChange={(e) => updateCondition(c.id, { right: { ...rightIndicator!, field: e.target.value } })}
                                            className="bg-secondary/80 text-[11px] h-6 px-1 rounded border border-border outline-none w-[64px] font-bold text-foreground appearance-none cursor-pointer"
                                        >
                                            {getFieldOptions(rightIndicator!.type).map((field) => (
                                                <option key={field} value={field}>{getFieldLabel(t, field)}</option>
                                            ))}
                                        </select>
                                    )}
                                </>
                            )}

                            <button
                                onClick={() => removeCondition(c.id)}
                                className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={11} />
                            </button>
                                    </>
                                );
                            })()}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

interface RuleBuilderProps {
    entry: ConditionGroup;
    trigger?: ConditionGroup;
    side: 'BUY' | 'SELL';
    onChangeEntry: (group: ConditionGroup) => void;
    onChangeTrigger?: (group: ConditionGroup) => void;
}

export function RuleBuilder({ entry, trigger, side, onChangeEntry, onChangeTrigger }: RuleBuilderProps) {
    const t = useTranslations('Strategy');
    return (
        <div className="flex flex-col gap-3">
            <RuleSection
                title={`${t('builder.marketFilter')} (${side})`}
                group={entry}
                onChange={onChangeEntry}
                accentColor={side === 'BUY' ? "text-blue-500" : "text-red-500"}
                stepNumber={1}
            />
            <RuleSection
                title={`${t('builder.entrySetup')} (${side})`}
                group={trigger || { operator: 'AND', conditions: [] }}
                onChange={onChangeTrigger || (() => undefined)}
                accentColor={side === 'BUY' ? "text-emerald-500" : "text-orange-500"}
                stepNumber={2}
            />
        </div>
    );
}


