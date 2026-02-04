import { subscribeBinance } from "../services/binanceService.js";
export const candleBuffers = {};

function broadcastToSubscribers(clients, symbol, interval, candle) {
    const payload = JSON.stringify({
        topic: "candleUpdate",
        data: {
            ...candle,
            symbol,
            interval
        }
    });

    const targetKey = `${symbol.replace(/[mM]$/, 'm')}|${interval}`;

    for (const [ws, meta] of clients.entries()) {
        if (meta.charts && meta.charts.has(targetKey)) {
            if (ws.readyState === ws.OPEN) {
                ws.send(payload);
            }
        }
    }
}

export function handleSubscribeCandle({ ws, clients }, data) {
    const clientData = clients.get(ws);
    if (!clientData) return;

    let symbol = data.symbol;
    if (symbol.toUpperCase().includes('USDT')) {
        symbol = symbol.toUpperCase();
    } else if (symbol.toLowerCase().endsWith('m')) {
        symbol = symbol.replace(/[mM]$/, 'm');
    }
    const interval = data.interval;
    const chartKey = `${symbol}|${interval}`;

    if (!clientData.charts) clientData.charts = new Set();
    clientData.charts.add(chartKey);

    // If Binance symbol (contains USDT), subscribe to real-time stream
    if (symbol.includes('USDT')) {
        subscribeBinance(symbol, interval, (candle) => {
            broadcastToSubscribers(clients, symbol, interval, candle);
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
