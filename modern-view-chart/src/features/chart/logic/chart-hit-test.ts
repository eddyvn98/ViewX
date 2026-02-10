import { ISeriesApi } from 'lightweight-charts';
import { Alert, Position, Order } from '@/lib/store';
import { DraftOrder } from '@/lib/store/slices/terminal-slice';

interface HitTestResult {
    type: 'entry' | 'sl' | 'tp' | 'alert' | 'limit';
    id?: string;
    ticket?: number | string;
    price: number;
}

interface StateRef {
    positions: Position[];
    orders: Order[];
    draftOrder: DraftOrder | null;
    symbolInfo: any;
    alerts: Alert[];
    currentPrice: number;
}

export const getNearElement = (
    y: number,
    x: number,
    series: ISeriesApi<"Candlestick"> | null,
    container: HTMLElement | null,
    symbol: string | undefined,
    state: StateRef,
    isTouch: boolean = false
): HitTestResult | null => {
    if (!series || !container || !symbol) return null;

    const { positions, orders, draftOrder, alerts, currentPrice } = state;

    // Helper to match symbols with or without suffixes like .m
    const norm = (sym: string | undefined) => (sym || '').toUpperCase().replace('.M', '').replace('.H', '');
    const targetSymbol = norm(symbol);

    const width = container.clientWidth;
    const isNearRightEdge = (width - x) < 100;
    let tolerance = isNearRightEdge ? 25 : 12;
    if (isTouch) tolerance = 30;

    // 1. Alerts
    const symbolAlerts = alerts.filter(a => norm(a.symbol) === targetSymbol && a.active);
    for (const a of symbolAlerts) {
        const cy = series.priceToCoordinate(a.price);
        if (cy !== null && Math.abs(cy - y) < tolerance) return { type: 'alert', id: a.id, price: a.price, ticket: a.id };
    }

    // 2. Draft
    if (draftOrder && norm(draftOrder.symbol) === targetSymbol) {
        const bid = currentPrice || 0;
        const isBuy = draftOrder.type === 'buy';
        const ask = bid * 1.0001;
        const entryPrice = draftOrder.isMarket ? (isBuy ? ask : bid) : (draftOrder.price || bid);
        const lines = [{ type: 'entry', price: entryPrice }, { type: 'sl', price: draftOrder.sl || 0 }, { type: 'tp', price: draftOrder.tp || 0 }];
        for (const l of lines) {
            if (l.price <= 0) continue;
            const cy = series.priceToCoordinate(l.price);
            if (cy !== null && Math.abs(cy - y) < tolerance) return { ...l, ticket: 'draft' } as any;
        }
    }

    // 3. Positions & Orders
    const items = [
        ...positions.filter(p => norm(p.symbol) === targetSymbol),
        ...orders.filter(o => norm(o.symbol) === targetSymbol)
    ];

    for (const item of items) {
        const isPos = 'open_price' in item;
        const openPrice = isPos ? (item as Position).open_price : (item as Order).price_open;
        const lines = [{ type: 'entry', price: openPrice }, { type: 'sl', price: item.sl }, { type: 'tp', price: item.tp }];
        for (const l of lines) {
            if (l.price <= 0) continue;
            const cy = series.priceToCoordinate(l.price);
            if (cy !== null && Math.abs(cy - y) < tolerance) return { ...l, ticket: item.ticket } as any;
        }
    }
    return null;
};
