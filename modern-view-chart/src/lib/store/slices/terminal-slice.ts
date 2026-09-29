import { StateCreator } from 'zustand';
import { AccountInfo, HistoryDeal, Order, Position } from '../types';
import { withOrderAnchors, withPositionAnchors } from './terminal/anchor-utils';
import { Mt5AccountScope, persistMt5Scope, readStoredMt5Scope, sameMt5Scope, SHARED_MT5_SCOPE } from '@/lib/mt5/account-scope';
import {
    applyPendingOrderLocks,
    applyPendingPositionLocks,
    filterPendingDeletions,
    hasPositionStructuralChange,
    patchRealtimePositionFields
} from './terminal/reconcile-utils';

export interface DraftOrder {
    symbol: string;
    type: 'buy' | 'sell';
    volume: number;
    price?: number;
    sl?: number;
    tp?: number;
    isMarket: boolean;
    source?: string | null;
    accountLogin?: string | null;
    terminalId?: string | null;
    broker?: string | null;
    slTouched?: boolean;
    tpTouched?: boolean;
}

export interface OrderFormState {
    orderType: 'market' | 'pending';
    side: 'buy' | 'sell';
    volume: string;
    sl: string;
    tp: string;
}

export interface DraggingPosition {
    ticket: number | string;
    type: 'sl' | 'tp' | 'entry' | 'alert';
    price: number;
}

export interface PendingModification {
    ticket: number;
    field: 'sl' | 'tp' | 'open_price' | 'price_open';
    price: number;
    source: string;
    timestamp: number;
}

export interface AnalysisResult {
    ticket: number;
    verdict: string;
    analysis: {
        rsi: number;
        hull: number;
        price: number;
        explanation: string[];
    };
    reason?: string;
}

export interface OptimizationResult {
    status: string;
    symbol: string;
    best_params: {
        rsi_buy: number;
        rsi_sell: number;
    };
    metrics: {
        pnl: number;
        winrate: number;
        trades: number;
    };
    current_metrics: {
        pnl: number;
        winrate: number;
    };
    improvement: string;
}

export interface TerminalSlice {
    accounts: Record<string, AccountInfo>;
    mt5AccountsAvailable: Mt5AccountScope[];
    selectedMt5Scope: Mt5AccountScope;
    positions: Position[];
    orders: Order[];
    history: HistoryDeal[];
    analysisResults: Record<number, AnalysisResult>;
    optimizationResult: OptimizationResult | null;
    draftOrder: DraftOrder | null;
    orderForm: OrderFormState;
    editingPosition: Position | null;
    draggingPosition: DraggingPosition | null;
    isTerminalVisible: boolean;
    isTerminalCollapsed: boolean;
    terminalHeight: number;
    hoveredTicket: number | null;
    pendingModifications: Record<string, PendingModification>;
    pendingDeletions: Record<string, number>;
    setAccount: (source: string, data: AccountInfo) => void;
    setMt5AccountsAvailable: (accounts: Mt5AccountScope[]) => void;
    setSelectedMt5Scope: (scope: Mt5AccountScope) => void;
    setPositions: (data: Position[] | ((prev: Position[]) => Position[]), sourceOverride?: string) => void;
    setOrders: (data: Order[] | ((prev: Order[]) => Order[]), sourceOverride?: string) => void;
    addPendingModification: (
        ticket: number,
        field: 'sl' | 'tp' | 'open_price' | 'price_open',
        price: number,
        source?: string,
    ) => void;
    addPendingDeletion: (ticket: number, source?: string) => void;
    setHistory: (data: HistoryDeal[] | ((prev: HistoryDeal[]) => HistoryDeal[])) => void;
    appendHistory: (newData: HistoryDeal[], isReset?: boolean, sourceOverride?: string) => void;
    setAnalysisResult: (ticket: number, result: AnalysisResult) => void;
    setOptimizationResult: (result: OptimizationResult | null) => void;
    setTerminalVisible: (visible: boolean) => void;
    setTerminalCollapsed: (collapsed: boolean) => void;
    setTerminalHeight: (height: number) => void;
    setDraftOrder: (draft: DraftOrder | null) => void;
    setOrderForm: (draft: Partial<OrderFormState>) => void;
    resetOrderForm: () => void;
    setEditingPosition: (position: Position | null) => void;
    setDraggingPosition: (drag: DraggingPosition | null) => void;
    setHoveredTicket: (ticket: number | null) => void;
}

