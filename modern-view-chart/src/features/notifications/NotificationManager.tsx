'use client';

import { useEffect, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/use-websocket';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertEditDialog } from '@/features/chart/components/AlertEditDialog';

export function NotificationManager() {
    const notifications = useMarketStore((state) => state.notifications);
    const removeNotification = useMarketStore((state) => state.removeNotification);
    const alerts = useMarketStore((state) => state.alerts);
    const updateAlert = useMarketStore((state) => state.updateAlert);
    const { sendMessage } = useWebSocket();

    const [editingAlert, setEditingAlert] = useState<{ id: string; symbol: string; price: number } | null>(null);
    const visibleNotifications = notifications.slice(-2);

    // Listen for double-click edit event from chart
    useEffect(() => {
        const handleEditAlert = (e: CustomEvent) => {
            const { id, symbol, price } = e.detail;
            console.log('[EDIT] Opening dialog for alert:', id);
            setEditingAlert({ id, symbol, price });
        };

        window.addEventListener('editAlert', handleEditAlert as EventListener);
        return () => window.removeEventListener('editAlert', handleEditAlert as EventListener);
    }, []);

    const handleNotificationClick = (alertId?: string) => {
        if (!alertId) return;
        const alert = alerts.find(a => a.id === alertId);
        if (alert) {
            setEditingAlert({ id: alert.id, symbol: alert.symbol, price: alert.price });
        }
    };

    const handleSavePrice = (newPrice: number) => {
        if (editingAlert) {
            updateAlert(editingAlert.id, { price: newPrice, active: true });
            sendMessage({
                type: 'alert_command',
                command: 'update',
                id: editingAlert.id,
                updates: { price: newPrice, active: true }
            });
        }
    };

    return (
        <>
            <div className="fixed top-12 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
                {visibleNotifications.map((notification) => (
                    <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification.alertId)}
                        className={cn(
                            "pointer-events-auto flex items-start gap-3 p-3 rounded-lg shadow-xl border animate-in slide-in-from-right-full duration-300",
                            "bg-[#1e222d] border-[#2a2e39] text-[#d1d4dc]",
                            notification.alertId && "cursor-pointer hover:bg-[#252933] transition-colors"
                        )}
                    >
                        <div className="shrink-0 mt-0.5">
                            {notification.type === 'success' && <CheckCircle size={18} className="text-green-500" />}
                            {notification.type === 'error' && <AlertCircle size={18} className="text-red-500" />}
                            {notification.type === 'warning' && <AlertTriangle size={18} className="text-yellow-500" />}
                            {notification.type === 'info' && <Info size={18} className="text-blue-500" />}
                        </div>
                        <div className="flex-1 text-sm font-medium leading-tight">
                            {notification.message}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                            }}
                            className="shrink-0 text-[#787b86] hover:text-[#d1d4dc] transition-colors"
                        >
                            <X size={16} />
                        </button>

                        <AutoDismiss id={notification.id} onDismiss={removeNotification} />
                    </div>
                ))}
            </div>

            {editingAlert && (
                <AlertEditDialog
                    alertId={editingAlert.id}
                    symbol={editingAlert.symbol}
                    currentPrice={editingAlert.price}
                    onSave={handleSavePrice}
                    onClose={() => setEditingAlert(null)}
                />
            )}
        </>
    );
}

function AutoDismiss({ id, onDismiss }: { id: string, onDismiss: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [id, onDismiss]);
    return null;
}
