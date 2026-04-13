import { RSI } from "technicalindicators";
import { calcBollingerBands } from "../../services/indicators.js";
import { fetchLatestCandle, fetchPrices } from "./dataService.js";
import { getBinancePrices } from "./binanceTickerService.js";
import { candleBuffers } from "../handlers/subscribeHandler.js";
import { safeSend } from "../wsSend.js";
import { normalizeSymbol } from "../subscriptionIndex.js";
import { getScopedMt5Prices, isRecipientForMt5Owner } from "../mt5Scope.js";
import { getVietnamGoldQuotes } from "../../services/vnGoldService.js";
import { logWarn } from "../../logger.js";

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

        for (const ws of subscribers) {
            const meta = clients.get(ws);
            if (!meta || !isRecipientForMt5Owner(meta, ownerUserId)) continue;
            const data = await fetchLatestCandle(mt5Prices, symbol, interval, meta.userId || null);
            if (!data) continue;

            const candle = data.candle;
            const bufferKey = `${meta.userId || "__global__"}|${key}`;
            if (!candleBuffers[bufferKey]) candleBuffers[bufferKey] = [];
            const buffer = candleBuffers[bufferKey];

            const lastInBuffer = buffer[buffer.length - 1];
            if (lastInBuffer && lastInBuffer.time === candle.time) {
                lastInBuffer.close = candle.close;
            } else {
                buffer.push({ time: candle.time, close: candle.close });
                if (buffer.length > 200) buffer.shift();
            }

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

            const source = String(symbol || "").toUpperCase().includes("USDT")
                ? "BINANCE"
                : String(symbol || "").toUpperCase() === "SJCVN" || String(symbol || "").toUpperCase() === "DOJIVN"
                    ? "VN_GOLD"
                    : "MT5";

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

            if (ws.readyState === ws.OPEN) {
                safeSend(ws, payload, { nonCritical: true });
            }
        }
    }
}

export async function broadcastPricesToSubscribers({ clients, mt5Prices, subscriptionIndex }) {
    try {
        const allPrices = getBinancePrices();
        const vnGoldQuotes = await getVietnamGoldQuotes();
        const tickers = allPrices.length > 0 ? [...allPrices, ...vnGoldQuotes] : await fetchPrices();
        const binanceBySymbol = new Map();
        for (const item of tickers) {
            const symbol = normalizeSymbol(item?.symbol);
            if (symbol) binanceBySymbol.set(symbol, { ...item, symbol });
        }

        const payloadCache = new Map();
        for (const [ws, meta] of clients.entries()) {
            if (ws.readyState !== ws.OPEN) continue;
            if (!meta || meta.isBridgeAuthenticated) continue;

            const latestBySymbol = new Map(binanceBySymbol);
            for (const item of getScopedMt5Prices(mt5Prices, meta.userId || null)) {
                const symbol = normalizeSymbol(item?.symbol);
                if (symbol && !isVietnamGoldSymbol(symbol)) {
                    latestBySymbol.set(symbol, { ...item, symbol });
                }
            }

            const orderedSymbols = Array.isArray(meta.symbols) ? meta.symbols : [];
            const data = orderedSymbols.map((s) => latestBySymbol.get(normalizeSymbol(s))).filter(Boolean);
            if (data.length === 0) continue;

            const cacheKey = `explicit:${meta.userId || "__global__"}:${orderedSymbols.join("|")}`;
            let payload = payloadCache.get(cacheKey);
            if (!payload) {
                payload = JSON.stringify({ topic: "priceUpdate", data });
                payloadCache.set(cacheKey, payload);
            }
            safeSend(ws, payload, { nonCritical: true });
        }

        const coreSymbols = subscriptionIndex.coreSymbols || [];
        for (const ws of subscriptionIndex.defaultPriceClients) {
            if (ws.readyState !== ws.OPEN) continue;
            const meta = clients.get(ws);
            if (!meta || meta.isBridgeAuthenticated) continue;

            const latestBySymbol = new Map(binanceBySymbol);
            for (const item of getScopedMt5Prices(mt5Prices, meta.userId || null)) {
                const symbol = normalizeSymbol(item?.symbol);
                if (symbol && !isVietnamGoldSymbol(symbol)) {
                    latestBySymbol.set(symbol, { ...item, symbol });
                }
            }
            const data = coreSymbols.map((s) => latestBySymbol.get(s)).filter(Boolean);
            if (data.length === 0) continue;

            const cacheKey = `core:${meta.userId || "__global__"}:${coreSymbols.join("|")}`;
            let payload = payloadCache.get(cacheKey);
            if (!payload) {
                payload = JSON.stringify({ topic: "priceUpdate", data });
                payloadCache.set(cacheKey, payload);
            }
            safeSend(ws, payload, { nonCritical: true });
        }
    } catch (err) {
        warnBroadcast("ws.price_broadcast.failed", { error: err?.message || err });
    }
}

export async function broadcastChartCandles({ clients, mt5Prices, subscriptionIndex }) {
    const uniqueSymbols = new Set(Array.from(subscriptionIndex.chartSubscribers.keys()).map((k) => String(k).split("|")[0]));

    for (const symbol of uniqueSymbols) {
        await broadcastCandleForSymbol({ clients, mt5Prices, subscriptionIndex }, symbol);
    }
}

export function broadcastToAll(clients, payload) {
    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload);
        }
    }
}
