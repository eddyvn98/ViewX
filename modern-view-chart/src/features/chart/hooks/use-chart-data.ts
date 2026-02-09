import { useRef, useEffect } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { calculateHeikinAshi } from '../utils/indicator-math';

const EMPTY_CANDLES: any[] = [];

export function useChartData(
    id: string,
    symbol: string | undefined,
    interval: string | undefined,
    source: string | undefined,
    chartType: 'candles' | 'heikin_ashi',
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

    // ⚡ CPU OPTIMIZATION: Only notify React if the number of candles changes
    const candlesCount = useMarketStore(state => (key ? (state.candleData[key]?.length || 0) : 0));
    // Internal access to avoid dependency tracking of the whole array
    const getCandles = () => (key ? (useMarketStore.getState().candleData[key] || EMPTY_CANDLES) : EMPTY_CANDLES);


    const lastSymbolRef = useRef(symbol);
    const lastKeyRef = useRef(key);
    const lastChartTypeRef = useRef(chartType);
    const isConnected = useMarketStore(state => state.isConnected);

    // 2. TẬP TRUNG TỐI ƯU: Cập nhật giá nhảy Real-time (Manual Subscription + Frame Throttle)
    const lastTickRef = useRef({ price: 0 });
    const currentCandleRef = useRef<any>(null); // Always stores RAW candle
    const currentHaCandleRef = useRef<any>(null); // Stores HA state snapshot
    const frameRequestedRef = useRef<boolean>(false);
    const lastSentTimeRef = useRef<number | null>(null);
    const lastFetchRequestTimeRef = useRef<number>(0);

    // 1. Đồng bộ toàn bộ dữ liệu (History hoặc New Candle)
    useEffect(() => {
        if (!isReady || !seriesRef.current || !symbol || !interval || !source) return;

        const isContextChange = key !== lastKeyRef.current || chartType !== lastChartTypeRef.current;
        const currentCandles = getCandles();

        // 1. Handle Context Reset
        if (isContextChange) {
            seriesRef.current.setData([]);
            subSyncRef.current?.setData([]);
            timescaleSyncRef.current?.setData([]);

            lastKeyRef.current = key;
            lastChartTypeRef.current = chartType;
            lastSymbolRef.current = symbol; // Keep track for ticker sync
            isInitialMount.current = true;
            lastDataLength.current = 0;

            // Reset references to prevent stale data usage
            currentCandleRef.current = null;
            currentHaCandleRef.current = null;

            // ⚡ CRITICAL: Reset the last sent time and last tick price 
            // to allow fresh updates for the new symbol
            lastSentTimeRef.current = null;
            lastFetchRequestTimeRef.current = 0;
            lastTickRef.current.price = 0;

            // Reset scales immediately to avoid "distortion" from previous symbol's price range
            requestAnimationFrame(() => {
                if (!chartRef.current || !subchartRef.current) return;

                chartRef.current.timeScale().scrollToRealTime();

                // Set autoScale to true but also force a reset of the price scale
                // by momentarily disabling autoScale if it was already on
                const priceScale = chartRef.current.priceScale('right');
                priceScale.applyOptions({ autoScale: true });
                subchartRef.current.priceScale('right').applyOptions({ autoScale: true });
            });
        }

        const series = seriesRef.current;

        // Request initial candles if none are present
        if (currentCandles.length === 0 && symbol && interval && source === 'MT5' && isConnected) {
            const now = Date.now();
            // ⚡ LOOP PROTECTION: Prevent spamming requests if backend returns empty/null
            // Only retry every 2 seconds instead of every render frame
            if (now - lastFetchRequestTimeRef.current > 2000) {
                lastFetchRequestTimeRef.current = now;
                sendMessage({
                    topic: "mt5_command",
                    command: "get_candles",
                    symbol: symbol,
                    interval: interval,
                    count: 300
                });
                // Also fetch symbol info for PnL accuracy
                sendMessage({
                    topic: "mt5_command",
                    command: "get_symbol_info",
                    symbol: symbol
                });
                console.log(`📡 [FETCH] Requesting init candles & info for ${symbol}`);
            }
            return;
        }

        // 2. Inject Data to Chart (Context Change or New Data Batch)
        if (isContextChange || currentCandles.length !== lastDataLength.current) {
            let displayCandles = currentCandles;

            if (chartType === 'heikin_ashi') {
                const haData = calculateHeikinAshi(currentCandles);
                displayCandles = haData.map(c => ({
                    ...c,
                    open: c.ha_open,
                    high: c.ha_high,
                    low: c.ha_low,
                    close: c.ha_close
                }));
            }

            const formatted = displayCandles.map(c => ({
                time: (typeof c.time === 'object' ? (c.time as any).timestamp : Number(c.time)) as Time,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
            }));

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
            const syncData: any[] = [];
            for (let i = 0; i < formatted.length; i++) {
                syncData.push({ time: formatted[i].time, value: 0 });
            }
            for (let i = 0; i < futurePoints.length; i++) {
                syncData.push(futurePoints[i]);
            }

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
                    chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                    subchartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                });
                isInitialMount.current = false;
            }
        }

        lastDataLength.current = currentCandles.length;
    }, [isReady, candlesCount, symbol, interval, source, isConnected, chartType]);

    // Đồng bộ nến cuối cùng từ Store vào Ref mỗi khi nến mới được thêm hoặc Reset
    useEffect(() => {
        const currentCandles = getCandles();
        if (currentCandles.length > 0) {
            currentCandleRef.current = { ...currentCandles[currentCandles.length - 1] };

            if (chartType === 'heikin_ashi') {
                const haData = calculateHeikinAshi(currentCandles);
                if (haData.length > 0) {
                    currentHaCandleRef.current = haData[haData.length - 1];
                }
            }
        }
    }, [candlesCount, chartType]);

    useEffect(() => {
        if (!seriesRef.current || !normSymbol || !isReady) return;

        const updateChartFrame = () => {
            const series = seriesRef.current;
            const base = currentCandleRef.current; // RAW candle (updated in place)
            const haBase = currentHaCandleRef.current; // HA Base for Open

            if (!series || !base) {
                frameRequestedRef.current = false;
                return;
            }

            const candleTime = typeof base.time === 'object' ? (base.time as any).timestamp : Number(base.time);

            // Defensive check: lightweight-charts will throw if we update with an older time
            if (lastSentTimeRef.current !== null && candleTime < lastSentTimeRef.current) {
                frameRequestedRef.current = false;
                return;
            }
            lastSentTimeRef.current = candleTime;

            let open = Number(base.open);
            let high = Number(base.high);
            let low = Number(base.low);
            let close = Number(base.close);

            // Real-time HA Calculation
            if (chartType === 'heikin_ashi' && haBase) {
                const haOpen = Number(haBase.ha_open); // Fixed for this candle
                // Recalculate based on LATEST raw values
                const haClose = (open + high + low + close) / 4;
                const haHigh = Math.max(high, haOpen, haClose);
                const haLow = Math.min(low, haOpen, haClose);

                open = haOpen;
                high = haHigh;
                low = haLow;
                close = haClose;
            }

            if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
                frameRequestedRef.current = false;
                return;
            }

            series.update({
                time: candleTime as Time,
                open,
                high,
                low,
                close,
            });

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
    }, [normSymbol, isReady, chartType]);

}
