export type MatrixSortMode = 'abc' | 'added';
export type MatrixSignal = 'BUY' | 'SELL' | 'NO_TRADE';
export type MatrixPositionBadge = 'OPEN' | 'PENDING' | null;

export interface MatrixScannerConfig {
    id: string;
    name: string;
    strategyId: string | null;
    symbols: string[];
    timeframes: string[];
    active: boolean;
    symbolSortMode: MatrixSortMode;
    signalTtlMultiplier: number;
    signalTtlFloorSec: number;
}

export interface StrategyMatrixConfig {
    symbols: string[];
    timeframes: string[];
    symbolSortMode: MatrixSortMode;
    signalTtlMultiplier: number;
    signalTtlFloorSec: number;
}

export interface MatrixCellState {
    symbol: string;
    timeframe: string;
    signal: MatrixSignal;
    badge: MatrixPositionBadge;
    signalTimestamp?: number;
    stale: boolean;
}
