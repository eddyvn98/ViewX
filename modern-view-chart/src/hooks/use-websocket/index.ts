import { useCallback, useEffect, useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { connectSocket } from './connection';
import { useBackfillEventEffect, useInitialHistoryAndForegroundResyncEffect, useSymbolInterestEffect } from './effects';
import { wsRuntime } from './runtime';
import { SOCKET_STALE_MS } from './constants';

type WsMessage = Record<string, unknown>;

export function useWebSocket(): { sendMessage: (data: WsMessage) => void } {
    const setConnected = useMarketStore((state) => state.setConnected);
    const setBridgeOnline = useMarketStore((state) => state.setBridgeOnline);
    const updateTickers = useMarketStore((state) => state.updateTickers);
    const setCandles = useMarketStore((state) => state.setCandles);
    const updateLastCandle = useMarketStore((state) => state.updateLastCandle);
    const setAccount = useMarketStore((state) => state.setAccount);
    const setPositions = useMarketStore((state) => state.setPositions);
    const setOrders = useMarketStore((state) => state.setOrders);
    const appendHistory = useMarketStore((state) => state.appendHistory);
    const setSymbolInfo = useMarketStore((state) => state.setSymbolInfo);
    const setAvailableSymbols = useMarketStore((state) => state.setAvailableSymbols);
    const isConnected = useMarketStore((state) => state.isConnected);

    const deps = useMemo(() => ({
        appendHistory: (items: Array<Record<string, unknown>>, isReset: boolean) =>
            appendHistory(items as unknown as Parameters<typeof appendHistory>[0], isReset),
        setAccount: (source: string, account: Record<string, unknown>) =>
            setAccount(source, account as unknown as Parameters<typeof setAccount>[1]),
        setAvailableSymbols: (symbols: string[]) =>
            setAvailableSymbols(symbols as unknown as Parameters<typeof setAvailableSymbols>[0]),
        setBridgeOnline,
        setCandles: (source: string, symbol: string, interval: string, data: Array<Record<string, unknown>>) =>
            setCandles(source, symbol, interval, data as unknown as Parameters<typeof setCandles>[3]),
        setConnected,
        setOrders: (orders: Array<Record<string, unknown>>) =>
            setOrders(orders as unknown as Parameters<typeof setOrders>[0]),
        setPositions: (positions: Array<Record<string, unknown>>) =>
            setPositions(positions as unknown as Parameters<typeof setPositions>[0]),
        setSymbolInfo: (info: Record<string, unknown>) =>
            setSymbolInfo(info as unknown as Parameters<typeof setSymbolInfo>[0]),
        updateLastCandle: (source: string, symbol: string, interval: string, candle: Record<string, unknown>) =>
            updateLastCandle(source, symbol, interval, candle as unknown as Parameters<typeof updateLastCandle>[3]),
        updateTickers: (tickers: Record<string, unknown>) =>
            updateTickers(tickers as unknown as Parameters<typeof updateTickers>[0]),
    }), [
        appendHistory,
        setAccount,
        setAvailableSymbols,
        setBridgeOnline,
        setCandles,
        setConnected,
        setOrders,
        setPositions,
        setSymbolInfo,
        updateLastCandle,
        updateTickers,
    ]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const socket = wsRuntime.globalSocket;
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
        if (socket && (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING)) {
            wsRuntime.globalSocket = null;
        }
        void connectSocket(deps);
    }, [deps]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const timer = window.setInterval(() => {
            const socket = wsRuntime.globalSocket;
            const visible = document.visibilityState === 'visible';
            if (!socket || socket.readyState === WebSocket.CLOSED) {
                wsRuntime.globalSocket = null;
                if (visible) void connectSocket(deps);
                return;
            }
            if (socket.readyState !== WebSocket.OPEN) return;
            if (!visible) return;
            const staleMs = wsRuntime.lastMessageAt > 0 ? Date.now() - wsRuntime.lastMessageAt : Number.POSITIVE_INFINITY;
            if (staleMs > SOCKET_STALE_MS) {
                try {
                    socket.close(4007, 'ws_stale_watchdog');
                } catch {
                    // Ignore close races; reconnect path will recover.
                }
            }
        }, 5000);

        return () => window.clearInterval(timer);
    }, [deps]);

    useInitialHistoryAndForegroundResyncEffect(isConnected);
    useBackfillEventEffect(isConnected);
    useSymbolInterestEffect(isConnected);

    const sendMessage = useCallback((data: WsMessage) => {
        const socket = wsRuntime.globalSocket;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
                wsRuntime.globalSocket = null;
            }
            void connectSocket(deps);
            return;
        }
        if (data?.command === 'get_candles') {
            debugLog('[WS][send get_candles]', {
                symbol: data.symbol,
                interval: data.interval,
                count: data.count,
            });
        }
        socket.send(JSON.stringify(data));
    }, [deps]);

    return { sendMessage };
}
