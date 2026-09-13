import fetch from "node-fetch";

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

export async function handleBinanceHistory({ ws }, data) {
    try {
        const binanceInterval = INTERVAL_MAP[data.interval] || '1m';
        const requestedCount = Number(data.count);
        const limit = Number.isFinite(requestedCount)
            ? Math.max(1, Math.min(1000, Math.floor(requestedCount)))
            : 500;
        const fromTimestamp = Number(data.fromTimestamp);
        const toTimestamp = Number(data.toTimestamp);
        const params = new URLSearchParams({
            symbol: data.symbol.toUpperCase(),
            interval: binanceInterval,
            limit: String(limit),
        });
        if (Number.isFinite(fromTimestamp) && fromTimestamp > 0) {
            params.set('startTime', String(Math.floor(fromTimestamp * 1000)));
        }
        if (Number.isFinite(toTimestamp) && toTimestamp > 0) {
            params.set('endTime', String(Math.floor(toTimestamp * 1000)));
        }
        const url = `https://api.binance.com/api/v3/klines?${params.toString()}`;
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
