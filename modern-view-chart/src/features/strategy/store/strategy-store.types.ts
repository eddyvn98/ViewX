import type { Candle } from '@/lib/store/types';
import type { MatrixScannerConfig, MatrixSortMode } from '../dashboard/matrix-types';
import type { Strategy, StrategyDirection, StrategySignal, TradeContext, VirtualPosition } from '../types';

export interface StrategyState {
    strategies: Strategy[];
    signals: StrategySignal[];
    virtualPositions: VirtualPosition[];
    virtualBalance: number;
    initialVirtualBalance: number;
    lastBacktestPnL: number;
    backtestCount: number;
    matrixScanners: MatrixScannerConfig[];
    focusedMatrixScannerId: string | null;
    scopedLastSignalTimes: Record<string, number>;
    addStrategy: (strategy: Strategy) => void;
    updateStrategy: (id: string, updates: Partial<Strategy>) => void;
    deleteStrategy: (id: string) => void;
    toggleStrategy: (id: string) => void;
    toggleAiGuard: (id: string) => void;
    addSignal: (signal: StrategySignal) => void;
    updateSignal: (index: number, signal: StrategySignal) => void;
    updateLastSignalTime: (strategyId: string, timestamp: number, matrixScopeKey?: string) => void;
    addVirtualPosition: (pos: VirtualPosition) => void;
    cancelVirtualPosition: (strategyId: string, symbol: string, direction?: StrategyDirection, matrixScopeKey?: string) => void;
    closeVirtualPosition: (
        strategyId: string,
        symbol: string,
        exitPrice: number,
        metadataUpdate?: Partial<TradeContext>,
        direction?: StrategyDirection,
        matrixScopeKey?: string
    ) => void;
    updateVirtualPosition: (id: string, updates: Partial<VirtualPosition>) => void;
    showHistoryMarkers: boolean;
    toggleShowHistoryMarkers: () => void;
    clearSignals: () => void;
    clearVirtualPositions: () => void;
    setVirtualBalance: (balance: number) => void;
    resetVirtualBalance: () => void;
    resetVirtualAccount: () => void;
    lastResetTime: number;
    runBacktest: (
        strategyId: string,
        candles: Candle[],
        overrideSymbol?: string,
        overrideTimeframe?: string,
        source?: 'MT5' | 'BINANCE',
        matrixScopeKey?: string
    ) => Promise<void>;
    addMatrixScanner: () => void;
    addMatrixScannerForStrategy: (strategyId: string) => string;
    findMatrixScannerByStrategy: (strategyId: string) => string | null;
    focusMatrixScanner: (scannerId: string | null) => void;
    removeMatrixScanner: (scannerId: string) => void;
    setMatrixScannerName: (scannerId: string, name: string) => void;
    setMatrixScannerStrategy: (scannerId: string, strategyId: string | null) => void;
    toggleMatrixScanner: (scannerId: string) => void;
    addMatrixScannerSymbol: (scannerId: string, symbol: string) => void;
    removeMatrixScannerSymbol: (scannerId: string, symbol: string) => void;
    addMatrixScannerTimeframe: (scannerId: string, timeframe: string) => void;
    removeMatrixScannerTimeframe: (scannerId: string, timeframe: string) => void;
    setMatrixScannerSymbolSortMode: (scannerId: string, mode: MatrixSortMode) => void;
    setMatrixScannerSignalTtlMultiplier: (scannerId: string, multiplier: number) => void;
    setMatrixScannerSignalTtlFloorSec: (scannerId: string, seconds: number) => void;
    resetMatrixScannerConfig: (scannerId: string) => void;
}
