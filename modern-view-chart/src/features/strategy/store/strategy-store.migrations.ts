import { normalizeSymbol } from '@/lib/utils/symbol';
import type { MatrixScannerConfig, StrategyMatrixConfig } from '../dashboard/matrix-types';
import type { Strategy } from '../types';
import { normalizeMatrixScopeKey } from '../utils/matrix-scope';
import { normalizeTF } from '../utils/time-utils';
import {
    createDefaultScanner,
    createMergedHullStrategy,
    createScannerFromConfig,
    LEGACY_DEFAULT_MATRIX_CONFIG,
    MERGED_HULL_STRATEGY_ID,
} from './strategy-store.defaults';

export function mergeLegacyHullStrategies(rawStrategies: Strategy[]): { strategies: Strategy[]; idMap: Map<string, string> } {
    const idMap = new Map<string, string>();
    const mergedId = MERGED_HULL_STRATEGY_ID;
    const existingMerged = rawStrategies.find((s) => s.id === mergedId);
    const legacyBuy = rawStrategies.find((s) => s.id === 'hull-ha-gold-buy');
    const legacySell = rawStrategies.find((s) => s.id === 'hull-ha-gold-sell');

    if (existingMerged) {
        if (legacyBuy) idMap.set(legacyBuy.id, mergedId);
        if (legacySell) idMap.set(legacySell.id, mergedId);
        return {
            strategies: rawStrategies.filter((s) => s.id !== 'hull-ha-gold-buy' && s.id !== 'hull-ha-gold-sell'),
            idMap,
        };
    }

    if (!legacyBuy && !legacySell) {
        return { strategies: rawStrategies, idMap };
    }

    const base = createMergedHullStrategy();
    const merged: Strategy = {
        ...base,
        active: legacyBuy?.active ?? legacySell?.active ?? base.active,
        executionMode: legacyBuy?.executionMode ?? legacySell?.executionMode ?? base.executionMode,
        positionMode: legacyBuy?.positionMode ?? legacySell?.positionMode ?? base.positionMode,
        magic: legacyBuy?.magic ?? legacySell?.magic ?? base.magic,
        comment: legacyBuy?.comment || legacySell?.comment || base.comment,
        symbol: legacyBuy?.symbol || legacySell?.symbol,
        timeframe: legacyBuy?.timeframe || legacySell?.timeframe,
        aiGuard: legacyBuy?.aiGuard || legacySell?.aiGuard,
        lastSignalTime: Math.max(legacyBuy?.lastSignalTime || 0, legacySell?.lastSignalTime || 0) || undefined,
        buy: legacyBuy
            ? {
                  entry: legacyBuy.entry || base.buy!.entry,
                  trigger: legacyBuy.trigger,
                  exit: legacyBuy.exit,
                  cancelConditions: legacyBuy.cancelConditions,
                  risk: legacyBuy.risk || base.buy!.risk,
                  entryType: legacyBuy.entryType || base.buy!.entryType,
                  entryPrice: legacyBuy.entryPrice,
              }
            : base.buy,
        sell: legacySell
            ? {
                  entry: legacySell.entry || base.sell!.entry,
                  trigger: legacySell.trigger,
                  exit: legacySell.exit,
                  cancelConditions: legacySell.cancelConditions,
                  risk: legacySell.risk || base.sell!.risk,
                  entryType: legacySell.entryType || base.sell!.entryType,
                  entryPrice: legacySell.entryPrice,
              }
            : base.sell,
    };

    idMap.set('hull-ha-gold-buy', mergedId);
    idMap.set('hull-ha-gold-sell', mergedId);

    return {
        strategies: [...rawStrategies.filter((s) => s.id !== 'hull-ha-gold-buy' && s.id !== 'hull-ha-gold-sell'), merged],
        idMap,
    };
}

