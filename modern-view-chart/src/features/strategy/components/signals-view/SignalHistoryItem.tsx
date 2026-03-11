import React from 'react';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StrategySignal } from '@/features/strategy/types';

interface SignalHistoryItemProps {
    signal: StrategySignal;
    signalIndex: number;
    isAnalyzing: boolean;
    aiGuardEnabled: boolean;
    buyLabel: string;
    sellLabel: string;
    exitLabel: string;
    onManualAnalyze: (signalIndex: number, signal: StrategySignal) => void;
}

export function SignalHistoryItem({
    signal,
    signalIndex,
    isAnalyzing,
    aiGuardEnabled,
    buyLabel,
    sellLabel,
    exitLabel,
    onManualAnalyze,
}: SignalHistoryItemProps) {
    const isExit = signal.type === 'EXIT';
    const isSell = signal.type === 'SELL';

    return (
        <div className="p-2 rounded-lg border border-border/40 dark:border-white/5 bg-secondary/30 dark:bg-white/[0.01] transition-all hover:bg-secondary/50 dark:hover:bg-white/[0.03] group relative flex items-center justify-between gap-3 shadow-sm">
            <div
                className={cn(
                    'absolute inset-y-0 left-0 w-0.5 opacity-30 group-hover:opacity-100 transition-all',
                    isExit ? 'bg-orange-500 shadow-sm' : isSell ? 'bg-rose-500 shadow-sm' : 'bg-primary shadow-sm'
                )}
            />

            <div className="flex items-center gap-3">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                        <span
                            className={cn(
                                'font-black uppercase text-[7px] px-1 rounded-sm',
                                isExit
                                    ? 'text-orange-500 bg-orange-400/10'
                                    : isSell
                                        ? 'text-rose-500 bg-rose-400/10'
                                        : 'text-primary bg-primary/10'
                            )}
                        >
                            {isExit ? exitLabel : isSell ? sellLabel : buyLabel}
                        </span>
                        <span className="text-[12px] font-bold text-foreground leading-none">{signal.symbol}</span>
                        <span className="text-[10px] font-bold text-foreground/70 font-mono tracking-tighter">@{signal.price}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase">
                            {new Date(signal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[8px] font-bold text-muted-foreground/40 italic tracking-tighter">
                            {typeof signal.risk.lotSize === 'object'
                                ? signal.risk.lotSize.mode === 'fixed'
                                    ? signal.risk.lotSize.value
                                    : 'AUTO'
                                : signal.risk.lotSize}{' '}
                            LOTS
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {signal.aiAnalysis?.confidence && aiGuardEnabled ? (
                    <div className="flex items-center gap-1 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                        <BrainCircuit size={10} className="text-primary/50" />
                        <span className="text-[8px] font-black text-primary/70">{signal.aiAnalysis.confidence.toFixed(0)}%</span>
                    </div>
                ) : !isExit ? (
                    <button
                        onClick={() => onManualAnalyze(signalIndex, signal)}
                        disabled={isAnalyzing}
                        className="opacity-0 group-hover:opacity-100 transition-all p-1 text-primary hover:text-white bg-primary/10 hover:bg-primary rounded border border-primary/20"
                    >
                        {isAnalyzing ? <Loader2 size={10} className="animate-spin" /> : <BrainCircuit size={10} />}
                    </button>
                ) : null}
            </div>
        </div>
    );
}
