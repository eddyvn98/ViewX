import { useRef, useEffect } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    CandlestickSeries,
    LineSeries,
} from 'lightweight-charts';

export function useChartInit(
    priceContainerRef: React.RefObject<HTMLDivElement | null>,
    subchartContainerRef: React.RefObject<HTMLDivElement | null>,
    timescaleContainerRef: React.RefObject<HTMLDivElement | null>
) {
    const priceChartRef = useRef<IChartApi | null>(null);
    const subchartChartRef = useRef<IChartApi | null>(null);
    const timescaleChartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const subSyncRef = useRef<ISeriesApi<'Line'> | null>(null);
    const timescaleSyncRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!priceContainerRef.current || !subchartContainerRef.current || !timescaleContainerRef.current) return;

        const commonOptions = {
            layout: { background: { color: '#131722' }, textColor: '#d4d4d8' },
            grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
            crosshair: { mode: 1 },
            timeScale: {
                rightOffset: 40, // Khoảng trống sau 100 nến trắng tương lai
                barSpacing: 10,
                fixLeftEdge: true,
                fixRightEdge: false, // Cho phép kéo chart về phía tương lai
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: false, // Cho phép scroll xa khỏi nến cuối cùng
                borderVisible: false,
                borderColor: "#2B2B43",
                visible: true,
                timeVisible: true,
                secondsVisible: false,
                shiftVisibleRangeOnNewBar: true,
            },
        };

        /* ================= PRICE CHART ================= */
        const priceChart = createChart(priceContainerRef.current, {
            ...commonOptions,
            width: priceContainerRef.current.clientWidth,
            height: priceContainerRef.current.clientHeight,
            timeScale: { ...commonOptions.timeScale, visible: false },
            rightPriceScale: {
                visible: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
                borderVisible: true,
                minimumWidth: 80,
            },
            handleScale: { mouseWheel: true, axisPressedMouseMove: { price: true, time: true } as any },
            handleScroll: true,
        });

        /* ================= RSI SUBCHART ================= */
        const subchartChart = createChart(subchartContainerRef.current, {
            ...commonOptions,
            layout: { ...commonOptions.layout, background: { color: 'transparent' } },
            width: subchartContainerRef.current.clientWidth,
            height: subchartContainerRef.current.clientHeight,
            timeScale: { ...commonOptions.timeScale, visible: false },
            rightPriceScale: {
                visible: true,
                autoScale: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
                borderVisible: true,
                minimumWidth: 80,
            },
            handleScale: { mouseWheel: false, axisPressedMouseMove: { price: true, time: true } as any },
            handleScroll: true,
        });

        /* ================= TIMESCALE FOOTER ================= */
        const timescaleChart = createChart(timescaleContainerRef.current, {
            ...commonOptions,
            layout: { background: { color: '#131722' }, textColor: '#d4d4d8', fontSize: 11 },
            grid: { vertLines: { visible: false }, horzLines: { visible: false } },
            width: timescaleContainerRef.current.clientWidth,
            height: timescaleContainerRef.current.clientHeight,
            timeScale: { ...commonOptions.timeScale, visible: true },
            rightPriceScale: { visible: true, borderVisible: false, ticksVisible: false, minimumWidth: 80 },
            leftPriceScale: { visible: false },
            crosshair: {
                vertLine: { visible: false, labelVisible: true },
                horzLine: { visible: false, labelVisible: false },
            },
            handleScale: { mouseWheel: true, axisPressedMouseMove: { time: true } as any },
            handleScroll: true,
        });

        const candleSeries = priceChart.addSeries(CandlestickSeries, {
            upColor: '#22c55e', downColor: '#ef4444', borderVisible: false,
            wickUpColor: '#22c55e', wickDownColor: '#ef4444',
        });

        const subSyncSeries = subchartChart.addSeries(LineSeries as any, { visible: false });
        const footSyncSeries = timescaleChart.addSeries(LineSeries as any, { visible: false });

        /* ================= SAFE SYNC CROSSHAIR ================= */
        const syncCrosshair = (source: IChartApi, targets: { chart: IChartApi, series: ISeriesApi<any> }[], param: any) => {
            if (param.time && param.point) {
                targets.forEach(t => {
                    try {
                        // FIX: Kiểm tra kĩ time trước khi set để tránh lỗi 'year'
                        t.chart.setCrosshairPosition(0, param.time, t.series);
                    } catch (e) { }
                });
            } else {
                targets.forEach(t => t.chart.clearCrosshairPosition());
            }
        };

        priceChart.subscribeCrosshairMove((param) => {
            syncCrosshair(priceChart, [
                { chart: subchartChart, series: subSyncSeries },
                { chart: timescaleChart, series: footSyncSeries }
            ], param);
        });

        subchartChart.subscribeCrosshairMove((param) => {
            syncCrosshair(subchartChart, [
                { chart: priceChart, series: candleSeries },
                { chart: timescaleChart, series: footSyncSeries }
            ], param);
        });

        /* ================= SYNC TIME RANGE ================= */
        const priceTS = priceChart.timeScale();
        const subTS = subchartChart.timeScale();
        const footTS = timescaleChart.timeScale();

        let syncing = false;
        const syncTime = (range: any) => {
            if (!range || syncing) return;
            syncing = true;
            priceTS.setVisibleLogicalRange(range);
            subTS.setVisibleLogicalRange(range);
            footTS.setVisibleLogicalRange(range);
            syncing = false;
        };

        priceTS.subscribeVisibleLogicalRangeChange(syncTime);
        subTS.subscribeVisibleLogicalRangeChange(syncTime);
        footTS.subscribeVisibleLogicalRangeChange(syncTime);

        /* ================= SYNC LAYOUT WIDTH ================= */
        let syncRequestId: number | null = null;
        let lastMaxW = 80;

        const autoSyncLayout = () => {
            if (syncRequestId !== null) return;

            syncRequestId = requestAnimationFrame(() => {
                syncRequestId = null;

                // Check if charts are still valid
                if (!priceContainerRef.current || !subchartContainerRef.current) return;

                const priceW = priceChart.priceScale('right').width();
                const subW = subchartChart.priceScale('right').width();
                const maxW = Math.max(priceW, subW, 80);

                if (Math.abs(maxW - lastMaxW) > 1) {
                    lastMaxW = maxW;
                    const opt = { rightPriceScale: { minimumWidth: maxW } };
                    priceChart.applyOptions(opt);
                    subchartChart.applyOptions(opt);
                    timescaleChart.applyOptions(opt);
                }
            });
        };

        // Subscribe to events that might change the price scale width
        priceTS.subscribeVisibleLogicalRangeChange(autoSyncLayout);
        subTS.subscribeVisibleLogicalRangeChange(autoSyncLayout);

        // Run initially
        setTimeout(autoSyncLayout, 50);

        const resizeObserver = new ResizeObserver(() => {
            if (priceContainerRef.current) priceChart.applyOptions({ width: priceContainerRef.current.clientWidth, height: priceContainerRef.current.clientHeight });
            if (subchartContainerRef.current) subchartChart.applyOptions({ width: subchartContainerRef.current.clientWidth, height: subchartContainerRef.current.clientHeight });
            if (timescaleContainerRef.current) timescaleChart.applyOptions({ width: timescaleContainerRef.current.clientWidth, height: timescaleContainerRef.current.clientHeight });
            autoSyncLayout();
        });

        if (priceContainerRef.current) resizeObserver.observe(priceContainerRef.current);

        priceChartRef.current = priceChart;
        subchartChartRef.current = subchartChart;
        timescaleChartRef.current = timescaleChart;
        seriesRef.current = candleSeries;
        subSyncRef.current = subSyncSeries as any;
        timescaleSyncRef.current = footSyncSeries as any;

        return () => {
            if (syncRequestId !== null) cancelAnimationFrame(syncRequestId);
            resizeObserver.disconnect();
            priceChart.remove();
            subchartChart.remove();
            timescaleChart.remove();
        };
    }, []);

    return {
        priceChartRef, subchartChartRef, timescaleChartRef,
        seriesRef, subSyncRef, timescaleSyncRef,
        syncRange: () => {
            const range = priceChartRef.current?.timeScale().getVisibleLogicalRange();
            if (range) {
                subchartChartRef.current?.timeScale().setVisibleLogicalRange(range);
                timescaleChartRef.current?.timeScale().setVisibleLogicalRange(range);
            }
        },
    };
}
