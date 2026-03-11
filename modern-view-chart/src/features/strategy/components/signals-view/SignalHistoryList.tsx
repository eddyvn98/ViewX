import React from 'react';
import type { StrategySignal } from '@/features/strategy/types';
import type { SignalWithIndex } from './types';
import { SignalHistoryItem } from './SignalHistoryItem';

interface SignalHistoryListProps {
    filteredSignals: SignalWithIndex[];
    analyzingIndex: number | null;
    aiGuardStrategyIds: Set<string>;
    noRecentSignalsLabel: string;
    buyLabel: string;
    sellLabel: string;
    exitLabel: string;
    onManualAnalyze: (signalIndex: number, signal: StrategySignal) => void;
}

export function SignalHistoryList({
    filteredSignals,
    analyzingIndex,
    aiGuardStrategyIds,
    noRecentSignalsLabel,
    buyLabel,
    sellLabel,
    exitLabel,
    onManualAnalyze,
}: SignalHistoryListProps) {
    if (filteredSignals.length === 0) {
        return (
            <div className="py-3 text-center text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">
                {noRecentSignalsLabel}
            </div>
        );
    }

    return (
        <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-1.5">
            {filteredSignals.map(({ sig, index }) => (
                <SignalHistoryItem
                    key={`${sig.strategyId}-${sig.timestamp}-${index}`}
                    signal={sig}
                    signalIndex={index}
                    isAnalyzing={analyzingIndex === index}
                    aiGuardEnabled={aiGuardStrategyIds.has(sig.strategyId)}
                    buyLabel={buyLabel}
                    sellLabel={sellLabel}
                    exitLabel={exitLabel}
                    onManualAnalyze={onManualAnalyze}
                />
            ))}
        </div>
    );
}
