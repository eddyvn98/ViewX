import { useMarketStore } from '@/lib/store';
import { BACKFILL_THROTTLE_MS, FOREGROUND_RESYNC_DEBOUNCE_MS, SYMBOL_INTEREST_DEBOUNCE_MS } from './constants';
import { wsRuntime } from './runtime';
import { parseIntervalSeconds } from './socket-config';
import { collectActiveSymbolsFromStore, normalizeSymbol } from './symbol-utils';

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

export function requestChartBackfill(sourceRaw: string, symbolRaw: string, intervalRaw: string, reason: string, count = 300) {
    const source = String(sourceRaw || '').toUpperCase();
    const symbol = String(symbolRaw || '').trim();
    const interval = String(intervalRaw || '').trim();
    const socket = wsRuntime.globalSocket;
    if (!source || !symbol || !interval || !socket || socket.readyState !== WebSocket.OPEN) return;

    const throttleKey = `${source}:${normalizeSymbol(symbol)}:${interval}`;
    const nowMs = Date.now();
    const lastRequestedAt = wsRuntime.lastForegroundResyncAtByKey[throttleKey] || 0;
    if (nowMs - lastRequestedAt < BACKFILL_THROTTLE_MS) return;
    wsRuntime.lastForegroundResyncAtByKey[throttleKey] = nowMs;

    if (source === 'MT5') {
        socket.send(
            JSON.stringify({
                topic: 'mt5_command',
                command: 'get_candles',
                symbol,
                interval,
                count,
                reason,
            }),
        );
        return;
    }

    if (source === 'BINANCE') {
        const nowSec = Math.floor(Date.now() / 1000);
        const secondsPerBar = parseIntervalSeconds(interval);
        socket.send(
            JSON.stringify({
                topic: 'get_binance_candles',
                symbol,
                interval,
                fromTimestamp: nowSec - secondsPerBar * count,
                toTimestamp: nowSec,
                reason,
            }),
        );
    }
}

export function syncForegroundCharts(force: boolean, reason: string) {
    const state = useMarketStore.getState();
    const tabs = state.tabs;
    const nowSec = Math.floor(Date.now() / 1000);

    Object.values(tabs).forEach((tab: any) => {
        Object.values(tab.charts || {}).forEach((chart: any) => {
            const source = String(chart?.source || '').toUpperCase();
            const symbol = String(chart?.symbol || '').trim();
            const interval = String(chart?.interval || '').trim();
            if (!source || !symbol || !interval) return;

            const key = `${source}:${normalizeSymbol(symbol)}:${interval}`;
            const candles = state.candleData[key] || [];
            if (force || candles.length === 0) {
                requestChartBackfill(source, symbol, interval, reason);
                return;
            }

            const lastTime = Number(candles[candles.length - 1]?.time);
            if (!Number.isFinite(lastTime)) {
                requestChartBackfill(source, symbol, interval, reason);
                return;
            }

            const intervalSec = Math.max(60, parseIntervalSeconds(interval));
            const secondsGap = nowSec - lastTime;

            // Backfill as soon as we detect a likely missed closed bar.
            if (secondsGap >= intervalSec) {
                requestChartBackfill(source, symbol, interval, reason);
            }
        });
    });
}
