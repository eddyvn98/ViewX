import { useEffect, useMemo, useRef, useState } from 'react';
import { useChartOHLC } from '../hooks/use-chart-ohlc';
import { useMarketStore, Candle } from '@/lib/store';
import { useChartIndicatorValues } from '../hooks/use-chart-indicator-values';

interface ChartOverlayProps {
    chartId: string;
    symbol?: string;
    interval?: string;
    source?: string;
    candles: Candle[];
    currentPrice?: number;
}

export function ChartOverlay({ chartId, symbol, interval, source, candles, currentPrice }: ChartOverlayProps) {
    if (!symbol || !interval || !source) return null;
    const [isBackfillLoading, setIsBackfillLoading] = useState(false);
    const startedAtRef = useRef(0);
    const baselineOldestTimeRef = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const normalizedSource = useMemo(() => String(source || '').toUpperCase(), [source]);
    const oldestTime = Number(candles[0]?.time || 0);

    useEffect(() => {
        const onBackfillRequest = (event: Event) => {
            const detail = (event as CustomEvent)?.detail || {};
            const reqSymbol = String(detail.symbol || '').trim().toUpperCase();
            const reqInterval = String(detail.interval || '').trim();
            const reqSource = String(detail.source || '').toUpperCase();
            const reqDirection = String(detail.direction || '').toLowerCase();
            if (reqDirection !== 'older') return;
            if (reqSymbol !== String(symbol).trim().toUpperCase()) return;
            if (reqInterval !== String(interval).trim()) return;
            if (reqSource !== normalizedSource) return;

            startedAtRef.current = Date.now();
            baselineOldestTimeRef.current = oldestTime;
            setIsBackfillLoading(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setIsBackfillLoading(false), 6000);
        };

        window.addEventListener('chart-backfill-request', onBackfillRequest as EventListener);
        return () => {
            window.removeEventListener('chart-backfill-request', onBackfillRequest as EventListener);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [symbol, interval, normalizedSource, oldestTime]);

    useEffect(() => {
        if (!isBackfillLoading) return;
        const baseline = baselineOldestTimeRef.current;
        if (!Number.isFinite(baseline ?? NaN)) return;
        // Turn off loading as soon as chart extends further into the past.
        if (Number.isFinite(oldestTime) && oldestTime > 0 && oldestTime < Number(baseline)) {
            setIsBackfillLoading(false);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [isBackfillLoading, oldestTime]);


    return (
        <>
            {isBackfillLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-primary/35 bg-background/85 px-3 py-2 text-[12px] font-bold tracking-wide text-primary shadow-lg backdrop-blur-md">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                        <span>Loading chart history...</span>
                    </div>
                </div>
            )}
        </>
    );
}
