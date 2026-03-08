import { normalizeSymbol } from '@/lib/utils/symbol';
import type { Candle } from '@/lib/store/types';
import type { Strategy, StrategySignal, VirtualPosition } from '../types';
import type { MatrixCellState, MatrixScannerConfig } from './matrix-types';
import { normalizeDashboardTf, resolveCellTTL, timeframeToChartInterval } from './matrix-utils';
import { RuleEngine } from '../logic/RuleEngine';
import { getStrategyLeg, strategySupportsDirection } from '../strategy-helpers';

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

function matchesCellStrategy(strategy: Strategy, symbol: string, timeframe: string): boolean {
    if (!strategy.active) return false;
    const tf = normalizeDashboardTf(strategy.timeframe || '1m');
    if (tf !== timeframe) return false;

    if (!strategy.symbol) return true;
    return normalizeSymbol(strategy.symbol).toLowerCase() === symbol.toLowerCase();
}

function matchesSymbolStrategy(strategy: Strategy, symbol: string): boolean {
    if (!strategy.active) return false;
    if (!strategy.symbol) return true;
    return normalizeSymbol(strategy.symbol).toLowerCase() === symbol.toLowerCase();
}

function hasMatchingStrategyId(strategyId: string, strategyIds: Set<string>): boolean {
    return strategyIds.size > 0 && strategyIds.has(strategyId);
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
    const exactMatchingStrategies = candidateStrategies.filter((s) => matchesCellStrategy(s, symbol, timeframe));
    const symbolMatchingStrategies = candidateStrategies.filter((s) => matchesSymbolStrategy(s, symbol));
    const strategiesForEntry = exactMatchingStrategies.length > 0 ? exactMatchingStrategies : symbolMatchingStrategies;
    const strategyIds = new Set(strategiesForEntry.map((s) => s.id));
    const exactStrategyIds = new Set(exactMatchingStrategies.map((s) => s.id));

    const latestSignal = input.signals
        .filter((sig) =>
            normalizeSymbol(sig.symbol).toLowerCase() === symbol.toLowerCase() &&
            hasMatchingStrategyId(sig.strategyId, strategyIds)
        )
        .sort((a, b) => b.timestamp - a.timestamp)[0];

    const ttlSec = resolveCellTTL(timeframe, input.matrixConfig);

    const candles = input.getCandles?.(symbol, timeframe) || [];
    const lastCandle = candles[candles.length - 1];
    const lastCandleMs = candleTimeToMs(lastCandle?.time);
    const staleByCandle = !lastCandleMs || ((nowMs - lastCandleMs) / 1000 > ttlSec);
    const staleBySignal = latestSignal ? (nowMs - latestSignal.timestamp) / 1000 > ttlSec : true;
    const stale = candles.length >= 2 ? staleByCandle : staleBySignal;

    let signal: MatrixCellState['signal'] = 'NO_TRADE';

    if (candles.length >= 2 && !stale && strategiesForEntry.length > 0) {
        const readyBuy = strategiesForEntry.some((s) => strategySupportsDirection(s, 'BUY') && RuleEngine.evaluateGroup(getStrategyLeg(s, 'BUY').entry, candles));
        const readySell = strategiesForEntry.some((s) => strategySupportsDirection(s, 'SELL') && RuleEngine.evaluateGroup(getStrategyLeg(s, 'SELL').entry, candles));
        if (readyBuy && !readySell) signal = 'BUY';
        else if (readySell && !readyBuy) signal = 'SELL';
    } else if (latestSignal && !stale) {
        if (latestSignal.type === 'BUY') signal = 'BUY';
        if (latestSignal.type === 'SELL') signal = 'SELL';
    }

    // Keep execution badge strict by exact timeframe strategy IDs
    // so positions from M1 do not leak to H1/H4 cells.
    const matchingPositions = input.virtualPositions.filter((p) =>
        normalizeSymbol(p.symbol).toLowerCase() === symbol.toLowerCase() &&
        hasMatchingStrategyId(p.strategyId, exactStrategyIds) &&
        (!p.timeframe || normalizeDashboardTf(p.timeframe) === timeframe)
    );

    const desiredSide = signal === 'BUY' || signal === 'SELL' ? signal : null;
    const sideMatchedPositions = desiredSide
        ? matchingPositions.filter((p) => String(p.type || '').toUpperCase() === desiredSide)
        : matchingPositions;
    const positionsForBadge = sideMatchedPositions.length > 0 ? sideMatchedPositions : matchingPositions;

    const open = positionsForBadge.some((p) => p.status === 'open');
    const pending = positionsForBadge.some((p) => p.status === 'pending');

    // If no fresh signal but there is active position state in this exact timeframe scope,
    // infer BUY/SELL from the active position side so the matrix reflects "in trade".
    if (signal === 'NO_TRADE' && (open || pending)) {
        const sides = matchingPositions
            .filter((p) => p.status === 'open' || p.status === 'pending')
            .map((p) => String(p.type || '').toLowerCase());
        const hasBuy = sides.some((s) => s.includes('buy'));
        const hasSell = sides.some((s) => s.includes('sell'));
        if (hasBuy && !hasSell) signal = 'BUY';
        else if (hasSell && !hasBuy) signal = 'SELL';
    }

    const badge: MatrixCellState['badge'] = open ? 'OPEN' : (pending ? 'PENDING' : null);

    return {
        symbol,
        timeframe,
        signal,
        badge,
        signalTimestamp: lastCandleMs || latestSignal?.timestamp,
        stale,
    };
}

export interface MatrixRunnerConfigItem {
    scannerId: string;
    strategyId: string;
    timeframe: string;
    symbol: string;
    interval: string;
    source: 'MT5';
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
                const key = `${scanner.id}:${scanner.strategyId}:MT5:${symbol}:${interval}`;
                if (seen.has(key)) continue;
                seen.add(key);
                list.push({
                    scannerId: scanner.id,
                    strategyId: scanner.strategyId,
                    timeframe: tf,
                    symbol,
                    interval,
                    source: 'MT5',
                });
            }
        }
    }

    return list;
}
