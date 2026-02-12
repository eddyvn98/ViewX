import React from 'react';
import { VirtualPosition } from '../../types';
import { TrendingUp, TrendingDown, Clock, Hash, Percent } from 'lucide-react';

interface Props {
    positions: VirtualPosition[];
}

export function TradeHistory({ positions }: Props) {
    const closedPositions = [...positions]
        .filter(p => p.status === 'closed')
        .sort((a, b) => (b.exitTimestamp || 0) - (a.exitTimestamp || 0));

    if (closedPositions.length === 0) {
        return (
            <div className="bg-[#1e222d] rounded-xl border border-[#363a45] p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#131722] flex items-center justify-center mb-4 border border-[#363a45]">
                    <Clock size={24} className="text-[#4a4f5d]" />
                </div>
                <h3 className="text-white font-bold mb-1 uppercase tracking-wider">No Trade History</h3>
                <p className="text-[#787b86] text-xs max-w-xs">Virtual positions will appear here once they are closed by your strategies.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Hash size={14} className="text-blue-500" />
                    Closed Sessions ({closedPositions.length})
                </span>
            </div>

            <div className="bg-[#1e222d] rounded-xl border border-[#363a45] overflow-hidden shadow-2xl flex flex-col">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                    <table className="w-full text-left border-collapse table-fixed md:table-auto">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#131722] border-b border-[#363a45]">
                                <th className="px-4 py-3 text-[9px] font-black text-[#787b86] uppercase tracking-tighter w-[35%] md:w-auto">Time / Symbol</th>
                                <th className="px-4 py-3 text-[9px] font-black text-[#787b86] uppercase tracking-tighter w-[15%] md:w-auto">Type</th>
                                <th className="px-4 py-3 text-[9px] font-black text-[#787b86] uppercase tracking-tighter w-[10%] md:w-auto">Lot</th>
                                <th className="px-4 py-3 text-[9px] font-black text-[#787b86] uppercase tracking-tighter w-[20%] md:w-auto">Entry / Exit</th>
                                <th className="px-4 py-3 text-[9px] font-black text-[#787b86] uppercase tracking-tighter text-right w-[20%] md:w-auto">Profit (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#363a45]/30">
                            {closedPositions.map((p) => (
                                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-white group-hover:text-blue-400 transition-colors uppercase">{p.symbol}</span>
                                            <span className="text-[9px] font-bold text-[#4a4f5d]">
                                                {new Date(p.exitTimestamp || 0).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${p.type === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'} uppercase`}>
                                            {p.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[11px] font-mono font-bold text-[#d1d4dc]">{p.lotSize.toFixed(2)}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-mono font-bold text-[#d1d4dc]">{p.entryPrice.toFixed(2)}</span>
                                            <span className="text-[10px] font-mono font-bold text-[#4a4f5d]">{p.exitPrice?.toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className={`flex flex-col items-end`}>
                                            <span className={`text-[11px] font-mono font-black ${(p.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {(p.pnl || 0) >= 0 ? '+' : ''}${Math.abs(p.pnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className={`text-[9px] font-bold ${(p.pnl || 0) >= 0 ? 'text-green-500/50' : 'text-red-500/50'}`}>
                                                {((p.pnl || 0) / 10000 * 100).toFixed(2)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
