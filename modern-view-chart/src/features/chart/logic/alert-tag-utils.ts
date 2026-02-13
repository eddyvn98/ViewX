import { Alert } from '@/lib/store';
import { TagData, norm } from './order-tag-utils';

export function getAlertTags(alerts: Alert[], symbol: string, draggingState: any): TagData[] {
    const targetSymbol = norm(symbol);
    const result: TagData[] = [];

    alerts.filter(a => norm(a.symbol) === targetSymbol && a.active).forEach(alert => {
        let price = alert.price;

        // Apply dragging override
        if (draggingState && draggingState.id === alert.id && draggingState.type === 'alert') {
            price = draggingState.price;
        }

        result.push({
            id: `alert-${alert.id}`,
            type: 'alert',
            ticket: alert.id, // Use Alert ID as ticket for compatibility
            price: price,
            label: 'ALERT',
            color: '#f59e0b', // Amber-500
            pOriginal: alert
        });
    });

    return result;
}
