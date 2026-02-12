import React from 'react';
import { StrategyRisk, PositionMode } from '../types';
import { Target, Shield, Zap, Clock, Layers } from 'lucide-react';

interface RiskPanelProps {
    risk: StrategyRisk;
    positionMode: PositionMode;
    onChangeRisk: (risk: StrategyRisk) => void;
    onChangeMode: (mode: PositionMode) => void;
}

export function RiskPanel({ risk, positionMode, onChangeRisk, onChangeMode }: RiskPanelProps) {
    return (
        <div className="flex flex-col gap-6 bg-[#2a2e39]/30 p-4 rounded-lg border border-[#363a45]">
            {/* Position Mode & Execution */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Layers size={14} className="text-purple-400" />
                    <span className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider">Execution Settings</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#787b86]">Position Mode</span>
                        <select
                            value={positionMode}
                            onChange={(e) => onChangeMode(e.target.value as PositionMode)}
                            className="bg-[#131722] text-xs p-2 rounded border border-[#363a45] outline-none"
                        >
                            <option value="single_position">Single Pos</option>
                            <option value="hedge">Hedge</option>
                            <option value="scale_in">Scale In</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#787b86]">Max Trades</span>
                        <input
                            type="number"
                            value={risk.maxTrades || 1}
                            onChange={(e) => onChangeRisk({ ...risk, maxTrades: parseInt(e.target.value) })}
                            className="bg-[#131722] text-xs p-2 rounded border border-[#363a45] outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Risk Metrics */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Shield size={14} className="text-orange-400" />
                    <span className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider">Risk Parameters</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#787b86]">Stop Loss (Pips)</span>
                        <input
                            type="number"
                            value={risk.sl}
                            onChange={(e) => onChangeRisk({ ...risk, sl: parseFloat(e.target.value) })}
                            className="bg-[#131722] text-xs p-2 rounded border border-[#363a45] outline-none text-red-400 font-bold"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#787b86]">Take Profit (Pips)</span>
                        <input
                            type="number"
                            value={risk.tp}
                            onChange={(e) => onChangeRisk({ ...risk, tp: parseFloat(e.target.value) })}
                            className="bg-[#131722] text-xs p-2 rounded border border-[#363a45] outline-none text-green-400 font-bold"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#787b86]">Lot Size</span>
                        <input
                            type="number"
                            step="0.01"
                            value={risk.lotSize}
                            onChange={(e) => onChangeRisk({ ...risk, lotSize: parseFloat(e.target.value) })}
                            className="bg-[#131722] text-xs p-2 rounded border border-[#363a45] outline-none"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#787b86]">Trailing Stop</span>
                        <button
                            onClick={() => onChangeRisk({ ...risk, trailing: !risk.trailing })}
                            className={`py-2 px-3 rounded text-[10px] font-bold uppercase transition-all border ${risk.trailing ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-[#131722] border-[#363a45] text-[#787b86]'}`}
                        >
                            {risk.trailing ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Constraints */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Clock size={14} className="text-blue-400" />
                    <span className="text-[10px] font-bold text-[#787b86] uppercase tracking-wider">Schedule & Constraints</span>
                </div>

                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#787b86]">Cooldown (Minutes)</span>
                    <input
                        type="number"
                        value={risk.cooldownMinutes || 0}
                        onChange={(e) => onChangeRisk({ ...risk, cooldownMinutes: parseInt(e.target.value) })}
                        className="bg-[#131722] text-xs p-2 rounded border border-[#363a45] outline-none"
                    />
                </div>
            </div>
        </div>
    );
}
