import WebSocket from 'ws';

// Map intervals from our app (1, 15, H1) to Binance (1m, 15m, 1h)
const INTERVAL_MAP = {
    '1': '1m',
    '3': '3m',
    '5': '5m',
    '15': '15m',
    '30': '30m',
    '60': '1h',
    '240': '4h',
    'D1': '1d'
};

const streams = new Map(); // key: "symbol:interval" => WebSocket

export function subscribeBinance(symbol, interval, onCandleUpdate) {
    const rawInterval = interval.toString().replace('m', '').replace('h', '');
    const binanceInterval = INTERVAL_MAP[rawInterval] || (interval.includes('m') || interval.includes('h') ? interval : '1m');

    const normalizedSymbol = symbol.toUpperCase();
    const key = `${normalizedSymbol}:${rawInterval}`;

    if (streams.has(key)) return; // Already subscribed

    const cleanSymbol = normalizedSymbol.toLowerCase().replace('usdt', '');
    const wsUrl = `wss://stream.binance.com:9443/ws/${cleanSymbol}usdt@kline_${binanceInterval}`;

    console.log(`🔌 Connecting to Binance Stream: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log(`✅ Binance Stream Open: ${key}`);
    });

    ws.on('message', (data) => {
        // console.log(`📩 Msg from ${key}:`, data.length);
        try {
            const msg = JSON.parse(data);
            if (msg.e === 'kline') {
                const k = msg.k;
                const candle = {
                    time: k.t / 1000,
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: parseFloat(k.v),
                    isClosed: k.x
                };
                onCandleUpdate(candle);
            }
        } catch (err) {
            console.error('Binance Parse Error:', err);
        }
    });

    ws.on('close', () => {
        console.log(`❌ Binance Stream Closed: ${key}`);
        streams.delete(key);
        // Optional: Auto-reconnect logic could go here
    });

    ws.on('error', (err) => {
        console.error(`Binance Socket Error (${key}):`, err.message);
    });

    streams.set(key, ws);
}

export function unsubscribeBinance(symbol, interval) {
    const key = `${symbol}:${interval}`;
    const ws = streams.get(key);
    if (ws) {
        ws.terminate();
        streams.delete(key);
    }
}
