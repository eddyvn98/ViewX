import fetch from "node-fetch";
import { vangTodaySnapshotModel } from "../model/vangtoday_snapshot.js";
import { vangTodayOhlcModel } from "../model/vangtoday_ohlc.js";
import { logWarn } from "../logger.js";

const ENDPOINT = "https://vang.today/api/prices";
const WEBSITE_URL = "https://vang.today";
const SOURCE = "VANG_TODAY";
const CACHE_TTL_MS = 30_000;
const TIMEFRAMES = new Set(["60", "240", "D"]);
const PRICE_TYPES = new Set(["buy", "sell"]);

let latestCache = {
    updatedAt: 0,
    quotes: [],
};
let inflight = null;

function normalizeTimeframe(interval) {
    const raw = String(interval || "").trim().toUpperCase();
    if (raw === "60" || raw === "1H" || raw === "H1") return "60";
    if (raw === "240" || raw === "4H" || raw === "H4") return "240";
    if (raw === "D" || raw === "1D" || raw === "DAY") return "D";
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

function normalizeQuotes(payload) {
    const rows = payload?.prices && typeof payload.prices === "object" ? payload.prices : {};
    const serverTs = Number(payload?.timestamp || 0);
    const capturedAt = Number.isFinite(serverTs) && serverTs > 0 ? new Date(serverTs * 1000) : new Date();

    return Object.entries(rows)
        .map(([symbol, row]) => {
            const buy = Number(row?.buy || 0);
            const sell = Number(row?.sell || 0);
            const currency = String(row?.currency || "").toUpperCase();
            if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) return null;
            if (currency !== "VND") return null;
            return {
                symbol: String(symbol || "").trim().toUpperCase(),
                name: String(row?.name || symbol || ""),
                buy,
                sell,
                currency: "VND",
                source: SOURCE,
                capturedAt,
            };
        })
        .filter((item) => item && item.symbol);
}

function normalizeText(input) {
    return String(input || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .toLowerCase()
        .trim();
}

async function fetchFromVangToday() {
    const response = await fetch(ENDPOINT, {
        headers: {
            "user-agent": "Mozilla/5.0 (compatible; VivuTradeBot/1.0)",
            accept: "application/json,text/plain,*/*",
        },
    });
    if (!response.ok) {
        throw new Error(`vangtoday_http_${response.status}`);
    }
    const payload = await response.json();
    return normalizeQuotes(payload);
}

function refreshVangTodayQuotes() {
    if (inflight) return inflight;

    inflight = fetchFromVangToday()
        .then((quotes) => {
            if (quotes.length > 0) {
                latestCache = {
                    updatedAt: Date.now(),
                    quotes,
                };
            }
            return latestCache.quotes;
        })
        .catch((error) => {
            logWarn("vangtoday.fetch_failed", { error: error?.message || String(error) });
            return latestCache.quotes;
        })
        .finally(() => {
            inflight = null;
        });

    return inflight;
}

export async function getVangTodayLatestQuotes({ force = false, nonBlocking = false } = {}) {
    const now = Date.now();
    if (!force && latestCache.quotes.length > 0 && now - latestCache.updatedAt < CACHE_TTL_MS) {
        return latestCache.quotes;
    }

    const refreshPromise = refreshVangTodayQuotes();
    if (nonBlocking && !force) {
        return latestCache.quotes;
    }

    return refreshPromise;
}

export async function persistVangTodaySnapshots(quotes) {
    const docs = (Array.isArray(quotes) ? quotes : [])
        .filter((item) => item?.symbol && Number.isFinite(item?.buy) && Number.isFinite(item?.sell))
        .map((item) => ({
            symbol: String(item.symbol).trim().toUpperCase(),
            name: String(item.name || item.symbol || ""),
            currency: "VND",
            buy: Number(item.buy),
            sell: Number(item.sell),
            source: SOURCE,
            capturedAt: new Date(item.capturedAt || Date.now()),
        }));

    if (docs.length === 0) return [];

    await vangTodaySnapshotModel.bulkWrite(
        docs.map((doc) => ({
            updateOne: {
                filter: { symbol: doc.symbol, capturedAt: doc.capturedAt },
                update: { $set: doc },
                upsert: true,
            },
        })),
        { ordered: false },
    ).catch((error) => {
        logWarn("vangtoday.persist_snapshot_partial", { error: error?.message || String(error) });
    });

    for (const doc of docs) {
        await rebuildBucket(doc.symbol, "buy", "60", doc.capturedAt);
        await rebuildBucket(doc.symbol, "buy", "240", doc.capturedAt);
        await rebuildBucket(doc.symbol, "buy", "D", doc.capturedAt);
        await rebuildBucket(doc.symbol, "sell", "60", doc.capturedAt);
        await rebuildBucket(doc.symbol, "sell", "240", doc.capturedAt);
        await rebuildBucket(doc.symbol, "sell", "D", doc.capturedAt);
    }

    return docs;
}

export async function rebuildBucket(symbolInput, priceTypeInput, timeframeInput, anchorDateInput) {
    const symbol = String(symbolInput || "").trim().toUpperCase();
    const priceType = String(priceTypeInput || "").trim().toLowerCase();
    const timeframe = normalizeTimeframe(timeframeInput);
    if (!symbol || !PRICE_TYPES.has(priceType) || !TIMEFRAMES.has(timeframe)) return null;

    const bucketStart = getBucketStart(anchorDateInput, timeframe);
    const nextBucketStart = timeframe === "D"
        ? new Date(bucketStart.getTime() + 24 * 60 * 60 * 1000)
        : new Date(bucketStart.getTime() + Number.parseInt(timeframe, 10) * 60 * 1000);

    const points = await vangTodaySnapshotModel
        .find({
            symbol,
            capturedAt: { $gte: bucketStart, $lt: nextBucketStart },
        })
        .sort({ capturedAt: 1 })
        .lean();

    if (points.length === 0) return null;

    const values = points
        .map((item) => Number(item?.[priceType]))
        .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length === 0) return null;

    const doc = {
        symbol,
        source: SOURCE,
        currency: "VND",
        priceType,
        timeframe,
        bucketStart,
        open: values[0],
        high: Math.max(...values),
        low: Math.min(...values),
        close: values[values.length - 1],
        volume: 0,
        points: values.length,
    };

    await vangTodayOhlcModel.updateOne(
        { symbol, priceType, timeframe, bucketStart },
        { $set: doc },
        { upsert: true },
    );
    return doc;
}

