import WebSocket from 'ws';

// Map intervals from our app (1, 15, H1) to Binance (1m, 15m, 1h)
const INTERVAL_MAP = {
    '1': '1m',
    '3': '3m',
    '5': '5m',
    '10': '10m',
    '15': '15m',
    '30': '30m',
    '60': '1h',
    '120': '2h',
    '240': '4h',
    '1440': '1d',
    'D': '1d',
    '1D': '1d',
    'D1': '1d',
    '10080': '1w',
    'W': '1w',
    '1W': '1w',
    'W1': '1w',
    '43200': '1M',
    'M': '1M',
    '1M': '1M',
    'MN1': '1M',
    '1mo': '1M',
    '525600': '1M',
    'Y': '1M',
    '1Y': '1M',
    'Y1': '1M',
};

const streams = new Map(); // key: "symbol:interval" => WebSocket

export function subscribeBinance(symbol, interval, onCandleUpdate) {
    const strInterval = String(interval || '').trim();
    const binanceInterval = INTERVAL_MAP[strInterval] || INTERVAL_MAP[strInterval.toUpperCase()] || (strInterval.endsWith('m') || strInterval.endsWith('h') || strInterval.endsWith('d') || strInterval.endsWith('w') || strInterval.endsWith('M') ? strInterval : '1m');

    const normalizedSymbol = symbol.toUpperCase();
    const key = `${normalizedSymbol}:${strInterval}`;

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
