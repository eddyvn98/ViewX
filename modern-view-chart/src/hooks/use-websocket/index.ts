import { useCallback, useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { connectSocket } from './connection';
import { useBackfillEventEffect, useInitialHistoryAndForegroundResyncEffect, useSymbolInterestEffect } from './effects';
import { wsRuntime } from './runtime';

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
        if (typeof window === 'undefined') return;
        if (wsRuntime.globalSocket) return;

        const deps = {
            appendHistory: (items: Array<Record<string, unknown>>, isReset: boolean) =>
                appendHistory(items as unknown as Parameters<typeof appendHistory>[0], isReset),
            setAccount: (source: string, account: Record<string, unknown>) =>
                setAccount(source, account as unknown as Parameters<typeof setAccount>[1]),
            setAvailableSymbols: (symbols: Array<Record<string, unknown> | string>) =>
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

    useInitialHistoryAndForegroundResyncEffect(isConnected);
    useBackfillEventEffect(isConnected);
    useSymbolInterestEffect(isConnected);

    const sendMessage = useCallback((data: WsMessage) => {
        const socket = wsRuntime.globalSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            if (data?.command === 'get_candles') {
                debugLog('[WS][send get_candles]', {
                    symbol: data.symbol,
                    interval: data.interval,
                    count: data.count,
                });
            }
            socket.send(JSON.stringify(data));
        }
    }, []);

    return { sendMessage };
}
