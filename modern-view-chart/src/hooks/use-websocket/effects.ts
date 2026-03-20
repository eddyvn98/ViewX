import { useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { wsRuntime } from './runtime';
import { clearForegroundResyncTimer, clearQueuedSymbolInterest, queueForegroundResync, queueSymbolsInterestSync, requestChartBackfill, sendSymbolsInterestNow, syncForegroundCharts } from './senders';
import { APP_PING_INTERVAL_MS, APP_PONG_TIMEOUT_MS, RESUME_SOCKET_GRACE_MS, SOCKET_STALE_MS } from './constants';

function ensureLiveSocket(reason: string) {
    const socket = wsRuntime.globalSocket;
    const isOpen = socket?.readyState === WebSocket.OPEN;
    const staleForMs = wsRuntime.lastMessageAt > 0 ? Date.now() - wsRuntime.lastMessageAt : Number.POSITIVE_INFINITY;

    if (!isOpen) return;
    if (staleForMs < SOCKET_STALE_MS) return;

    try {
        socket.close(4001, `resume_reconnect:${reason}`);
    } catch {
        // Ignore close races; the reconnect path will recover on next pass.
    }
}

function startHeartbeatLoop() {
    const existing = wsRuntime.heartbeatTimer;
    if (existing) clearInterval(existing);

    wsRuntime.heartbeatTimer = setInterval(() => {
        const socket = wsRuntime.globalSocket;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        const now = Date.now();
        const pongAge = wsRuntime.lastAppPongAt > 0 ? now - wsRuntime.lastAppPongAt : Number.POSITIVE_INFINITY;
        if (pongAge > APP_PING_INTERVAL_MS + APP_PONG_TIMEOUT_MS) {
            try {
                socket.close(4003, 'app_pong_timeout');
            } catch {
                // Ignore close races and let reconnect handle recovery.
            }
            return;
        }

        try {
            socket.send(JSON.stringify({ topic: 'app_ping', sentAt: now, visibilityState: document.visibilityState }));
        } catch {
            try {
                socket.close(4004, 'app_ping_failed');
            } catch {
                // Ignore close races.
            }
        }
    }, APP_PING_INTERVAL_MS);
}

export function useInitialHistoryAndForegroundResyncEffect(isConnected: boolean) {
    useEffect(() => {
        const socket = wsRuntime.globalSocket;
        if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) return;

        wsRuntime.initialResyncEffectRefCount += 1;
        if (wsRuntime.initialResyncEffectRefCount > 1) {
            return () => {
                wsRuntime.initialResyncEffectRefCount = Math.max(0, wsRuntime.initialResyncEffectRefCount - 1);
                if (wsRuntime.initialResyncEffectRefCount === 0) {
                    wsRuntime.initialResyncEffectTeardown?.();
                    wsRuntime.initialResyncEffectTeardown = null;
                }
            };
        }

        if (!wsRuntime.historyFetched) {
            wsRuntime.historyFetched = true;
            socket.send(JSON.stringify({ topic: 'mt5_command', command: 'get_history', limit: 100 }));

            const watchlist = useMarketStore.getState().watchlist;
            watchlist.forEach((s) => {
                socket.send(JSON.stringify({ topic: 'mt5_command', command: 'get_symbol_info', symbol: s }));
            });
        }

        const scheduleResumeHealthCheck = (reason: string) => {
            if (wsRuntime.resumeHealthCheckTimer) {
                clearTimeout(wsRuntime.resumeHealthCheckTimer);
            }
            const baselineMessageAt = wsRuntime.lastMessageAt;
            wsRuntime.resumeHealthCheckTimer = setTimeout(() => {
                wsRuntime.resumeHealthCheckTimer = null;
                const socketNow = wsRuntime.globalSocket;
                if (!socketNow || socketNow.readyState !== WebSocket.OPEN) return;
                if (document.visibilityState !== 'visible') return;
                if (wsRuntime.lastMessageAt > baselineMessageAt) return;
                try {
                    socketNow.close(4002, `resume_healthcheck:${reason}`);
                } catch {
                    // Ignore close races and let reconnect logic handle it.
                }
            }, RESUME_SOCKET_GRACE_MS);
        };

        const runVisibleSync = (reason: string, force: boolean) => {
            if (document.visibilityState !== 'visible') return;
            wsRuntime.lastResumeSyncAt = Date.now();
            sendSymbolsInterestNow();
            window.dispatchEvent(new CustomEvent('chart-foreground-resync', { detail: { reason, force } }));
            queueForegroundResync(() => syncForegroundCharts(force, reason));
            ensureLiveSocket(reason);
            scheduleResumeHealthCheck(reason);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                runVisibleSync('visibility_resume', true);
            }
        };
        const onFocus = () => runVisibleSync('window_focus', true);
        const onPageShow = () => runVisibleSync('page_show', true);

        runVisibleSync('socket_connected', false);
        startHeartbeatLoop();
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onFocus);
        window.addEventListener('pageshow', onPageShow);

        wsRuntime.initialResyncEffectTeardown = () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('pageshow', onPageShow);
            clearForegroundResyncTimer();
            if (wsRuntime.resumeHealthCheckTimer) {
                clearTimeout(wsRuntime.resumeHealthCheckTimer);
                wsRuntime.resumeHealthCheckTimer = null;
            }
            if (wsRuntime.heartbeatTimer) {
                clearInterval(wsRuntime.heartbeatTimer);
                wsRuntime.heartbeatTimer = null;
            }
        };

        return () => {
            wsRuntime.initialResyncEffectRefCount = Math.max(0, wsRuntime.initialResyncEffectRefCount - 1);
            if (wsRuntime.initialResyncEffectRefCount === 0) {
                wsRuntime.initialResyncEffectTeardown?.();
                wsRuntime.initialResyncEffectTeardown = null;
            }
        };
    }, [isConnected]);
}

