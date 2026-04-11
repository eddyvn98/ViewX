import { goldPriceSnapshotModel } from "../model/gold_price_snapshot.js";
import { goldOhlcModel } from "../model/gold_ohlc.js";
import { logInfo, logWarn } from "../logger.js";

const SOURCE = "VN_GOLD";
const HOURLY_TIMEFRAMES = ["60", "240"];
const STORED_TIMEFRAMES = [...HOURLY_TIMEFRAMES, "D"];

function normalizeSymbol(symbol) {
    return String(symbol || "").trim().toUpperCase();
}

function normalizeTimeframe(timeframe) {
    const raw = String(timeframe || "").trim().toUpperCase();
    if (raw === "1H" || raw === "60") return "60";
    if (raw === "4H" || raw === "240") return "240";
    if (raw === "1D" || raw === "D" || raw === "DAY") return "D";
    return raw;
}

function getBucketStart(dateInput, timeframe) {
    const date = new Date(dateInput);
    if (timeframe === "D") {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }

    const minutes = Number.parseInt(timeframe, 10);
    const intervalMs = Math.max(60, minutes) * 60 * 1000;
    return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
}

function toCandleDoc(symbol, timeframe, bucketStart, points, provider, meta = null) {
    const ordered = points
        .map((point) => ({
            capturedAt: new Date(point.capturedAt),
            price: Number(point.price || 0),
        }))
        .filter((point) => Number.isFinite(point.price) && point.price > 0)
        .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

    if (ordered.length === 0) return null;

    const prices = ordered.map((point) => point.price);
    return {
        symbol,
        source: SOURCE,
        provider,
        timeframe,
        bucketStart,
        open: ordered[0].price,
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: ordered[ordered.length - 1].price,
        volume: 0,
        points: ordered.length,
        meta,
    };
}

function projectDailyDocsToIntraday(dailyDocs, timeframe) {
    const hours = timeframe === "240" ? [8] : [8, 10, 12, 14, 16];
    const bars = [];
    for (const doc of dailyDocs) {
        const day = new Date(doc.bucketStart);
        const seq = [Number(doc.open), Number(doc.high), Number(doc.low), Number(doc.close), Number(doc.close)];
        hours.forEach((hour, idx) => {
            const base = seq[Math.min(idx, seq.length - 1)];
            const bucket = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0));
            bars.push({
                time: Math.floor(bucket.getTime() / 1000),
                open: base,
                high: Math.max(base, Number(doc.high)),
                low: Math.min(base, Number(doc.low)),
                close: idx === hours.length - 1 ? Number(doc.close) : base,
                volume: 0,
            });
        });
    }
    return bars.sort((a, b) => a.time - b.time);
}

export function isStoredVietnamGoldTimeframe(timeframe) {
    return STORED_TIMEFRAMES.includes(normalizeTimeframe(timeframe));
}

export async function persistVietnamGoldSnapshots(quotes) {
    const docs = (Array.isArray(quotes) ? quotes : [])
        .map((quote) => {
            const symbol = normalizeSymbol(quote?.symbol);
            const capturedAt = new Date(Number(quote?.serverTime || Date.now()));
            const price = Number(quote?.price || 0);
            if (!symbol || !Number.isFinite(price) || price <= 0) return null;
            return {
                symbol,
                source: SOURCE,
                provider: symbol === "SJCVN" ? "SJC" : symbol === "DOJIVN" ? "DOJI" : "VN_GOLD",
                price,
                bid: Number(quote?.bid || price),
                ask: Number(quote?.ask || price),
                capturedAt,
                sourceUrl: String(quote?.sourceUrl || ""),
            };
        })
        .filter(Boolean);

    if (docs.length === 0) return [];

    await goldPriceSnapshotModel.bulkWrite(
        docs.map((doc) => ({
            updateOne: {
                filter: { symbol: doc.symbol, capturedAt: doc.capturedAt },
                update: { $set: doc },
                upsert: true,
            },
        })),
        { ordered: false },
    ).catch((error) => {
        logWarn("vn_gold.snapshot.persist_partial", { error: error?.message || String(error) });
    });

    for (const doc of docs) {
        for (const timeframe of HOURLY_TIMEFRAMES) {
            await rebuildVietnamGoldBucket(doc.symbol, timeframe, doc.capturedAt);
        }
        await rebuildVietnamGoldBucket(doc.symbol, "D", doc.capturedAt);
    }

    return docs;
}

