import { RSI } from "technicalindicators";
import { calcBollingerBands } from "../../services/indicators.js";
import { fetchLatestCandle, fetchPrices } from "./dataService.js";
import { getBinancePrices } from "./binanceTickerService.js";
import { candleBuffers } from "../handlers/subscribeHandler.js";
import { safeSend } from "../wsSend.js";
import { normalizeSymbol } from "../subscriptionIndex.js";

export async function broadcastCandleForSymbol({ clients, mt5Prices, subscriptionIndex }, symbolTarget) {
    const normalizedTarget = normalizeSymbol(symbolTarget);
    if (!normalizedTarget) return;

    const keys = [];
    for (const key of subscriptionIndex.chartSubscribers.keys()) {
        if (String(key).startsWith(`${normalizedTarget}|`)) keys.push(key);
    }

    for (const key of keys) {
        const [symbol, interval] = key.split("|");
        const data = await fetchLatestCandle(mt5Prices, symbol, interval);
        if (!data) continue;

        const candle = data.candle;
        if (!candleBuffers[key]) candleBuffers[key] = [];
        const buffer = candleBuffers[key];

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

        const payload = JSON.stringify({
            topic: "candleUpdate",
            data: {
                ...candle,
                symbol,
                interval,
                rsi: rsiValue,
                bollinger,
            },
        });

        const subscribers = subscriptionIndex.chartSubscribers.get(key);
        if (!subscribers || subscribers.size === 0) continue;

        for (const ws of subscribers) {
            if (!clients.has(ws)) continue;
            if (ws.readyState === ws.OPEN) {
                safeSend(ws, payload, { nonCritical: true });
            }
        }
    }
}

export async function broadcastPricesToSubscribers({ clients, mt5Prices, subscriptionIndex }) {
    try {
        const allPrices = getBinancePrices();
        const tickers = allPrices.length > 0 ? allPrices : await fetchPrices();
        const mt5Data = Array.from(mt5Prices.values());
        const latestBySymbol = new Map();
        for (const item of [...tickers, ...mt5Data]) {
            const symbol = normalizeSymbol(item?.symbol);
            if (symbol) latestBySymbol.set(symbol, { ...item, symbol });
        }

        const perWsSymbolMap = new Map();
        for (const [symbol, item] of latestBySymbol.entries()) {
            const subscribers = subscriptionIndex.symbolSubscribers.get(symbol);
            if (!subscribers) continue;

            for (const ws of subscribers) {
                if (!clients.has(ws)) continue;
                let mapForWs = perWsSymbolMap.get(ws);
                if (!mapForWs) {
                    mapForWs = new Map();
                    perWsSymbolMap.set(ws, mapForWs);
                }
                mapForWs.set(symbol, item);
            }
        }

        const payloadCache = new Map();
        for (const [ws, symbolMap] of perWsSymbolMap.entries()) {
            if (ws.readyState !== ws.OPEN) continue;
            const meta = clients.get(ws);
            if (!meta || meta.isBridgeAuthenticated) continue;

            const orderedSymbols = Array.isArray(meta.symbols) ? meta.symbols : [];
            const data = orderedSymbols.map((s) => symbolMap.get(normalizeSymbol(s))).filter(Boolean);
            if (data.length === 0) continue;

            const cacheKey = `explicit:${orderedSymbols.join("|")}`;
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

            const data = coreSymbols.map((s) => latestBySymbol.get(s)).filter(Boolean);
            if (data.length === 0) continue;

            const cacheKey = `core:${coreSymbols.join("|")}`;
            let payload = payloadCache.get(cacheKey);
            if (!payload) {
                payload = JSON.stringify({ topic: "priceUpdate", data });
                payloadCache.set(cacheKey, payload);
            }
            safeSend(ws, payload, { nonCritical: true });
        }
    } catch (err) {
        console.error("[WS] Error broadcasting prices:", err.message);
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
