import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { BINANCE_DISCOVERY_SYMBOLS } from './constants';
import type { MatrixScannerConfig } from '@/features/strategy/dashboard/matrix-types';

interface ChartLike {
    symbol?: string;
}

interface TabLike {
    charts?: Record<string, ChartLike>;
}

export function normalizeSymbol(symbol: string): string {
    if (!symbol) return '';
    if (symbol.toUpperCase().includes('USDT')) return symbol.toUpperCase();
    if (symbol.endsWith('m') || symbol.endsWith('M')) return `${symbol.slice(0, -1)}m`;
    return symbol;
}

function addMatchVariants(target: Set<string>, value: unknown) {
    const exact = String(value || '').trim();
    if (!exact) return;
    target.add(exact);
    const normalized = normalizeSymbol(exact);
    if (normalized) target.add(normalized);
}

export function buildActiveSymbolSet(state: ReturnType<typeof useMarketStore.getState>): Set<string> {
    const set = new Set<string>();

    const watchlistSymbols = state.watchlistItems?.length > 0
        ? state.watchlistItems.map((item) => item.symbol)
        : state.watchlist;
    watchlistSymbols.forEach((symbol) => addMatchVariants(set, symbol));

    Object.values(state.tabs as Record<string, TabLike>).forEach((tab) => {
        Object.values(tab.charts || {}).forEach((chart) => addMatchVariants(set, chart.symbol));
    });

    BINANCE_DISCOVERY_SYMBOLS.forEach((symbol) => addMatchVariants(set, symbol));
    return set;
}

export function collectActiveSymbolsFromStore(): string[] {
    const state = useMarketStore.getState();
    const strategyState = useStrategyStore.getState();
    const expanded = new Set<string>();

    const watchlistSymbols = state.watchlistItems?.length > 0
        ? state.watchlistItems.map((item) => item.symbol)
        : state.watchlist;
    watchlistSymbols.forEach((symbol) => {
        const exact = String(symbol || '').trim();
        if (exact) expanded.add(exact);
    });

    Object.values(state.tabs as Record<string, TabLike>).forEach((tab) => {
        Object.values(tab.charts || {}).forEach((chart) => {
            const exact = String(chart.symbol || '').trim();
            if (exact) expanded.add(exact);
        });
    });

    const matrixSymbols = (strategyState.matrixScanners || [])
        .flatMap((scanner: MatrixScannerConfig) => scanner.symbols || [])
        .map((symbol) => String(symbol || '').trim())
        .filter(Boolean);
    const activeStrategySymbols = (strategyState.strategies || [])
        .filter((strategy) => strategy.active && strategy.symbol)
        .map((strategy) => String(strategy.symbol || '').trim())
        .filter(Boolean);

    for (const symbol of [...matrixSymbols, ...activeStrategySymbols]) {
        expanded.add(symbol);
    }

    BINANCE_DISCOVERY_SYMBOLS.forEach((symbol) => expanded.add(symbol));
    return Array.from(expanded).slice(0, 300);
}
