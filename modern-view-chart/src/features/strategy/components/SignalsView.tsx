import React from 'react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { VirtualBalanceCard } from '@/features/strategy/components/VirtualBalanceCard';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';
import { History as HistoryIcon, Activity, X as XIcon } from 'lucide-react';


export function SignalsView() {
    const {
        signals,
        virtualPositions,
        closeVirtualPosition,
        cancelVirtualPosition,
    } = useStrategyStore();

    const tickers = useMarketStore(state => state.tickers);
    const symbolInfo = useMarketStore(state => state.symbolInfo);

    const activePositions = virtualPositions.filter(p => p.status === 'open' || p.status === 'pending');

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300 w-full">
            {/* VIRTUAL ACCOUNT DASHBOARD */}
            <VirtualBalanceCard />

            {/* ACTIVE POSITIONS SECTION */}
            {activePositions.length > 0 && (
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1.5">
                            <HistoryIcon size={12} /> Active ({activePositions.length})
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {activePositions.map((pos) => {
                            const ticker = tickers[pos.symbol];
                            const currentPrice = ticker?.price || pos.entryPrice;
                            const pnl = pos.status === 'open' ? calculatePnL({ type: pos.type.toLowerCase() as any, openPrice: pos.entryPrice, currentPrice, volume: pos.lotSize, symbol: pos.symbol, symbolInfo: symbolInfo[pos.symbol] }) : 0;
                            return (
                                <div key={pos.id} className="bg-[#131722] rounded-lg border border-[#2a2e39] overflow-hidden">
                                    <div className="flex items-center justify-between p-2.5 border-b border-[#2a2e39]/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-white">{pos.symbol}</span>
                                            <span className={`text-[9px] font-black px-1 rounded ${pos.type === 'BUY' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>{pos.type}</span>
                                        </div>
                                        <div className={`font-mono text-xs font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatPnL(pnl)}</div>
                                        <button onClick={() => pos.status === 'open' ? closeVirtualPosition(pos.strategyId, pos.symbol, currentPrice) : cancelVirtualPosition(pos.strategyId, pos.symbol)} className="text-[#4a4f5d] hover:text-red-500 transition-colors"><XIcon size={12} /></button>
                                    </div>
                                    <div className="grid grid-cols-3 p-2 text-[9px] text-[#787b86] bg-[#1e222d]/20">
                                        <div>Entry: <span className="text-white font-mono">{pos.entryPrice.toFixed(2)}</span></div>
                                        <div className="text-center">SL: <span className="text-red-400/80 font-mono">{pos.sl || '---'}</span></div>
                                        <div className="text-right">TP: <span className="text-green-400/80 font-mono">{pos.tp || '---'}</span></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SIGNAL HISTORY */}
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold text-[#787b86] uppercase tracking-widest flex items-center gap-1.5"><Activity size={12} /> Recent Signals</span>
                </div>
                <div className="flex flex-col gap-2">
                    {signals.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center gap-2">
                            <Activity size={32} />
                            <span className="text-[10px] uppercase font-bold tracking-tighter">No signals yet</span>
                        </div>
                    ) : (
                        signals.map((sig, i) => (
                            <div key={i} className={`bg-[#131722] p-3 rounded-lg border-l-2 ${sig.type === 'EXIT' ? 'border-orange-500' : 'border-green-500'} flex flex-col gap-1.5`}>
                                <div className="flex justify-between items-center text-[9px]">
                                    <span className={`font-black uppercase ${sig.type === 'EXIT' ? 'text-orange-400' : 'text-green-400'}`}>{sig.type} SIGNAL</span>
                                    <span className="text-[#4a4f5d]">{new Date(sig.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex justify-between items-center"><span className="text-xs font-bold text-white">{sig.symbol} @ {sig.price}</span><span className="text-[10px] text-[#787b86]">Vol: {typeof sig.risk.lotSize === 'object' ? (sig.risk.lotSize.mode === 'fixed' ? sig.risk.lotSize.value : sig.risk.lotSize.mode.toUpperCase()) : sig.risk.lotSize}</span></div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
