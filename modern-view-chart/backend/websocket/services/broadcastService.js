import { RSI } from "technicalindicators";
import { calcBollingerBands } from "../../services/indicators.js";
import { fetchLatestCandle, fetchPrices } from "./dataService.js";
import { getBinancePrices } from "./binanceTickerService.js";
import { candleBuffers } from "../handlers/subscribeHandler.js";
import { safeSend } from "../wsSend.js";
import { normalizeSymbol } from "../subscriptionIndex.js";
import { getScopedMt5Prices, isRecipientForMt5Owner } from "../mt5Scope.js";
import { getCachedVietnamGoldQuotes } from "../../services/vnGoldService.js";
import { getCachedVangTodayQuotes } from "../../services/vangTodayService.js";
import { logWarn } from "../../logger.js";
import { recordBroadcastStageDuration } from "../../runtime-state.js";

let lastBroadcastWarnAt = 0;

function warnBroadcast(event, fields = {}) {
    const now = Date.now();
    if (now - lastBroadcastWarnAt < 60_000) return;
    lastBroadcastWarnAt = now;
    logWarn(event, fields);
}

function isVietnamGoldSymbol(symbol) {
    const upper = String(symbol || "").toUpperCase();
    return upper === "SJCVN" || upper === "DOJIVN";
}

export async function broadcastCandleForSymbol({ clients, mt5Prices, subscriptionIndex }, symbolTarget, ownerUserId = null) {
    const normalizedTarget = normalizeSymbol(symbolTarget);
    if (!normalizedTarget) return;

    const keys = [];
    for (const key of subscriptionIndex.chartSubscribers.keys()) {
        if (String(key).startsWith(`${normalizedTarget}|`)) keys.push(key);
    }

    for (const key of keys) {
        const [symbol, interval] = key.split("|");
        const subscribers = subscriptionIndex.chartSubscribers.get(key);
        if (!subscribers || subscribers.size === 0) continue;

        // Subscribers in the same MT5 scope receive identical candle data.
        // Group them so candle lookup + RSI/Bollinger + JSON serialization happen once
        // per scope instead of once per socket.
        const groups = new Map();
        for (const ws of subscribers) {
            const meta = clients.get(ws);
            if (!meta || !isRecipientForMt5Owner(meta, ownerUserId)) continue;
            if (ws.readyState !== ws.OPEN) continue;

            const scopeKey = meta.userId ? `user:${meta.userId}` : "__global__";
            let group = groups.get(scopeKey);
            if (!group) {
                group = {
                    userId: meta.userId || null,
                    sockets: [],
                };
                groups.set(scopeKey, group);
            }
            group.sockets.push(ws);
        }

        for (const [scopeKey, group] of groups.entries()) {
            const fetchStartAt = performance.now();
            const data = await fetchLatestCandle(mt5Prices, symbol, interval, group.userId);
            recordBroadcastStageDuration("candle_fetch", performance.now() - fetchStartAt);
            if (!data) continue;

            const candle = data.candle;
            const bufferKey = `${scopeKey}|${key}`;
            if (!candleBuffers[bufferKey]) candleBuffers[bufferKey] = [];
            const buffer = candleBuffers[bufferKey];

            const lastInBuffer = buffer[buffer.length - 1];
            if (lastInBuffer && lastInBuffer.time === candle.time) {
                lastInBuffer.close = candle.close;
            } else {
                buffer.push({ time: candle.time, close: candle.close });
                if (buffer.length > 200) buffer.shift();
            }

            const indicatorStartAt = performance.now();
            const closes = buffer.map((c) => c.close);
            const rsiArr = RSI.calculate({ period: 14, values: closes });
            const rsiValue = rsiArr[rsiArr.length - 1];

            let bollinger = null;
            if (buffer.length >= 20) {
                const bands = calcBollingerBands(buffer, 20, 2);
                if (bands.length > 0) {
                    bollinger = bands[bands.length - 1];
                }
            }
            recordBroadcastStageDuration("candle_indicator", performance.now() - indicatorStartAt);

            const source = String(symbol || "").toUpperCase().includes("USDT")
                ? "BINANCE"
                : String(symbol || "").toUpperCase() === "SJCVN" || String(symbol || "").toUpperCase() === "DOJIVN"
                    ? "VN_GOLD"
                    : "MT5";

            const serializeSendStartAt = performance.now();
            const payload = JSON.stringify({
                topic: "candleUpdate",
                data: {
                    ...candle,
                    symbol,
                    interval,
                    source,
                    rsi: rsiValue,
                    bollinger,
                },
            });

            for (const ws of group.sockets) {
                safeSend(ws, payload, { nonCritical: true });
            }
            recordBroadcastStageDuration("candle_serialize_send", performance.now() - serializeSendStartAt);
        }
    }
}

