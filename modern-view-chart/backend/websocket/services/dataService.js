import fetch from "node-fetch";
import { createMt5Scope, getScopedMt5Price } from "../mt5Scope.js";
import { getVietnamGoldQuotes } from "../../services/vnGoldService.js";
import { getVangTodayLatestQuotes } from "../../services/vangTodayService.js";
import { logWarn } from "../../logger.js";

const currentCandleCache = {};
let lastBinanceFetchWarnAt = 0;

function warnBinanceFetch(event, fields = {}) {
    const now = Date.now();
    if (now - lastBinanceFetchWarnAt < 60_000) return;
    lastBinanceFetchWarnAt = now;
    logWarn(event, fields);
}

export async function fetchLatestCandle(mt5Prices, symbol, interval, mt5ScopeInput = null) {
    const mt5Scope = createMt5Scope(mt5ScopeInput || {});
    const symbolLower = (symbol || "").toLowerCase();
    const scopedMt5Price = getScopedMt5Price(mt5Prices, mt5Scope, symbol);
    const isVietnamGold = symbolLower === "sjcvn" || symbolLower === "dojivn";
    const isMt5 = symbolLower.endsWith('m') || symbolLower.endsWith('.m') || Boolean(scopedMt5Price);

    if (isVietnamGold) {
        const quotes = await getVietnamGoldQuotes({ nonBlocking: true });
        const quote = quotes.find((item) => String(item?.symbol || "").toLowerCase() === symbolLower);
        if (!quote?.price) return null;

        const intervalStr = interval.toString();
        const secondsMap = { '1': 60, '3': 180, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400, 'D1': 86400 };
        const secondsPerCandle = secondsMap[intervalStr] || (parseInt(intervalStr.replace(/[mM]/g, ''), 10) * 60) || 900;
        const nowSeconds = Math.floor((Number(quote.serverTime || Date.now()) > 2000000000 ? Number(quote.serverTime || Date.now()) / 1000 : Number(quote.serverTime || Date.now())));
        const candleTime = Math.floor(nowSeconds / secondsPerCandle) * secondsPerCandle;
        const key = `vn_gold|${symbol}|${interval}`;
        let cached = currentCandleCache[key];

        if (!cached || cached.time !== candleTime) {
            cached = {
                time: candleTime,
                open: quote.price,
                high: quote.price,
                low: quote.price,
                close: quote.price,
                volume: 0,
            };
            currentCandleCache[key] = cached;
        } else {
            cached.close = quote.price;
            if (quote.price > cached.high) cached.high = quote.price;
            if (quote.price < cached.low) cached.low = quote.price;
        }

        return {
            symbol,
            interval,
            candle: { ...cached },
        };
    }

    if (isMt5) {
        const p = scopedMt5Price;
        if (!p) return null;

        const intervalStr = interval.toString();
        const secondsMap = { '1': 60, '3': 180, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400, 'D1': 86400 };
        const secondsPerCandle = secondsMap[intervalStr] || (parseInt(intervalStr.replace(/[mM]/g, '')) * 60) || 900;

        // Auto-detect if serverTime is in seconds or milliseconds
        let nowSeconds;
        if (p.serverTime) {
            nowSeconds = p.serverTime > 2000000000 ? Math.floor(p.serverTime / 1000) : Math.floor(p.serverTime);
        } else {
            nowSeconds = Math.floor(Date.now() / 1000);
        }

        const brokerOffsetSeconds = 0;
        const candleTime = Math.floor((nowSeconds + brokerOffsetSeconds) / secondsPerCandle) * secondsPerCandle;

        const key = `${mt5Scope.scopeId}|${symbol}|${interval}`;
        let cached = currentCandleCache[key];

        if (!cached || cached.time !== candleTime) {
            // New candle started
            cached = {
                time: candleTime,
                open: p.price,
                high: p.price,
                low: p.price,
                close: p.price,
                volume: 0
            };
            currentCandleCache[key] = cached;
            // console.log(`[CANDLE] New bar started for ${symbol} at ${new Date(candleTime * 1000).toISOString()}`);
        } else {
            // Update existing candle
            cached.close = p.price;
            if (p.price > cached.high) cached.high = p.price;
            if (p.price < cached.low) cached.low = p.price;
        }

        return {
            symbol, interval,
            candle: { ...cached }
        };
    }

    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=1`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const raw = await res.json();

        if (!Array.isArray(raw) || raw.length === 0 || !Array.isArray(raw[0])) return null;

        const [time, open, high, low, close, volume] = raw[0];
        return {
            symbol,
            interval,
            candle: {
                time: time / 1000,
                open: +open,
                high: +high,
                low: +low,
                close: +close,
                volume: +volume,
            },
        };
    } catch {
        return null;
    }
}

export async function fetchPrices(
    symbols = ["BTCUSDT", "ETHUSDT", "ADAUSDT", "BNBUSDT", "XRPUSDT", "SUIUSDT"],
    { includeGold = true } = {}
) {
    const requests = symbols.map(async (symbol) => {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${symbol}`);
        }
        return response.json();
    });

    const settled = await Promise.allSettled(requests);
    const results = [];
    const failedSymbols = [];
    for (let i = 0; i < settled.length; i += 1) {
        const item = settled[i];
        if (item.status === "fulfilled" && item.value?.symbol && item.value?.lastPrice != null) {
            results.push(item.value);
            continue;
        }
        failedSymbols.push(symbols[i]);
    }

    if (failedSymbols.length > 0) {
        warnBinanceFetch("ws.binance_rest_fetch.partial_failure", {
            failed_symbols: failedSymbols,
            ok_count: results.length,
            fail_count: failedSymbols.length,
        });
    }

    const mappedBinance = results.map((item) => ({
        symbol: item.symbol,
        price: parseFloat(item.lastPrice),
        change: parseFloat(item.priceChangePercent),
        source: 'BINANCE'
    }));

    if (!includeGold) return mappedBinance;

    const [vnGoldQuotes, vangTodayQuotes] = await Promise.all([
        getVietnamGoldQuotes({ nonBlocking: true }),
        getVangTodayLatestQuotes({ nonBlocking: true }),
    ]);

    return [
        ...mappedBinance,
        ...vnGoldQuotes,
        ...vangTodayQuotes.map((item) => ({
            symbol: item.symbol,
            price: Number(item.buy) || Number(item.sell) || 0,
            bid: Number(item.buy) || 0,
            ask: Number(item.sell) || 0,
            displayName: item.name,
            source: "VN_GOLD",
            change: 0,
            changeValue: 0,
            volume: 0,
            serverTime: new Date(item.capturedAt || Date.now()).getTime(),
        })),
    ];
}
