import { useEffect, useCallback } from "react";
import { useMarketStore } from "@/lib/store";
import { soundService } from "@/features/strategy/logic/SoundService";

let SOCKET_URL = "ws://127.0.0.1:8091";
let globalSocket: WebSocket | null = null;
let historyFetched = false;
let reconnectAttempts = 0;

let tickerUpdateBuffer: Record<string, any> = {};
let tickerUpdateTimer: NodeJS.Timeout | null = null;
let candleUpdateBuffer: Record<string, any> = {};
let candleUpdateTimer: NodeJS.Timeout | null = null;
let positionUpdateTimer: NodeJS.Timeout | null = null;
let positionUpdateBuffer: any = null;
let subscribeSymbolsTimer: NodeJS.Timeout | null = null;

function normalizeSymbol(symbol: string): string {
    if (!symbol) return "";
    if (symbol.toUpperCase().includes("USDT")) return symbol.toUpperCase();
    if (symbol.endsWith("m") || symbol.endsWith("M")) return `${symbol.slice(0, -1)}m`;
    return symbol;
}

function collectActiveSymbolsFromStore(): string[] {
    const state = useMarketStore.getState();
    const chartSymbols = Object.values(state.tabs).flatMap((tab: any) =>
        Object.values(tab.charts || {}).map((chart: any) => chart.symbol),
    );
    const all = [...state.watchlist, ...chartSymbols]
        .filter(Boolean)
        .map((s) => normalizeSymbol(String(s)));
    return Array.from(new Set(all)).slice(0, 300);
}

function buildSocketUrl(): string {
    if (typeof window === "undefined") return SOCKET_URL;
    const params = new URLSearchParams(window.location.search);
    const wsOverride = params.get("ws_url");
    const token = params.get("access_token");
    const ticket = params.get("access_ticket");
    const base = wsOverride || SOCKET_URL;

    try {
        const u = new URL(base);
        if (token && !u.searchParams.get("access_token")) {
            u.searchParams.set("access_token", token);
        }
        if (ticket && !u.searchParams.get("access_ticket")) {
            u.searchParams.set("access_ticket", ticket);
        }
        return u.toString();
    } catch {
        return base;
    }
}

function sendSymbolsInterestNow() {
    if (!globalSocket || globalSocket.readyState !== WebSocket.OPEN) return;
    const symbols = collectActiveSymbolsFromStore();
    globalSocket.send(JSON.stringify({ topic: "subscribeSymbols", symbols }));
}

function queueSymbolsInterestSync() {
    if (subscribeSymbolsTimer) {
        clearTimeout(subscribeSymbolsTimer);
    }
    subscribeSymbolsTimer = setTimeout(() => {
        sendSymbolsInterestNow();
        subscribeSymbolsTimer = null;
    }, 700);
}

