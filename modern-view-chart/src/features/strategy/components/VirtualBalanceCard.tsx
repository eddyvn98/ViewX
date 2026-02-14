import React from 'react';
import { History, Maximize2, Trash2 } from 'lucide-react';
import { useStrategyStore } from '../store/strategy-store';
import { cn } from '@/lib/utils';

export function VirtualBalanceCard() {
    const { virtualBalance, initialVirtualBalance, setVirtualBalance, resetVirtualBalance, resetVirtualAccount } = useStrategyStore();
    const [confirmAction, setConfirmAction] = React.useState<'balance' | 'all' | null>(null);

    // Auto-cancel confirmation after 3 seconds
    React.useEffect(() => {
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

    return (
        <div className="bg-secondary/20 dark:bg-white/[0.02] p-2 rounded-lg border border-border/40 dark:border-white/5 flex items-center justify-between gap-3 backdrop-blur-sm">

            {/* Left: Balance & PnL */}
            <div className="flex items-center gap-3">
                <div className={cn("w-1 h-8 rounded-full opacity-80", (virtualBalance - initialVirtualBalance) >= 0 ? "bg-emerald-500" : "bg-rose-500")} />

                <div className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-1 group/input">
                        <span className="text-[10px] font-bold text-muted-foreground">$</span>
                        <input
                            type="number"
                            value={virtualBalance === 0 ? '' : Number(virtualBalance).toFixed(2)}
                            onChange={(e) => setVirtualBalance(parseFloat(e.target.value) || 0)}
                            className="bg-transparent border-none outline-none text-[13px] font-bold text-foreground w-[80px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none tracking-tight leading-none"
                            placeholder="0.00"
                            step="0.01"
                        />
                    </div>
                    <span className={cn(
                        "text-[9px] font-bold",
                        (virtualBalance - initialVirtualBalance) >= 0
                            ? "text-emerald-500"
                            : "text-rose-500"
                    )}>
                        {(virtualBalance - initialVirtualBalance) >= 0 ? '+' : ''}
                        {(((virtualBalance - initialVirtualBalance) / initialVirtualBalance) * 100).toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
                <button
                    onClick={openDashboard}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors border border-primary/10"
                    title="Open Dashboard"
                >
                    <Maximize2 size={11} /> Dashboard
                </button>

                <button
                    onClick={handleAction}
                    className={cn(
                        "p-1.5 rounded-md transition-all border border-transparent",
                        confirmAction === 'all'
                            ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                            : 'text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10'
                    )}
                    title={confirmAction === 'all' ? "Confirm Reset" : "Reset Account"}
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
}
