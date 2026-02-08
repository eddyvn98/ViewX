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
    const draftOrder = useMarketStore((state) => state.draftOrder);

    // Chart Interaction Logic
    const { sendMessage } = useWebSocket();

    // Filter alerts for current symbol
    const symbolAlerts = alerts.filter(a => a.symbol === symbol);

    // Refs for interaction
    const priceLinesRef = useRef<Map<string, any>>(new Map());

    // 1. Render Alert Lines (Only Active)
    useEffect(() => {
        if (!seriesRef.current || !symbol) return;

        // Only show active alerts
        const activeAlerts = symbolAlerts.filter(a => a.active);
        const activeIds = new Set(activeAlerts.map(a => a.id));

        // Clear existing lines not in active state or no longer existing
        priceLinesRef.current.forEach((line, id) => {
            if (!activeIds.has(id)) {
                seriesRef.current?.removePriceLine(line);
                priceLinesRef.current.delete(id);
            }
        });

        // Add/Update lines for active alerts
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
                const line = priceLinesRef.current.get(alert.id);
                line.applyOptions(lineOptions);
            } else {
                const line = seriesRef.current?.createPriceLine(lineOptions);
                if (line) {
                    priceLinesRef.current.set(alert.id, line);
                }
            }
        });

    }, [symbolAlerts, symbol, seriesRef, draftOrder]);

    // 3. Proximity Detection
    const getAlertNearPrice = useCallback((y: number, x: number) => {
        const series = seriesRef.current;
        const chart = chartRef.current;
        if (!series || !chart) return undefined;

        // Don't detect other elements if drafting
        if (draftOrder && draftOrder.symbol === symbol) return undefined;

        const container = chart.chartElement();
        const activeAlerts = symbolAlerts.filter(a => a.active);
        const isNearRightEdge = (container.clientWidth - x) < 60;
        const pixelTolerance = isNearRightEdge ? 20 : 10;

        return activeAlerts.find(a => {
            const alertY = series.priceToCoordinate(a.price);
            if (alertY === null) return false;
            return Math.abs(alertY - y) < pixelTolerance;
        });
    }, [symbolAlerts, seriesRef, chartRef, draftOrder, symbol]);

    const handleRemoveAlert = useCallback((id: string) => {
        removeAlert(id);
        sendMessage({
            topic: 'alert_command',
            command: 'remove',
            id
        });
    }, [removeAlert, sendMessage]);

    const handleUpdateAlertPrice = useCallback((id: string, newPrice: number) => {
        updateAlert(id, { price: newPrice });
        sendMessage({
            topic: 'alert_command',
            command: 'update',
            id,
            updates: { price: newPrice }
        });
    }, [updateAlert, sendMessage]);

    const handleAddAlertAtPrice = useCallback((price: number) => {
        if (!symbol) return;
        const id = crypto.randomUUID();
        const alertData: any = {
            id, symbol, price, active: true, type: 'crossing', note: 'Manual Alert', createdAt: Date.now()
        };
        addAlert(alertData);
        sendMessage({
            topic: 'alert_command',
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

