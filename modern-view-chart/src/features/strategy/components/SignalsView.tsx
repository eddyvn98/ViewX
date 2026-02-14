import React from 'react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { VirtualBalanceCard } from '@/features/strategy/components/VirtualBalanceCard';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';
import { History as HistoryIcon, Activity, X as XIcon, BrainCircuit, Loader2 } from 'lucide-react';
import { AiAnalyzer, AnalysisType } from '../logic/AiAnalyzer';
import { StatsService } from '../logic/StatsService';
import { ContextCollector } from '../logic/ContextCollector';
import { toast } from 'sonner';


export function SignalsView() {
    const {
        signals,
        virtualPositions,
        closeVirtualPosition,
        cancelVirtualPosition,
        updateSignal,
        updateStrategy,
    } = useStrategyStore();

    const [analyzingIndex, setAnalyzingIndex] = React.useState<number | null>(null);

    const handleManualAnalyze = async (index: number, signal: any) => {
        setAnalyzingIndex(index);
        try {
            const strategy = useStrategyStore.getState().strategies.find(s => s.id === signal.strategyId);
            if (!strategy) throw new Error("Strategy not found");

            const allCandleData = useMarketStore.getState().candleData;
            const tf = strategy.timeframe || '1m';
            const normSymbol = signal.symbol.toLowerCase().replace('m', '');

            // Search for matching data key (source:symbol:timeframe)
            const dataKey = Object.keys(allCandleData).find(k => {
                const parts = k.toLowerCase().split(':');
                if (parts.length < 2) return false;
                const s = parts[1];
                const t = parts[2] || '';
                return (s === normSymbol || s.includes(normSymbol)) &&
                    (t.replace('m', '') === tf.toLowerCase().replace('m', ''));
            });

            const candles = dataKey ? allCandleData[dataKey] : [];
            const stats = await StatsService.compute(signal.strategyId);
            const metrics = ContextCollector.captureEntryContext(strategy, candles, signal.symbol);

            // Map ContextCollector fields to what AiAnalyzer expects
            const aiMetrics = {
                spread: metrics.spread_at_entry || 0,
                volatility: metrics.volatility_atr || 0,
                trendStrength: metrics.mtf?.h1_trend === 'UP' ? 30 : 10,
                rsi: metrics.indicators_snapshot['RSI[14]'] || 50,
                session: metrics.session
            };

            const ai = await AiAnalyzer.analyzeSignal(strategy, signal, aiMetrics, stats, AnalysisType.PRE_TRADE);

            updateSignal(index, { ...signal, aiAnalysis: ai });
            toast.success(`AI Audit Complete: ${ai.confidence}% Confidence`);
        } catch (err) {
            console.error('[Signals] AI Analysis failed:', err);
            toast.error("AI Analysis failed");
        } finally {
            setAnalyzingIndex(null);
        }
    };

    const tickers = useMarketStore(state => state.tickers);
    const symbolInfo = useMarketStore(state => state.symbolInfo);

    const activePositions = virtualPositions.filter(p => p.status === 'open' || p.status === 'pending');

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300 w-full pb-4">
            {/* VIRTUAL ACCOUNT DASHBOARD */}
            <VirtualBalanceCard />

            {/* ACTIVE POSITIONS SECTION */}
            {activePositions.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1.5">
                            <HistoryIcon size={11} /> Active ({activePositions.length})
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                        {activePositions.map((pos) => {
                            const ticker = tickers[pos.symbol];
                            const currentPrice = ticker?.price || pos.entryPrice;
                            const pnl = pos.status === 'open' ? calculatePnL({ type: pos.type.toLowerCase() as any, openPrice: pos.entryPrice, currentPrice, volume: pos.lotSize, symbol: pos.symbol, symbolInfo: symbolInfo[pos.symbol] }) : 0;
                            return (
                                <div key={pos.id} className="bg-[#131722]/60 rounded-md border border-[#2a2e39]/50 overflow-hidden">
                                    <div className="flex items-center justify-between p-2 py-1.5 border-b border-[#2a2e39]/30">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-zinc-100">{pos.symbol}</span>
                                            <span className={`text-[8px] font-black px-1 rounded uppercase ${pos.type === 'BUY' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>{pos.type}</span>
                                            {pos.confidence && (
                                                <div className="flex items-center gap-1 bg-blue-500/5 px-1 py-0.5 rounded border border-blue-500/10">
                                                    <BrainCircuit size={9} className="text-blue-400/80" />
                                                    <span className="text-[8px] font-black text-blue-400/80">{pos.confidence.toFixed(0)}%</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`font-mono text-[10px] font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatPnL(pnl)}</div>
                                        <button onClick={() => pos.status === 'open' ? closeVirtualPosition(pos.strategyId, pos.symbol, currentPrice) : cancelVirtualPosition(pos.strategyId, pos.symbol)} className="text-[#4a4f5d] hover:text-red-500 transition-colors p-1"><XIcon size={11} /></button>
                                    </div>
                                    <div className="grid grid-cols-3 px-2 py-1 text-[8px] text-[#787b86] bg-[#1e222d]/10">
                                        <div>Entry: <span className="text-zinc-300 font-mono">{pos.entryPrice.toFixed(2)}</span></div>
                                        <div className="text-center">SL: <span className="text-red-500/60 font-mono">{pos.sl || '---'}</span></div>
                                        <div className="text-right">TP: <span className="text-green-500/60 font-mono">{pos.tp || '---'}</span></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SIGNAL HISTORY */}
            <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center px-1">
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-1.5"><Activity size={10} /> RECENT SIGNALS</span>
                    <div className="h-[1px] bg-white/5 flex-1 ml-4" />
                </div>
                <div className="flex flex-col gap-1.5">
                    {signals.length === 0 ? (
                        <div className="py-8 flex flex-col items-center justify-center opacity-10 text-center gap-2">
                            <Activity size={20} />
                            <span className="text-[8px] uppercase font-black tracking-widest">No Active signals</span>
                        </div>
                    ) : (
                        signals.map((sig, i) => (
                            <div key={i} className={`bg-[#131722]/30 p-2 py-1.5 rounded border border-white/5 border-l-2 ${sig.type === 'EXIT' ? 'border-orange-500/40' : 'border-green-500/40'} flex flex-col gap-0.5 group hover:bg-[#131722]/50 transition-colors`}>
                                <div className="flex justify-between items-center text-[7px]">
                                    <span className={`font-black uppercase tracking-tight ${sig.type === 'EXIT' ? 'text-orange-500/60' : 'text-green-500/60'}`}>{sig.type} SIGNAL</span>
                                    <div className="flex items-center gap-2">
                                        {sig.aiAnalysis?.confidence ? (
                                            <div className="flex items-center gap-1 bg-blue-500/5 px-1 py-0.5 rounded border border-blue-500/10">
                                                <BrainCircuit size={9} className="text-blue-400/80" />
                                                <span className="text-[8px] font-black text-blue-400/80">{sig.aiAnalysis.confidence.toFixed(0)}%</span>
                                            </div>
                                        ) : sig.type !== 'EXIT' ? (
                                            <button
                                                onClick={() => handleManualAnalyze(i, sig)}
                                                disabled={analyzingIndex === i}
                                                className="flex items-center gap-1 text-[7px] font-black text-blue-500/40 hover:text-blue-400 uppercase tracking-tighter bg-blue-500/5 px-1 py-0.5 rounded border border-dashed border-blue-500/20 disabled:opacity-50 transition-all"
                                            >
                                                {analyzingIndex === i ? <Loader2 size={8} className="animate-spin" /> : <BrainCircuit size={8} />}
                                                {analyzingIndex === i ? 'thinking...' : 'audit'}
                                            </button>
                                        ) : null}
                                        <span className="text-zinc-800 font-bold group-hover:text-zinc-600 transition-colors">{new Date(sig.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pr-1 h-5">
                                    <span className="text-[11px] font-bold text-zinc-300">{sig.symbol} @ <span className="font-mono text-zinc-100">{sig.price}</span></span>
                                    <span className="text-[8px] font-black text-zinc-800 uppercase group-hover:text-zinc-700 transition-colors">V: {typeof sig.risk.lotSize === 'object' ? (sig.risk.lotSize.mode === 'fixed' ? sig.risk.lotSize.value : sig.risk.lotSize.mode.toUpperCase()) : sig.risk.lotSize}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