export async function broadcastPricesToSubscribers({ clients, mt5Prices, subscriptionIndex }) {
    try {
        const sourcesStartAt = performance.now();

        // Do not walk the full Binance !ticker@arr cache every second. Most viewers only
        // subscribe to a handful of symbols (and many sessions are MT5-only).
        const requestedSymbols = new Set(subscriptionIndex.symbolSubscribers.keys());
        if ((subscriptionIndex.defaultPriceClients?.size || 0) > 0) {
            for (const symbol of subscriptionIndex.coreSymbols || []) requestedSymbols.add(symbol);
        }
        const requestedBinanceSymbols = Array.from(requestedSymbols)
            .map((symbol) => normalizeSymbol(symbol))
            .filter((symbol) => String(symbol || "").toUpperCase().endsWith("USDT"));

        let binancePrices = getBinancePrices(requestedBinanceSymbols);
        if (requestedBinanceSymbols.length > 0 && binancePrices.length === 0) {
            binancePrices = await fetchPrices(requestedBinanceSymbols, { includeGold: false });
        }

        // Realtime price broadcasts must never wait for external gold refresh work.
        // Read the current cache synchronously and kick a stale refresh in the background.
        const vnGoldQuotes = getCachedVietnamGoldQuotes();
        const vangTodayQuotes = getCachedVangTodayQuotes();
        const mappedVangTodayQuotes = vangTodayQuotes.map((item) => ({
            symbol: item.symbol,
            price: Number(item.buy) || Number(item.sell) || 0,
            bid: Number(item.buy) || 0,
            ask: Number(item.sell) || 0,
            displayName: item.name,
            source: "VN_GOLD",
            serverTime: new Date(item.capturedAt || Date.now()).getTime(),
            change: 0,
            changeValue: 0,
            volume: 0,
        }));
        const tickers = [...binancePrices, ...vnGoldQuotes, ...mappedVangTodayQuotes];
        const binanceBySymbol = new Map();
        for (const item of tickers) {
            const symbol = normalizeSymbol(item?.symbol);
            if (symbol) binanceBySymbol.set(symbol, { ...item, symbol });
        }
        recordBroadcastStageDuration("price_sources", performance.now() - sourcesStartAt);

        const payloadCache = new Map();
        const latestByScopeCache = new Map();
        let scopeBuildMs = 0;
        let sendMs = 0;

        const getLatestByScope = (userId) => {
            const scopeKey = userId ? `user:${userId}` : "__global__";
            const cached = latestByScopeCache.get(scopeKey);
            if (cached) return cached;

            const scopeStartAt = performance.now();
            const latestBySymbol = new Map(binanceBySymbol);
            for (const item of getScopedMt5Prices(mt5Prices, userId || null)) {
                const symbol = normalizeSymbol(item?.symbol);
                if (symbol && !isVietnamGoldSymbol(symbol)) {
                    latestBySymbol.set(symbol, { ...item, symbol });
                }
            }
            scopeBuildMs += performance.now() - scopeStartAt;
            latestByScopeCache.set(scopeKey, latestBySymbol);
            return latestBySymbol;
        };

        for (const [ws, meta] of clients.entries()) {
            if (ws.readyState !== ws.OPEN) continue;
            if (!meta || meta.isBridgeAuthenticated) continue;

            const latestBySymbol = getLatestByScope(meta.userId || null);
            const sendStartAt = performance.now();
            const orderedSymbols = Array.isArray(meta.symbols) ? meta.symbols : [];
            const data = orderedSymbols.map((s) => latestBySymbol.get(normalizeSymbol(s))).filter(Boolean);
            if (data.length > 0) {
                const cacheKey = `explicit:${meta.userId || "__global__"}:${orderedSymbols.join("|")}`;
                let payload = payloadCache.get(cacheKey);
                if (!payload) {
                    payload = JSON.stringify({ topic: "priceUpdate", data });
                    payloadCache.set(cacheKey, payload);
                }
                safeSend(ws, payload, { nonCritical: true });
            }
            sendMs += performance.now() - sendStartAt;
        }

        const coreSymbols = subscriptionIndex.coreSymbols || [];
        for (const ws of subscriptionIndex.defaultPriceClients) {
            if (ws.readyState !== ws.OPEN) continue;
            const meta = clients.get(ws);
            if (!meta || meta.isBridgeAuthenticated) continue;

            const latestBySymbol = getLatestByScope(meta.userId || null);
            const sendStartAt = performance.now();
            const data = coreSymbols.map((s) => latestBySymbol.get(s)).filter(Boolean);
            if (data.length > 0) {
                const cacheKey = `core:${meta.userId || "__global__"}:${coreSymbols.join("|")}`;
                let payload = payloadCache.get(cacheKey);
                if (!payload) {
                    payload = JSON.stringify({ topic: "priceUpdate", data });
                    payloadCache.set(cacheKey, payload);
                }
                safeSend(ws, payload, { nonCritical: true });
            }
            sendMs += performance.now() - sendStartAt;
        }

        recordBroadcastStageDuration("price_scope", scopeBuildMs);
        recordBroadcastStageDuration("price_send", sendMs);
    } catch (err) {
        warnBroadcast("ws.price_broadcast.failed", { error: err?.message || err });
    }
}

export async function broadcastChartCandles({ clients, mt5Prices, subscriptionIndex }) {
    const uniqueSymbols = new Set(Array.from(subscriptionIndex.chartSubscribers.keys()).map((k) => String(k).split("|")[0]));

    await Promise.all(
        Array.from(uniqueSymbols, (symbol) =>
            broadcastCandleForSymbol({ clients, mt5Prices, subscriptionIndex }, symbol)
        )
    );
}

export function broadcastToAll(clients, payload) {
    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload);
        }
    }
}
