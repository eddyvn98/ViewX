import React, { useState } from 'react';
import { StrategyRisk, PositionMode, SLTPConfig, LotConfig, LotMode } from '../types';
import { Shield, Zap, Settings2, Target } from 'lucide-react';
import { PriceConfigRow } from './PriceConfigRow';
import { useTranslations } from 'next-intl';

interface RiskPanelProps {
    risk: StrategyRisk;
    positionMode: PositionMode;
    onChangeRisk: (risk: StrategyRisk) => void;
    onChangeMode: (mode: PositionMode) => void;
}

export function RiskPanel({ risk, positionMode, onChangeRisk, onChangeMode }: RiskPanelProps) {
    const t = useTranslations('Strategy');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const ensureConfig = (val: number | SLTPConfig | undefined, type: 'sl' | 'tp'): SLTPConfig => {
        if (typeof val === 'number') return { mode: 'fixed', value: val };
        if (!val) {
            if (type === 'sl') return { mode: 'candle', candleField: 'low', candleOffset: 1, offset: 0 };
            return { mode: 'fixed', value: 400 };
        }
        return val;
    };

    const slConfig = ensureConfig(risk.sl, 'sl');
    const tpConfig = ensureConfig(risk.tp, 'tp');

    const lotConfig: LotConfig = typeof risk.lotSize === 'number'
        ? { mode: 'fixed', value: risk.lotSize }
        : risk.lotSize;

    const handleLotModeChange = (mode: LotMode) => {
        const newValue = mode === 'fixed' ? 0.1 : (mode === 'percentage' ? 1 : 100);
        onChangeRisk({ ...risk, lotSize: { mode, value: newValue } });
    };

    return (
        <div className="rounded-lg border border-border bg-secondary/10 overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-semibold flex items-center justify-center">4</span>
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-rose-500">{t('builder.riskManagement')}</span>
                </div>
            </div>

            <div className="p-3 flex flex-col gap-1.5">
                {/* LOT SIZE - ROW */}
                <div className="flex items-center gap-3 h-6">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tighter w-16 shrink-0">{t('builder.volume')}</span>

                    <div className="flex items-center gap-1.5">
                        <select
                            value={lotConfig.mode}
                            onChange={(e) => handleLotModeChange(e.target.value as LotMode)}
                            className="bg-secondary text-[11px] font-semibold px-1 h-5 rounded border border-border outline-none text-muted-foreground appearance-none cursor-pointer min-w-[56px] text-center hover:border-blue-500/40 transition-colors"
                        >
                            <option value="fixed" className="bg-popover text-foreground">{t('builder.points')}</option>
                            <option value="percentage" className="bg-popover text-foreground">{t('builder.percent')}</option>
                            <option value="amount" className="bg-popover text-foreground">{t('builder.amount')}</option>
                        </select>

                        <div className="flex items-center gap-1 bg-secondary/60 rounded px-1 border border-border min-h-[20px]">
                            <input
                                type="number"
                                step={lotConfig.mode === 'fixed' ? "0.01" : "0.1"}
                                value={lotConfig.value}
                                onChange={(e) => onChangeRisk({ ...risk, lotSize: { ...lotConfig, value: parseFloat(e.target.value) } })}
                                className="bg-transparent border-none h-5 px-1 text-[11px] font-mono font-semibold text-foreground outline-none w-12 text-right"
                            />
                            <span className="text-[11px] text-muted-foreground font-semibold uppercase">
                                {lotConfig.mode === 'fixed' ? 'Lot' : (lotConfig.mode === 'percentage' ? '%' : '$')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="h-[1px] bg-border/10 w-full" />

                {/* SL & TP Advanced Rows */}
                <div className="flex flex-col gap-1">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between h-4">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                <Shield size={8} /> {t('builder.useStopLoss')}
                            </span>
                            <button
                                onClick={() => onChangeRisk({ ...risk, sl: risk.sl ? undefined : { mode: 'candle', candleField: 'low', candleOffset: 1, offset: 0 } })}
                                className={`w-6 h-3 rounded-full relative transition-all duration-300 ${risk.sl ? 'bg-red-500/40' : 'bg-secondary'}`}
                            >
                                <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-foreground transition-all duration-300 ${risk.sl ? 'left-3.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                        {risk.sl && (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <PriceConfigRow
                                    label={risk.trailing ? "Initial SL" : "Stop Loss"}
                                    icon={<Shield size={10} />}
                                    config={slConfig}
                                    onChange={(sl) => onChangeRisk({ ...risk, sl })}
                                    accentColor="text-red-500/60"
                                />
                            </div>
                        )}
                    </div>

                    <div className="h-[1px] bg-border/10 w-full" />

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between h-4">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                <Target size={8} /> {t('builder.useTakeProfit')}
                            </span>
                            <button
                                onClick={() => onChangeRisk({ ...risk, tp: risk.tp ? undefined : { mode: 'fixed', value: 400 } })}
                                className={`w-6 h-3 rounded-full relative transition-all duration-300 ${risk.tp ? 'bg-green-500/40' : 'bg-secondary'}`}
                            >
                                <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-foreground transition-all duration-300 ${risk.tp ? 'left-3.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                        {risk.tp && (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <PriceConfigRow
                                    label="Take Profit"
                                    icon={<Target size={10} />}
                                    config={tpConfig}
                                    onChange={(tp) => onChangeRisk({ ...risk, tp })}
                                    accentColor="text-green-500/60"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-[1px] bg-border/10 w-full" />

                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between h-6">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                            <Zap size={9} className={risk.trailing ? 'text-blue-500/80' : 'text-muted-foreground/40'} /> {t('builder.trailingProtect')}
                        </span>
                        <button
                            onClick={() => {
                                const newTrailing = !risk.trailing;
                                const update: Partial<StrategyRisk> = { trailing: newTrailing };
                                if (newTrailing && !risk.sl) update.sl = { mode: 'fixed', value: 200 };
                                if (newTrailing && !risk.trailingSource) update.trailingSource = 'HA_Low';
                                onChangeRisk({ ...risk, ...update });
                            }}
                            className={`w-7 h-3.5 rounded-full relative transition-all duration-300 ${risk.trailing ? 'bg-blue-600/60' : 'bg-secondary'}`}
                        >
                            <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-foreground transition-all duration-300 ${risk.trailing ? 'left-4' : 'left-0.5'}`} />
                        </button>
                    </div>
                    {risk.trailing && (
                        <span className="text-[11px] text-blue-500/60 font-semibold italic pl-4 -mt-1 mb-1">
                            ACTIVE PROTECTION ENABLED
                        </span>
                    )}
                </div>

                {/* ADVANCED COLLAPSIBLE */}
                <div className="flex flex-col gap-3 mt-1">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#b4b7c1] hover:text-white transition-colors uppercase"
                    >
                        <Settings2 size={10} /> {showAdvanced ? t('builder.hideAdvanced') : t('builder.showAdvanced')}
                    </button>

                    {showAdvanced && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">{t('builder.position')}</span>
                                <select
                                    value={positionMode}
                                    onChange={(e) => onChangeMode(e.target.value as PositionMode)}
                                    className="bg-secondary text-[11px] h-7 px-2 rounded border border-border text-foreground outline-none font-bold appearance-none cursor-pointer hover:border-blue-500/50 transition-colors"
                                >
                                    <option value="single_position" className="bg-popover">{t('builder.single')}</option>
                                    <option value="hedge" className="bg-popover">{t('builder.hedge')}</option>
                                    <option value="scale_in" className="bg-popover">{t('builder.scaleIn')}</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">{t('builder.maxTrades')}</span>
                                <input
                                    type="number"
                                    value={risk.maxTrades || 1}
                                    onChange={(e) => onChangeRisk({ ...risk, maxTrades: parseInt(e.target.value) })}
                                    className="bg-secondary/80 text-[11px] h-7 px-2 rounded border border-border text-foreground outline-none font-mono font-bold text-right"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


