import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { BINANCE_DISCOVERY_SYMBOLS } from './constants';

export function normalizeSymbol(symbol: string): string {
    if (!symbol) return '';
    if (symbol.toUpperCase().includes('USDT')) return symbol.toUpperCase();
    if (symbol.endsWith('m') || symbol.endsWith('M')) return `${symbol.slice(0, -1)}m`;
    return symbol;
}

export function buildActiveSymbolSet(state: ReturnType<typeof useMarketStore.getState>): Set<string> {
    const symbols = [
        ...state.watchlist,
        ...Object.values(state.tabs).flatMap((tab: any) =>
            Object.values(tab.charts || {}).map((chart: any) => chart.symbol),
        ),
    ].filter(Boolean) as string[];

    const set = new Set<string>();
    symbols.forEach((s) => {
        const normalized = normalizeSymbol(String(s));
        if (normalized) set.add(normalized);
    });
    BINANCE_DISCOVERY_SYMBOLS.forEach((s) => set.add(s));
    return set;
}

export function collectActiveSymbolsFromStore(): string[] {
    const state = useMarketStore.getState();
    const strategyState = useStrategyStore.getState();
    const chartSymbols = Object.values(state.tabs).flatMap((tab: any) =>
        Object.values(tab.charts || {}).map((chart: any) => chart.symbol),
    );
    const matrixSymbols = (strategyState.matrixConfig?.symbols || []).map((s) => String(s));
    const activeStrategySymbols = (strategyState.strategies || [])
        .filter((s) => s.active && s.symbol)
        .map((s) => String(s.symbol));
    const all = [...state.watchlist, ...chartSymbols]
        .concat(matrixSymbols)
        .concat(activeStrategySymbols)
        .filter(Boolean)
        .map((s) => normalizeSymbol(String(s)));
    const expanded = new Set<string>(all.filter(Boolean));
    BINANCE_DISCOVERY_SYMBOLS.forEach((s) => expanded.add(s));
    return Array.from(expanded).slice(0, 300);
}
