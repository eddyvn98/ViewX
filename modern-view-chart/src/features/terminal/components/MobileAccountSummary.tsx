'use client';

import { AccountInfo } from "@/lib/store/types";
import { useMarketStore } from "@/lib/store";
import { calculatePnL } from "@/lib/utils/pnl";
import { cn } from "@/lib/utils";

interface AccountSummaryProps {
    account: AccountInfo | null;
}

export function MobileAccountSummary({ account }: AccountSummaryProps) {
    const positions = useMarketStore(state => state.positions);
    const tickers = useMarketStore(state => state.tickers);
    const symbolInfoMap = useMarketStore(state => state.symbolInfo);

    if (!account) return null;

    const realTimeProfit = positions.reduce((sum, pos) => {
        const livePrice = tickers[pos.symbol]?.price || pos.current_price;
        const symbolInfo = symbolInfoMap[pos.symbol];
        const pnl = calculatePnL({
            type: pos.type,
            openPrice: pos.open_price,
            currentPrice: livePrice,
            volume: pos.volume,
            symbolInfo,
            symbol: pos.symbol
        });
        return sum + pnl;
    }, 0);

    const realTimeEquity = (account.balance ?? 0) + realTimeProfit;
    const isProfitable = realTimeProfit >= 0;

    return (
        <div className="bg-zinc-900/60 backdrop-blur-md rounded-lg p-1 px-2 border border-zinc-800/50 flex items-center justify-between shadow-inner h-9">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-zinc-500 uppercase font-black">Eq:</span>
                    <span className={cn(
                        "text-xs font-mono font-bold",
                        realTimeEquity >= (account.balance ?? 0) ? "text-white" : "text-red-400"
                    )}>
                        {realTimeEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="w-px h-3 bg-zinc-800/50" />
                <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-zinc-500 uppercase font-black">Pr:</span>
                    <span className={cn(
                        "text-xs font-mono font-bold font-black",
                        isProfitable ? "text-green-500" : "text-red-500"
                    )}>
                        {isProfitable ? '+' : ''}{realTimeProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 text-right">
                <div className="flex items-baseline gap-1">
                    <span className="text-[7px] text-zinc-600 uppercase font-medium">B</span>
                    <span className="text-[9px] font-mono text-zinc-500 leading-none">{(account.balance ?? 0).toFixed(0)}</span>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-[7px] text-zinc-600 uppercase font-medium">L</span>
                    <span className="text-[9px] font-mono text-zinc-500 leading-none">{(account.margin_level ?? 0).toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
}