export function useWebSocket(): { sendMessage: (data: any) => void } {
    const setConnected = useMarketStore((state) => state.setConnected);
    const setBridgeOnline = useMarketStore((state) => state.setBridgeOnline);
    const updateTicker = useMarketStore((state) => state.updateTicker);
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
        if (typeof window === "undefined") return;
        if (globalSocket) return;

        const connect = () => {
            SOCKET_URL = buildSocketUrl();
            globalSocket = new WebSocket(SOCKET_URL);

            globalSocket.onopen = () => {
                reconnectAttempts = 0;
                setConnected(true);
                const userId = "user_123";
                const symbols = collectActiveSymbolsFromStore();
                globalSocket?.send(JSON.stringify({ topic: "auth", userId, symbols }));
                globalSocket?.send(JSON.stringify({ topic: "subscribeSymbols", symbols }));
            };

            globalSocket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    const msgType = msg.topic || msg.event || msg.type;

                    if ((msgType === "priceUpdate" && Array.isArray(msg.data)) || msgType === "tick" || msgType === "mt5_update") {
                        const state = useMarketStore.getState();
                        const activeSymbols = new Set(
                            [
                                ...state.watchlist,
                                ...Object.values(state.tabs).flatMap((tab: any) =>
                                    Object.values(tab.charts).map((c: any) => c.symbol),
                                ),
                            ].filter(Boolean) as string[],
                        );

                        const incomingData = msgType === "priceUpdate" ? msg.data : [msg];
                        let usefulUpdate = false;
                        incomingData.forEach((item: any) => {
                            if (activeSymbols.has(item.symbol)) {
                                tickerUpdateBuffer[item.symbol] = {
                                    symbol: item.symbol,
                                    price: item.price,
                                    change: item.change || 0,
                                    changeValue: item.changeValue || 0,
                                    volume: 0,
                                    source: item.source || "MT5",
                                    serverTime: item.time,
                                };
                                usefulUpdate = true;
                            }
                        });

                        if (usefulUpdate && !tickerUpdateTimer) {
                            tickerUpdateTimer = setTimeout(() => {
                                updateTickers(tickerUpdateBuffer);
                                tickerUpdateBuffer = {};
                                tickerUpdateTimer = null;
                            }, 500);
                        }
                    }

                    if (msgType === "mt5_candles" && Array.isArray(msg.candles)) {
                        const targetSymbol = msg.symbol;
                        const targetInterval = msg.interval;
                        if (targetSymbol && targetInterval) {
                            const source = msg.source || "MT5";
                            setCandles(source, targetSymbol, targetInterval, msg.candles);
                        }
                    }

                    if (msgType === "candleUpdate" && msg.data) {
                        const c = msg.data;
                        const source = c.symbol.toUpperCase().includes("USDT") ? "BINANCE" : "MT5";
                        const key = `${source}:${c.symbol}:${c.interval}`;
                        candleUpdateBuffer[key] = { source, symbol: c.symbol, interval: c.interval, candle: c };

                        if (!candleUpdateTimer) {
                            candleUpdateTimer = setTimeout(() => {
                                Object.values(candleUpdateBuffer).forEach((item: any) => {
                                    updateLastCandle(item.source, item.symbol, item.interval, item.candle);
                                });
                                candleUpdateBuffer = {};
                                candleUpdateTimer = null;
                            }, 250);
                        }
                    }

                    if (msgType === "bridgeStatus") {
                        setBridgeOnline(msg.online);
                        if (msg.online) historyFetched = false;
                    }

                    if (msgType === "mt5_positions_update") {
                        positionUpdateBuffer = msg;
                        if (!positionUpdateTimer) {
                            positionUpdateTimer = setTimeout(() => {
                                const data = positionUpdateBuffer;
                                if (data.account) {
                                    setAccount("MT5", {
                                        balance: Number(data.account.balance) || 0,
                                        equity: Number(data.account.equity) || 0,
                                        margin: Number(data.account.margin) || 0,
                                        free_margin: Number(data.account.free_margin) || 0,
                                        margin_level: Number(data.account.margin_level) || 0,
                                        profit: Number(data.account.profit) || 0,
                                    });
                                }
                                if (data.positions && Array.isArray(data.positions)) {
                                    const mappedPositions = data.positions.map((p: any) => ({
                                        ticket: p.ticket,
                                        symbol: p.symbol,
                                        type: p.type || "buy",
                                        volume: p.volume || 0,
                                        open_price: p.price_open || 0,
                                        current_price: p.price_current || 0,
                                        sl: p.sl || 0,
                                        tp: p.tp || 0,
                                        profit: p.profit || 0,
                                        time: p.time,
                                        magic: p.magic || 0,
                                        source: "MT5",
                                    }));
                                    setPositions(mappedPositions);
                                }
                                if (data.orders && Array.isArray(data.orders)) {
                                    const mappedOrders = data.orders.map((o: any) => ({
                                        ticket: o.ticket,
                                        symbol: o.symbol,
                                        type: o.type,
                                        volume: o.volume,
                                        price_open: o.price_open,
                                        current_price: o.price_current,
                                        sl: o.sl,
                                        tp: o.tp,
                                        profit: o.profit || 0,
                                        time: o.time,
                                        magic: o.magic || 0,
                                        source: "MT5",
                                    }));
                                    setOrders(mappedOrders);
                                }
                                positionUpdateTimer = null;
                            }, 1200);
                        }
                    }

                    if (msgType === "optimization_result") {
                        const result = msg.data;
                        const setOptimizationResult = useMarketStore.getState().setOptimizationResult;
                        if (setOptimizationResult) {
                            setOptimizationResult(result);
                        }
                    }

                    if (msgType === "binance_positions_update") {
                        if (msg.account) {
                            setAccount("BINANCE_DEMO", msg.account);
                        }
                        if (msg.positions && Array.isArray(msg.positions)) {
                            const mapped = msg.positions.map((p: any) => ({ ...p, source: "BINANCE_DEMO" }));
                            setPositions(mapped);
                        }
                        if (msg.history && Array.isArray(msg.history)) {
                            const mapped = msg.history.map((h: any) => ({ ...h, source: "BINANCE_DEMO" }));
                            appendHistory(mapped, true);
                        }
                    }

                    if (msgType === "binance_order_result") {
                        if (msg.status === "success") {
                            useMarketStore.getState().addNotification(
                                `Binance Order Success: ${msg.message || "Trade executed"}`,
                                "success",
                            );
                        } else {
                            useMarketStore.getState().addNotification(`Binance Order Failed: ${msg.message}`, "error");
                        }
                    }

                    if (msgType === "mt5_history_deals") {
                        const dealData = Array.isArray(msg.data) ? msg.data : [];
                        const isChunk = msg.is_chunk !== undefined ? msg.is_chunk : false;
                        const isReset = isChunk === false;
                        appendHistory(dealData, isReset);
                    }

                    if (msgType === "mt5_symbol_info") {
                        setSymbolInfo(msg.data);
                    }

                    if (msgType === "mt5_available_symbols") {
                        setAvailableSymbols(msg.symbols || []);
                    }

                    if (msgType === "alert_triggered") {
                        const { alert, message, direction } = msg as any;
                        useMarketStore.getState().updateAlert(alert.id, { active: false, direction });
                        useMarketStore.getState().addNotification(
                            message,
                            direction === "bullish" ? "success" : "warning",
                            alert.id,
                        );
                        soundService.playAlert();
                    }

                    if (msgType === "strategy_alert") {
                        const { signal } = msg;
                        const direction = signal.signal === "BUY" ? "bullish" : "bearish";
                        useMarketStore.getState().addNotification(
                            `STRATEGY: ${signal.signal} ${signal.symbol} - ${signal.params.reason}`,
                            direction === "bullish" ? "success" : "warning",
                        );
                        soundService.playAlert();
                    }
                } catch {
                    // Ignore malformed WS frames.
                }
            };

            globalSocket.onclose = () => {
                setConnected(false);
                setBridgeOnline(false);
                globalSocket = null;
                historyFetched = false;

                reconnectAttempts += 1;
                const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 30000);
                setTimeout(connect, delay);
            };

            globalSocket.onerror = () => {
                globalSocket?.close();
            };
        };

        connect();
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
        updateTicker,
        updateTickers,
    ]);

    useEffect(() => {
        if (!isConnected || globalSocket?.readyState !== WebSocket.OPEN) return;

        if (!historyFetched) {
            historyFetched = true;
            globalSocket.send(JSON.stringify({ topic: "mt5_command", command: "get_history", limit: 100 }));

            const watchlist = useMarketStore.getState().watchlist;
            watchlist.forEach((s) => {
                globalSocket?.send(JSON.stringify({ topic: "mt5_command", command: "get_symbol_info", symbol: s }));
            });
        }

        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                const state = useMarketStore.getState();
                const tabs = state.tabs;
                const now = Date.now() / 1000;

                Object.values(tabs).forEach((tab: any) => {
                    Object.values(tab.charts).forEach((chart: any) => {
                        if (chart.source === "MT5") {
                            const key = `MT5:${chart.symbol}:${chart.interval}`;
                            const candles = state.candleData[key] || [];
                            let shouldFetch = candles.length === 0;

                            if (candles.length > 0) {
                                const lastT = Number(candles[candles.length - 1].time);
                                const intervalMinutes = parseInt(chart.interval) || 1;
                                const secondsGap = now - lastT;
                                if (secondsGap > intervalMinutes * 60 * 2) {
                                    shouldFetch = true;
                                }
                            }

                            if (shouldFetch) {
                                globalSocket?.send(
                                    JSON.stringify({
                                        topic: "mt5_command",
                                        command: "get_candles",
                                        symbol: chart.symbol,
                                        interval: chart.interval,
                                        count: 300,
                                    }),
                                );
                            }
                        }
                    });
                });
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [isConnected]);

    useEffect(() => {
        if (!isConnected) return;
        queueSymbolsInterestSync();

        const unsubscribeWatchlist = useMarketStore.subscribe((state) => state.watchlist, () => {
            queueSymbolsInterestSync();
        });
        const unsubscribeTabs = useMarketStore.subscribe((state) => state.tabs, () => {
            queueSymbolsInterestSync();
        });

        return () => {
            unsubscribeWatchlist();
            unsubscribeTabs();
            if (subscribeSymbolsTimer) {
                clearTimeout(subscribeSymbolsTimer);
                subscribeSymbolsTimer = null;
            }
        };
    }, [isConnected]);

    const sendMessage = useCallback((data: any) => {
        if (globalSocket?.readyState === WebSocket.OPEN) {
            globalSocket.send(JSON.stringify(data));
        }
    }, []);

    return { sendMessage };
}
