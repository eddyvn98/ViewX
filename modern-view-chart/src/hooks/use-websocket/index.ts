import { useCallback, useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { debugLog } from '@/lib/debug';
import { connectSocket } from './connection';
import { useBackfillEventEffect, useInitialHistoryAndForegroundResyncEffect, useSymbolInterestEffect } from './effects';
import { wsRuntime } from './runtime';

export function useWebSocket(): { sendMessage: (data: any) => void } {
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

        void connectSocket({
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
        });
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

    const sendMessage = useCallback((data: any) => {
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
