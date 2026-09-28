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
    pendingDeletions: Record<number, number>;
    setAccount: (source: string, data: AccountInfo) => void;
    setMt5AccountsAvailable: (accounts: Mt5AccountScope[]) => void;
    setSelectedMt5Scope: (scope: Mt5AccountScope) => void;
    setPositions: (data: Position[] | ((prev: Position[]) => Position[])) => void;
    setOrders: (data: Order[] | ((prev: Order[]) => Order[])) => void;
    addPendingModification: (ticket: number, field: 'sl' | 'tp' | 'open_price' | 'price_open', price: number) => void;
    addPendingDeletion: (ticket: number) => void;
    setHistory: (data: HistoryDeal[] | ((prev: HistoryDeal[]) => HistoryDeal[])) => void;
    appendHistory: (newData: HistoryDeal[], isReset?: boolean) => void;
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

    addPendingDeletion: (ticket) => set((state) => {
        const ticketNum = typeof ticket === 'string' ? parseInt(ticket, 10) : ticket;
        if (Number.isNaN(ticketNum)) return state;

        return {
            pendingDeletions: { ...state.pendingDeletions, [ticketNum]: Date.now() },
            positions: state.positions.filter((p) => Number(p.ticket) !== ticketNum),
            orders: state.orders.filter((o) => Number(o.ticket) !== ticketNum)
        };
    }),

    addPendingModification: (ticket, field, price) => set((state) => {
        const key = `${ticket}-${field}`;
        return {
            pendingModifications: {
                ...state.pendingModifications,
                [key]: { ticket, field, price, timestamp: Date.now() }
            }
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

    setPositions: (data) => set((state) => {
        const payload = typeof data === 'function' ? data(state.positions) : data;
        const source = payload[0]?.source;
        if (!source && payload.length === 0) return {};

        const finalSource = source || 'MT5';
        const otherPositions = state.positions.filter((p) => p.source !== finalSource);
        const prevMap = new Map(state.positions.map((p) => [p.ticket, p]));

        const merged = [...otherPositions, ...payload].map((p) => withPositionAnchors(p, prevMap.get(p.ticket)));
        const filtered = filterPendingDeletions(merged, state.pendingDeletions, 10000);
        const newPositions = filtered.map((position) => applyPendingPositionLocks(position, state.pendingModifications, 3000));

        if (state.positions.length === newPositions.length) {
            let hasStructuralChange = false;
            for (const nextPos of newPositions) {
                if (hasPositionStructuralChange(prevMap.get(nextPos.ticket), nextPos)) {
                    hasStructuralChange = true;
                    break;
                }
            }

            if (!hasStructuralChange) {
                let anyValueChange = false;
                for (const nextPos of newPositions) {
                    const prevPos = prevMap.get(nextPos.ticket);
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

    setOrders: (data) => set((state) => {
        const payload = typeof data === 'function' ? data(state.orders) : data;
        const prevMap = new Map(state.orders.map((o) => [o.ticket, o]));

        const merged = payload.map((o) => withOrderAnchors(o, prevMap.get(o.ticket)));
        const protectedOrders = filterPendingDeletions(merged, state.pendingDeletions, 10000)
            .map((order) => applyPendingOrderLocks(order, state.pendingModifications, 3000));

        return { orders: protectedOrders };
    }),

    setHistory: (data) => set((state) => ({
        history: typeof data === 'function' ? data(state.history) : data
    })),

    appendHistory: (newData, isReset = false) => set((state) => {
        const source = newData[0]?.source || 'MT5';
        const baseHistory = isReset ? state.history.filter((h) => h.source !== source) : state.history;
        const map = new Map(baseHistory.map((d) => [d.ticket, d]));
        newData.forEach((d) => map.set(d.ticket, d));
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
