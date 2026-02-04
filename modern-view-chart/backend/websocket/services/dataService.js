import fetch from "node-fetch";

const currentCandleCache = {};

export async function fetchLatestCandle(mt5Prices, symbol, interval) {
    const symbolLower = (symbol || "").toLowerCase();
    const isMt5 = symbolLower.endsWith('m') || symbolLower.endsWith('.m') || mt5Prices.has(symbol);

    if (isMt5) {
        let p = mt5Prices.get(symbol);
        if (!p) {
            const entry = Array.from(mt5Prices.entries()).find(([k]) => k.toLowerCase() === symbolLower);
            if (entry) p = entry[1];
        }
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

        const key = `${symbol}|${interval}`;
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
    } catch (e) {
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
