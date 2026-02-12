import React, { useState } from 'react';
import { StrategyRisk, PositionMode, SLTPConfig, LotConfig, LotMode } from '../types';
import { Shield, Zap, Settings2, Target } from 'lucide-react';
import { PriceConfigRow } from './PriceConfigRow';

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
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">Risk Management</span>
                <div className="h-[1px] bg-blue-500/20 w-full" />
            </div>

            <div className="flex flex-col gap-1.5 pl-1 bg-black/5 p-2 rounded border border-[#363a45]/10">
                {/* LOT SIZE - ROW */}
                <div className="flex items-center gap-4 h-7">
                    <span className="text-[10px] font-bold text-[#b4b7c1] uppercase tracking-tighter w-[84px] shrink-0">Volume (Lot)</span>

                    <div className="flex items-center gap-2">
                        <select
                            value={lotConfig.mode}
                            onChange={(e) => handleLotModeChange(e.target.value as LotMode)}
                            className="bg-[#1e222d] text-[10px] font-black px-1.5 h-6 rounded border border-[#4a4f5d] outline-none text-[#d1d4dc] appearance-none cursor-pointer min-w-[64px] text-center hover:border-blue-500/50 transition-colors"
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
                                className="bg-transparent border-none h-6 px-1 text-xs font-mono font-black text-white outline-none w-14 text-right"
                            />
                            <span className="text-[8px] text-[#4a4f5d] font-bold uppercase">
                                {lotConfig.mode === 'fixed' ? 'Lot' : (lotConfig.mode === 'percentage' ? '%' : '$')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="h-[1px] bg-[#363a45]/10 w-full" />

                {/* SL & TP Advanced Rows */}
                <div className="flex flex-col gap-1">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between h-4">
                            <span className="text-[8px] font-black text-[#b4b7c1] uppercase tracking-widest flex items-center gap-1">
                                <Shield size={8} /> Use Stop Loss
                            </span>
                            <button
                                onClick={() => onChangeRisk({ ...risk, sl: risk.sl ? undefined : { mode: 'candle', candleField: 'low', candleOffset: 1, offset: 0 } })}
                                className={`w-6 h-3 rounded-full relative transition-all duration-300 ${risk.sl ? 'bg-red-500/40' : 'bg-[#131722]'}`}
                            >
                                <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all duration-300 ${risk.sl ? 'left-3.5' : 'left-0.5'}`} />
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

                    <div className="h-[1px] bg-[#363a45]/5 w-full" />

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between h-4">
                            <span className="text-[8px] font-black text-[#b4b7c1] uppercase tracking-widest flex items-center gap-1">
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

                <div className="h-[1px] bg-[#363a45]/10 w-full" />

                {/* TRAILING - COMPACT ROW */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between h-7">
                        <span className="text-[10px] font-bold text-[#b4b7c1] uppercase tracking-tighter flex items-center gap-1.5">
                            <Zap size={10} className={risk.trailing ? 'text-blue-500/80' : 'text-[#2a2e39]'} /> Trailing Stop
                        </span>
                        <button
                            onClick={() => {
                                const newTrailing = !risk.trailing;
                                const update: Partial<StrategyRisk> = { trailing: newTrailing };

                                // Auto-enable SL if Trailing is enabled
                                if (newTrailing && !risk.sl) {
                                    update.sl = { mode: 'fixed', value: 200 };
                                }

                                // If enabling, ensure we have a default source if missing
                                if (newTrailing && !risk.trailingSource) {
                                    const potentialSource = risk.slSource as any;
                                    if (potentialSource === 'HA_Low' || potentialSource === 'HA_High') {
                                        update.trailingSource = potentialSource;
                                    } else {
                                        update.trailingSource = 'HA_Low';
                                    }
                                }

                                onChangeRisk({ ...risk, ...update });
                            }}
                            className={`w-8 h-4 rounded-full relative transition-all duration-300 ${risk.trailing ? 'bg-blue-600/60' : 'bg-[#131722]'}`}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 ${risk.trailing ? 'left-4.5' : 'left-0.5'}`} />
                        </button>
                    </div>
                    {risk.trailing && (
                        <span className="text-[8px] text-blue-500/60 font-medium italic pl-7 -mt-1 mb-1">
                            Trailing transforms your SL into a dynamic protector.
                        </span>
                    )}
                </div>

                {/* ADVANCED COLLAPSIBLE */}
                <div className="flex flex-col gap-3 mt-1">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-1.5 text-[9px] font-black text-[#b4b7c1] hover:text-white transition-colors uppercase"
                    >
                        <Settings2 size={10} /> {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                    </button>

                    {showAdvanced && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[8px] text-[#b4b7c1] font-black uppercase tracking-widest">Position</span>
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
                                <span className="text-[8px] text-[#b4b7c1] font-black uppercase tracking-widest">Max Trades</span>
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
