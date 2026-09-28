import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { buildMatrixRunnerConfigs } from '@/features/strategy/dashboard/matrix-cell-state';
import type { MatrixScannerConfig } from '@/features/strategy/dashboard/matrix-types';
import { BACKFILL_THROTTLE_MS, FOREGROUND_RESYNC_DEBOUNCE_MS, SYMBOL_INTEREST_DEBOUNCE_MS } from './constants';
import { wsRuntime } from './runtime';
import { parseIntervalSeconds } from './socket-config';
import { collectActiveSymbolsFromStore, normalizeSymbol } from './symbol-utils';
import { getIncrementalHistoryCount } from '@/features/chart/hooks/history-sync';
import { buildMt5AuthFields, resolveChartDataSource } from '@/lib/mt5/account-scope';

type ChartLike = {
    source?: string;
    symbol?: string;
    interval?: string;
};

type TabLike = {
    charts?: Record<string, ChartLike>;
};

export function sendSymbolsInterestNow() {
    const socket = wsRuntime.globalSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const symbols = collectActiveSymbolsFromStore();
    socket.send(JSON.stringify({ topic: 'subscribeSymbols', symbols }));
}

export function queueSymbolsInterestSync() {
    if (wsRuntime.subscribeSymbolsTimer) {
        clearTimeout(wsRuntime.subscribeSymbolsTimer);
    }
    wsRuntime.subscribeSymbolsTimer = setTimeout(() => {
        sendSymbolsInterestNow();
        wsRuntime.subscribeSymbolsTimer = null;
    }, SYMBOL_INTEREST_DEBOUNCE_MS);
}

export function queueForegroundResync(run: () => void) {
    if (wsRuntime.foregroundResyncTimer) clearTimeout(wsRuntime.foregroundResyncTimer);
    wsRuntime.foregroundResyncTimer = setTimeout(() => {
        run();
        wsRuntime.foregroundResyncTimer = null;
    }, FOREGROUND_RESYNC_DEBOUNCE_MS);
}

export function clearQueuedSymbolInterest() {
    if (wsRuntime.subscribeSymbolsTimer) {
        clearTimeout(wsRuntime.subscribeSymbolsTimer);
        wsRuntime.subscribeSymbolsTimer = null;
    }
}

export function clearForegroundResyncTimer() {
    if (wsRuntime.foregroundResyncTimer) {
        clearTimeout(wsRuntime.foregroundResyncTimer);
        wsRuntime.foregroundResyncTimer = null;
    }
}

type BackfillOptions = {
    anchorTimeSec?: number;
    direction?: 'older' | 'latest';
};

export function getMatrixCandleRequests(scanners: MatrixScannerConfig[]) {
    return buildMatrixRunnerConfigs(scanners).map(({ source, symbol, interval }) => ({ source, symbol, interval }));
}

