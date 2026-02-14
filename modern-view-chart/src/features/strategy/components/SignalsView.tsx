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
import { cn } from '@/lib/utils';


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
        <div className="flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-500 w-full pb-6 px-3">
            {/* VIRTUAL ACCOUNT DASHBOARD */}
            <VirtualBalanceCard />

            {/* ACTIVE POSITIONS SECTION */}
            {activePositions.length > 0 && (
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-2 drop-shadow-sm">
                            <Activity size={14} className="text-primary" /> Active trade ({activePositions.length})
                        </span>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/10 to-transparent ml-4 opacity-50" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {activePositions.map((pos) => {
                            const ticker = tickers[pos.symbol];
                            const currentPrice = ticker?.price || pos.entryPrice;
                            const pnl = pos.status === 'open' ? calculatePnL({ type: pos.type.toLowerCase() as any, openPrice: pos.entryPrice, currentPrice, volume: pos.lotSize, symbol: pos.symbol, symbolInfo: symbolInfo[pos.symbol] }) : 0;
                            const isBuy = pos.type === 'BUY';

                            return (
                                <div key={pos.id} className="relative group overflow-hidden rounded-xl border border-border dark:border-white/5 bg-secondary/50 dark:bg-white/[0.03] transition-all hover:bg-secondary/70 dark:hover:bg-white/[0.05] shadow-sm">
                                    <div className={cn("absolute inset-y-0 left-0 w-1 rounded-l-xl z-20", isBuy ? "bg-blue-500 shadow-[2px_0_8px_rgba(59,130,246,0.2)]" : "bg-rose-500 shadow-[2px_0_8px_rgba(244,63,94,0.2)]")} />

                                    <div className="flex items-center justify-between px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-foreground dark:text-white tracking-tight leading-none">{pos.symbol}</span>
                                                <span className="text-[9px] font-medium text-muted-foreground uppercase opacity-60 mt-0.5">MT5 Broker</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 ml-1">
                                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-lg uppercase border", isBuy ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20")}>{pos.type}</span>
                                                {pos.confidence && (
                                                    <div className="flex items-center gap-1 bg-primary/5 px-1.5 py-0.5 rounded-lg border border-primary/10">
                                                        <BrainCircuit size={10} className="text-primary/70" />
                                                        <span className="text-[9px] font-bold text-primary/80">{pos.confidence.toFixed(0)}%</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={cn("font-mono text-[14px] font-bold drop-shadow-sm", pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                                                <span className="text-[9px] ml-1 opacity-60">USD</span>
                                            </div>
                                            <button
                                                onClick={() => pos.status === 'open' ? closeVirtualPosition(pos.strategyId, pos.symbol, currentPrice) : cancelVirtualPosition(pos.strategyId, pos.symbol)}
                                                className="p-1 rounded-lg hover:bg-white/5 text-muted-foreground/40 hover:text-foreground transition-colors"
                                            >
                                                <XIcon size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] text-muted-foreground bg-secondary/30 dark:bg-black/20 border-t border-border/30 dark:border-white/5">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-[8px] uppercase font-bold opacity-40">Ent</span>
                                            <span className="text-foreground dark:text-white font-mono font-bold text-[11px]">{pos.entryPrice.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-baseline justify-center gap-1.5 border-x border-border/20 dark:border-white/5">
                                            <span className="text-[8px] uppercase font-bold opacity-40">SL</span>
                                            <span className="text-rose-500 dark:text-rose-400 font-mono font-bold text-[11px]">{pos.sl || '---'}</span>
                                        </div>
                                        <div className="flex items-baseline justify-end gap-1.5">
                                            <span className="text-[8px] uppercase font-bold opacity-40">TP</span>
                                            <span className="text-emerald-500 dark:text-emerald-400 font-mono font-bold text-[11px]">{pos.tp || '---'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SIGNAL HISTORY */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-2 drop-shadow-sm">
                        <HistoryIcon size={14} className="text-muted-foreground/40" /> Recent signals
                    </span>
                    <div className="h-[px] flex-1 bg-gradient-to-r from-muted-foreground/10 to-transparent ml-4 opacity-50" />
                </div>

                <div className="flex flex-col gap-2.5">
                    {signals.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center opacity-10 text-center gap-3">
                            <Activity size={32} />
                            <span className="text-[11px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Monitoring Market Signals</span>
                        </div>
                    ) : (
                        signals.map((sig, i) => {
                            const isExit = sig.type === 'EXIT';
                            const isSell = sig.type === 'SELL';
                            const isBuy = sig.type === 'BUY';

                            return (
                                <div key={i} className="p-3.5 rounded-xl border border-border dark:border-white/5 bg-secondary/50 dark:bg-white/[0.03] transition-all hover:bg-secondary/70 dark:hover:bg-white/[0.05] group relative overflow-hidden shadow-sm">
                                    <div className={cn(
                                        "absolute inset-y-0 left-0 w-1 opacity-40 group-hover:opacity-100 transition-opacity",
                                        isExit ? "bg-orange-500" : (isSell ? "bg-rose-500" : "bg-emerald-500")
                                    )} />

                                    <div className="flex justify-between items-center text-[10px] mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-lg text-[9px]",
                                                isExit ? "text-orange-500 bg-orange-400/10" : (isSell ? "text-rose-500 bg-rose-400/10" : "text-emerald-500 bg-emerald-400/10")
                                            )}>{sig.type} SIGNAL</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {sig.aiAnalysis?.confidence ? (
                                                <div className="flex items-center gap-1.5 bg-secondary px-2 py-0.5 rounded-lg border border-border/50">
                                                    <BrainCircuit size={10} className="text-muted-foreground/60" />
                                                    <span className="text-[10px] font-bold text-muted-foreground/80">{sig.aiAnalysis.confidence.toFixed(0)}% AI Audit</span>
                                                </div>
                                            ) : !isExit ? (
                                                <button
                                                    onClick={() => handleManualAnalyze(i, sig)}
                                                    disabled={analyzingIndex === i}
                                                    className="flex items-center gap-2 text-[10px] font-bold text-primary hover:text-white transition-all bg-primary/10 hover:bg-primary px-3 py-1 rounded-lg border border-primary/20 disabled:opacity-50"
                                                >
                                                    {analyzingIndex === i ? <Loader2 size={10} className="animate-spin" /> : <BrainCircuit size={10} />}
                                                    {analyzingIndex === i ? 'Processing...' : 'AI Audit'}
                                                </button>
                                            ) : null}
                                            <span className="text-muted-foreground/50 font-bold group-hover:text-muted-foreground transition-all">{new Date(sig.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end">
                                        <div className="flex flex-col">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-[16px] font-bold text-foreground dark:text-white leading-none tracking-tight">{sig.symbol}</span>
                                                <span className="text-muted-foreground/50 text-[11px] font-bold">@</span>
                                                <span className="text-[14px] font-bold text-foreground/80 dark:text-foreground font-mono leading-none">{sig.price}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-wider group-hover:text-muted-foreground/60 transition-colors">Volume profile</span>
                                            <span className="text-[11px] font-bold text-foreground dark:text-white/80 uppercase">
                                                {typeof sig.risk.lotSize === 'object' ? (sig.risk.lotSize.mode === 'fixed' ? sig.risk.lotSize.value : sig.risk.lotSize.mode.toUpperCase()) : sig.risk.lotSize} lots
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
