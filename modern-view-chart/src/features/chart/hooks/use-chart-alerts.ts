import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket'; // Import
import { IChartApi, ISeriesApi, CreatePriceLineOptions } from 'lightweight-charts';

export function useChartAlerts(
    chartId: string,
    chartRef: React.MutableRefObject<IChartApi | null>,
    seriesRef: React.MutableRefObject<ISeriesApi<"Candlestick"> | null>,
    symbol: string | undefined
) {
    // Store Actions
    const alerts = useMarketStore((state) => state.alerts);
    const addAlert = useMarketStore((state) => state.addAlert);
    const updateAlert = useMarketStore((state) => state.updateAlert);
    const removeAlert = useMarketStore((state) => state.removeAlert);

    // Chart Interaction Logic
    const { sendMessage } = useWebSocket();

    // Filter alerts for current symbol
    const symbolAlerts = alerts.filter(a => a.symbol === symbol);

    // Refs for interaction
    const priceLinesRef = useRef<Map<string, any>>(new Map());
    const isDraggingRef = useRef<string | null>(null);
    const dragStartPriceRef = useRef<number | null>(null);

    // 1. Render Alert Lines (Only Active)
    useEffect(() => {
        if (!seriesRef.current || !symbol) return;

        // Only show active alerts
        const activeAlerts = symbolAlerts.filter(a => a.active);
        const activeIds = new Set(activeAlerts.map(a => a.id));

        // Clear existing lines not in active state
        priceLinesRef.current.forEach((line, id) => {
            if (!activeIds.has(id)) {
                seriesRef.current?.removePriceLine(line);
                priceLinesRef.current.delete(id);
            }
        });

        // Add/Update lines for active alerts only
        activeAlerts.forEach(alert => {
            const lineOptions: CreatePriceLineOptions = {
                price: alert.price,
                color: '#f59e0b', // Amber-500
                lineWidth: 1,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: '🔔 Alert',
            };

            if (priceLinesRef.current.has(alert.id)) {
                // Update existing
                const line = priceLinesRef.current.get(alert.id);
                line.applyOptions(lineOptions);
            } else {
                // Create new
                const line = seriesRef.current?.createPriceLine(lineOptions);
                if (line) {
                    priceLinesRef.current.set(alert.id, line);
                }
            }
        });

    }, [symbolAlerts, symbol, seriesRef]);

    // 2. Drag Interaction Logic
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current) return;

        const chart = chartRef.current;
        const container = chart.chartElement(); // Need access to div for events

        const handleMouseDown = (param: any) => {
            if (!param.point || !seriesRef.current) return;

            // Check if hovering near a line
            // Note: Native LWCharts doesn't strictly expose "hovered price line" easily in all versions.
            // We approximate by checking price proximity or rely on future UI overlay for better drag.
            // For now, implementing Right-Click logic as primary "Add".
            // Dragging native price lines is tricky without custom overlay primitives.
            // We will stick to basic rendering first, and Context Menu for Add/Remove.
        };

        // chart.subscribeClick(handleMouseDown);
        // return () => chart.unsubscribeClick(handleMouseDown);
    }, [chartRef]);

    // 3. Proximity Detection (for Drag/Delete/Context) - Only Active Alerts
    const getAlertNearPrice = useCallback((y: number, x: number) => {
        const series = seriesRef.current;
        const chart = chartRef.current;
        if (!series || !chart) return undefined;

        const container = chart.chartElement();
        const activeAlerts = symbolAlerts.filter(a => a.active);

        // Define "Tag Zone" as the rightmost 60px where the price labels are
        const isNearRightEdge = (container.clientWidth - x) < 60;

        // Use pixel tolerance for consistent feel regardless of zoom
        // More generous if clicking near the tags
        const pixelTolerance = isNearRightEdge ? 20 : 10;

        return activeAlerts.find(a => {
            const alertY = series.priceToCoordinate(a.price);
            if (alertY === null) return false;
            return Math.abs(alertY - y) < pixelTolerance;
        });
    }, [symbolAlerts, seriesRef, chartRef]);

    const handleRemoveAlert = useCallback((id: string) => {
        removeAlert(id);
        sendMessage({
            type: 'alert_command',
            command: 'remove',
            id
        });
    }, [removeAlert, sendMessage]);

    const handleUpdateAlertPrice = useCallback((id: string, newPrice: number) => {
        updateAlert(id, { price: newPrice });
        sendMessage({
            type: 'alert_command',
            command: 'update',
            id,
            updates: { price: newPrice }
        });
    }, [updateAlert, sendMessage]);

    // 5. Context Menu Logic (Exposed to Parent/Container)
    // We will attach a native context menu listener to the chart container element in parent

    const handleAddAlertAtPrice = useCallback((price: number) => {
        if (!symbol) return;

        const id = crypto.randomUUID();
        const alertData: any = {
            id,
            symbol,
            price,
            active: true,
            type: 'crossing',
            note: 'Manual Alert',
            createdAt: Date.now()
        };

        addAlert(alertData);
        sendMessage({
            type: 'alert_command',
            command: 'add',
            alert: alertData
        });

    }, [symbol, addAlert, sendMessage]);

    return {
        alerts,
        handleAddAlertAtPrice,
        handleRemoveAlert,
        handleUpdateAlertPrice,
        getAlertNearPrice
    };
}
