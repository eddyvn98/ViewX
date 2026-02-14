'use client';

import { memo, useRef, useEffect, useCallback } from 'react';
import { AccountInfo } from "@/lib/store/types";
import { useMarketStore } from "@/lib/store";
import { calculatePnL } from "@/lib/utils/pnl";
import { cn } from "@/lib/utils";

interface AccountSummaryProps {
    account: AccountInfo | null;
}

/**
 * Optimized MobileAccountSummary - Uses RAF + DOM manipulation for real-time updates
 * Prevents React re-renders when tickers change (~30fps WebSocket updates)
 */
export const MobileAccountSummary = memo(function MobileAccountSummary({ account }: AccountSummaryProps) {
    const profitRef = useRef<HTMLSpanElement>(null);
    const equityRef = useRef<HTMLSpanElement>(null);
    const rafIdRef = useRef<number | null>(null);
    const lastProfitRef = useRef<string>('');
    const lastEquityRef = useRef<string>('');

    const updateDOM = useCallback(() => {
        if (!account) return;

        const state = useMarketStore.getState();
        const positions = state.positions;
        const tickers = state.tickers;
        const symbolInfoMap = state.symbolInfo;

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

        const profitStr = realTimeProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const equityStr = realTimeEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (profitRef.current && profitStr !== lastProfitRef.current) {
            lastProfitRef.current = profitStr;
            profitRef.current.textContent = (isProfitable ? '+' : '') + profitStr;
            profitRef.current.className = cn(
                "text-xs font-mono font-bold font-black",
                isProfitable ? "text-green-500" : "text-red-500"
            );
        }

        if (equityRef.current && equityStr !== lastEquityRef.current) {
            lastEquityRef.current = equityStr;
            equityRef.current.textContent = equityStr;
            equityRef.current.className = cn(
                "text-xs font-mono font-bold",
                realTimeEquity >= (account.balance ?? 0) ? "text-foreground" : "text-red-400"
            );
        }
    }, [account]);

    useEffect(() => {
        if (!account) return;

        let running = true;
        let lastUpdate = 0;
        const interval = 100; // 10fps max for mobile performance

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
        <div className="bg-secondary/60 backdrop-blur-md rounded-lg p-1 px-2 border border-border/50 flex items-center justify-between shadow-inner h-9">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-muted-foreground uppercase font-black">Eq:</span>
                    <span ref={equityRef} className="text-xs font-mono font-bold text-foreground">···</span>
                </div>
                <div className="w-px h-3 bg-border/50" />
                <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-muted-foreground uppercase font-black">Pr:</span>
                    <span ref={profitRef} className="text-xs font-mono font-bold font-black text-green-500">···</span>
                </div>
            </div>

            <div className="flex items-center gap-2 text-right">
                <div className="flex items-baseline gap-1">
                    <span className="text-[7px] text-muted-foreground/80 uppercase font-medium">B</span>
                    <span className="text-[9px] font-mono text-muted-foreground leading-none">{(account.balance ?? 0).toFixed(0)}</span>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-[7px] text-muted-foreground/80 uppercase font-medium">L</span>
                    <span className="text-[9px] font-mono text-muted-foreground leading-none">{(account.margin_level ?? 0).toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
}
);
