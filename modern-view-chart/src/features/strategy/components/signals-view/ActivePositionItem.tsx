import React from 'react';
import { BrainCircuit, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VirtualPosition } from '@/features/strategy/types';

interface ActivePositionItemProps {
    position: VirtualPosition;
    currentPrice: number;
    pnl: number;
    aiGuardEnabled: boolean;
    buyLabel: string;
    sellLabel: string;
    onCloseOrCancel: (position: VirtualPosition, currentPrice: number) => void;
}

export function ActivePositionItem({
    position,
    currentPrice,
    pnl,
    aiGuardEnabled,
    buyLabel,
    sellLabel,
    onCloseOrCancel,
}: ActivePositionItemProps) {
    const isBuy = position.type === 'BUY';

    return (
        <div className="relative group overflow-hidden rounded-xl border border-border dark:border-white/5 bg-secondary/50 dark:bg-white/[0.03] transition-all hover:bg-secondary/70 dark:hover:bg-white/[0.05] shadow-sm">
            <div className={cn('absolute inset-y-0 left-0 w-1 rounded-l-xl z-20', isBuy ? 'bg-primary shadow-sm' : 'bg-rose-500 shadow-sm')} />

            <div className="flex items-center justify-between px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-foreground dark:text-white tracking-tight">{position.symbol}</span>
                    <span
                        className={cn(
                            'text-[8px] font-bold px-1 py-0.25 rounded uppercase border',
                            isBuy ? 'bg-primary/10 text-primary border-primary/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        )}
                    >
                        {isBuy ? buyLabel : sellLabel}
                    </span>
                    {position.timeframe && (
                        <span className="text-[9px] font-black text-muted-foreground/50 uppercase bg-secondary/50 px-1 rounded-sm border border-border/30 leading-none h-3.5 flex items-center">
                            {position.timeframe}
                        </span>
                    )}
                    {position.confidence && aiGuardEnabled && (
                        <div className="flex items-center gap-0.5 text-primary/60">
                            <BrainCircuit size={8} />
                            <span className="text-[8px] font-bold">{position.confidence.toFixed(0)}%</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className={cn('font-mono text-[12px] font-bold', pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                        {pnl >= 0 ? '+' : ''}
                        {pnl.toFixed(2)}
                    </div>
                    <button
                        onClick={() => onCloseOrCancel(position, currentPrice)}
                        className="p-1 rounded hover:bg-white/5 text-muted-foreground/30 hover:text-foreground transition-colors"
                    >
                        <XIcon size={12} />
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between px-2.5 py-1 text-[9px] text-muted-foreground bg-secondary/30 dark:bg-black/20 border-t border-border/30 dark:border-white/5">
                <div className="flex gap-4">
                    <div className="flex items-baseline gap-1">
                        <span className="text-[7px] uppercase font-black text-muted-foreground/50">GIA</span>
                        <span className="font-mono font-bold text-[10px] text-foreground">{position.entryPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[7px] uppercase font-black text-rose-500/40">SL</span>
                        <span className="text-rose-500 font-mono font-bold text-[10px]">{position.sl ? Number(position.sl).toFixed(2) : '--'}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[7px] uppercase font-black text-emerald-500/40">TP</span>
                        <span className="text-emerald-500 font-mono font-bold text-[10px]">{position.tp ? Number(position.tp).toFixed(2) : '--'}</span>
                    </div>
                </div>
                <span className="text-[8px] font-black text-muted-foreground/60">{position.lotSize} LOTS</span>
            </div>
        </div>
    );
}