export async function getVangTodaySymbols() {
    const docs = await vangTodaySnapshotModel.aggregate([
        { $sort: { capturedAt: -1 } },
        { $group: { _id: "$symbol", name: { $first: "$name" } } },
        { $project: { _id: 0, symbol: "$_id", name: 1 } },
        { $sort: { symbol: 1 } },
    ]);
    if (docs.length > 0) return docs;
    const latest = await getVangTodayLatestQuotes();
    return latest.map((item) => ({ symbol: item.symbol, name: item.name }));
}

function aggregatePointsToCandles(points, timeframe) {
    const tf = normalizeTimeframe(timeframe);
    const buckets = new Map();

    for (const point of points) {
        const timestamp = Number(point?.time || 0);
        const price = Number(point?.price || 0);
        if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) continue;
        const bucketStartDate = getBucketStart(new Date(timestamp * 1000), tf);
        const bucketStart = bucketStartDate.getTime();
        const current = buckets.get(bucketStart);
        if (!current) {
            buckets.set(bucketStart, {
                bucketStart: bucketStartDate,
                open: price,
                high: price,
                low: price,
                close: price,
                points: 1,
            });
            continue;
        }
        current.high = Math.max(current.high, price);
        current.low = Math.min(current.low, price);
        current.close = price;
        current.points += 1;
    }

    return Array.from(buckets.values()).sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());
}

function resolveSymbolByTitle(title, symbolMap) {
    const normalizedTitle = normalizeText(title);
    if (!normalizedTitle) return null;

    let best = null;
    let bestScore = -1;
    for (const [symbol, name] of symbolMap.entries()) {
        const normalizedName = normalizeText(name);
        const normalizedSymbol = normalizeText(symbol);
        let score = 0;
        if (normalizedTitle === normalizedName) score += 100;
        if (normalizedTitle.includes(normalizedName) || normalizedName.includes(normalizedTitle)) score += 40;
        if (normalizedTitle.includes(normalizedSymbol) || normalizedSymbol.includes(normalizedTitle)) score += 25;

        const titleTokens = new Set(normalizedTitle.split(" ").filter(Boolean));
        const nameTokens = new Set(normalizedName.split(" ").filter(Boolean));
        for (const token of titleTokens) {
            if (nameTokens.has(token)) score += 5;
        }
        if (score > bestScore) {
            bestScore = score;
            best = symbol;
        }
    }

    return bestScore >= 20 ? best : null;
}

