import { AccountInfo } from "@/lib/store/types";
import { useMarketStore } from "@/lib/store";
import { calculatePnL } from "@/lib/utils/pnl";

interface AccountSummaryProps {
    account: AccountInfo | null;
}

export function AccountSummary({ account }: AccountSummaryProps) {
    const positions = useMarketStore(state => state.positions);
    const tickers = useMarketStore(state => state.tickers);
    const symbolInfoMap = useMarketStore(state => state.symbolInfo);

    if (!account) return null;

    // Calculate real-time profit for all positions using live prices
    const realTimeProfit = positions.reduce((sum, pos) => {
        const livePrice = tickers[pos.symbol]?.price || pos.current_price;
        const symbolInfo = symbolInfoMap[pos.symbol];

        const pnl = calculatePnL({
            type: pos.type,
            openPrice: pos.open_price,
            currentPrice: livePrice,
            volume: pos.volume,
            symbolInfo
        });

        return sum + pnl;
    }, 0);

    // Equity = Balance + Profit
    const realTimeEquity = (account.balance ?? 0) + realTimeProfit;

    return (
        <div className="flex flex-wrap gap-5 mb-3 text-[12px] text-[#787b86]">
            <div>Balance: <span className="text-[#d1d4dc] font-semibold">{(account.balance ?? 0).toFixed(2)}</span></div>
            <div>Equity: <span className={`font-semibold ${realTimeEquity >= (account.balance ?? 0) ? 'text-[#d1d4dc]' : 'text-red-400'}`}>{realTimeEquity.toFixed(2)}</span></div>
            <div>Margin: <span className="text-[#d1d4dc] font-semibold">{(account.margin ?? 0).toFixed(2)}</span></div>
            <div>Free Margin: <span className="text-[#d1d4dc] font-semibold">{(account.free_margin ?? 0).toFixed(2)}</span></div>
            <div>Level: <span className="text-[#d1d4dc] font-semibold">{(account.margin_level ?? 0).toFixed(2)}%</span></div>
            <div>Profit: <span className={`font-semibold ${realTimeProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{realTimeProfit.toFixed(2)}</span></div>
        </div>
    );
}
