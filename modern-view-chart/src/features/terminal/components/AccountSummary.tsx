import { memo, useRef, useEffect, useCallback } from 'react';
import { AccountInfo } from "@/lib/store/types";
import { useMarketStore } from "@/lib/store";
import { calculatePnL } from "@/lib/utils/pnl";

interface AccountSummaryProps {
    account: AccountInfo | null;
}

/**
 * Optimized AccountSummary - Uses RAF + DOM manipulation for real-time profit updates
 * This prevents React re-renders when tickers change (which happens ~30fps)
 */
export const AccountSummary = memo(function AccountSummary({ account }: AccountSummaryProps) {
    const profitRef = useRef<HTMLSpanElement>(null);
    const equityRef = useRef<HTMLSpanElement>(null);
    const rafIdRef = useRef<number | null>(null);
    const lastProfitRef = useRef<string>('');
    const lastEquityRef = useRef<string>('');

    // Calculate and update DOM directly via RAF
    const updateDOM = useCallback(() => {
        if (!account) return;

        const state = useMarketStore.getState();
        const positions = state.positions;
        const tickers = state.tickers;
        const symbolInfoMap = state.symbolInfo;

        // Calculate real-time profit
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

        // Only update DOM if values changed
        const profitStr = realTimeProfit.toFixed(2);
        const equityStr = realTimeEquity.toFixed(2);

        if (profitRef.current && profitStr !== lastProfitRef.current) {
            lastProfitRef.current = profitStr;
            profitRef.current.textContent = profitStr;
            profitRef.current.className = `font-semibold ${realTimeProfit >= 0 ? 'text-green-500' : 'text-red-500'}`;
        }

        if (equityRef.current && equityStr !== lastEquityRef.current) {
            lastEquityRef.current = equityStr;
            equityRef.current.textContent = equityStr;
            equityRef.current.className = `font-semibold ${realTimeEquity >= (account.balance ?? 0) ? 'text-[#d1d4dc]' : 'text-red-400'}`;
        }
    }, [account]);

    // Subscribe to store changes via RAF loop (not React re-renders)
    useEffect(() => {
        if (!account) return;

        let running = true;
        let lastUpdate = 0;
        const interval = 100; // Update every 100ms max

        const tick = () => {
            if (!running) return;

            const now = Date.now();
            if (now - lastUpdate >= interval) {
                lastUpdate = now;
                updateDOM();
            }

            rafIdRef.current = requestAnimationFrame(tick);
        };

        rafIdRef.current = requestAnimationFrame(tick);

        return () => {
            running = false;
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, [account, updateDOM]);

    if (!account) return null;

    return (
        <div className="flex flex-wrap gap-5 mb-3 text-[12px] text-[#787b86]">
            <div>Balance: <span className="text-[#d1d4dc] font-semibold">{(account.balance ?? 0).toFixed(2)}</span></div>
            <div>Equity: <span ref={equityRef} className="font-semibold text-[#d1d4dc]">···</span></div>
            <div>Margin: <span className="text-[#d1d4dc] font-semibold">{(account.margin ?? 0).toFixed(2)}</span></div>
            <div>Free Margin: <span className="text-[#d1d4dc] font-semibold">{(account.free_margin ?? 0).toFixed(2)}</span></div>
            <div>Level: <span className="text-[#d1d4dc] font-semibold">{(account.margin_level ?? 0).toFixed(2)}%</span></div>
            <div>Profit: <span ref={profitRef} className="font-semibold text-green-500">···</span></div>
        </div>
    );
});
