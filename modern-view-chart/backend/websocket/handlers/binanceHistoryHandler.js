import fetch from "node-fetch";
import { getBinanceUpstreamLimit, resolveBinanceInterval } from "../../modules/chart/binanceIntervals.js";
import { aggregateBinanceCandles } from "../../modules/chart/binanceCandleAggregation.js";


export async function handleBinanceHistory({ ws }, data) {
    try {
        const requestedInterval = String(data.interval || '1').trim();
        const intervalPlan = resolveBinanceInterval(requestedInterval);
        const binanceInterval = intervalPlan.upstream;
        const requestedCount = Number(data.count);
        const limit = Number.isFinite(requestedCount)
            ? Math.max(1, Math.min(1000, Math.floor(requestedCount)))
            : 500;
        const upstreamLimit = getBinanceUpstreamLimit(requestedInterval, limit);
        const fromTimestamp = Number(data.fromTimestamp);
        const toTimestamp = Number(data.toTimestamp);
        const params = new URLSearchParams({
            symbol: data.symbol.toUpperCase(),
            interval: binanceInterval,
            limit: String(upstreamLimit),
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

        const normalizedCandles = raw.map(k => ({
            time: k[0] / 1000,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));
        const candles = aggregateBinanceCandles(normalizedCandles, requestedInterval).slice(-limit);

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