export function migrateStrategyStoreState(persistedState: unknown, version: number) {
    const state = (persistedState || {}) as Record<string, unknown>;
    const normalizePosition = (raw: any) => {
        if (!raw || typeof raw !== 'object') return raw;
        const symbol = typeof raw.symbol === 'string' ? normalizeSymbol(raw.symbol) : raw.symbol;
        const timeframe = typeof raw.timeframe === 'string' ? normalizeTF(raw.timeframe) : raw.timeframe;
        return {
            ...raw,
            symbol,
            timeframe,
            source: raw.source === 'MT5' ? 'MT5' : raw.source,
            matrixScopeKey: normalizeMatrixScopeKey(raw.strategyId, symbol, timeframe, raw.matrixScopeKey),
        };
    };
    const normalizeSignal = (raw: any) => {
        if (!raw || typeof raw !== 'object') return raw;
        const symbol = typeof raw.symbol === 'string' ? normalizeSymbol(raw.symbol) : raw.symbol;
        const timeframe = typeof raw.timeframe === 'string' ? normalizeTF(raw.timeframe) : raw.timeframe;
        return {
            ...raw,
            symbol,
            timeframe,
            source: raw.source === 'MT5' ? 'MT5' : raw.source,
            matrixScopeKey: normalizeMatrixScopeKey(raw.strategyId, symbol, timeframe, raw.matrixScopeKey),
        };
    };
    const rawStrategies = Array.isArray(state.strategies) ? (state.strategies as Strategy[]) : [];
    const mergedHull = mergeLegacyHullStrategies(rawStrategies);
    const remapStrategyId = (raw: any) => {
        if (!raw || typeof raw !== 'object') return raw;
        const nextStrategyId = mergedHull.idMap.get(raw.strategyId) || raw.strategyId;
        const nextTimeframe = typeof raw.timeframe === 'string' ? normalizeTF(raw.timeframe) : raw.timeframe;
        const nextSymbol = typeof raw.symbol === 'string' ? normalizeSymbol(raw.symbol) : raw.symbol;
        return {
            ...raw,
            strategyId: nextStrategyId,
            symbol: nextSymbol,
            timeframe: nextTimeframe,
            matrixScopeKey: normalizeMatrixScopeKey(nextStrategyId, nextSymbol, nextTimeframe, raw.matrixScopeKey),
        };
    };
    if (version < 2) {
        const legacyRaw = state.matrixConfig as StrategyMatrixConfig | undefined;
        const legacyConfig: StrategyMatrixConfig =
            legacyRaw && Array.isArray(legacyRaw.symbols) && Array.isArray(legacyRaw.timeframes)
                ? legacyRaw
                : LEGACY_DEFAULT_MATRIX_CONFIG;
        const scanners =
            Array.isArray(state.matrixScanners) && state.matrixScanners.length > 0
                ? (state.matrixScanners as MatrixScannerConfig[])
                : [createScannerFromConfig(legacyConfig, null)];
        return {
            ...state,
            strategies: mergedHull.strategies,
            matrixScanners: scanners,
            focusedMatrixScannerId: null,
            virtualPositions: Array.isArray(state.virtualPositions) ? state.virtualPositions.map(remapStrategyId).map(normalizePosition) : [],
            signals: Array.isArray(state.signals) ? state.signals.map(remapStrategyId).map(normalizeSignal) : [],
        };
    }
    if (version < 3) {
        return {
            ...state,
            strategies: mergedHull.strategies,
            matrixScanners: Array.isArray(state.matrixScanners) && state.matrixScanners.length > 0 ? state.matrixScanners : [createDefaultScanner(0)],
            focusedMatrixScannerId: typeof state.focusedMatrixScannerId === 'string' ? state.focusedMatrixScannerId : null,
            virtualPositions: Array.isArray(state.virtualPositions) ? state.virtualPositions.map(remapStrategyId).map(normalizePosition) : [],
            signals: Array.isArray(state.signals) ? state.signals.map(remapStrategyId).map(normalizeSignal) : [],
        };
    }
    if (version < 4) {
        return {
            ...state,
            strategies: mergedHull.strategies.length > 0 ? mergedHull.strategies : [createMergedHullStrategy()],
            matrixScanners:
                Array.isArray(state.matrixScanners) && state.matrixScanners.length > 0
                    ? state.matrixScanners.map((scanner: any) => ({
                          ...scanner,
                          strategyId: mergedHull.idMap.get(scanner.strategyId) || scanner.strategyId,
                      }))
                    : [createDefaultScanner(0)],
            focusedMatrixScannerId: typeof state.focusedMatrixScannerId === 'string' ? state.focusedMatrixScannerId : null,
            virtualPositions: Array.isArray(state.virtualPositions) ? state.virtualPositions.map(remapStrategyId).map(normalizePosition) : [],
            signals: Array.isArray(state.signals) ? state.signals.map(remapStrategyId).map(normalizeSignal) : [],
        };
    }
    if (!Array.isArray(state.matrixScanners) || state.matrixScanners.length === 0) {
        return {
            ...state,
            strategies: mergedHull.strategies.length > 0 ? mergedHull.strategies : [createMergedHullStrategy()],
            matrixScanners: [createDefaultScanner(0)],
            focusedMatrixScannerId: null,
            virtualPositions: Array.isArray(state.virtualPositions) ? state.virtualPositions.map(remapStrategyId).map(normalizePosition) : [],
            signals: Array.isArray(state.signals) ? state.signals.map(remapStrategyId).map(normalizeSignal) : [],
        };
    }
    return {
        ...state,
        strategies: mergedHull.strategies.length > 0 ? mergedHull.strategies : [createMergedHullStrategy()],
        matrixScanners: (state.matrixScanners as any[]).map((scanner) => ({
            ...scanner,
            strategyId: mergedHull.idMap.get(scanner.strategyId) || scanner.strategyId,
        })),
        focusedMatrixScannerId: typeof state.focusedMatrixScannerId === 'string' ? state.focusedMatrixScannerId : null,
        virtualPositions: Array.isArray(state.virtualPositions) ? state.virtualPositions.map(remapStrategyId).map(normalizePosition) : [],
        signals: Array.isArray(state.signals) ? state.signals.map(remapStrategyId).map(normalizeSignal) : [],
    };
}
