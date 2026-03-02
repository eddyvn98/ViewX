import { useEffect, useCallback } from "react";
import { useMarketStore } from "@/lib/store";
import { soundService } from "@/features/strategy/logic/SoundService";
import { useStrategyStore } from "@/features/strategy/store/strategy-store";

const WS_URL_FROM_ENV = process.env.NEXT_PUBLIC_WS_URL || "";
let SOCKET_URL = WS_URL_FROM_ENV || "";
let globalSocket: WebSocket | null = null;
let historyFetched = false;
let reconnectAttempts = 0;
const STRATEGY_ENGINE_ENABLED = process.env.NEXT_PUBLIC_STRATEGY_ENGINE_ENABLED === "true";

let tickerUpdateBuffer: Record<string, any> = {};
let tickerUpdateTimer: NodeJS.Timeout | null = null;
let candleUpdateBuffer: Record<string, any> = {};
let candleUpdateTimer: NodeJS.Timeout | null = null;
let positionUpdateTimer: NodeJS.Timeout | null = null;
let positionUpdateBuffer: any = null;
let subscribeSymbolsTimer: NodeJS.Timeout | null = null;
let wsTicketCache = "";
let wsTicketExpiresAt = 0;
let wsTicketPromise: Promise<string> | null = null;
let forceFreshTicketOnReconnect = false;
let unauthorizedFrameReceived = false;

function parseIntervalSeconds(interval: string): number {
    const text = String(interval || "").trim();
    if (!text) return 60;
    if (/^\d+$/.test(text)) return Number(text) * 60;

    const m = text.match(/^(\d+)\s*([mhd])$/i);
    if (!m) return 60;
    const value = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === "m") return value * 60;
    if (unit === "h") return value * 3600;
    if (unit === "d") return value * 86400;
    return 60;
}

function normalizeSymbol(symbol: string): string {
    if (!symbol) return "";
    if (symbol.toUpperCase().includes("USDT")) return symbol.toUpperCase();
    if (symbol.endsWith("m") || symbol.endsWith("M")) return `${symbol.slice(0, -1)}m`;
    return symbol;
}

function collectActiveSymbolsFromStore(): string[] {
    const state = useMarketStore.getState();
    const strategyState = useStrategyStore.getState();
    const chartSymbols = Object.values(state.tabs).flatMap((tab: any) =>
        Object.values(tab.charts || {}).map((chart: any) => chart.symbol),
    );
    const matrixSymbols = (strategyState.matrixConfig?.symbols || []).map((s) => String(s));
    const activeStrategySymbols = (strategyState.strategies || [])
        .filter((s) => s.active && s.symbol)
        .map((s) => String(s.symbol));
    const all = [...state.watchlist, ...chartSymbols]
        .concat(matrixSymbols)
        .concat(activeStrategySymbols)
        .filter(Boolean)
        .map((s) => normalizeSymbol(String(s)));
    return Array.from(new Set(all)).slice(0, 300);
}

function deriveDefaultSocketUrl(): string {
    if (typeof window === "undefined") return SOCKET_URL || "ws://127.0.0.1:8091";
    if (SOCKET_URL) return SOCKET_URL;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return "ws://127.0.0.1:8091";
    }
    return `${protocol}//${host}`;
}

function extractCredentialFromUrl(url: URL): string {
    const token = url.searchParams.get("access_token");
    const ticket = url.searchParams.get("access_ticket");
    const credential = (token || ticket || "").trim();
    if (!credential) return "";
    url.searchParams.delete("access_token");
    url.searchParams.delete("access_ticket");
    return credential;
}

function stripCredentialFromSocketUrl(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);
        parsed.searchParams.delete("access_token");
        parsed.searchParams.delete("access_ticket");
        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