export async function backfillVangTodayHistoryFromWebsite() {
    const [quotes, response] = await Promise.all([
        getVangTodayLatestQuotes({ force: true }),
        fetch(WEBSITE_URL, {
            headers: {
                "user-agent": "Mozilla/5.0 (compatible; VivuTradeBot/1.0)",
            },
        }),
    ]);
    if (!response.ok) throw new Error(`vangtoday_web_http_${response.status}`);
    const html = await response.text();
    const decoded = html.replace(/&quot;/g, "\"");
    const matches = [...decoded.matchAll(/showChart\('([^']+)',\s*(\[[\s\S]*?\])\s*,\s*(true|false)\)/g)];
    if (matches.length === 0) return 0;

    const symbolMap = new Map(quotes.map((item) => [item.symbol, item.name]));
    let upsertCount = 0;

    for (const match of matches) {
        const title = String(match[1] || "");
        const rawJson = String(match[2] || "[]");
        const symbol = resolveSymbolByTitle(title, symbolMap);
        if (!symbol || symbol === "XAUUSD") continue;

        let historyDays = [];
        try {
            historyDays = JSON.parse(rawJson);
        } catch {
            continue;
        }
        if (!Array.isArray(historyDays) || historyDays.length === 0) continue;

        const buyPoints = [];
        const sellPoints = [];
        for (const dayItem of historyDays) {
            const entries = Array.isArray(dayItem?.entries) ? dayItem.entries : [];
            for (const entry of entries) {
                const unix = Number(entry?.unix || 0);
                const buy = Number(entry?.buy || 0);
                const sell = Number(entry?.sell || 0);
                if (Number.isFinite(unix) && unix > 0) {
                    if (Number.isFinite(buy) && buy > 0) buyPoints.push({ time: unix, price: buy });
                    if (Number.isFinite(sell) && sell > 0) sellPoints.push({ time: unix, price: sell });
                }
            }
        }

        for (const [priceType, points] of [["buy", buyPoints], ["sell", sellPoints]]) {
            if (!Array.isArray(points) || points.length === 0) continue;
            for (const timeframe of ["60", "240", "D"]) {
                const candles = aggregatePointsToCandles(points, timeframe);
                if (candles.length === 0) continue;
                await vangTodayOhlcModel.bulkWrite(
                    candles.map((item) => ({
                        updateOne: {
                            filter: { symbol, priceType, timeframe, bucketStart: item.bucketStart },
                            update: {
                                $set: {
                                    symbol,
                                    source: SOURCE,
                                    currency: "VND",
                                    priceType,
                                    timeframe,
                                    bucketStart: item.bucketStart,
                                    open: item.open,
                                    high: item.high,
                                    low: item.low,
                                    close: item.close,
                                    volume: 0,
                                    points: item.points,
                                },
                            },
                            upsert: true,
                        },
                    })),
                    { ordered: false },
                );
                upsertCount += candles.length;
            }
        }
    }

    return upsertCount;
}

export async function getVangTodayCandles(symbolInput, intervalInput, priceTypeInput, countInput = 300) {
    const symbol = String(symbolInput || "").trim().toUpperCase();
    const timeframe = normalizeTimeframe(intervalInput);
    const priceType = String(priceTypeInput || "buy").trim().toLowerCase();
    const count = Math.max(10, Math.min(1000, Number.parseInt(String(countInput || "300"), 10) || 300));
    if (!symbol || !TIMEFRAMES.has(timeframe) || !PRICE_TYPES.has(priceType)) return [];

    const docs = await vangTodayOhlcModel
        .find({ symbol, timeframe, priceType })
        .sort({ bucketStart: -1 })
        .limit(count)
        .lean();

    const baseCandles = docs.reverse().map((doc) => ({
        time: Math.floor(new Date(doc.bucketStart).getTime() / 1000),
        open: Number(doc.open),
        high: Number(doc.high),
        low: Number(doc.low),
        close: Number(doc.close),
        volume: Number(doc.volume || 0),
    }));

    if (timeframe === "D") return baseCandles;
    if (baseCandles.length === 0) return [];

    const stepSeconds = timeframe === "240" ? 240 * 60 : 60 * 60;
    const byTime = new Map(baseCandles.map((item) => [Number(item.time), item]));
    const latestTime = Number(baseCandles[baseCandles.length - 1].time);
    const startTime = latestTime - (count - 1) * stepSeconds;
    const seededStart = Number(baseCandles[0].time);
    let lastClose = Number(baseCandles[0].close);
    const dense = [];

    for (let time = Math.min(startTime, seededStart); time <= latestTime; time += stepSeconds) {
        const found = byTime.get(time);
        if (found) {
            lastClose = Number(found.close);
            dense.push(found);
            continue;
        }
        dense.push({
            time,
            open: lastClose,
            high: lastClose,
            low: lastClose,
            close: lastClose,
            volume: 0,
        });
    }

    return dense.slice(Math.max(0, dense.length - count));
}
