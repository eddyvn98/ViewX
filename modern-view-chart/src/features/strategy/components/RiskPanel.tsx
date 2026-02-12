import React, { useState } from 'react';
import { StrategyRisk, PositionMode, SLTPConfig, SLTPMode, IndicatorType, LotConfig, LotMode } from '../types';
import { Shield, Zap, Settings2, Target, ChevronRight } from 'lucide-react';

interface SLTPRowProps {
    label: string;
    icon: React.ReactNode;
    config: SLTPConfig;
    onChange: (config: SLTPConfig) => void;
    accentColor: string;
}

function SLTPRow({ label, icon, config, onChange, accentColor }: SLTPRowProps) {
    const handleModeChange = (mode: SLTPMode) => {
        const newConfig: SLTPConfig = { ...config, mode };
        if (mode === 'candle') {
            newConfig.candleField = label.includes('Stop') ? 'low' : 'high';
            newConfig.candleOffset = 1;
            newConfig.offset = 0;
        } else if (mode === 'indicator') {
            newConfig.indicator = { type: 'EMA', params: [200] };
            newConfig.offset = 0;
        } else if (mode === 'winrate') {
            newConfig.value = 2;
        }
        onChange(newConfig);
    };

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-4 h-7">
                <span className={`text-[9px] font-black ${accentColor} uppercase tracking-tighter flex items-center gap-1.5 w-[84px] shrink-0`}>
                    {icon} {label}
                </span>

                <div className="flex items-center gap-2">
                    <select
                        value={config.mode}
                        onChange={(e) => handleModeChange(e.target.value as SLTPMode)}
                        className="bg-[#1e222d] text-[9px] font-black px-1.5 h-6 rounded border border-[#4a4f5d] outline-none text-[#d1d4dc] appearance-none cursor-pointer min-w-[64px] text-center hover:border-blue-500/50 transition-colors"
                    >
                        <option value="fixed">Points</option>
                        <option value="percentage">Percent</option>
                        <option value="amount">Amount</option>
                        <option value="candle">Candle</option>
                        <option value="indicator">Indicator</option>
                        <option value="winrate">R:R Ratio</option>
                    </select>

                    <div className="flex items-center gap-1.5 bg-[#131722]/40 rounded px-1 border border-transparent min-h-[24px]">
                        {/* DYNAMIC INPUTS BASED ON MODE */}
                        {(config.mode === 'fixed' || config.mode === 'percentage' || config.mode === 'amount') && (
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    value={config.value || 0}
                                    onChange={(e) => onChange({ ...config, value: parseFloat(e.target.value) })}
                                    className="bg-transparent border-none h-6 px-1 text-[11px] font-mono font-black text-white outline-none w-14 text-right"
                                />
                                <span className="text-[8px] text-[#4a4f5d] font-bold uppercase">
                                    {config.mode === 'fixed' ? 'Pts' : (config.mode === 'percentage' ? '%' : '$')}
                                </span>
                            </div>
                        )}

                        {config.mode === 'candle' && (
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={config.candleField}
                                    onChange={(e) => onChange({ ...config, candleField: e.target.value as any })}
                                    className="bg-transparent text-[10px] font-black text-blue-400 outline-none w-12 appearance-none cursor-pointer"
                                >
                                    <option value="high">High</option>
                                    <option value="low">Low</option>
                                    <option value="close">Close</option>
                                </select>
                                <div className="flex items-center gap-0.5">
                                    <span className="text-[8px] text-[#4a4f5d] font-bold">#</span>
                                    <input
                                        type="number"
                                        value={config.candleOffset}
                                        onChange={(e) => onChange({ ...config, candleOffset: parseInt(e.target.value) })}
                                        className="bg-transparent text-[10px] w-6 text-center font-mono font-black text-white outline-none border-b border-[#363a45]"
                                    />
                                </div>
                                <ChevronRight size={8} className="text-[#4a4f5d]" />
                                <div className="flex items-center gap-0.5">
                                    <span className="text-[8px] text-[#4a4f5d] font-bold">+</span>
                                    <input
                                        type="number"
                                        value={config.offset}
                                        onChange={(e) => onChange({ ...config, offset: parseFloat(e.target.value) })}
                                        className="bg-transparent text-[10px] w-12 text-right font-mono text-white outline-none"
                                        placeholder="Pts"
                                    />
                                </div>
                            </div>
                        )}

                        {config.mode === 'indicator' && (
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={config.indicator?.type}
                                    onChange={(e) => onChange({ ...config, indicator: { ...config.indicator!, type: e.target.value as IndicatorType } })}
                                    className="bg-transparent text-[9px] font-black text-blue-400 outline-none w-12 appearance-none cursor-pointer"
                                >
                                    <option value="EMA">EMA</option>
                                    <option value="SMA">SMA</option>
                                    <option value="HMA">HMA</option>
                                </select>
                                <input
                                    type="number"
                                    value={config.indicator?.params[0]}
                                    onChange={(e) => onChange({ ...config, indicator: { ...config.indicator!, params: [parseInt(e.target.value)] } })}
                                    className="bg-transparent text-[10px] w-8 text-center font-mono font-black text-white outline-none border-b border-[#363a45]"
                                />
                                <ChevronRight size={8} className="text-[#4a4f5d]" />
                                <div className="flex items-center gap-0.5">
                                    <span className="text-[8px] text-[#4a4f5d] font-bold">+</span>
                                    <input
                                        type="number"
                                        value={config.offset}
                                        onChange={(e) => onChange({ ...config, offset: parseFloat(e.target.value) })}
                                        className="bg-transparent text-[10px] w-12 text-right font-mono text-white outline-none"
                                        placeholder="Pts"
                                    />
                                </div>
                            </div>
                        )}

                        {config.mode === 'winrate' && (
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] font-black text-[#4a4f5d]">Ratio 1 :</span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={config.value || 0}
                                    onChange={(e) => onChange({ ...config, value: parseFloat(e.target.value) })}
                                    className="bg-transparent border-none h-6 px-1 text-[11px] font-mono font-black text-white outline-none w-10 text-right"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface RiskPanelProps {
    risk: StrategyRisk;
    positionMode: PositionMode;
    onChangeRisk: (risk: StrategyRisk) => void;
    onChangeMode: (mode: PositionMode) => void;
}

export function RiskPanel({ risk, positionMode, onChangeRisk, onChangeMode }: RiskPanelProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const ensureConfig = (val: number | SLTPConfig | undefined, type: 'sl' | 'tp'): SLTPConfig => {
        if (typeof val === 'number') return { mode: 'fixed', value: val };
        if (!val) return { mode: 'fixed', value: type === 'sl' ? 200 : 400 };
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
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[#5d606b] uppercase tracking-widest">Risk Management</span>
                <div className="h-[1px] bg-[#363a45]/30 w-full" />
            </div>

            <div className="flex flex-col gap-3 pl-1 bg-black/5 p-3 rounded border border-[#363a45]/10">
                {/* LOT SIZE - ROW */}
                <div className="flex items-center gap-4 h-7">
                    <span className="text-[10px] font-bold text-[#4a4f5d] uppercase tracking-tighter w-[84px] shrink-0">Volume (Lot)</span>

                    <div className="flex items-center gap-2">
                        <select
                            value={lotConfig.mode}
                            onChange={(e) => handleLotModeChange(e.target.value as LotMode)}
                            className="bg-[#1e222d] text-[9px] font-black px-1.5 h-6 rounded border border-[#4a4f5d] outline-none text-[#d1d4dc] appearance-none cursor-pointer min-w-[64px] text-center hover:border-blue-500/50 transition-colors"
                        >
                            <option value="fixed">Fixed</option>
                            <option value="percentage">Account %</option>
                            <option value="amount">Fixed $</option>
                        </select>

                        <div className="flex items-center gap-1.5 bg-[#131722]/40 rounded px-1 border border-transparent min-h-[24px]">
                            <input
                                type="number"
                                step={lotConfig.mode === 'fixed' ? "0.01" : "0.1"}
                                value={lotConfig.value}
                                onChange={(e) => onChangeRisk({ ...risk, lotSize: { ...lotConfig, value: parseFloat(e.target.value) } })}
                                className="bg-transparent border-none h-6 px-1 text-[11px] font-mono font-black text-white outline-none w-14 text-right"
                            />
                            <span className="text-[8px] text-[#4a4f5d] font-bold uppercase">
                                {lotConfig.mode === 'fixed' ? 'Lot' : (lotConfig.mode === 'percentage' ? '%' : '$')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="h-[1px] bg-[#363a45]/10 w-full" />

                {/* SL & TP Advanced Rows */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between h-5">
                            <span className="text-[8px] font-black text-[#4a4f5d] uppercase tracking-widest flex items-center gap-1">
                                <Shield size={8} /> Use Stop Loss
                            </span>
                            <button
                                onClick={() => onChangeRisk({ ...risk, sl: risk.sl ? undefined : { mode: 'fixed', value: 200 } })}
                                className={`w-6 h-3 rounded-full relative transition-all duration-300 ${risk.sl ? 'bg-red-500/40' : 'bg-[#131722]'}`}
                            >
                                <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all duration-300 ${risk.sl ? 'left-3.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                        {risk.sl && (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <SLTPRow
                                    label="Stop Loss"
                                    icon={<Shield size={10} />}
                                    config={slConfig}
                                    onChange={(sl) => onChangeRisk({ ...risk, sl })}
                                    accentColor="text-red-500/60"
                                />
                            </div>
                        )}
                    </div>

                    <div className="h-[1px] bg-[#363a45]/5 w-full" />

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between h-5">
                            <span className="text-[8px] font-black text-[#4a4f5d] uppercase tracking-widest flex items-center gap-1">
                                <Target size={8} /> Use Take Profit
                            </span>
                            <button
                                onClick={() => onChangeRisk({ ...risk, tp: risk.tp ? undefined : { mode: 'fixed', value: 400 } })}
                                className={`w-6 h-3 rounded-full relative transition-all duration-300 ${risk.tp ? 'bg-green-500/40' : 'bg-[#131722]'}`}
                            >
                                <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all duration-300 ${risk.tp ? 'left-3.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                        {risk.tp && (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <SLTPRow
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

                <div className="h-[1px] bg-[#363a45]/10 w-full" />

                {/* TRAILING - COMPACT ROW */}
                <div className="flex items-center justify-between h-7">
                    <span className="text-[10px] font-bold text-[#4a4f5d] uppercase tracking-tighter flex items-center gap-1.5">
                        <Zap size={10} className={risk.trailing ? 'text-blue-500/80' : 'text-[#2a2e39]'} /> Trailing Stop
                    </span>
                    <button
                        onClick={() => onChangeRisk({ ...risk, trailing: !risk.trailing })}
                        className={`w-8 h-4 rounded-full relative transition-all duration-300 ${risk.trailing ? 'bg-blue-600/60' : 'bg-[#131722]'}`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 ${risk.trailing ? 'left-4.5' : 'left-0.5'}`} />
                    </button>
                </div>

                {/* ADVANCED COLLAPSIBLE */}
                <div className="flex flex-col gap-3 mt-1">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-1.5 text-[9px] font-black text-[#4a4f5d] hover:text-[#5d606b] transition-colors uppercase"
                    >
                        <Settings2 size={10} /> {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                    </button>

                    {showAdvanced && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] text-[#4a4f5d] font-black uppercase tracking-widest">Position</span>
                                <select
                                    value={positionMode}
                                    onChange={(e) => onChangeMode(e.target.value as PositionMode)}
                                    className="bg-[#1e222d] text-[10px] h-7 px-2 rounded border border-[#4a4f5d] text-[#d1d4dc] outline-none font-bold appearance-none cursor-pointer hover:border-blue-500/50 transition-colors"
                                >
                                    <option value="single_position">Single</option>
                                    <option value="hedge">Hedge</option>
                                    <option value="scale_in">Scale In</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] text-[#4a4f5d] font-black uppercase tracking-widest">Max Trades</span>
                                <input
                                    type="number"
                                    value={risk.maxTrades || 1}
                                    onChange={(e) => onChangeRisk({ ...risk, maxTrades: parseInt(e.target.value) })}
                                    className="bg-[#131722]/80 text-[10px] h-7 px-2 rounded border border-[#363a45]/50 text-white outline-none font-mono font-bold text-right"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
