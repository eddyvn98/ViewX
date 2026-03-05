import { useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { wsRuntime } from './runtime';
import { clearForegroundResyncTimer, clearQueuedSymbolInterest, queueForegroundResync, queueSymbolsInterestSync, requestChartBackfill, syncForegroundCharts } from './senders';

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

        const runVisibleSync = (reason: string, force: boolean) => {
            if (document.visibilityState !== 'visible') return;
            queueForegroundResync(() => syncForegroundCharts(force, reason));
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                runVisibleSync('visibility_resume', false);
            }
        };
        const onFocus = () => runVisibleSync('window_focus', false);
        const onPageShow = () => runVisibleSync('page_show', false);

        runVisibleSync('socket_connected', false);
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onFocus);
        window.addEventListener('pageshow', onPageShow);

        wsRuntime.initialResyncEffectTeardown = () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('pageshow', onPageShow);
            clearForegroundResyncTimer();
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
            if (!symbol || !interval) return;

            requestChartBackfill(source, symbol, interval, 'event_request', count);
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
