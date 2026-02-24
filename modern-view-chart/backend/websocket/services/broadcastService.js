import { RSI } from "technicalindicators";
import { calcBollingerBands } from "../../services/indicators.js";
import { fetchLatestCandle } from "./dataService.js";
import { candleBuffers } from "../handlers/subscribeHandler.js";

export async function broadcastCandleForSymbol({ clients, mt5Prices }, symbolTarget) {
    const normalizedTarget = (symbolTarget || "").replace(/[mM]$/, 'm');
    const groups = groupClientsByChart(clients);
    const keys = Object.keys(groups).filter(k => k.startsWith(`${normalizedTarget}|`));

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
                bollinger: bollinger,
            },
        });

        for (const ws of groups[key]) {
            if (ws.readyState === ws.OPEN) {
                ws.send(payload);
            }
        }
    }
}

import { fetchPrices } from "./dataService.js";
import { getBinancePrices } from "./binanceTickerService.js";

export async function broadcastPricesToSubscribers({ clients, mt5Prices }) {
    try {
        // Use real-time prices from our WebSocket service for better performance
        const allPrices = getBinancePrices();

        // If WebSocket hasn't filled yet, fallback to REST once
        const tickers = allPrices.length > 0 ? allPrices : await fetchPrices();

        for (const [ws] of clients.entries()) {
            if (ws.readyState !== ws.OPEN) continue;

            if (tickers.length > 0) {
                const mt5Data = Array.from(mt5Prices.values());
                const combinedPrices = [...tickers, ...mt5Data];
                ws.send(JSON.stringify({ topic: "priceUpdate", data: combinedPrices }));
            }
        }
    } catch (err) {
        console.error("❌ Error broadcasting prices:", err.message);
    }
}

export async function broadcastChartCandles({ clients, mt5Prices }) {
    const groups = groupClientsByChart(clients);
    const uniqueSymbols = new Set(Object.keys(groups).map(k => k.split("|")[0]));

    for (const symbol of uniqueSymbols) {
        await broadcastCandleForSymbol({ clients, mt5Prices }, symbol);
    }
}

export function broadcastToAll(clients, payload) {
    for (const [clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}

function groupClientsByChart(clients) {
    const groups = {};
    for (const [ws, meta] of clients.entries()) {
        if (!meta.charts || meta.charts.size === 0) continue;

        for (const key of meta.charts) {
            // Key is already normalized in handleSubscribeCandle as "symbol|interval"
            if (!groups[key]) groups[key] = [];
            groups[key].push(ws);
        }
    }
    return groups;
}