export async function rebuildVietnamGoldBucket(symbolInput, timeframeInput, anchorDateInput) {
    const symbol = normalizeSymbol(symbolInput);
    const timeframe = normalizeTimeframe(timeframeInput);
    if (!symbol || !isStoredVietnamGoldTimeframe(timeframe)) return null;

    const bucketStart = getBucketStart(anchorDateInput, timeframe);
    const nextBucketStart = getBucketStart(
        timeframe === "D"
            ? new Date(bucketStart.getTime() + 24 * 60 * 60 * 1000)
            : new Date(bucketStart.getTime() + Number.parseInt(timeframe, 10) * 60 * 1000),
        timeframe,
    );

    const points = await goldPriceSnapshotModel
        .find({
            symbol,
            capturedAt: {
                $gte: bucketStart,
                $lt: nextBucketStart,
            },
        })
        .sort({ capturedAt: 1 })
        .lean();

    if (points.length === 0) return null;

    const provider = String(points[0]?.provider || symbol);
    const candle = toCandleDoc(symbol, timeframe, bucketStart, points, provider, { origin: "snapshots" });
    if (!candle) return null;

    await goldOhlcModel.updateOne(
        { symbol, timeframe, bucketStart },
        { $set: candle },
        { upsert: true },
    );

    return candle;
}

export async function upsertVietnamGoldDailyCandle({
    symbol: symbolInput,
    provider,
    day,
    open,
    high,
    low,
    close,
    points = 1,
    meta = null,
}) {
    const symbol = normalizeSymbol(symbolInput);
    const bucketStart = getBucketStart(day, "D");
    const candle = {
        symbol,
        source: SOURCE,
        provider,
        timeframe: "D",
        bucketStart,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: 0,
        points: Number(points) || 1,
        meta,
    };

    if (![candle.open, candle.high, candle.low, candle.close].every((value) => Number.isFinite(value) && value > 0)) {
        return null;
    }

    await goldOhlcModel.updateOne(
        { symbol, timeframe: "D", bucketStart },
        { $set: candle },
        { upsert: true },
    );
    return candle;
}

export async function getStoredVietnamGoldCandles(symbolInput, timeframeInput, count = 300) {
    const symbol = normalizeSymbol(symbolInput);
    const timeframe = normalizeTimeframe(timeframeInput);
    const safeCount = Math.max(1, Math.min(1000, Number.parseInt(count, 10) || 300));
    if (!symbol || !isStoredVietnamGoldTimeframe(timeframe)) return [];

    const docs = await goldOhlcModel
        .find({ symbol, timeframe })
        .sort({ bucketStart: -1 })
        .limit(safeCount)
        .lean();

    const normalizedDocs = docs
        .reverse()
        .map((doc) => ({
            time: Math.floor(new Date(doc.bucketStart).getTime() / 1000),
            open: Number(doc.open),
            high: Number(doc.high),
            low: Number(doc.low),
            close: Number(doc.close),
            volume: Number(doc.volume || 0),
        }));

    if ((timeframe === "60" || timeframe === "240") && normalizedDocs.length < 24) {
        const dailyDocs = await goldOhlcModel
            .find({ symbol, timeframe: "D" })
            .sort({ bucketStart: -1 })
            .limit(Math.max(60, Math.ceil(safeCount / 2)))
            .lean();
        if (dailyDocs.length > 0) {
            const projected = projectDailyDocsToIntraday(dailyDocs.reverse(), timeframe);
            const merged = [...projected, ...normalizedDocs]
                .sort((a, b) => a.time - b.time)
                .filter((item, idx, arr) => idx === 0 || item.time !== arr[idx - 1].time);
            return merged.slice(Math.max(0, merged.length - safeCount));
        }
    }

    return normalizedDocs;
}

export async function getVietnamGoldStorageStats() {
    const [snapshotCount, candleCount] = await Promise.all([
        goldPriceSnapshotModel.estimatedDocumentCount(),
        goldOhlcModel.estimatedDocumentCount(),
    ]);
    return { snapshotCount, candleCount };
}

export function logVietnamGoldStorageStarted(config) {
    logInfo("vn_gold.storage.started", config);
}