function buildSocketConfig(options?: { ignoreUrlCredential?: boolean }): { url: string; protocols: string[] } {
    const baseFallback = deriveDefaultSocketUrl();
    if (typeof window === "undefined") return { url: baseFallback, protocols: [] };

    const params = new URLSearchParams(window.location.search);
    const wsOverride = params.get("ws_url");
    const base = wsOverride || baseFallback;
    const ignoreUrlCredential = Boolean(options?.ignoreUrlCredential);

    try {
        const u = new URL(base);
        let credential = "";
        if (!ignoreUrlCredential) {
            credential = extractCredentialFromUrl(u);
        } else {
            u.searchParams.delete("access_token");
            u.searchParams.delete("access_ticket");
        }
        if (!credential && !ignoreUrlCredential) {
            credential = (params.get("access_token") || params.get("access_ticket") || "").trim();
        }

        const protocols = credential ? [`bearer.${credential}`] : [];
        return { url: u.toString(), protocols };
    } catch {
        const credential = ignoreUrlCredential ? "" : (params.get("access_token") || params.get("access_ticket") || "").trim();
        const protocols = credential ? [`bearer.${credential}`] : [];
        return { url: ignoreUrlCredential ? stripCredentialFromSocketUrl(base) : base, protocols };
    }
}