export const createTerminalSlice: StateCreator<TerminalSlice> = (set) => ({
    accounts: {},
    mt5AccountsAvailable: [SHARED_MT5_SCOPE],
    selectedMt5Scope: readStoredMt5Scope(),
    positions: [],
    orders: [],
    history: [],
    analysisResults: {},
    optimizationResult: null,
    draftOrder: null,
    orderForm: {
        orderType: 'market',
        side: 'buy',
        volume: '0.1',
        sl: '',
        tp: '',
    },
    editingPosition: null,
    draggingPosition: null,
    isTerminalVisible: true,
    isTerminalCollapsed: true,
    terminalHeight: 300,
    hoveredTicket: null,
    pendingModifications: {},
    pendingDeletions: {},

    addPendingDeletion: (ticket, source = 'MT5') => set((state) => {
        const ticketNum = typeof ticket === 'string' ? parseInt(ticket, 10) : ticket;
        if (Number.isNaN(ticketNum)) return state;
        const sourceKey = String(source || 'MT5');
        const key = `${sourceKey}:${ticketNum}`;

        return {
            pendingDeletions: { ...state.pendingDeletions, [key]: Date.now() },
            positions: state.positions.filter(
                (p) => String(p.source || 'MT5') !== sourceKey || Number(p.ticket) !== ticketNum,
            ),
            orders: state.orders.filter(
                (o) => String(o.source || 'MT5') !== sourceKey || Number(o.ticket) !== ticketNum,
            ),
        };
    }),

    addPendingModification: (ticket, field, price, source = 'MT5') => set((state) => {
        const sourceKey = String(source || 'MT5');
        const key = `${sourceKey}:${ticket}-${field}`;
        const matches = (item: { ticket: number; source?: string }) =>
            item.ticket === ticket && String(item.source || 'MT5') === sourceKey;
        return {
            pendingModifications: {
                ...state.pendingModifications,
                [key]: { ticket, field, price, source: sourceKey, timestamp: Date.now() },
            },
            positions: field === 'price_open'
                ? state.positions
                : state.positions.map((item) => matches(item) ? { ...item, [field]: price } : item),
            orders: field === 'open_price'
                ? state.orders
                : state.orders.map((item) => matches(item) ? { ...item, [field]: price } : item),
        };
    }),

    setAccount: (source, data) => set((state) => ({
        accounts: { ...state.accounts, [source]: data }
    })),

    setMt5AccountsAvailable: (accounts) => set((state) => {
        const normalized = Array.isArray(accounts) && accounts.length > 0 ? accounts : [SHARED_MT5_SCOPE];
        const selectedStillExists = normalized.some((scope) => sameMt5Scope(scope, state.selectedMt5Scope));
        if (selectedStillExists) {
            return { mt5AccountsAvailable: normalized };
        }
        const fallback = normalized.find((scope) => scope.source === 'MT5')
            || normalized[0]
            || SHARED_MT5_SCOPE;
        return {
            mt5AccountsAvailable: normalized,
            selectedMt5Scope: persistMt5Scope(fallback),
        };
    }),

    setSelectedMt5Scope: (scope) => set({
        selectedMt5Scope: persistMt5Scope(scope),
    }),

    setPositions: (data, sourceOverride) => set((state) => {
        const payload = typeof data === 'function' ? data(state.positions) : data;
        const finalSource = sourceOverride || payload[0]?.source || 'MT5';
        const otherPositions = state.positions.filter((p) => String(p.source || 'MT5') !== finalSource);
        const positionKey = (position: Position) => `${String(position.source || 'MT5')}:${position.ticket}`;
        const prevMap = new Map(state.positions.map((p) => [positionKey(p), p]));

        const merged = [
            ...otherPositions,
            ...payload.map((p) => withPositionAnchors(p, prevMap.get(`${finalSource}:${p.ticket}`))),
        ];
        const filtered = filterPendingDeletions(merged, state.pendingDeletions, 10000);
        const newPositions = filtered.map((position) => applyPendingPositionLocks(position, state.pendingModifications, 3000));

        if (state.positions.length === newPositions.length) {
            let hasStructuralChange = false;
            for (const nextPos of newPositions) {
                if (hasPositionStructuralChange(prevMap.get(positionKey(nextPos)), nextPos)) {
                    hasStructuralChange = true;
                    break;
                }
            }

            if (!hasStructuralChange) {
                let anyValueChange = false;
                for (const nextPos of newPositions) {
                    const prevPos = prevMap.get(positionKey(nextPos));
                    if (prevPos && patchRealtimePositionFields(prevPos, nextPos)) {
                        anyValueChange = true;
                    }
                }
                if (anyValueChange) return { positions: [...state.positions] };
                return {};
            }
        }

        return { positions: newPositions };
    }),

    setOrders: (data, sourceOverride) => set((state) => {
        const payload = typeof data === 'function' ? data(state.orders) : data;
        const finalSource = sourceOverride || payload[0]?.source || 'MT5';
        const orderKey = (order: Order) => `${String(order.source || 'MT5')}:${order.ticket}`;
        const prevMap = new Map(state.orders.map((order) => [orderKey(order), order]));
        const otherOrders = state.orders.filter((order) => String(order.source || 'MT5') !== finalSource);

        const scopedOrders = payload.map((order) =>
            withOrderAnchors(order, prevMap.get(`${finalSource}:${order.ticket}`))
        );
        const protectedOrders = filterPendingDeletions(
            [...otherOrders, ...scopedOrders],
            state.pendingDeletions,
            10000,
        ).map((order) => applyPendingOrderLocks(order, state.pendingModifications, 3000));

        return { orders: protectedOrders };
    }),

    setHistory: (data) => set((state) => ({
        history: typeof data === 'function' ? data(state.history) : data
    })),

    appendHistory: (newData, isReset = false, sourceOverride) => set((state) => {
        const source = sourceOverride || newData[0]?.source || 'MT5';
        const baseHistory = isReset ? state.history.filter((h) => h.source !== source) : state.history;
        const historyKey = (deal: HistoryDeal) => `${String(deal.source || 'MT5')}:${deal.ticket}`;
        const map = new Map(baseHistory.map((deal) => [historyKey(deal), deal]));
        newData.forEach((deal) => map.set(historyKey(deal), deal));
        const combined = Array.from(map.values());
        combined.sort((a, b) => b.time - a.time);
        return { history: combined };
    }),

    setAnalysisResult: (ticket, result) => set((state) => ({
        analysisResults: { ...state.analysisResults, [ticket]: result }
    })),

    setOptimizationResult: (result) => set({ optimizationResult: result }),
    setTerminalVisible: (visible) => set({ isTerminalVisible: visible }),
    setTerminalCollapsed: (collapsed) => set({ isTerminalCollapsed: collapsed }),
    setTerminalHeight: (height) => set({ terminalHeight: height }),
    setDraftOrder: (draft) => set({ draftOrder: draft }),
    setOrderForm: (draft) => set((state) => ({
        orderForm: {
            ...state.orderForm,
            ...draft,
        },
    })),
    resetOrderForm: () => set({
        orderForm: {
            orderType: 'market',
            side: 'buy',
            volume: '0.1',
            sl: '',
            tp: '',
        },
    }),
    setEditingPosition: (position) => set({ editingPosition: position }),
    setDraggingPosition: (drag) => set({ draggingPosition: drag }),
    setHoveredTicket: (ticket) => set({ hoveredTicket: ticket }),
});