export function requestChartBackfill(
    sourceRaw: string,
    symbolRaw: string,
    intervalRaw: string,
    reason: string,
    count = 300,
    options?: BackfillOptions,
) {
    const source = String(sourceRaw || '').toUpperCase();
    const symbol = String(symbolRaw || '').trim();
    const interval = String(intervalRaw || '').trim();
    const socket = wsRuntime.globalSocket;
    if (!source || !symbol || !interval || !socket || socket.readyState !== WebSocket.OPEN) return;

    const selectedMt5Scope = useMarketStore.getState().selectedMt5Scope;
    const scopedSource = resolveChartDataSource(source, selectedMt5Scope);
    const mt5ScopeFields = source === 'MT5' ? buildMt5AuthFields(selectedMt5Scope) : {};
    const direction = options?.direction === 'older' ? 'older' : 'latest';
    const anchorTimeSec = Number(options?.anchorTimeSec);
    const intervalSec = Math.max(60, parseIntervalSeconds(interval));
    const anchorKey = direction === 'older' && Number.isFinite(anchorTimeSec)
        ? Math.floor(anchorTimeSec)
        : 'latest';
    const throttleKey = `${scopedSource}:${normalizeSymbol(symbol)}:${interval}:${direction}:${anchorKey}`;
    const nowMs = Date.now();
    const lastRequestedAt = wsRuntime.lastForegroundResyncAtByKey[throttleKey] || 0;
    if (nowMs - lastRequestedAt < BACKFILL_THROTTLE_MS) return;
    wsRuntime.lastForegroundResyncAtByKey[throttleKey] = nowMs;

    if (source === 'MT5') {
        if (direction === 'older' && Number.isFinite(anchorTimeSec) && anchorTimeSec > 0) {
            socket.send(
                JSON.stringify({
                    topic: 'mt5_command',
                    command: 'get_candles_at',
                    symbol,
                    interval,
                    timestamp: Math.max(1, Math.floor(anchorTimeSec - intervalSec)),
                    count,
                    reason,
                    ...mt5ScopeFields,
                }),
            );
            return;
        }

        socket.send(
            JSON.stringify({
                topic: 'mt5_command',
                command: 'get_candles',
                symbol,
                interval,
                count,
                reason,
                ...mt5ScopeFields,
            }),
        );
        return;
    }

    if (source === 'BINANCE') {
        const nowSec = Math.floor(Date.now() / 1000);
        const secondsPerBar = intervalSec;
        const endSec =
            direction === 'older' && Number.isFinite(anchorTimeSec) && anchorTimeSec > 0
                ? Math.max(secondsPerBar, Math.floor(anchorTimeSec - secondsPerBar))
                : nowSec;
        socket.send(
            JSON.stringify({
                topic: 'get_binance_candles',
                symbol,
                interval,
                fromTimestamp: Math.max(1, endSec - secondsPerBar * count),
                toTimestamp: endSec,
                reason,
            }),
        );
        return;
    }

    if (source === 'VN_GOLD') {
        socket.send(
            JSON.stringify({
                topic: 'get_vn_gold_candles',
                symbol,
                interval,
                count,
                reason,
            }),
        );
    }
}

export function syncForegroundCharts(force: boolean, reason: string) {
    void force;
    const state = useMarketStore.getState();
    const tabs = state.tabs;
    const nowSec = Math.floor(Date.now() / 1000);

    Object.values(tabs as Record<string, TabLike>).forEach((tab) => {
        Object.values(tab.charts || {}).forEach((chart) => {
            const source = String(chart?.source || '').toUpperCase();
            const symbol = String(chart?.symbol || '').trim();
            const interval = String(chart?.interval || '').trim();
            if (!source || !symbol || !interval) return;

            const dataSource = resolveChartDataSource(source, state.selectedMt5Scope);
            const key = `${dataSource}:${normalizeSymbol(symbol)}:${interval}`;
            const candles = state.candleData[key] || [];
            if (candles.length === 0) {
                requestChartBackfill(source, symbol, interval, reason);
                return;
            }

            const lastTime = Number(candles[candles.length - 1]?.time);
            if (!Number.isFinite(lastTime)) {
                requestChartBackfill(source, symbol, interval, reason);
                return;
            }

            const intervalSec = Math.max(60, parseIntervalSeconds(interval));
            const requestCount = getIncrementalHistoryCount(lastTime, nowSec, intervalSec);

            // Even forced foreground resyncs should only request bars that can
            // actually be missing. Realtime ticks cover the current open bar.
            if (requestCount > 0) {
                requestChartBackfill(source, symbol, interval, reason, requestCount);
            }
        });
    });

    // Scanner cells do not need to be open as chart tabs, so request their
    // candles explicitly. Without this, the runner has no candleData to
    // evaluate and every matrix cell remains in the no-trade state.
    const scanners = useStrategyStore.getState().matrixScanners || [];
    getMatrixCandleRequests(scanners).forEach(({ source, symbol, interval }) => {
        const normalizedSource = String(source || '').toUpperCase();
        const normalizedInterval = String(interval || '').trim();
        const dataSource = resolveChartDataSource(normalizedSource, state.selectedMt5Scope);
        const key = `${dataSource}:${normalizeSymbol(symbol)}:${normalizedInterval}`;
        const candles = state.candleData[key] || [];

        if (candles.length === 0) {
            requestChartBackfill(source, symbol, interval, reason);
            return;
        }

        const lastTime = Number(candles[candles.length - 1]?.time);
        const intervalSec = Math.max(60, parseIntervalSeconds(normalizedInterval));
        const requestCount = getIncrementalHistoryCount(lastTime, nowSec, intervalSec);
        if (requestCount > 0) {
            requestChartBackfill(source, symbol, interval, reason, requestCount);
        }
    });
}
