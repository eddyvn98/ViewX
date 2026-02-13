import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket'; // Import
import { IChartApi, ISeriesApi } from 'lightweight-charts';

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
    const addNotification = useMarketStore((state) => state.addNotification);
    const draftOrder = useMarketStore((state) => state.draftOrder);

    // Chart Interaction Logic
    const { sendMessage } = useWebSocket();

    // 2. Filter alerts for current symbol
    const symbolAlerts = alerts.filter(a => a.symbol === symbol);

    const handleRemoveAlert = useCallback((id: string) => {
        removeAlert(id);
        addNotification('Alert removed', 'success');
        sendMessage({
            topic: 'alert_command',
            command: 'remove',
            id
        });
    }, [removeAlert, addNotification, sendMessage]);

    const handleUpdateAlertPrice = useCallback((id: string, newPrice: number) => {
        updateAlert(id, { price: newPrice });
        addNotification(`Alert updated: ${newPrice}`, 'success');
        sendMessage({
            topic: 'alert_command',
            command: 'update',
            id,
            updates: { price: newPrice }
        });
    }, [updateAlert, addNotification, sendMessage]);

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

    // 3. Alert Monitoring Logic (Client-Side)
    // Use refs to access latest state inside subscription without re-running effect
    const prevPriceRef = useRef<number | null>(null);
    const lastTriggeredRef = useRef<Set<string>>(new Set());
    const alertsRef = useRef(alerts);
    const actionsRef = useRef({ removeAlert, sendMessage, addNotification });

    // Keep refs up to date
    useEffect(() => { alertsRef.current = alerts; }, [alerts]);
    useEffect(() => { actionsRef.current = { removeAlert, sendMessage, addNotification }; }, [removeAlert, sendMessage, addNotification]);

    useEffect(() => {
        if (!symbol) return;

        // Reset state on symbol change
        prevPriceRef.current = null;
        lastTriggeredRef.current.clear();

        return useMarketStore.subscribe(
            (state) => state.tickers[symbol]?.price,
            (currentPrice) => {
                if (!currentPrice) return;
                const prevPrice = prevPriceRef.current;

                if (prevPrice !== null) {
                    const currentSymbolAlerts = alertsRef.current.filter(a => a.symbol === symbol && a.active);
                    const { removeAlert, sendMessage, addNotification } = actionsRef.current;

                    currentSymbolAlerts.forEach(alert => {
                        if (lastTriggeredRef.current.has(alert.id)) return;

                        const crossedUp = prevPrice < alert.price && currentPrice >= alert.price;
                        const crossedDown = prevPrice > alert.price && currentPrice <= alert.price;

                        if (crossedUp || crossedDown) {
                            // Trigger Alert
                            addNotification(`Alert Triggered: ${symbol} @ ${alert.price}`, 'warning');

                            // Mark as triggered
                            lastTriggeredRef.current.add(alert.id);

                            // Auto-remove (One-time alert)
                            removeAlert(alert.id);

                            // 1. Remove from backend tracking
                            sendMessage({
                                topic: 'alert_command',
                                command: 'remove',
                                id: alert.id
                            });

                            // 2. Force Telegram Notification
                            const direction = crossedUp ? 'Bullish ↗️' : 'Bearish ↘️';
                            sendMessage({
                                topic: 'alert_command',
                                command: 'trigger',
                                alert: alert,
                                message: `🔔 Alert: ${symbol} crossed ${alert.price} (${direction})`
                            });
                        }
                    });
                }
                prevPriceRef.current = currentPrice;
            }
        );
    }, [symbol]); // Only re-subscribe if symbol changes

    return {
        alerts,
        handleAddAlertAtPrice,
        handleRemoveAlert,
        handleUpdateAlertPrice
    };
}
