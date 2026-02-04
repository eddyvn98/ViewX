import { useEffect, useRef } from 'react';
import { useMarketStore } from '@/lib/store';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useWebSocket } from '@/hooks/use-websocket';
import { calculateHeikinAshi } from '../utils/indicator-math';
import { getChartTimezoneOffset as getOffset } from '../utils/time-utils';

export function useChartData(
    id: string, // chart id
    symbol: string | undefined,
    interval: string | undefined,
    source: string | undefined,
    chartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>
) {
    const { sendMessage } = useWebSocket();
    const initialDataLoaded = useRef(false);
    const chart = useMarketStore(state => state.activeTabId ? state.tabs[state.activeTabId]?.charts[id] : null);
    const timezone = chart?.timezone || 'Etc/UTC';
    const chartType = chart?.chartType || 'candles';

    useEffect(() => {
        if (!symbol || !interval || !source || !seriesRef.current) return;

        const normSymbol = (symbol || "").toLowerCase().endsWith('m') ? symbol!.replace(/[mM]$/, 'm') : symbol;
        const key = `${source}:${normSymbol}:${interval}`;
        const state = useMarketStore.getState();
        const initialCandles = state.candleData[key] || [];
        const offset = getOffset(timezone);

        // Explicitly request history and subscription on change
        if (source === 'MT5') {
            sendMessage({
                topic: "mt5_command",
                command: "get_candles",
                symbol,
                interval,
                count: 500
            });
            sendMessage({
                topic: "mt5_command",
                command: "get_symbol_info",
                symbol
            });
        } else if (source === 'BINANCE') {
            sendMessage({
                topic: "get_binance_candles",
                symbol: symbol,
                interval: interval,
                limit: 500
            });
        }

        // Always subscribe to real-time updates for this specific config
        sendMessage({
            topic: "subscribeCandle",
            symbol: symbol,
            interval: interval
        });

        const formatCandles = (candles: any[]) => {
            if (chartType === 'heikin_ashi') {
                return calculateHeikinAshi(candles).map(c => ({
                    time: c.time + offset,
                    open: c.ha_open,
                    high: c.ha_high,
                    low: c.ha_low,
                    close: c.ha_close
                }));
            }
            return candles.map(c => ({
                ...c,
                time: c.time + offset
            }));
        };

        const formatSingle = (candle: any, allCandles: any[]) => {
            if (chartType === 'heikin_ashi') {
                const has = calculateHeikinAshi(allCandles);
                const c = has[has.length - 1];
                return {
                    time: c.time + offset,
                    open: c.ha_open,
                    high: c.ha_high,
                    low: c.ha_low,
                    close: c.ha_close
                };
            }
            return { ...candle, time: candle.time + offset };
        };

        let lastCandleCount = 0;
        let lastFirstCandleTime = 0;

        // Initial Data Load
        if (initialCandles.length > 0) {
            const sorted = [...initialCandles].sort((a, b) => a.time - b.time);
            const formatted = formatCandles(sorted);
            seriesRef.current?.setData(formatted as any);
            lastCandleCount = initialCandles.length;
            lastFirstCandleTime = sorted[0].time;
            initialDataLoaded.current = true;
        }

        const unsubscribe = useMarketStore.subscribe(
            (state) => state.candleData[key],
            (currentCandles) => {
                if (!currentCandles?.length || !seriesRef.current) {
                    lastCandleCount = 0;
                    lastFirstCandleTime = 0;
                    return;
                }

                const sorted = [...currentCandles].sort((a, b) => a.time - b.time);
                const firstCandleTime = sorted[0].time;
                const lastIdx = sorted.length - 1;
                const lastCandle = sorted[lastIdx];

                // Heikin Ashi depends on previous candle, so we reload more often or re-calc
                if (!initialDataLoaded.current ||
                    (firstCandleTime !== lastFirstCandleTime) ||
                    (Math.abs(currentCandles.length - lastCandleCount) > 1) ||
                    chartType === 'heikin_ashi') { // Always full re-calc for HA for simplicity/correctness

                    const formatted = formatCandles(sorted);
                    seriesRef.current.setData(formatted as any);
                    lastCandleCount = currentCandles.length;
                    lastFirstCandleTime = firstCandleTime;
                    initialDataLoaded.current = true;
                } else {
                    // Real-time update/append (Normal candles)
                    seriesRef.current.update(formatSingle(lastCandle, sorted));
                    lastCandleCount = currentCandles.length;
                    lastFirstCandleTime = firstCandleTime;
                }
            }
        );

        return () => {
            unsubscribe();
            initialDataLoaded.current = false;
            if (seriesRef.current) seriesRef.current.setData([]);
        };
    }, [symbol, interval, source, timezone, chartType]);

    return { initialDataLoaded };
}
