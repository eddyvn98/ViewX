import React, { useState } from 'react';
import { VirtualPosition, PerformanceMetrics } from '../../types';
import { TrendingUp, TrendingDown, Clock, Hash, Percent, ChevronDown, ChevronUp } from 'lucide-react';
import { TradeDetailPanel } from './TradeDetailPanel';

interface Props {
    positions: VirtualPosition[];
    metrics?: PerformanceMetrics;
}

export function TradeHistory({ positions, metrics }: Props) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const closedPositions = [...positions]
        .filter(p => p.status === 'closed')
        .sort((a, b) => (b.exitTimestamp || 0) - (a.exitTimestamp || 0));

    if (closedPositions.length === 0) {
        return (
            <div className="bg-secondary/40 rounded-xl border border-border p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-secondary/60 flex items-center justify-center mb-4 border border-border">
                    <Clock size={24} className="text-muted-foreground" />
                </div>
                <h3 className="text-foreground font-bold mb-1 uppercase tracking-wider">No Trade History</h3>
                <p className="text-muted-foreground text-xs max-w-xs">Virtual positions will appear here once they are closed by your strategies.</p>
            </div>
        );
    }

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <Hash size={14} className="text-blue-500" />
                    Closed Sessions ({closedPositions.length})
                </span>
            </div>

            <div className="bg-secondary/40 rounded-xl border border-border overflow-hidden shadow-2xl flex flex-col">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                    <table className="w-full text-left border-collapse table-fixed md:table-auto">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-secondary/80 border-b border-border">
                                <th className="px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-tighter w-[35%] md:w-auto text-center w-8"></th>
                                <th className="px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-tighter w-[35%] md:w-auto">Time / Symbol</th>
                                <th className="px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-tighter w-[15%] md:w-auto">Type</th>
                                <th className="px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-tighter w-[10%] md:w-auto">Lot</th>
                                <th className="px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-tighter w-[10%] md:w-auto">Entry / Exit</th>
                                <th className="px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-tighter w-[15%] md:w-auto text-center">AI Conf.</th>
                                <th className="px-4 py-3 text-[9px] font-black text-muted-foreground uppercase tracking-tighter text-right w-[20%] md:w-auto">Profit (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {closedPositions.map((p) => (
                                <React.Fragment key={p.id}>
                                    <tr
                                        className={`hover:bg-white/[0.04] transition-all cursor-pointer group ${expandedId === p.id ? 'bg-white/[0.02]' : ''}`}
                                        onClick={() => toggleExpand(p.id)}
                                    >
                                        <td className="px-2 py-3 text-center">
                                            {expandedId === p.id ? (
                                                <ChevronUp size={14} className="text-blue-500" />
                                            ) : (
                                                <ChevronDown size={14} className="text-muted-foreground group-hover:text-blue-500" />
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-foreground group-hover:text-blue-500 transition-colors uppercase">{p.symbol}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground">
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
                                            <span className="text-[11px] font-mono font-bold text-foreground/80">{p.lotSize.toFixed(2)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-mono font-bold text-foreground/80">{p.entryPrice.toFixed(2)}</span>
                                                <span className="text-[10px] font-mono font-bold text-muted-foreground">{p.exitPrice?.toFixed(2)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {p.confidence ? (
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${p.confidence >= 80 ? 'bg-green-500/10 text-green-400' :
                                                        p.confidence >= 50 ? 'bg-yellow-500/10 text-yellow-400' :
                                                            'bg-red-500/10 text-red-400'
                                                        }`}>
                                                        {p.confidence.toFixed(0)}%
                                                    </span>
                                                    <span className="text-[7px] font-bold text-muted-foreground uppercase italic">Confidence</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground">-</span>
                                            )}
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
                                    {expandedId === p.id && (
                                        <tr>
                                            <td colSpan={6} className="p-0 border-b border-border/50">
                                                <TradeDetailPanel position={p} metrics={metrics} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
