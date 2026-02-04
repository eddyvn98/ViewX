import { RSI } from "technicalindicators";
import fetch from "node-fetch";
import { calcBollingerBands } from "../../services/indicators.js";
import { clients, mt5Prices, candleBuffers } from "./state.js";

export async function broadcastPricesToSubscribers() {
    const allSymbols = null;
    try {
        const allPrices = await fetchPrices(allSymbols);

        for (const [ws] of clients.entries()) {
            if (ws.readyState !== ws.OPEN) continue;

            if (allPrices.length > 0) {
                // Merge MT5 prices into the update
                const mt5Data = Array.from(mt5Prices.values());
                const combinedPrices = [...allPrices, ...mt5Data];
                ws.send(JSON.stringify({ type: "priceUpdate", data: combinedPrices }));
            }
        }
    } catch (err) {
        console.error("❌ Error broadcasting prices:", err.message);
    }
}

async function fetchPrices(symbols) {
    symbols = ["BTCUSDT", "ETHUSDT", "ADAUSDT", "BNBUSDT", "XRPUSDT", "SUIUSDT"];
    const requests = symbols.map((symbol) =>
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(
            (r) => r.json()
        )
    );
    const results = await Promise.all(requests);
    return results.map((item) => ({
        symbol: item.symbol,
        price: parseFloat(item.lastPrice),
        change: parseFloat(item.priceChangePercent),
    }));
}

export async function broadcastChartCandles() {
    const groups = groupClientsByChart();

    for (const key of Object.keys(groups)) {
        const [symbol, interval] = key.split("|");
        const data = await fetchLatestCandle(symbol, interval);
        if (!data) continue;

        const candle = data.candle;
        const buffer = candleBuffers[key] || [];
        buffer.push({ time: candle.time, close: candle.close });
        if (buffer.length > 100) buffer.shift();
        candleBuffers[key] = buffer;

        const closes = buffer.map((c) => c.close);
        const rsiArr = RSI.calculate({ period: 14, values: closes });
        const rsiValue = rsiArr[rsiArr.length - 1];

        let bollinger = null;
        if (buffer.length >= 20) {
            const bands = calcBollingerBands(buffer, 20, 2);
            if (bands.length > 0) bollinger = bands[bands.length - 1];
        }

        const payload = JSON.stringify({
            type: "candleUpdate",
            data: { ...candle, symbol, interval, rsi: rsiValue, bollinger },
        });

        for (const ws of groups[key]) {
            if (ws.readyState === ws.OPEN) ws.send(payload);
        }
    }
}

function groupClientsByChart() {
    const groups = {};
    for (const [ws, { chart }] of clients.entries()) {
        if (!chart) continue;
        const key = `${chart.symbol}|${chart.interval}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(ws);
    }
    return groups;
}

async function fetchLatestCandle(symbol, interval) {
    if (mt5Prices.has(symbol) || symbol.endsWith('m')) {
        const p = mt5Prices.get(symbol);
        if (!p) return null;
        return {
            symbol, interval,
            candle: {
                time: Math.floor(Date.now() / 1000),
                open: p.price, high: p.price, low: p.price, close: p.price, volume: 0
            }
        };
    }

    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const raw = await res.json();
        if (!Array.isArray(raw) || raw.length === 0) return null;
        const [time, open, high, low, close, volume] = raw[0];
        return {
            symbol, interval,
            candle: { time: time / 1000, open: +open, high: +high, low: +low, close: +close, volume: +volume }
        };
    } catch (e) {
        return null;
    }
}
