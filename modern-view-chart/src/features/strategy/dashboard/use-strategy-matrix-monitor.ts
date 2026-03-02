import { useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '../store/strategy-store';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { normalizeDashboardTf, timeframeToChartInterval, timeframeToSeconds } from './matrix-utils';

function isCandleSetStale(lastCandleTime: unknown, timeframeSec: number): boolean {
    if (!Number.isFinite(timeframeSec) || timeframeSec <= 0) return true;
    const raw = Number(lastCandleTime);
    if (!Number.isFinite(raw)) return true;
    const lastSec = raw > 10_000_000_000 ? Math.floor(raw / 1000) : raw;
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec - lastSec > timeframeSec * 2;
}

export function useStrategyMatrixMonitor() {
    const isConnected = useMarketStore((s) => s.isConnected);
    const matrixConfig = useStrategyStore((s) => s.matrixConfig);

    useEffect(() => {
        if (!isConnected) return;

        const requestBackfill = (symbol: string, interval: string, count = 300) => {
            window.dispatchEvent(new CustomEvent('chart-backfill-request', {
                detail: {
                    source: 'MT5',
                    symbol,
                    interval,
                    count,
                },
            }));
        };

        const lastRequestAt = new Map<string, number>();

        const tick = () => {
            const now = Date.now();
            for (const rawSymbol of matrixConfig.symbols) {
                const symbol = normalizeSymbol(rawSymbol);
                if (!symbol) continue;

                for (const rawTf of matrixConfig.timeframes) {
                    const tf = normalizeDashboardTf(rawTf);
                    const interval = timeframeToChartInterval(tf);
                    const tfSec = timeframeToSeconds(tf);
                    const key = `MT5:${symbol}:${interval}`;
                    const candles = useMarketStore.getState().candleData[key] || [];
                    const missing = candles.length < 50;
                    const stale = candles.length > 0 ? isCandleSetStale(candles[candles.length - 1]?.time, tfSec) : true;

                    const refreshEveryMs = Math.min(120_000, Math.max(10_000, Math.floor((Math.max(tfSec, 60) * 1000) / 6)));
                    const lastReq = lastRequestAt.get(key) || 0;
                    const dueRefresh = now - lastReq >= refreshEveryMs;

                    if ((missing || stale || dueRefresh) && document.visibilityState === 'visible') {
                        requestBackfill(symbol, interval, 300);
                        lastRequestAt.set(key, now);
                    }
                }
            }
        };

        tick();
        const timer = window.setInterval(tick, 10_000);
        return () => window.clearInterval(timer);
    }, [isConnected, matrixConfig]);

}
