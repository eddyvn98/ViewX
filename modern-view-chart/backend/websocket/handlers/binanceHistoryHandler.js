import fetch from "node-fetch";

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

export async function handleBinanceHistory({ ws }, data) {
    try {
        const binanceInterval = INTERVAL_MAP[data.interval] || '1m';
        const url = `https://api.binance.com/api/v3/klines?symbol=${data.symbol.toUpperCase()}&interval=${binanceInterval}&limit=500`;
        const res = await fetch(url);
        if (!res.ok) return;
        const raw = await res.json();

        if (!Array.isArray(raw)) return;

        const candles = raw.map(k => ({
            time: k[0] / 1000,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));

        ws.send(JSON.stringify({
            topic: "mt5_candles",
            symbol: data.symbol,
            interval: data.interval,
            source: 'BINANCE',
            candles: candles
        }));
    } catch (err) {
        console.error("❌ Error fetching Binance history:", err.message);
    }
}
