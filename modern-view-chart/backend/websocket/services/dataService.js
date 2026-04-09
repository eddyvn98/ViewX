import fetch from "node-fetch";
import { getScopedMt5Price } from "../mt5Scope.js";

const currentCandleCache = {};

export async function fetchLatestCandle(mt5Prices, symbol, interval, ownerUserId = null) {
    const symbolLower = (symbol || "").toLowerCase();
    const scopedMt5Price = getScopedMt5Price(mt5Prices, ownerUserId, symbol);
    const isMt5 = symbolLower.endsWith('m') || symbolLower.endsWith('.m') || Boolean(scopedMt5Price);

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

        const key = `${ownerUserId || "__global__"}|${symbol}|${interval}`;
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

export async function fetchPrices(symbols = ["BTCUSDT", "ETHUSDT", "ADAUSDT", "BNBUSDT", "XRPUSDT", "SUIUSDT"]) {
    const requests = symbols.map((symbol) =>
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then((r) => r.json())
    );

    const results = await Promise.all(requests);

    return results.map((item) => ({
        symbol: item.symbol,
        price: parseFloat(item.lastPrice),
        change: parseFloat(item.priceChangePercent),
        source: 'BINANCE'
    }));
}
