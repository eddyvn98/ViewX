import React from 'react';
import { History, Maximize2 } from 'lucide-react';
import { useStrategyStore } from '../store/strategy-store';

export function VirtualBalanceCard() {
    const { virtualBalance, initialVirtualBalance, setVirtualBalance, resetVirtualAccount } = useStrategyStore();
    const [isConfirmingReset, setIsConfirmingReset] = React.useState(false);

    // Auto-cancel confirmation after 3 seconds
    React.useEffect(() => {
        if (isConfirmingReset) {
            const timer = setTimeout(() => setIsConfirmingReset(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isConfirmingReset]);

    const handleResetClick = () => {
        if (isConfirmingReset) {
            resetVirtualAccount();
            setIsConfirmingReset(false);
        } else {
            setIsConfirmingReset(true);
        }
    };

    const openDashboard = () => {
        window.open('/strategy/dashboard', '_blank');
    };

    return (
        <div className="bg-[#131722] p-4 rounded-xl border border-blue-500/20 flex flex-col gap-4 shadow-lg shadow-blue-500/5">
            {/* Top Row: Balance Display */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-[#5d606b] uppercase tracking-widest">Virtual Account</span>
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500/20" />
                    </div>
                </div>

                <div className="flex items-baseline gap-2 group relative">
                    <span className="text-2xl font-mono font-black text-white select-none">$</span>
                    <input
                        type="number"
                        value={virtualBalance === 0 ? '' : Number(virtualBalance).toFixed(2)}
                        onChange={(e) => setVirtualBalance(parseFloat(e.target.value) || 0)}
                        className="bg-transparent border-none outline-none text-3xl font-mono font-black text-white w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:text-blue-400 transition-colors placeholder:text-[#363a45]"
                        placeholder="0.00"
                        step="0.01"
                    />
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-500/40 uppercase pointer-events-none">Equity</span>
                </div>
            </div>

            {/* Middle Row: Actions */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={openDashboard}
                    className="h-8 flex items-center justify-center gap-2 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase transition-all border border-blue-500/20 active:scale-95 group"
                    title="View Trading Performance"
                >
                    <Maximize2 size={12} className="group-hover:scale-110 transition-transform" />
                    Dashboard
                </button>
                <button
                    onClick={handleResetClick}
                    className={`h-8 flex items-center justify-center gap-2 rounded text-[10px] font-black uppercase transition-all active:scale-95 group ${isConfirmingReset
                            ? 'bg-red-500 text-white hover:bg-red-600 border border-red-500 animate-pulse'
                            : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                        }`}
                    title={isConfirmingReset ? "Click again to confirm reset" : "Reset Balance & History"}
                >
                    <History size={12} className={`transition-transform duration-500 ${isConfirmingReset ? 'rotate-180' : 'group-hover:-rotate-180'}`} />
                    {isConfirmingReset ? 'CONFIRM?' : 'RESET ALL'}
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#363a45]/30">
                <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-[#4a4f5d] uppercase">Profit/Loss</span>
                    <span className={`text-xs font-mono font-bold ${(virtualBalance - initialVirtualBalance) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(virtualBalance - initialVirtualBalance) >= 0 ? '+' : ''}${(virtualBalance - initialVirtualBalance).toFixed(2)}
                    </span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[8px] font-bold text-[#4a4f5d] uppercase text-right">Performance</span>
                    <span className={`text-xs font-mono font-bold ${(virtualBalance - initialVirtualBalance) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(((virtualBalance - initialVirtualBalance) / initialVirtualBalance) * 100).toFixed(2)}%
                    </span>
                </div>
            </div>
        </div>
    );
}
