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
}

export interface DraggingPosition {
    ticket: number;
    type: 'sl' | 'tp';
    price: number;
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
    setAccount: (source: string, data: AccountInfo) => void;
    setPositions: (data: Position[] | ((prev: Position[]) => Position[])) => void;
    setOrders: (data: import('../types').Order[] | ((prev: import('../types').Order[]) => import('../types').Order[])) => void;
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
    editingPosition: null, // Initialized
    draggingPosition: null, // Initialized
    isTerminalVisible: true,
    isTerminalCollapsed: true,
    terminalHeight: 300,
    hoveredTicket: null,

    setAccount: (source, data) => set((state) => ({
        accounts: { ...state.accounts, [source]: data }
    })),

    // Positions Setter - OPTIMIZED to prevent flickering
    setPositions: (data) => set((state) => {
        const payload = typeof data === 'function' ? data(state.positions) : data;

        // CRITICAL FIX: Get source from first item, but DON'T process empty arrays without source
        const source = (payload as any)[0]?.source;

        // If payload is empty and no source, ignore it - prevents Binance empty arrays from wiping MT5
        if (!source && payload.length === 0) {
            return {};
        }

        const finalSource = source || 'MT5';

        const otherPositions = state.positions.filter(p => p.source !== finalSource);
        const newPositionsRaw = [...otherPositions, ...payload];

        // OPTIMIZATION: Only trigger state update if STRUCTURAL fields change
        if (state.positions.length === newPositionsRaw.length) {
            let hasStructuralChange = false;
            const prevMap = new Map(state.positions.map(p => [p.ticket, p]));

            for (const newPos of newPositionsRaw) {
                const prevPos = prevMap.get(newPos.ticket);
                if (!prevPos) {
                    hasStructuralChange = true;
                    break;
                }

                // Only compare structural fields (not profit/current_price)
                if (
                    prevPos.open_price !== newPos.open_price ||
                    prevPos.sl !== newPos.sl ||
                    prevPos.tp !== newPos.tp ||
                    prevPos.volume !== newPos.volume ||
                    prevPos.type !== newPos.type
                ) {
                    hasStructuralChange = true;
                    break;
                }
            }

            // Trigger state update for profit changes (needed for Terminal UI)
            // But return the current state if absolutely nothing changed
            if (!hasStructuralChange) {
                let anyValueChange = false;
                for (const newPos of newPositionsRaw) {
                    const prevPos = prevMap.get(newPos.ticket);
                    if (prevPos) {
                        if (prevPos.profit !== newPos.profit || prevPos.current_price !== newPos.current_price) {
                            anyValueChange = true;
                            // Mutate existing object in-place (efficient)
                            prevPos.profit = newPos.profit;
                            prevPos.current_price = newPos.current_price;
                        }
                    }
                }

                if (anyValueChange) {
                    // Return a NEW array reference to trigger UI re-render
                    // but the objects inside are the same (mutated in-place)
                    return { positions: [...state.positions] };
                }
                return {}; // No change at all
            }
        }

        return { positions: newPositionsRaw };
    }),

    setOrders: (data) => set((state) => ({
        orders: typeof data === 'function' ? data(state.orders) : data
    })),
    setHistory: (data) => set((state) => {
        const newData = typeof data === 'function' ? data(state.history) : data;
        return { history: newData };
    }),
    appendHistory: (newData, isReset = false) => set((state) => {
        const source = newData[0]?.source || 'MT5';

        // Filter out existing deals from this source if reset is requested
        let baseHistory = isReset
            ? state.history.filter(h => h.source !== source)
            : state.history;

        // Efficient merge using Map
        const map = new Map(baseHistory.map(d => [d.ticket, d]));
        newData.forEach(d => map.set(d.ticket, d));
        const combined = Array.from(map.values());

        // Sort by time desc
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
