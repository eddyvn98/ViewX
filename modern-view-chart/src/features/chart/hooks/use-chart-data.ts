import { useRef, useEffect } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';

const EMPTY_CANDLES: any[] = [];

export function useChartData(
    id: string,
    symbol: string | undefined,
    interval: string | undefined,
    source: string | undefined,
    chartRef: React.RefObject<IChartApi | null>,
    subchartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>,
    subSyncRef: React.RefObject<ISeriesApi<'Line'> | null>,
    timescaleSyncRef: React.RefObject<ISeriesApi<'Line'> | null>,
    isReady: boolean
) {
    const isInitialMount = useRef(true);
    const lastDataLength = useRef(0);
    const lastTimeRef = useRef<number>(0);
    const { sendMessage } = useWebSocket();

    const normSymbol = symbol ? (symbol.toLowerCase().endsWith('m') ? symbol.replace(/[mM]$/, 'm') : symbol) : '';
    const key = (symbol && source && interval) ? `${source}:${normSymbol}:${interval}` : '';

    const candles = useMarketStore(state => (key ? state.candleData[key] : null) || EMPTY_CANDLES);
    const currentPrice = useMarketStore(state => normSymbol ? state.tickers[normSymbol]?.price : null); // Normalize lookup

    const lastSymbolRef = useRef(symbol);
    const lastKeyRef = useRef(key);
    const isConnected = useMarketStore(state => state.isConnected);

    // 1. Đồng bộ toàn bộ dữ liệu (History hoặc New Candle)
    useEffect(() => {
        if (!isReady || !seriesRef.current || !symbol || !interval || !source) return;

        // Reset chart khi thay đổi Context (Symbol, Interval, Source)
        if (key !== lastKeyRef.current) {
            seriesRef.current.setData([]);
            subSyncRef.current?.setData([]);
            timescaleSyncRef.current?.setData([]);

            lastSymbolRef.current = symbol;
            lastKeyRef.current = key;
            isInitialMount.current = true;
            lastDataLength.current = 0;
        }

        if (candles.length === 0) {
            if (symbol && interval && source === 'MT5' && isConnected) {
                sendMessage({
                    topic: "mt5_command",
                    command: "get_candles",
                    symbol: symbol,
                    interval: interval,
                    count: 300
                });
            }
            return;
        }

        const formatted = candles.map(c => ({
            time: (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time)) as Time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
        }));

        let timeStep = 60;
        if (formatted.length > 1) {
            timeStep = Number(formatted[formatted.length - 1].time) - Number(formatted[formatted.length - 2].time);
        }

        const lastT = Number(formatted[formatted.length - 1].time);
        lastTimeRef.current = lastT;
        const futurePoints: any[] = [];
        for (let i = 1; i <= 100; i++) {
            futurePoints.push({ time: (lastT + timeStep * i) as Time });
        }

        if (isInitialMount.current || candles.length !== lastDataLength.current) {
            seriesRef.current.setData(formatted);

            const timeOnly = formatted.map(f => ({ time: f.time, value: 0 }));
            subSyncRef.current?.setData(timeOnly as any);

            const footerData = [
                ...timeOnly,
                ...futurePoints.map(p => ({ time: p.time }))
            ];
            timescaleSyncRef.current?.setData(footerData as any);

            if (isInitialMount.current && formatted.length > 0) {
                chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                subchartRef.current?.priceScale('right').applyOptions({ autoScale: true });

                requestAnimationFrame(() => {
                    chartRef.current?.timeScale().fitContent();
                    chartRef.current?.timeScale().scrollToRealTime();
                });

                isInitialMount.current = false;
            }
        }

        lastDataLength.current = candles.length;
    }, [isReady, candles, symbol, interval, source, isConnected]);


    // 2. Đồng bộ giá nhảy Real-time từ Ticker
    useEffect(() => {
        if (!seriesRef.current || !currentPrice || candles.length === 0) return;

        const lastCandle = candles[candles.length - 1];
        const candleTime = typeof lastCandle.time === 'object' ? (lastCandle.time as any).timestamp : Number(lastCandle.time);

        // CHỈ cập nhật nếu thời gian nến ticker >= thời gian nến cuối trên chart
        if (candleTime >= lastTimeRef.current) {
            try {
                const updatedPrice = Number(currentPrice);
                const updatedCandle = {
                    time: candleTime as Time,
                    open: Number(lastCandle.open),
                    high: Math.max(Number(lastCandle.high), updatedPrice),
                    low: Math.min(Number(lastCandle.low), updatedPrice),
                    close: updatedPrice,
                };

                seriesRef.current.update(updatedCandle);

                // Đồng bộ nhịp nhảy cho các thành phần khác
                const syncUpdate = { time: candleTime as Time, value: 0 } as any;
                subSyncRef.current?.update(syncUpdate);
                timescaleSyncRef.current?.update(syncUpdate);

                lastTimeRef.current = candleTime;
            } catch (err) {
                console.warn("⚠️ [ChartData] Update tick failed:", err);
            }
        }
    }, [currentPrice]);
}
