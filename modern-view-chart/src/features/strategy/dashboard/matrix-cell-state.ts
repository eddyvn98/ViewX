import { normalizeSymbol } from '@/lib/utils/symbol';
import type { Candle } from '@/lib/store/types';
import type { Strategy, StrategySignal, VirtualPosition } from '../types';
import type { MatrixCellState, MatrixScannerConfig } from './matrix-types';
import { inferMatrixSymbolSource, normalizeDashboardTf, resolveCellTTL, timeframeToChartInterval } from './matrix-utils';
import { RuleEngine } from '../logic/RuleEngine';
import { strategySupportsDirection } from '../strategy-helpers';
import { buildMatrixScopeKey } from '../utils/matrix-scope';

interface BuildCellStateInput {
    symbol: string;
    timeframe: string;
    strategyId?: string | null;
    strategies: Strategy[];
    signals: StrategySignal[];
    virtualPositions: VirtualPosition[];
    matrixConfig: Pick<MatrixScannerConfig, 'signalTtlMultiplier' | 'signalTtlFloorSec'>;
    getCandles?: (symbol: string, timeframe: string) => Candle[] | undefined;
    nowMs?: number;
}

function matchesCellStrategy(strategy: Strategy): boolean {
    // In matrix mode, the scanner owns symbol/timeframe. My Bot's timeframe is
    // only a legacy/default context and must not hide cells the runner executes.
    return strategy.active;
}

function hasMatchingStrategyId(strategyId: string, strategyIds: Set<string>): boolean {
    return strategyIds.size > 0 && strategyIds.has(strategyId);
}

function matchesSignalScope(signal: StrategySignal, strategyId: string, symbol: string, timeframe: string): boolean {
    if (signal.matrixScopeKey) {
        return signal.matrixScopeKey === buildMatrixScopeKey(strategyId, symbol, timeframe);
    }
    if (signal.timeframe) {
        return normalizeDashboardTf(signal.timeframe) === timeframe;
    }
    return true;
}

function candleTimeToMs(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return n > 10_000_000_000 ? n : n * 1000;
}

