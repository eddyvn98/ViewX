import React from 'react';
import type { StrategySignal, VirtualPosition } from '@/features/strategy/types';
import type { SignalWithIndex } from './types';
import { SignalHistoryItem } from './SignalHistoryItem';

interface SignalHistoryListProps {
    filteredSignals: SignalWithIndex[];
    virtualPositions: VirtualPosition[];
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
    virtualPositions,
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
            <div className="py-3 text-center text-[11px] text-muted-foreground/40 font-bold uppercase tracking-wider">
                {noRecentSignalsLabel}
            </div>
        );
    }

    return (
        <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-1.5">
            {filteredSignals.map(({ sig, index }) => {
                let linkedPosition: VirtualPosition | undefined;
                if (sig.type === 'BUY' || sig.type === 'SELL') {
                    // Try to match the position created for this entry
                    linkedPosition = virtualPositions.find(p => 
                        p.strategyId === sig.strategyId &&
                        p.symbol === sig.symbol &&
                        p.type === sig.type &&
                        (sig.barTime ? p.openedBarTime === sig.barTime : p.openedBarTime === sig.timestamp)
                    );
                }

                return (
                    <SignalHistoryItem
                        key={`${sig.strategyId}-${sig.timestamp}-${index}`}
                        signal={sig}
                        signalIndex={index}
                        linkedPosition={linkedPosition}
                        isAnalyzing={analyzingIndex === index}
                        aiGuardEnabled={aiGuardStrategyIds.has(sig.strategyId)}
                        buyLabel={buyLabel}
                        sellLabel={sellLabel}
                        exitLabel={exitLabel}
                        onManualAnalyze={onManualAnalyze}
                    />
                );
            })}
        </div>
    );
}