async function fetchWsTicketFromApi(): Promise<string> {
    if (typeof window === "undefined") return "";

    const nowSec = Math.floor(Date.now() / 1000);
    if (wsTicketCache && wsTicketExpiresAt > nowSec + 10) {
        return wsTicketCache;
    }
    if (wsTicketPromise) return wsTicketPromise;

    wsTicketPromise = fetch("/api/auth/ws-ticket", {
        method: "GET",
        credentials: "include",
    })
        .then(async (response) => {
            if (!response.ok) return "";
            const data = await response.json().catch(() => null);
            const ticket = typeof data?.access_ticket === "string" ? data.access_ticket.trim() : "";
            const expiresAt = Number.parseInt(String(data?.expires_at || "0"), 10);
            if (!ticket) return "";
            wsTicketCache = ticket;
            wsTicketExpiresAt = Number.isFinite(expiresAt) ? expiresAt : Math.floor(Date.now() / 1000) + 300;
            return wsTicketCache;
        })
        .catch(() => "")
        .finally(() => {
            wsTicketPromise = null;
        });

    return wsTicketPromise;
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

        const connect = async () => {
            const mustRefreshTicket = forceFreshTicketOnReconnect;
            const socketConfig = buildSocketConfig({ ignoreUrlCredential: mustRefreshTicket });
            if (mustRefreshTicket) {
                wsTicketCache = "";
                wsTicketExpiresAt = 0;
            }
            if (socketConfig.protocols.length === 0 || mustRefreshTicket) {
                const fetchedTicket = await fetchWsTicketFromApi();
                if (fetchedTicket) {
                    socketConfig.protocols = [`bearer.${fetchedTicket}`];
                }
            }
            forceFreshTicketOnReconnect = false;
            SOCKET_URL = socketConfig.url;
            const socket = socketConfig.protocols.length > 0
                ? new WebSocket(socketConfig.url, socketConfig.protocols)
                : new WebSocket(socketConfig.url);
            globalSocket = socket;

            socket.onopen = () => {
                reconnectAttempts = 0;
                setConnected(true);
                const userId = "user_123";
                const symbols = collectActiveSymbolsFromStore();
                socket.send(JSON.stringify({ topic: "auth", userId, symbols }));
                socket.send(JSON.stringify({ topic: "subscribeSymbols", symbols }));
            };

            socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    const msgType = msg.topic || msg.event || msg.type;
                    if (msgType === "error" && String(msg?.code || "").toLowerCase() === "unauthorized") {
                        unauthorizedFrameReceived = true;
                        socket.close(1008, "Unauthorized");
                        return;
                    }

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
                        const normalizedCandles = msg.candles.map((c: any) => ({
                            ...c,
                            time: c.time ?? c.t ?? c.timestamp ?? c.datetime,
                            open: c.open ?? c.o ?? c.open_price ?? c.price_open,
                            high: c.high ?? c.h ?? c.high_price ?? c.price_high,
                            low: c.low ?? c.l ?? c.low_price ?? c.price_low,
                            close: c.close ?? c.c ?? c.close_price ?? c.price_close,
                            volume: c.volume ?? c.v ?? c.tick_volume ?? c.real_volume ?? 0,
                        }));
                        if (process.env.NODE_ENV !== "production") {
                            const sample = normalizedCandles[0];
                            console.log("[WS][mt5_candles]", {
                                symbol: targetSymbol,
                                interval: targetInterval,
                                count: normalizedCandles.length,
                                source: msg.source,
                                sampleTime: sample?.time,
                                sampleOpen: sample?.open,
                            });
                        }
                        if (targetSymbol && targetInterval) {
                            const source = msg.source || "MT5";
                            setCandles(source, targetSymbol, targetInterval, normalizedCandles);
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
                        if (!STRATEGY_ENGINE_ENABLED) {
                            // Strategy engine is intentionally disabled in public endpoint release.
                        } else {
                        const { signal } = msg;
                        const direction = signal.signal === "BUY" ? "bullish" : "bearish";
                        useMarketStore.getState().addNotification(
                            `STRATEGY: ${signal.signal} ${signal.symbol} - ${signal.params.reason}`,
                            direction === "bullish" ? "success" : "warning",
                        );
                        soundService.playAlert();
                        }
                    }
                } catch {
                    // Ignore malformed WS frames.
                }
            };

            socket.onclose = (closeEvent) => {
                setConnected(false);
                setBridgeOnline(false);
                if (globalSocket === socket) {
                    globalSocket = null;
                }
                historyFetched = false;
                const closeReason = String(closeEvent?.reason || "").toLowerCase();
                const unauthorizedClose = Boolean(
                    unauthorizedFrameReceived ||
                    closeEvent?.code === 1008 ||
                    closeReason.includes("unauthorized"),
                );
                unauthorizedFrameReceived = false;
                if (unauthorizedClose) {
                    forceFreshTicketOnReconnect = true;
                    wsTicketCache = "";
                    wsTicketExpiresAt = 0;
                }

                reconnectAttempts += 1;
                const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 30000);
                setTimeout(() => {
                    void connect();
                }, delay);
            };

            socket.onerror = () => {
                socket.close();
            };
        };

        void connect();
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

        handleVisibility();
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [isConnected]);

    useEffect(() => {
        if (!isConnected || globalSocket?.readyState !== WebSocket.OPEN) return;

        const handleBackfillRequest = (event: Event) => {
            const detail = (event as CustomEvent)?.detail || {};
            const source = String(detail.source || "").toUpperCase();
            const symbol = String(detail.symbol || "").trim();
            const interval = String(detail.interval || "").trim();
            const count = Number.isFinite(Number(detail.count)) ? Number(detail.count) : 300;
            if (!symbol || !interval) return;

            if (source === "MT5") {
                globalSocket?.send(
                    JSON.stringify({
                        topic: "mt5_command",
                        command: "get_candles",
                        symbol,
                        interval,
                        count,
                    }),
                );
                return;
            }

            if (source === "BINANCE") {
                const nowSec = Math.floor(Date.now() / 1000);
                const secondsPerBar = parseIntervalSeconds(interval);
                globalSocket?.send(
                    JSON.stringify({
                        topic: "get_binance_candles",
                        symbol,
                        interval,
                        fromTimestamp: nowSec - secondsPerBar * count,
                        toTimestamp: nowSec,
                    }),
                );
            }
        };

        window.addEventListener("chart-backfill-request", handleBackfillRequest as EventListener);
        return () => window.removeEventListener("chart-backfill-request", handleBackfillRequest as EventListener);
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
            if (process.env.NODE_ENV !== "production" && data?.command === "get_candles") {
                console.log("[WS][send get_candles]", {
                    symbol: data.symbol,
                    interval: data.interval,
                    count: data.count,
                });
            }
            globalSocket.send(JSON.stringify(data));
        }
    }, []);

    return { sendMessage };
}
