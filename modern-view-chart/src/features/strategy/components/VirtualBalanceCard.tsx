import React from 'react';
import { History, Maximize2, Trash2 } from 'lucide-react';
import { useStrategyStore } from '../store/strategy-store';

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
        <div className="bg-[#131722] p-2.5 rounded-lg border border-blue-500/10 flex flex-col gap-2 shadow-lg shadow-black/40">
            {/* Header: Compact Balance & Performance */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[7px] font-black text-[#5d606b] uppercase tracking-widest">Equity</span>
                    <div className="flex items-baseline gap-1 focus-within:text-blue-400 transition-colors">
                        <span className="text-sm font-mono font-black text-white select-none">$</span>
                        <input
                            type="number"
                            value={virtualBalance === 0 ? '' : Number(virtualBalance).toFixed(2)}
                            onChange={(e) => setVirtualBalance(parseFloat(e.target.value) || 0)}
                            className="bg-transparent border-none outline-none text-base font-mono font-black text-white w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0.00"
                            step="0.01"
                        />
                    </div>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-[7px] font-bold text-[#4a4f5d] uppercase">24h Gain</span>
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-mono font-bold ${(virtualBalance - initialVirtualBalance) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {(((virtualBalance - initialVirtualBalance) / initialVirtualBalance) * 100).toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Compact Action Bar in one row */}
            <div className="flex gap-1 pt-1.5 border-t border-[#363a45]/20">
                <button
                    onClick={openDashboard}
                    className="flex-1 h-6 flex items-center justify-center gap-1.5 rounded bg-blue-500/5 hover:bg-blue-500/10 text-[#787b86] hover:text-blue-400 text-[8px] font-bold uppercase transition-all border border-[#363a45]/30 active:scale-95 group"
                >
                    <Maximize2 size={9} />
                    DASHBOARD
                </button>
                <button
                    onClick={handleAction}
                    className={`flex-1 h-6 flex items-center justify-center gap-1.5 rounded text-[8px] font-bold uppercase transition-all active:scale-95 ${confirmAction === 'all'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-500/5 text-red-500/60 hover:text-red-500 border border-red-500/10 hover:border-red-500/30'
                        }`}
                >
                    <Trash2 size={9} className={confirmAction === 'all' ? 'animate-pulse text-white' : 'opacity-50'} />
                    {confirmAction === 'all' ? 'CONFIRM' : 'RESET'}
                </button>
            </div>
        </div>
    );
}
