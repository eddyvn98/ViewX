import { subscribeBinance } from "../services/binanceService.js";
import { safeSend } from "../wsSend.js";
import { addChartSubscription, normalizeSymbol, setClientSymbolSubscriptions } from "../subscriptionIndex.js";
export const candleBuffers = {};

function broadcastToSubscribers(clients, subscriptionIndex, symbol, interval, candle) {
    const payload = JSON.stringify({
        topic: "candleUpdate",
        data: {
            ...candle,
            symbol,
            interval
        }
    });

    const targetKey = `${symbol.replace(/[mM]$/, 'm')}|${interval}`;
    const subscribers = subscriptionIndex.chartSubscribers.get(targetKey);
    if (!subscribers || subscribers.size === 0) return;

    for (const ws of subscribers) {
        const meta = clients.get(ws);
        if (!meta?.charts?.has(targetKey)) continue;
        if (ws.readyState === ws.OPEN) {
            safeSend(ws, payload, { nonCritical: true });
        }
    }
}

export function handleSubscribeCandle({ ws, clients, subscriptionIndex }, data) {
    const clientData = clients.get(ws);
    if (!clientData) return;

    let symbol = normalizeSymbol(data.symbol);
    if (!symbol) return;

    const interval = data.interval;
    const chartKey = `${symbol}|${interval}`;

    if (!clientData.charts) clientData.charts = new Set();
    clientData.charts.add(chartKey);
    addChartSubscription(subscriptionIndex, ws, chartKey);

    // If Binance symbol (contains USDT), subscribe to real-time stream
    if (symbol.includes('USDT')) {
        subscribeBinance(symbol, interval, (candle) => {
            broadcastToSubscribers(clients, subscriptionIndex, symbol, interval, candle);
        });
    }

    if (data.candles && Array.isArray(data.candles)) {
        const bufSymbol = data.symbol.replace(/[mM]$/, 'm');
        const key = `${bufSymbol}|${data.interval}`;
        candleBuffers[key] = data.candles.map(c => ({
            time: c.time,
            close: c.close
        }));
    }
}

export function handleSubscribeSymbols({ ws, clients, subscriptionIndex }, data) {
    const clientData = clients.get(ws);
    if (!clientData) return;

    if (!Array.isArray(data.symbols)) return;

    const rawSymbols = data.symbols
        .filter((symbol) => typeof symbol === "string")
        .map((symbol) => normalizeSymbol(symbol))
        .filter(Boolean)
        .slice(0, 300);

    clientData.symbols = setClientSymbolSubscriptions(subscriptionIndex, ws, rawSymbols);
}
