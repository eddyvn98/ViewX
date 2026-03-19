'use client';

import { cn } from '@/lib/utils';

type TerminalTab = 'positions' | 'orders' | 'history';

type TerminalFooterProps = {
    forceExpanded: boolean;
    terminalTab: TerminalTab;
    setTerminalTab: (value: TerminalTab) => void;
    visiblePositions: number;
    visibleOrders: number;
};

export function TerminalFooter({
    forceExpanded,
    terminalTab,
    setTerminalTab,
    visiblePositions,
    visibleOrders,
}: TerminalFooterProps) {
    return (
        <div className={cn('shrink-0 border-t border-border/10 bg-background/20', forceExpanded ? 'p-1' : 'px-2 pb-0.5')}>
            <div className="flex items-center gap-6">
                {(['positions', 'orders', 'history'] as TerminalTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setTerminalTab(tab)}
                        className={cn(
                            'pt-0.5 pb-0.5 text-[11px] font-black uppercase tracking-widest transition-all relative group',
                            terminalTab === tab ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'
                        )}
                    >
                        <span className="relative z-10">
                            {tab === 'positions'
                                ? `Positions (${visiblePositions})`
                                : tab === 'orders'
                                ? `Orders (${visibleOrders})`
                                : 'History'}
                        </span>
                        {terminalTab === tab && (
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary rounded-b-full shadow-glow" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
