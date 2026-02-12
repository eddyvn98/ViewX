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

    const handleAction = (type: 'balance' | 'all') => {
        if (confirmAction === type) {
            if (type === 'balance') resetVirtualBalance();
            else resetVirtualAccount();
            setConfirmAction(null);
        } else {
            setConfirmAction(type);
        }
    };

    const openDashboard = () => {
        window.open('/strategy/dashboard', '_blank');
    };

    return (
        <div className="bg-[#131722] p-3 rounded-lg border border-blue-500/10 flex flex-col gap-3 shadow-lg shadow-black/40">
            {/* Header: Compact Balance & Performance */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-[#5d606b] uppercase tracking-widest">Virtual Equity</span>
                    <div className="flex items-baseline gap-1.5 focus-within:text-blue-400 transition-colors">
                        <span className="text-lg font-mono font-black text-white select-none">$</span>
                        <input
                            type="number"
                            value={virtualBalance === 0 ? '' : Number(virtualBalance).toFixed(2)}
                            onChange={(e) => setVirtualBalance(parseFloat(e.target.value) || 0)}
                            className="bg-transparent border-none outline-none text-xl font-mono font-black text-white w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0.00"
                            step="0.01"
                        />
                    </div>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-[8px] font-bold text-[#4a4f5d] uppercase">Overall 24h</span>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono font-bold ${(virtualBalance - initialVirtualBalance) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {(((virtualBalance - initialVirtualBalance) / initialVirtualBalance) * 100).toFixed(2)}%
                        </span>
                        <div className="flex gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-blue-500/40" />
                            <span className="w-1 h-1 rounded-full bg-blue-500/20" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Double-Row Compact Action Bar */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[#363a45]/20">
                <button
                    onClick={openDashboard}
                    className="w-full h-7 flex items-center justify-center gap-1.5 rounded bg-blue-500/5 hover:bg-blue-500/10 text-[#787b86] hover:text-blue-400 text-[9px] font-bold uppercase transition-all border border-[#363a45]/30 active:scale-95 group"
                >
                    <Maximize2 size={10} />
                    VIEW DASHBOARD PERFORMANCE
                </button>
                <div className="flex gap-1.5">
                    <button
                        onClick={() => handleAction('balance')}
                        className={`flex-1 h-7 flex items-center justify-center gap-1.5 rounded text-[8px] font-bold uppercase transition-all active:scale-95 ${confirmAction === 'balance'
                            ? 'bg-orange-500 text-white'
                            : 'bg-[#1e222d] text-[#787b86] hover:text-[#d1d4dc] border border-[#363a45]/30'
                            }`}
                    >
                        <History size={10} className={confirmAction === 'balance' ? 'animate-pulse text-white' : 'text-orange-500/50'} />
                        {confirmAction === 'balance' ? 'CONFIRM $' : 'RESET MONEY'}
                    </button>
                    <button
                        onClick={() => handleAction('all')}
                        className={`flex-1 h-7 flex items-center justify-center gap-1.5 rounded text-[8px] font-bold uppercase transition-all active:scale-95 ${confirmAction === 'all'
                            ? 'bg-red-500 text-white'
                            : 'bg-[#1e222d] text-[#787b86] hover:text-red-500 border border-[#363a45]/30'
                            }`}
                    >
                        <Trash2 size={10} className={confirmAction === 'all' ? 'animate-pulse text-white' : 'text-red-500/50'} />
                        {confirmAction === 'all' ? 'CONFIRM ALL' : 'RESET LOGS'}
                    </button>
                </div>
            </div>
        </div>
    );
}