export function useBackfillEventEffect(isConnected: boolean) {
    useEffect(() => {
        const socket = wsRuntime.globalSocket;
        if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) return;
        wsRuntime.backfillEventEffectRefCount += 1;
        if (wsRuntime.backfillEventEffectRefCount > 1) {
            return () => {
                wsRuntime.backfillEventEffectRefCount = Math.max(0, wsRuntime.backfillEventEffectRefCount - 1);
                if (wsRuntime.backfillEventEffectRefCount === 0) {
                    wsRuntime.backfillEventEffectTeardown?.();
                    wsRuntime.backfillEventEffectTeardown = null;
                }
            };
        }

        const handleBackfillRequest = (event: Event) => {
            const detail = (event as CustomEvent)?.detail || {};
            const source = String(detail.source || '').toUpperCase();
            const symbol = String(detail.symbol || '').trim();
            const interval = String(detail.interval || '').trim();
            const count = Number.isFinite(Number(detail.count)) ? Number(detail.count) : 300;
            const anchorTimeSec = Number(detail.anchorTimeSec);
            const direction = detail.direction === 'older' ? 'older' : 'latest';
            if (!symbol || !interval) return;

            requestChartBackfill(source, symbol, interval, 'event_request', count, {
                anchorTimeSec,
                direction,
            });
        };

        window.addEventListener('chart-backfill-request', handleBackfillRequest as EventListener);
        wsRuntime.backfillEventEffectTeardown = () =>
            window.removeEventListener('chart-backfill-request', handleBackfillRequest as EventListener);
        return () => {
            wsRuntime.backfillEventEffectRefCount = Math.max(0, wsRuntime.backfillEventEffectRefCount - 1);
            if (wsRuntime.backfillEventEffectRefCount === 0) {
                wsRuntime.backfillEventEffectTeardown?.();
                wsRuntime.backfillEventEffectTeardown = null;
            }
        };
    }, [isConnected]);
}

export function useSymbolInterestEffect(isConnected: boolean) {
    useEffect(() => {
        if (!isConnected) return;
        wsRuntime.symbolInterestEffectRefCount += 1;
        if (wsRuntime.symbolInterestEffectRefCount > 1) {
            return () => {
                wsRuntime.symbolInterestEffectRefCount = Math.max(0, wsRuntime.symbolInterestEffectRefCount - 1);
                if (wsRuntime.symbolInterestEffectRefCount === 0) {
                    wsRuntime.symbolInterestEffectTeardown?.();
                    wsRuntime.symbolInterestEffectTeardown = null;
                }
            };
        }
        queueSymbolsInterestSync();

        const unsubscribeWatchlist = useMarketStore.subscribe((state) => state.watchlist, () => {
            queueSymbolsInterestSync();
        });
        const unsubscribeTabs = useMarketStore.subscribe((state) => state.tabs, () => {
            queueSymbolsInterestSync();
        });

        wsRuntime.symbolInterestEffectTeardown = () => {
            unsubscribeWatchlist();
            unsubscribeTabs();
            clearQueuedSymbolInterest();
        };
        return () => {
            wsRuntime.symbolInterestEffectRefCount = Math.max(0, wsRuntime.symbolInterestEffectRefCount - 1);
            if (wsRuntime.symbolInterestEffectRefCount === 0) {
                wsRuntime.symbolInterestEffectTeardown?.();
                wsRuntime.symbolInterestEffectTeardown = null;
            }
        };
    }, [isConnected]);
}