export function buildMatrixCellState(input: BuildCellStateInput): MatrixCellState {
    const nowMs = input.nowMs ?? Date.now();
    const symbol = normalizeSymbol(input.symbol);
    const timeframe = normalizeDashboardTf(input.timeframe);
    if (!input.strategyId) {
        return {
            symbol,
            timeframe,
            signal: 'NO_TRADE',
            badge: null,
            signalTimestamp: undefined,
            stale: true,
        };
    }
    const candidateStrategies = input.strategies.filter((s) => s.id === input.strategyId);
    const exactMatchingStrategies = candidateStrategies.filter(matchesCellStrategy);
    const strategiesForEntry = exactMatchingStrategies;
    const strategyIds = new Set(strategiesForEntry.map((s) => s.id));
    const positionStrategyIds = new Set(candidateStrategies.map((s) => s.id));

    const latestSignal = input.signals
        .filter((sig) =>
            normalizeSymbol(sig.symbol).toLowerCase() === symbol.toLowerCase() &&
            hasMatchingStrategyId(sig.strategyId, strategyIds) &&
            matchesSignalScope(sig, sig.strategyId, symbol, timeframe)
        )
        .sort((a, b) => b.timestamp - a.timestamp)[0];

    const ttlSec = resolveCellTTL(timeframe, input.matrixConfig);

    const fullCandles = input.getCandles?.(symbol, timeframe) || [];
    const lastBar = fullCandles[fullCandles.length - 1];
    const lastBarMs = candleTimeToMs(lastBar?.time);
    
    // Evaluate rules based on CLOSED candles only (exclude current forming bar)
    const evaluationCandles = fullCandles.slice(0, -1);
    const lastClosedCandle = evaluationCandles[evaluationCandles.length - 1];
    const lastClosedCandleMs = candleTimeToMs(lastClosedCandle?.time);

    const staleByCandle = !lastBarMs || ((nowMs - lastBarMs) / 1000 > ttlSec);
    const staleBySignal = latestSignal ? (nowMs - latestSignal.timestamp) / 1000 > ttlSec : true;
    const stale = fullCandles.length >= 2 ? staleByCandle : staleBySignal;

    let signal: MatrixCellState['signal'] = 'NO_TRADE';

    // Use evaluationCandles (closed only) for RuleEngine
    if (evaluationCandles.length >= 2 && !stale && exactMatchingStrategies.length > 0) {
        const readyBuy = strategiesForEntry.some((s) => strategySupportsDirection(s, 'BUY') && RuleEngine.isEntryReady(s, 'BUY', evaluationCandles));
        const readySell = strategiesForEntry.some((s) => strategySupportsDirection(s, 'SELL') && RuleEngine.isEntryReady(s, 'SELL', evaluationCandles));
        if (readyBuy && !readySell) signal = 'BUY';
        else if (readySell && !readyBuy) signal = 'SELL';
    } else if (latestSignal && !stale) {
        if (latestSignal.type === 'BUY') signal = 'BUY';
        if (latestSignal.type === 'SELL') signal = 'SELL';
    }

    // Strict position matching: must match symbol, strategy AND timeframe exactly.
    // This supports "independent orders per timeframe".
    const matchingPositions = input.virtualPositions.filter((p) =>
        normalizeSymbol(p.symbol).toLowerCase() === symbol.toLowerCase() &&
        hasMatchingStrategyId(p.strategyId, positionStrategyIds) &&
        normalizeDashboardTf(p.timeframe) === timeframe
    );

    const desiredSide = signal === 'BUY' || signal === 'SELL' ? signal : null;
    const sideMatchedPositions = desiredSide
        ? matchingPositions.filter((p) => String(p.type || '').toUpperCase() === desiredSide)
        : matchingPositions;
    const positionsForBadge = sideMatchedPositions.length > 0 ? sideMatchedPositions : matchingPositions;

    const open = positionsForBadge.some((p) => p.status === 'open');
    const pending = positionsForBadge.some((p) => p.status === 'pending');
    const openPosition = positionsForBadge.find((p) => p.status === 'open');
    const pendingPosition = positionsForBadge.find((p) => p.status === 'pending');

    if (openPosition) {
        signal = String(openPosition.type).toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
    } else if (pendingPosition) {
        signal = String(pendingPosition.type).toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
    }

    const badge: MatrixCellState['badge'] = open ? 'OPEN' : (pending ? 'PENDING' : null);

    return {
        symbol,
        timeframe,
        signal,
        badge,
        signalTimestamp: lastClosedCandleMs || lastBarMs || latestSignal?.timestamp,
        stale,
    };
}

export interface MatrixRunnerConfigItem {
    scannerId: string;
    strategyId: string;
    timeframe: string;
    symbol: string;
    interval: string;
    source: 'MT5' | 'BINANCE';
}

export function buildMatrixRunnerConfigs(scanners: MatrixScannerConfig[]): MatrixRunnerConfigItem[] {
    const list: MatrixRunnerConfigItem[] = [];
    const seen = new Set<string>();

    for (const scanner of scanners) {
        if (!scanner.active || !scanner.strategyId) continue;
        for (const rawSymbol of scanner.symbols) {
            const symbol = normalizeSymbol(rawSymbol);
            if (!symbol) continue;
            for (const rawTf of scanner.timeframes) {
                const tf = normalizeDashboardTf(rawTf);
                if (!tf) continue;
                const interval = timeframeToChartInterval(tf);
                const source = inferMatrixSymbolSource(symbol);
                const key = `${scanner.strategyId}:${source}:${symbol}:${interval}`;
                if (seen.has(key)) continue;
                seen.add(key);
                list.push({
                    scannerId: scanner.id,
                    strategyId: scanner.strategyId,
                    timeframe: tf,
                    symbol,
                    interval,
                    source,
                });
            }
        }
    }

    return list;
}
