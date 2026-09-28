import { useCallback, useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { connectSocket } from './connection';
import { useBackfillEventEffect, useInitialHistoryAndForegroundResyncEffect, useSymbolInterestEffect } from './effects';
import { wsRuntime } from './runtime';
import { buildMt5AuthFields } from '@/lib/mt5/account-scope';

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

    useEffect(() => {
        if (process.env.NEXT_PUBLIC_E2E === '1') return;
        if (typeof window === 'undefined') return;
        if (wsRuntime.globalSocket) return;

        const deps = {
            appendHistory: (items: Array<Record<string, unknown>>, isReset: boolean, source?: string) =>
                appendHistory(items as unknown as Parameters<typeof appendHistory>[0], isReset, source),
            setAccount: (source: string, account: Record<string, unknown>) =>
                setAccount(source, account as unknown as Parameters<typeof setAccount>[1]),
            setAvailableSymbols: (symbols, scopeKey) =>
                setAvailableSymbols(
                    symbols as Parameters<typeof setAvailableSymbols>[0],
                    scopeKey,
                ),
            setBridgeOnline,
            setCandles: (source: string, symbol: string, interval: string, data: Array<Record<string, unknown>>) =>
                setCandles(source, symbol, interval, data as unknown as Parameters<typeof setCandles>[3]),
            setConnected,
            setOrders: (orders: Array<Record<string, unknown>>, source?: string) =>
                setOrders(orders as unknown as Parameters<typeof setOrders>[0], source),
            setPositions: (positions: Array<Record<string, unknown>>, source?: string) =>
                setPositions(positions as unknown as Parameters<typeof setPositions>[0], source),
            setSymbolInfo: (info: Record<string, unknown>, keyOverride?: string) =>
                setSymbolInfo(
                    info as unknown as Parameters<typeof setSymbolInfo>[0],
                    keyOverride,
                ),
            updateLastCandle: (source: string, symbol: string, interval: string, candle: Record<string, unknown>) =>
                updateLastCandle(source, symbol, interval, candle as unknown as Parameters<typeof updateLastCandle>[3]),
            updateTickers: (tickers: Record<string, unknown>) =>
                updateTickers(tickers as unknown as Parameters<typeof updateTickers>[0]),
        };

        void connectSocket(deps);
    }, [
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

        const reconnectWithFreshAuth = () => {
            const socket = wsRuntime.globalSocket;
            wsRuntime.forceFreshTicketOnReconnect = true;
            wsRuntime.wsTicketCache = '';
            wsRuntime.wsTicketExpiresAt = 0;

            if (!socket) {
                return;
            }

            try {
                socket.close(4005, 'auth_state_changed');
            } catch {
                // Ignore close races; reconnect path will recover.
            }
        };

        window.addEventListener('auth-changed', reconnectWithFreshAuth);
        window.addEventListener('auth-state-changed', reconnectWithFreshAuth);
        return () => {
            window.removeEventListener('auth-changed', reconnectWithFreshAuth);
            window.removeEventListener('auth-state-changed', reconnectWithFreshAuth);
        };
    }, []);

    useInitialHistoryAndForegroundResyncEffect(isConnected);
    useBackfillEventEffect(isConnected);
    useSymbolInterestEffect(isConnected);

    const sendMessage = useCallback((data: WsMessage) => {
        const socket = wsRuntime.globalSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            let outbound: WsMessage = data;
            if (data?.topic === 'mt5_command' && data?.account_login === undefined && data?.accountLogin === undefined) {
                const selectedMt5Scope = useMarketStore.getState().selectedMt5Scope;
                outbound = {
                    ...data,
                    ...buildMt5AuthFields(selectedMt5Scope),
                };
            }

            if (outbound?.command === 'get_candles') {
                debugLog('[WS][send get_candles]', {
                    symbol: outbound.symbol,
                    interval: outbound.interval,
                    count: outbound.count,
                });
            }
            socket.send(JSON.stringify(outbound));
        }
    }, []);

    return { sendMessage };
}
