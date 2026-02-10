import { StateCreator } from 'zustand';
import { AccountInfo, Position, HistoryDeal } from '../types';

export interface DraftOrder {
    symbol: string;
    type: 'buy' | 'sell';
    volume: number;
    price?: number; // For pending orders
    sl?: number;
    tp?: number;
    isMarket: boolean;
    slTouched?: boolean;
    tpTouched?: boolean;
}

export interface DraggingPosition {
    ticket: number;
    type: 'sl' | 'tp' | 'entry';
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
    positions: Position[];
    orders: import('../types').Order[];
    history: HistoryDeal[];
    analysisResults: Record<number, AnalysisResult>;
    optimizationResult: OptimizationResult | null;
    draftOrder: DraftOrder | null;
    editingPosition: Position | null;
    draggingPosition: DraggingPosition | null;
    isTerminalVisible: boolean;
    isTerminalCollapsed: boolean;
    terminalHeight: number;
    hoveredTicket: number | null;
    pendingModifications: Record<string, PendingModification>; // Key: "ticket-field"
    pendingDeletions: Record<number, number>; // Key: ticket, Value: timestamp
    setAccount: (source: string, data: AccountInfo) => void;
    setPositions: (data: Position[] | ((prev: Position[]) => Position[])) => void;
    setOrders: (data: import('../types').Order[] | ((prev: import('../types').Order[]) => import('../types').Order[])) => void;
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
    setEditingPosition: (position: Position | null) => void;
    setDraggingPosition: (drag: DraggingPosition | null) => void;
    setHoveredTicket: (ticket: number | null) => void;
}

export const createTerminalSlice: StateCreator<TerminalSlice> = (set) => ({
    accounts: {},
    positions: [],
    orders: [],
    history: [],
    analysisResults: {},
    optimizationResult: null,
    draftOrder: null,
    editingPosition: null,
    draggingPosition: null,
    isTerminalVisible: true,
    isTerminalCollapsed: true,
    terminalHeight: 300,
    hoveredTicket: null,
    pendingModifications: {},
    pendingDeletions: {},

    addPendingDeletion: (ticket) => set((state) => {
        const ticketNum = typeof ticket === 'string' ? parseInt(ticket) : ticket;
        if (isNaN(ticketNum)) return state;

        return {
            pendingDeletions: { ...state.pendingDeletions, [ticketNum]: Date.now() },
            positions: state.positions.filter(p => Number(p.ticket) !== ticketNum),
            orders: state.orders.filter(o => Number(o.ticket) !== ticketNum)
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

    setPositions: (data) => set((state) => {
        const payload = typeof data === 'function' ? data(state.positions) : data;
        const source = (payload as any)[0]?.source;
        if (!source && payload.length === 0) return {};
        const finalSource = source || 'MT5';
        const otherPositions = state.positions.filter(p => p.source !== finalSource);
        const newPositionsRaw = [...otherPositions, ...payload].filter(p => {
            const ticketNum = Number(p.ticket);
            const pending = state.pendingDeletions[ticketNum];
            if (pending) {
                if (Date.now() - pending > 10000) return true; // 10s expiry
                return false; // Skip deleted item
            }
            return true;
        });

        if (state.positions.length === newPositionsRaw.length) {
            let hasStructuralChange = false;
            const prevMap = new Map(state.positions.map(p => [p.ticket, p]));

            for (const newPos of newPositionsRaw) {
                // Apply Pending Locks
                const fields: ('sl' | 'tp' | 'open_price')[] = ['sl', 'tp', 'open_price'];
                fields.forEach(field => {
                    const key = `${newPos.ticket}-${field}`;
                    const pending = state.pendingModifications[key];
                    if (pending) {
                        if (Date.now() - pending.timestamp > 3000) return;
                        const wsValue = newPos[field];
                        const epsilon = 0.000001;
                        if (Math.abs(wsValue - pending.price) >= epsilon) {
                            newPos[field] = pending.price;
                        }
                    }
                });

                const prevPos = prevMap.get(newPos.ticket);
                if (!prevPos || prevPos.open_price !== newPos.open_price || prevPos.sl !== newPos.sl || prevPos.tp !== newPos.tp || prevPos.volume !== newPos.volume || prevPos.type !== newPos.type) {
                    hasStructuralChange = true;
                }
            }

            if (!hasStructuralChange) {
                let anyValueChange = false;
                for (const newPos of newPositionsRaw) {
                    const prevPos = prevMap.get(newPos.ticket);
                    if (prevPos && (prevPos.profit !== newPos.profit || prevPos.current_price !== newPos.current_price)) {
                        anyValueChange = true;
                        prevPos.profit = newPos.profit;
                        prevPos.current_price = newPos.current_price;
                    }
                }
                if (anyValueChange) return { positions: [...state.positions] };
                return {};
            }
        }

        return { positions: newPositionsRaw };
    }),

    setOrders: (data) => set((state) => {
        const payload = typeof data === 'function' ? data(state.orders) : data;

        // 🛡️ Apply protection for Orders
        const protectedOrders = payload
            .filter(o => {
                const ticketNum = Number(o.ticket);
                const pending = state.pendingDeletions[ticketNum];
                if (pending) {
                    if (Date.now() - pending > 10000) return true; // 10s expiry
                    return false;
                }
                return true;
            })
            .map(o => {
                const newOrd = { ...o };
                const fields: ('sl' | 'tp' | 'price_open')[] = ['sl', 'tp', 'price_open'];

                fields.forEach(field => {
                    const key = `${o.ticket}-${field}`;
                    const pending = state.pendingModifications[key];

                    if (pending) {
                        if (Date.now() - pending.timestamp > 3000) return;

                        const wsValue = newOrd[field];
                        const epsilon = 0.000001;

                        if (Math.abs(wsValue - pending.price) >= epsilon) {
                            // WS is old/different -> Keep optimistic
                            // @ts-ignore
                            newOrd[field] = pending.price;
                        }
                    }
                });
                return newOrd;
            });

        return { orders: protectedOrders };
    }),
    setHistory: (data) => set((state) => ({
        history: typeof data === 'function' ? data(state.history) : data
    })),
    appendHistory: (newData, isReset = false) => set((state) => {
        const source = newData[0]?.source || 'MT5';
        let baseHistory = isReset ? state.history.filter(h => h.source !== source) : state.history;
        const map = new Map(baseHistory.map(d => [d.ticket, d]));
        newData.forEach(d => map.set(d.ticket, d));
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
    setEditingPosition: (position) => set({ editingPosition: position }),
    setDraggingPosition: (drag) => set({ draggingPosition: drag }),
    setHoveredTicket: (ticket) => set({ hoveredTicket: ticket }),
});
