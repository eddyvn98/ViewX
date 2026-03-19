import React from 'react';
import { History, Maximize2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useStrategyStore } from '../store/strategy-store';
import { cn } from '@/lib/utils';

export function VirtualBalanceCard() {
    const t = useTranslations('Signals');
    const { virtualBalance, initialVirtualBalance, lastBacktestPnL, backtestCount, setVirtualBalance, resetVirtualAccount } = useStrategyStore();
    const [mounted, setMounted] = React.useState(false);
    const [confirmAction, setConfirmAction] = React.useState<'balance' | 'all' | null>(null);

    React.useEffect(() => {
        setMounted(true);
        if (confirmAction) {
            const timer = setTimeout(() => setConfirmAction(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [confirmAction]);

    const handleAction = () => {
        if (confirmAction === 'all') {
            resetVirtualAccount();
            setConfirmAction(null);
        } else {
            setConfirmAction('all');
        }
    };

    const openDashboard = () => {
        window.open('/strategy/dashboard', '_blank');
    };

    const isProfit = (virtualBalance - initialVirtualBalance) >= 0;

    return (
        <div className="bg-secondary/10 dark:bg-white/[0.01] p-1.5 px-2 rounded-lg border border-border/30 dark:border-white/5 flex items-center justify-between gap-2 backdrop-blur-sm group">

            {/* Left: Info */}
            <div className="flex items-center gap-2">
                <div className={cn("w-0.5 h-6 rounded-full", isProfit ? "bg-emerald-500" : "bg-rose-500")} />

                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 leading-none">
                        <span className={cn(
                            "text-[6px] font-black px-0.5 rounded-[1px] uppercase tracking-tighter",
                            isProfit ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                        )}>
                            {t('virtualBalance')}
                        </span>
                        {backtestCount > 0 && (
                            <span className="text-[6px] font-bold text-muted-foreground/30 uppercase tracking-[0.1em] flex items-center gap-0.5">
                                <History size={6} /> {backtestCount} BT
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[12px] font-bold text-foreground tracking-tight leading-none">
                            {mounted
                                ? `$${Number(virtualBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `$${Number(virtualBalance).toFixed(2)}`
                            }
                        </span>
                        <span className={cn(
                            "text-[11px] font-bold",
                            isProfit ? "text-emerald-500" : "text-rose-500"
                        )}>
                            {isProfit ? '+' : ''}{(((virtualBalance - initialVirtualBalance) / initialVirtualBalance) * 100).toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={openDashboard}
                    className="p-1 px-2 bg-primary/10 hover:bg-primary/20 text-primary rounded ring-1 ring-primary/10 text-[11px] font-black uppercase tracking-widest transition-all"
                >
                    INFO
                </button>

                <button
                    onClick={handleAction}
                    className={cn(
                        "p-1 rounded transition-all",
                        confirmAction === 'all'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-500/10'
                    )}
                >
                    <Trash2 size={10} />
                </button>
            </div>
        </div>
    );
}

