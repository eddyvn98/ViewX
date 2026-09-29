import { RootState, useMarketStore } from '@/lib/store';
import { buildMt5WriteFields, type Mt5TradingIdentity } from '@/lib/mt5/trading-request';
import { resolveChartIdentityDataSource } from '@/lib/mt5/account-scope';

type SendMessage = ((data: unknown) => void) | undefined;
type StoreWithTransport = RootState & { sendMessage?: (data: unknown) => void };

export interface TagEditState {
    id: string;
    ticket: string | number;
    type: string;
    price: number;
    value: number;
    x?: number;
}

export function dispatchTagRemoveAction(tag: { ticket: string | number; type: string }, sendMessage?: SendMessage, identity?: Mt5TradingIdentity) {
    if (typeof tag.ticket === 'string' && tag.ticket.startsWith('web:')) {
        return;
    }

    const store = useMarketStore.getState() as StoreWithTransport;
    const dataSource = resolveChartIdentityDataSource(identity?.source || undefined, identity);
    const isPos = store.positions.some(
        (p) => Number(p.ticket) === Number(tag.ticket)
            && String(p.source || 'MT5') === dataSource,
    );
    const isOrder = store.orders.some(
        (o) => Number(o.ticket) === Number(tag.ticket)
            && String(o.source || 'MT5') === dataSource,
    );
    if (!isPos && !isOrder) {
        store.addNotification('MT5: Ticket không thuộc account của chart hiện tại', 'error');
        return;
    }

    let command: Record<string, unknown> | null = null;
    if (tag.type === 'entry') {
        command = {
            topic: 'mt5_command',
            command: isPos ? 'close' : 'delete',
            ticket: String(tag.ticket),
            ...buildMt5WriteFields(identity),
        };
    } else if (tag.type === 'sl' || tag.type === 'tp') {
        command = {
            topic: 'mt5_command',
            command: 'modify',
            ticket: String(tag.ticket),
            [tag.type === 'sl' ? 'sl' : 'tp']: 0,
            ...buildMt5WriteFields(identity),
        };
    }

    if (!command) return;

    if (tag.type === 'entry' && store.addPendingDeletion) {
        store.addPendingDeletion(Number(tag.ticket), dataSource);
    }

    if (sendMessage) {
        sendMessage(command);
        return;
    }

    store.sendMessage?.(command);
}

export function dispatchTagEditSaveAction(state: TagEditState, val: number, sendMessage?: SendMessage, identity?: Mt5TradingIdentity) {
    const { ticket, type } = state;

    if (ticket === 'draft') {
        const store = useMarketStore.getState();
        const draft = store.draftOrder;
        if (!draft) return;

        if (type === 'volume') {
            const finalVal = isNaN(val) || val <= 0 ? 0.01 : val;
            store.setDraftOrder({ ...draft, volume: finalVal });
            return;
        }

        const field = type.replace('draft_', '');
        const mappedField = field === 'entry' ? 'price' : (field === 'sl' ? 'sl' : (field === 'tp' ? 'tp' : field));
        store.setDraftOrder({
            ...draft,
            [mappedField]: val,
            isMarket: mappedField === 'price' ? false : draft.isMarket
        });
        return;
    }

    const store = useMarketStore.getState() as StoreWithTransport;
    const dataSource = resolveChartIdentityDataSource(identity?.source || undefined, identity);
    const isPos = store.positions.some(
        (p) => Number(p.ticket) === Number(ticket)
            && String(p.source || 'MT5') === dataSource,
    );
    const isOrder = store.orders.some(
        (o) => Number(o.ticket) === Number(ticket)
            && String(o.source || 'MT5') === dataSource,
    );
    if (!isPos && !isOrder) {
        store.addNotification('MT5: Ticket không thuộc account của chart hiện tại', 'error');
        return;
    }
    if (type === 'entry' && isPos) {
        store.addNotification('MT5: Không thể sửa giá vào lệnh của position đã khớp', 'warning');
        return;
    }

    const mappedType = type === 'entry' ? 'price' : type;
    const command = { topic: 'mt5_command', command: 'modify', ticket, [mappedType]: val, ...buildMt5WriteFields(identity) };
    const pendingField = isPos
        ? (type as 'sl' | 'tp')
        : (type === 'entry' ? 'price_open' : type as 'sl' | 'tp');
    store.addPendingModification(Number(ticket), pendingField, val, dataSource);

    if (sendMessage) {
        sendMessage(command);
        return;
    }

    store.sendMessage?.(command);
}

export function dispatchTagDeleteAction(state: TagEditState, sendMessage?: SendMessage, identity?: Mt5TradingIdentity) {
    const { ticket, type } = state;
    const store = useMarketStore.getState() as StoreWithTransport;

    if (ticket === 'draft') {
        if (type === 'volume' || type.includes('entry')) {
            store.setDraftOrder(null);
            return;
        }

        const field = type.replace('draft_', '') === 'sl' ? 'sl' : 'tp';
        if (store.draftOrder) {
            store.setDraftOrder({ ...store.draftOrder, [field]: 0, [`${field}Touched`]: false });
        }
        return;
    }

    const dataSource = resolveChartIdentityDataSource(identity?.source || undefined, identity);
    const isPos = store.positions.some(
        (p) => Number(p.ticket) === Number(ticket)
            && String(p.source || 'MT5') === dataSource,
    );
    const isOrder = store.orders.some(
        (o) => Number(o.ticket) === Number(ticket)
            && String(o.source || 'MT5') === dataSource,
    );
    if (!isPos && !isOrder) {
        store.addNotification('MT5: Ticket không thuộc account của chart hiện tại', 'error');
        return;
    }
    const cmd = {
        topic: 'mt5_command',
        command: (type === 'entry' ? (isPos ? 'close' : 'delete') : 'modify'),
        ticket,
        [type === 'entry' ? 'price' : type]: 0,
        ...buildMt5WriteFields(identity),
    };

    if (type === 'entry' && store.addPendingDeletion) {
        store.addPendingDeletion(Number(ticket), dataSource);
    }

    sendMessage?.(cmd);
}
