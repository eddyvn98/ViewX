'use client';

import React from 'react';
import { Minus, Plus, Info, ChevronDown } from 'lucide-react';

interface OrderInputsProps {
    volume: string;
    setVolume: (v: string) => void;
    sl: string;
    setSl: (v: string) => void;
    tp: string;
    setTp: (v: string) => void;
    slPnl: string | null;
    tpPnl: string | null;
    adjustVolume: (val: string, step: number) => string;
    adjustValue: (val: string, step: number, isSL: boolean) => string;
}

export function OrderInputs({
    volume, setVolume,
    sl, setSl,
    tp, setTp,
    slPnl, tpPnl,
    adjustVolume, adjustValue
}: OrderInputsProps) {
    return (
        <div className="space-y-3">
            {/* Volume */}
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Khối lượng</label>
                <div className="flex items-center gap-1">
                    <div className="flex-1 relative flex items-center">
                        <input
                            type="text"
                            value={volume}
                            onChange={(e) => setVolume(e.target.value)}
                            className="w-full bg-black/30 border border-zinc-800 rounded pl-2.5 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors font-medium"
                        />
                        <span className="absolute right-2.5 text-[10px] text-zinc-600 font-bold uppercase">Lô</span>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => setVolume(adjustVolume(volume, -0.01))} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"><Minus size={12} /></button>
                        <button onClick={() => setVolume(adjustVolume(volume, 0.01))} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"><Plus size={12} /></button>
                    </div>
                </div>
            </div>

            {/* Take Profit (Chốt lời) */}
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        Chốt lời <Info size={10} className="text-zinc-700 cursor-help" />
                    </label>
                </div>
                <div className="flex items-center gap-1">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Chưa thiết lập"
                            value={tp}
                            onChange={(e) => setTp(e.target.value)}
                            className="w-full bg-black/30 border border-zinc-800 rounded pl-2.5 pr-12 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors font-medium placeholder:text-zinc-700"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-zinc-600 font-bold cursor-pointer hover:text-zinc-400 transition-colors">
                            Giá <ChevronDown size={10} />
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => setTp(adjustValue(tp, -1, false))} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"><Minus size={12} /></button>
                        <button onClick={() => setTp(adjustValue(tp, 1, false))} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"><Plus size={12} /></button>
                    </div>
                </div>
                {tpPnl && <span className="text-[9px] font-bold text-blue-400 block ml-1">{tpPnl}</span>}
            </div>

            {/* Stop Loss (Cắt lỗ) */}
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        Cắt lỗ <Info size={10} className="text-zinc-700 cursor-help" />
                    </label>
                </div>
                <div className="flex items-center gap-1">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Chưa thiết lập"
                            value={sl}
                            onChange={(e) => setSl(e.target.value)}
                            className="w-full bg-black/30 border border-zinc-800 rounded pl-2.5 pr-12 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors font-medium placeholder:text-zinc-700"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-zinc-600 font-bold cursor-pointer hover:text-zinc-400 transition-colors">
                            Giá <ChevronDown size={10} />
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => setSl(adjustValue(sl, -1, true))} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"><Minus size={12} /></button>
                        <button onClick={() => setSl(adjustValue(sl, 1, true))} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"><Plus size={12} /></button>
                    </div>
                </div>
                {slPnl && <span className="text-[9px] font-bold text-red-400 block ml-1">{slPnl}</span>}
            </div>
        </div>
    );
}
