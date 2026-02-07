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


    const lastSymbolRef = useRef(symbol);
    const lastKeyRef = useRef(key);
    const isConnected = useMarketStore(state => state.isConnected);

    // 1. Đồng bộ toàn bộ dữ liệu (History hoặc New Candle)
    useEffect(() => {
        if (!isReady || !seriesRef.current || !symbol || !interval || !source) return;

        const isContextChange = key !== lastKeyRef.current;

        // 1. Handle Context Reset
        if (isContextChange) {
            seriesRef.current.setData([]);
            subSyncRef.current?.setData([]);
            timescaleSyncRef.current?.setData([]);

            lastKeyRef.current = key;
            lastSymbolRef.current = symbol; // Keep track for ticker sync
            isInitialMount.current = true;
            lastDataLength.current = 0;
        }

        const series = seriesRef.current;
        const formatted = candles.map(c => ({
            time: (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time)) as Time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
        }));

        // Request initial candles if none are present
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

        // 2. Inject Data to Chart (Context Change or New Data Batch)
        if (isContextChange || candles.length !== lastDataLength.current) {
            series.setData(formatted);

            // Calculate time step for future points
            let timeStep = 60;
            if (formatted.length > 1) {
                timeStep = Number(formatted[formatted.length - 1].time) - Number(formatted[formatted.length - 2].time);
            }
            const lastT = formatted.length > 0 ? Number(formatted[formatted.length - 1].time) : 0;

            // Generate future points for crosshair sync in future area
            const futurePoints: any[] = [];
            for (let i = 1; i <= 50; i++) {
                futurePoints.push({ time: (lastT + timeStep * i) as Time, value: 0 });
            }

            // Apply future points to BOTH subchart AND timescale (same pattern)
            const syncData = [
                ...formatted.map(f => ({ time: f.time, value: 0 })),
                ...futurePoints
            ];
            subSyncRef.current?.setData(syncData as any);
            timescaleSyncRef.current?.setData(syncData as any);

            // Handle Initial Auto-Fit
            if (isInitialMount.current && formatted.length > 0) {
                requestAnimationFrame(() => {
                    const timeScale = chartRef.current?.timeScale();
                    if (timeScale) {
                        const totalBars = formatted.length;
                        const barsToShow = window.innerWidth < 768 ? 50 : 100;
                        timeScale.setVisibleLogicalRange({
                            from: totalBars - barsToShow,
                            to: totalBars + 5
                        });
                    }
                    // Force auto-scale on both charts
                    chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                    subchartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                });
                isInitialMount.current = false;
            } else if (formatted.length > 0) {
                // Also trigger auto-scale on data updates (not just initial mount)
                requestAnimationFrame(() => {
                    chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                    subchartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                });
            }
        }

        lastDataLength.current = candles.length;
    }, [isReady, candles, symbol, interval, source, isConnected]);


    // 2. TẬP TRUNG TỐI ƯU: Cập nhật giá nhảy Real-time (Manual Subscription + Frame Throttle)
    const lastTickRef = useRef({ price: 0 });
    const currentCandleRef = useRef<any>(null);
    const frameRequestedRef = useRef<boolean>(false);

    // Đồng bộ nến cuối cùng từ Store vào Ref mỗi khi nến mới được thêm hoặc Reset
    useEffect(() => {
        if (candles.length > 0) {
            currentCandleRef.current = { ...candles[candles.length - 1] };
        }
    }, [candles]);

    useEffect(() => {
        if (!seriesRef.current || !normSymbol || !isReady) return;

        const updateChartFrame = () => {
            const series = seriesRef.current;
            const base = currentCandleRef.current;
            if (!series || !base) {
                frameRequestedRef.current = false;
                return;
            }

            const candleTime = typeof base.time === 'object' ? (base.time as any).timestamp : Number(base.time);

            series.update({
                time: candleTime as Time,
                open: Number(base.open),
                high: Number(base.high),
                low: Number(base.low),
                close: Number(base.close),
            });

            // Note: subSyncRef doesn't need real-time updates - it has future points for crosshair
            frameRequestedRef.current = false;
        };

        const unsub = useMarketStore.subscribe(
            (state) => state.tickers[normSymbol]?.price,
            (newPrice) => {
                const base = currentCandleRef.current;
                if (!newPrice || !base) return;

                const updatedPrice = Number(newPrice);
                if (updatedPrice === lastTickRef.current.price) return;

                // 1. Cập nhật MATH ngay lập tức để không lỡ High/Low (Râu nến)
                let dirty = false;
                if (updatedPrice > base.high) { base.high = updatedPrice; dirty = true; }
                if (updatedPrice < base.low) { base.low = updatedPrice; dirty = true; }
                if (updatedPrice !== base.close) { base.close = updatedPrice; dirty = true; }

                lastTickRef.current.price = updatedPrice;

                // 2. Chỉ vẽ lại (Render) theo nhịp màn hình (Throttling)
                if (dirty && !frameRequestedRef.current) {
                    frameRequestedRef.current = true;
                    requestAnimationFrame(updateChartFrame);
                }
            }
        );

        return () => {
            unsub();
            frameRequestedRef.current = false;
        };
    }, [normSymbol, isReady]);

}
