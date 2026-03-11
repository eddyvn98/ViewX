import React from 'react';
import { cn } from '@/lib/utils';
import type { SignalRange } from './types';

interface SignalRangeTabsProps {
    selectedRange: SignalRange;
    onSelectRange: (range: SignalRange) => void;
    labels: Record<SignalRange, string>;
}

export function SignalRangeTabs({ selectedRange, onSelectRange, labels }: SignalRangeTabsProps) {
    const tabs: SignalRange[] = ['day', 'week', 'month'];

    return (
        <div className="flex items-center gap-1 rounded-lg border border-border/40 dark:border-white/5 bg-secondary/20 dark:bg-white/[0.01] p-1">
            {tabs.map((tab) => (
                <button
                    key={tab}
                    onClick={() => onSelectRange(tab)}
                    className={cn(
                        'flex-1 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors',
                        selectedRange === tab
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground/70 hover:bg-secondary/60 dark:hover:bg-white/[0.04]'
                    )}
                >
                    {labels[tab]}
                </button>
            ))}
        </div>
    );
}
