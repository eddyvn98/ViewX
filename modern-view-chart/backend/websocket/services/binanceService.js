import WebSocket from 'ws';
import { resolveBinanceInterval } from '../../modules/chart/binanceIntervals.js';
import { getBinanceAggregateBucketStart } from '../../modules/chart/binanceCandleAggregation.js';


const streams = new Map(); // key: "symbol:interval" => WebSocket

export function subscribeBinance(symbol, interval, onCandleUpdate) {
    const strInterval = String(interval || '').trim();
    const intervalPlan = resolveBinanceInterval(strInterval);
    const binanceInterval = intervalPlan.upstream;

    const normalizedSymbol = symbol.toUpperCase();
    const key = `${normalizedSymbol}:${strInterval}`;

    if (streams.has(key)) return; // Already subscribed

    const cleanSymbol = normalizedSymbol.toLowerCase().replace('usdt', '');
    const wsUrl = `wss://stream.binance.com:9443/ws/${cleanSymbol}usdt@kline_${binanceInterval}`;

    console.log(`🔌 Connecting to Binance Stream: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    const aggregateComponents = new Map();

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

                if (!intervalPlan.aggregate) {
                    onCandleUpdate(candle);
                    return;
                }

                const bucketStart = getBinanceAggregateBucketStart(candle.time, strInterval);
                for (const componentTime of aggregateComponents.keys()) {
                    if (getBinanceAggregateBucketStart(componentTime, strInterval) !== bucketStart) {
                        aggregateComponents.delete(componentTime);
                    }
                }
                aggregateComponents.set(candle.time, candle);
                const components = Array.from(aggregateComponents.values()).sort((a, b) => a.time - b.time);
                const aggregated = {
                    time: bucketStart,
                    open: components[0].open,
                    high: Math.max(...components.map((item) => item.high)),
                    low: Math.min(...components.map((item) => item.low)),
                    close: components[components.length - 1].close,
                    volume: components.reduce((sum, item) => sum + item.volume, 0),
                    isClosed: false,
                };
                onCandleUpdate(aggregated);
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
