'use client';

import React, { useState, useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ChevronDown, Info, Minus, Plus, X } from 'lucide-react';

export function PositionModifier() {
    const editingPosition = useMarketStore(state => state.editingPosition);
    const setEditingPosition = useMarketStore(state => state.setEditingPosition);
    const tickers = useMarketStore(state => state.tickers);

    const [activeTab, setActiveTab] = useState<'modify' | 'partial' | 'closeBy'>('modify');
    const [sl, setSl] = useState(editingPosition?.sl?.toString() || '');
    const [tp, setTp] = useState(editingPosition?.tp?.toString() || '');
    const [partialVolume, setPartialVolume] = useState('0.01');

    if (!editingPosition) return null;

    const ticker = tickers[editingPosition.symbol];
    const currentPrice = ticker?.price || editingPosition.open_price;
    const isLong = editingPosition.type.toLowerCase().includes('buy');

    const pnl = isLong
        ? (currentPrice - editingPosition.open_price) * editingPosition.volume * 100
        : (editingPosition.open_price - currentPrice) * editingPosition.volume * 100;

    const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const formatPnl = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)} USD`;

    const handleAdjust = (val: string, setVal: (v: string) => void, step: number) => {
        const current = parseFloat(val) || currentPrice;
        setVal((current + step).toFixed(3));
    };

    const calculateTargetPnl = (targetPriceStr: string) => {
        const target = parseFloat(targetPriceStr);
        if (isNaN(target)) return null;
        const diff = isLong ? target - editingPosition.open_price : editingPosition.open_price - target;
        const projected = diff * editingPosition.volume * 100;
        const points = Math.abs(target - editingPosition.open_price) * 1000; // Simplified points
        return { pnl: formatPnl(projected), points: points.toFixed(1) };
    };

    const slMetrics = useMemo(() => calculateTargetPnl(sl), [sl, editingPosition]);
    const tpMetrics = useMemo(() => calculateTargetPnl(tp), [tp, editingPosition]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="w-[420px] bg-[#1e222d] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-5 py-4 border-b border-zinc-800/50 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-400">💰</span>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white tracking-tight">{editingPosition.symbol}</span>
                                    <span className="text-[11px] text-zinc-500 font-bold">{editingPosition.volume} lô</span>
                                </div>
                                <div className="flex items-center gap-2 text-[12px]">
                                    <span className={cn("font-bold", isLong ? "text-blue-500" : "text-red-500")}>
                                        {isLong ? 'Mua' : 'Bán'}
                                    </span>
                                    <span className="text-zinc-500">ở mức giá {formatPrice(editingPosition.open_price)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={cn("text-sm font-black", pnl >= 0 ? "text-green-500" : "text-red-500")}>
                                {formatPnl(pnl)}
                            </span>
                            <button onClick={() => setEditingPosition(null)} className="text-zinc-500 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-zinc-500 font-bold">
                        <span>Giá hiện tại</span>
                        <span className="text-white">{formatPrice(currentPrice)}</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-4 py-2 border-b border-zinc-800/50 flex gap-1">
                    {[
                        { id: 'modify', label: 'Sửa đổi' },
                        { id: 'partial', label: 'Đóng một phần' },
                        { id: 'closeBy', label: 'Đóng lệnh theo' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "flex-1 py-2 text-[13px] font-bold rounded-lg transition-all",
                                activeTab === tab.id ? "bg-zinc-800/50 text-white border border-zinc-700/50 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-5 space-y-6 min-h-[220px]">
                    {activeTab === 'modify' && (
                        <div className="space-y-4">
                            {/* TP Input */}
                            <div className="space-y-2">
                                <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                                    <span>Chốt lời</span>
                                    <Info size={12} className="text-zinc-700" />
                                </label>
                                <div className="flex gap-1.5">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={tp}
                                            onChange={e => setTp(e.target.value)}
                                            placeholder="Chưa thiết lập"
                                            className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-medium placeholder:text-zinc-800"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-zinc-600 font-bold cursor-pointer hover:text-zinc-400">
                                            Giá <ChevronDown size={14} />
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleAdjust(tp, setTp, -1)} className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl text-zinc-400 border border-zinc-800/50 transition-colors"><Minus size={16} /></button>
                                        <button onClick={() => handleAdjust(tp, setTp, 1)} className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl text-zinc-400 border border-zinc-800/50 transition-colors"><Plus size={16} /></button>
                                    </div>
                                </div>
                                {tpMetrics && (
                                    <div className="flex gap-3 text-[10px] font-bold text-blue-400 ml-1">
                                        <span>{tpMetrics.pnl}</span>
                                        <span className="text-zinc-600">|</span>
                                        <span>{tpMetrics.points} điểm cơ bản</span>
                                    </div>
                                )}
                            </div>

                            {/* SL Input */}
                            <div className="space-y-2">
                                <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                                    <span>Cắt lỗ</span>
                                    <Info size={12} className="text-zinc-700" />
                                </label>
                                <div className="flex gap-1.5">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={sl}
                                            onChange={e => setSl(e.target.value)}
                                            placeholder="Chưa thiết lập"
                                            className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-medium placeholder:text-zinc-800"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-zinc-600 font-bold cursor-pointer hover:text-zinc-400">
                                            Giá <ChevronDown size={14} />
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleAdjust(sl, setSl, -1)} className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl text-zinc-400 border border-zinc-800/50 transition-colors"><Minus size={16} /></button>
                                        <button onClick={() => handleAdjust(sl, setSl, 1)} className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl text-zinc-400 border border-zinc-800/50 transition-colors"><Plus size={16} /></button>
                                    </div>
                                </div>
                                {slMetrics && (
                                    <div className="flex gap-3 text-[10px] font-bold text-red-400 ml-1">
                                        <span>{slMetrics.pnl}</span>
                                        <span className="text-zinc-600">|</span>
                                        <span>{slMetrics.points} điểm cơ bản</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'partial' && (
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <label className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Khối lượng để đóng</label>
                                <div className="flex gap-1.5">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={partialVolume}
                                            onChange={e => setPartialVolume(e.target.value)}
                                            className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-bold"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-zinc-700 font-bold uppercase">Lô</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => {
                                            const v = Math.max(0.01, (parseFloat(partialVolume) || 0) - 0.01);
                                            setPartialVolume(v.toFixed(2));
                                        }} className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl text-zinc-400 border border-zinc-800/50 transition-colors"><Minus size={16} /></button>
                                        <button onClick={() => {
                                            const v = Math.min(editingPosition.volume, (parseFloat(partialVolume) || 0) + 0.01);
                                            setPartialVolume(v.toFixed(2));
                                        }} className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl text-zinc-400 border border-zinc-800/50 transition-colors"><Plus size={16} /></button>
                                    </div>
                                </div>
                                <span className="text-[10px] text-zinc-600 font-bold ml-1">Min: 0.01 - Max: {editingPosition.volume}</span>
                            </div>
                            <div className="text-center pt-2">
                                <div className="text-[12px] text-zinc-500 font-bold">Lợi nhuận ước tính:</div>
                                <div className={cn("text-lg font-black", pnl >= 0 ? "text-green-500" : "text-red-500")}>
                                    {formatPnl(pnl * (parseFloat(partialVolume) || 0) / editingPosition.volume)}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'closeBy' && (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <span className="text-2xl">🔄</span>
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-white">Không có lệnh đảo ngược</h4>
                                <p className="text-[11px] text-zinc-500 leading-relaxed max-w-[280px]">
                                    Tính năng "Đóng lệnh theo" cho phép nhà giao dịch đóng hai lệnh bảo toàn rủi ro bằng cách hủy lẫn nhau.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-5 pt-0">
                    <button
                        onClick={() => setEditingPosition(null)}
                        className={cn(
                            "w-full py-4 rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]",
                            activeTab === 'modify' ? "bg-yellow-400 hover:bg-yellow-300 text-black" : "bg-zinc-100 hover:bg-white text-black"
                        )}>
                        {activeTab === 'modify' ? 'Sửa đổi lệnh giao dịch' : activeTab === 'partial' ? 'Đóng lệnh giao dịch' : 'Quay lại'}
                    </button>
                    <button
                        onClick={() => setEditingPosition(null)}
                        className="w-full mt-2 py-3 text-[11px] font-bold text-zinc-500 hover:text-white transition-colors"
                    >
                        Hủy
                    </button>
                </div>
            </div>
        </div>
    );
}
