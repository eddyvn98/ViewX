import fetch from "node-fetch";
import { logWarn } from "../logger.js";
import { getStoredVietnamGoldCandles, isStoredVietnamGoldTimeframe } from "./vnGoldStorageService.js";

const SJC_ENDPOINT = "https://sjc.com.vn/GoldPrice/Services/PriceService.ashx";
const DOJI_ENDPOINT = "https://bang-gia-vang.trangsucdoji-ldp.workers.dev/";
const CACHE_TTL_MS = 30_000;
const SJC_HISTORY_LOOKBACK_DAYS = 30;
const SJC_DAILY_HISTORY_TTL_MS = 30 * 60 * 1000;

const SYMBOLS = {
    SJC: "SJCVN",
    DOJI: "DOJIVN",
};

let cache = {
    updatedAt: 0,
    quotes: [],
};

let inflightPromise = null;
let sjcDailyHistoryCache = {
    updatedAt: 0,
    points: [],
};
let sjcDailyHistoryInflight = null;

function parseNumberLikeVnd(input, multiplier = 1000) {
    const text = String(input ?? "")
        .replace(/[^\d,.-]/g, "")
        .replace(/,/g, "");
    const value = Number.parseFloat(text);
    if (!Number.isFinite(value)) return null;
    return value * multiplier;
}

function formatUpdateStamp(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function buildQuote({
    symbol,
    displayName,
    buy,
    sell,
    sourceUrl,
    updatedAt,
}) {
    const bid = Number.isFinite(buy) ? buy : null;
    const ask = Number.isFinite(sell) ? sell : null;
    const midpoint = bid !== null && ask !== null ? Math.round((bid + ask) / 2) : ask ?? bid ?? 0;

    return {
        symbol,
        displayName,
        price: midpoint,
        bid: bid ?? midpoint,
        ask: ask ?? midpoint,
        change: 0,
        changeValue: 0,
        volume: 0,
        source: "VN_GOLD",
        sourceUrl,
        serverTime: updatedAt,
    };
}

async function fetchSjcQuote() {
    const today = formatUpdateStamp(new Date());
    const response = await fetch(SJC_ENDPOINT, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
            method: "GetSJCGoldPriceByDate",
            toDate: today,
        }),
    });

    if (!response.ok) {
        throw new Error(`sjc_http_${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const preferred =
        rows.find((row) => String(row?.TypeName || "").includes("Vàng SJC 1L")) ||
        rows.find((row) => String(row?.TypeName || "").toLowerCase().includes("vàng sjc")) ||
        rows[0];

    if (!preferred) return null;

    const buy = parseNumberLikeVnd(preferred?.Buy, 100);
    const sell = parseNumberLikeVnd(preferred?.Sell, 100);
    if (!Number.isFinite(buy) && !Number.isFinite(sell)) return null;

    return buildQuote({
        symbol: SYMBOLS.SJC,
        displayName: "SJC",
        buy,
        sell,
        sourceUrl: "https://sjc.com.vn/bieu-do-gia-vang",
        updatedAt: Date.now(),
    });
}

async function fetchDojiQuote() {
    const response = await fetch(DOJI_ENDPOINT, {
        headers: {
            "accept": "application/xml,text/xml;q=0.9,*/*;q=0.8",
        },
    });

    if (!response.ok) {
        throw new Error(`doji_http_${response.status}`);
    }

    const xml = await response.text();
    const rowMatch = xml.match(/<Row[^>]*Name='([^']*SJC[^']*)'[^>]*Sell='([^']*)'[^>]*Buy='([^']*)'[^>]*\/>/i)
        || xml.match(/<Row[^>]*Name='([^']*)'[^>]*Sell='([^']*)'[^>]*Buy='([^']*)'[^>]*\/>/i);

    if (!rowMatch) return null;

    const [, , rawSell, rawBuy] = rowMatch;
    const buy = parseNumberLikeVnd(rawBuy, 1000);
    const sell = parseNumberLikeVnd(rawSell, 1000);

    if (!Number.isFinite(buy) && !Number.isFinite(sell)) return null;

    return buildQuote({
        symbol: SYMBOLS.DOJI,
        displayName: "DOJI",
        buy,
        sell,
        sourceUrl: "https://trangsuc.doji.vn/pages/bang-gia-vang",
        updatedAt: Date.now(),
    });
}

async function fetchFreshQuotes() {
    const settled = await Promise.allSettled([fetchSjcQuote(), fetchDojiQuote()]);
    const quotes = settled
        .flatMap((result) => {
            if (result.status !== "fulfilled") {
                logWarn("vn_gold.fetch_failed", { error: result.reason?.message || String(result.reason || "unknown") });
                return [];
            }
            return result.value ? [result.value] : [];
        });

    return quotes;
}

function refreshVietnamGoldQuotes() {
    if (inflightPromise) return inflightPromise;

    inflightPromise = fetchFreshQuotes()
        .then((quotes) => {
            if (quotes.length > 0) {
                cache = {
                    updatedAt: Date.now(),
                    quotes,
                };
            }
            return cache.quotes;
        })
        .catch((error) => {
            logWarn("vn_gold.refresh_failed", { error: error?.message || String(error) });
            return cache.quotes;
        })
        .finally(() => {
            inflightPromise = null;
        });

    return inflightPromise;
}

export function getCachedVietnamGoldQuotes({ refresh = true } = {}) {
    const now = Date.now();
    const stale = cache.quotes.length === 0 || now - cache.updatedAt >= CACHE_TTL_MS;
    if (refresh && stale) {
        void refreshVietnamGoldQuotes();
    }
    return cache.quotes;
}

export async function getVietnamGoldQuotes({ force = false, nonBlocking = false } = {}) {
    const now = Date.now();
    if (!force && cache.quotes.length > 0 && now - cache.updatedAt < CACHE_TTL_MS) {
        return cache.quotes;
    }

    const refreshPromise = refreshVietnamGoldQuotes();
    if (nonBlocking && !force) {
        return cache.quotes;
    }

    return refreshPromise;
}

export function getVietnamGoldSymbols() {
    return Object.values(SYMBOLS);
}

function toSjcDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function parseDotNetDate(input) {
    const matched = String(input || "").match(/Date\(([-\d]+)\)/);
    const value = matched ? Number.parseInt(matched[1], 10) : Number.NaN;
    return Number.isFinite(value) ? Math.floor(value / 1000) : null;
}

function intervalToSeconds(interval) {
    const raw = String(interval || "").trim();
    if (!raw) return 60;
    if (/^\d+$/.test(raw)) return Number(raw) * 60;
    const matched = raw.match(/^(\d+)\s*([mhd])$/i);
    if (!matched) return 60;
    const value = Number(matched[1]);
    const unit = matched[2].toLowerCase();
    if (unit === "m") return value * 60;
    if (unit === "h") return value * 3600;
    if (unit === "d") return value * 86400;
    return 60;
}

function normalizeTimeframe(interval) {
    const raw = String(interval || "").trim().toUpperCase();
    if (raw === "60" || raw === "1H") return "60";
    if (raw === "240" || raw === "4H") return "240";
    if (raw === "D" || raw === "1D") return "D";
    return raw;
}

function aggregateCandles(points, intervalSeconds) {
    const buckets = new Map();
    for (const point of points) {
        const timestamp = Number(point?.time || 0);
        const price = Number(point?.price || 0);
        if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) continue;
        const bucketTime = Math.floor(timestamp / intervalSeconds) * intervalSeconds;
        const current = buckets.get(bucketTime);
        if (!current) {
            buckets.set(bucketTime, {
                time: bucketTime,
                open: price,
                high: price,
                low: price,
                close: price,
                volume: 0,
            });
            continue;
        }
        current.high = Math.max(current.high, price);
        current.low = Math.min(current.low, price);
        current.close = price;
    }

    return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

async function fetchSjcHistory(interval, count = 300) {
    const listResponse = await fetch(SJC_ENDPOINT, { method: "POST" });
    if (!listResponse.ok) {
        throw new Error(`sjc_list_http_${listResponse.status}`);
    }
    const listPayload = await listResponse.json();
    const priceList = Array.isArray(listPayload?.data) ? listPayload.data : [];
    const target = priceList.find((item) =>
        String(item?.BranchName || "").trim() === "Hồ Chí Minh"
        && String(item?.TypeName || "").includes("Vàng SJC 1L")
    ) || priceList.find((item) => String(item?.TypeName || "").includes("Vàng SJC 1L"));

    if (!target?.Id) return [];

    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - SJC_HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const historyResponse = await fetch(SJC_ENDPOINT, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
            method: "GetGoldPriceHistory",
            goldPriceId: String(target.Id),
            fromDate: toSjcDate(fromDate),
            toDate: toSjcDate(toDate),
        }),
    });

    if (!historyResponse.ok) {
        throw new Error(`sjc_history_http_${historyResponse.status}`);
    }

    const historyPayload = await historyResponse.json();
    const rows = Array.isArray(historyPayload?.data) ? historyPayload.data : [];
    const points = rows.map((row) => {
        const buy = parseNumberLikeVnd(row?.Buy, 100);
        const sell = parseNumberLikeVnd(row?.Sell, 100);
        const midpoint = Math.round(((buy || 0) + (sell || 0)) / 2);
        return {
            time: parseDotNetDate(row?.GroupDate),
            price: midpoint,
        };
    });
    const aggregated = aggregateCandles(points, intervalToSeconds(interval));
    return aggregated.slice(Math.max(0, aggregated.length - count));
}

async function fetchSjcDailyPoint(date) {
    const response = await fetch(SJC_ENDPOINT, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
            method: "GetSJCGoldPriceByDate",
            toDate: toSjcDate(date),
        }),
    });

    if (!response.ok) {
        throw new Error(`sjc_daily_http_${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const row = rows.find((item) =>
        String(item?.BranchName || "").trim() === "Hồ Chí Minh"
        && String(item?.TypeName || "").includes("Vàng SJC 1L")
    ) || rows.find((item) => String(item?.TypeName || "").includes("Vàng SJC 1L")) || rows[0];

    if (!row) return null;

    const buyValue = parseNumberLikeVnd(row?.Buy, 100);
    const sellValue = parseNumberLikeVnd(row?.Sell, 100);
    const midpoint = Math.round(((buyValue || 0) + (sellValue || 0)) / 2);

    if (!Number.isFinite(midpoint) || midpoint <= 0) return null;

    return {
        time: Math.floor(date.getTime() / 1000),
        price: midpoint,
    };
}

async function fetchSjcRecentDailyPoints() {
    const now = Date.now();
    if (
        sjcDailyHistoryCache.points.length > 0
        && now - sjcDailyHistoryCache.updatedAt < SJC_DAILY_HISTORY_TTL_MS
    ) {
        return sjcDailyHistoryCache.points;
    }

    if (sjcDailyHistoryInflight) return sjcDailyHistoryInflight;

    sjcDailyHistoryInflight = (async () => {
        const today = new Date();
        const dates = [];
        for (let offset = SJC_HISTORY_LOOKBACK_DAYS - 1; offset >= 0; offset -= 1) {
            const date = new Date(today);
            date.setHours(12, 0, 0, 0);
            date.setDate(today.getDate() - offset);
            dates.push(date);
        }

        const settled = await Promise.allSettled(dates.map((date) => fetchSjcDailyPoint(date)));
        const points = settled.flatMap((result) => (
            result.status === "fulfilled" && result.value ? [result.value] : []
        ));

        sjcDailyHistoryCache = {
            updatedAt: Date.now(),
            points,
        };
        return points;
    })().finally(() => {
        sjcDailyHistoryInflight = null;
    });

    return sjcDailyHistoryInflight;
}

function buildCandlesFromHistoricalPoints(points, interval, count = 300) {
    const intervalSeconds = intervalToSeconds(interval);
    const safeCount = Number.isFinite(Number(count)) ? Math.max(10, Math.min(1000, Math.floor(Number(count)))) : 300;
    const usablePoints = points
        .filter((point) => Number.isFinite(Number(point?.time)) && Number.isFinite(Number(point?.price)))
        .sort((a, b) => Number(a.time) - Number(b.time));

    if (usablePoints.length === 0) return [];

    const sliced = usablePoints.slice(Math.max(0, usablePoints.length - safeCount));
    const startTime = Math.floor(Date.now() / 1000) - (sliced.length - 1) * intervalSeconds;

    return sliced.map((point, index) => {
        const price = Number(point.price);
        return {
            time: startTime + index * intervalSeconds,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
        };
    });
}

function buildSyntheticCandlesFromQuote(quote, interval, count = 300) {
    const intervalSeconds = intervalToSeconds(interval);
    const closePrice = Number(quote?.price || quote?.ask || quote?.bid || 0);
    if (!Number.isFinite(closePrice) || closePrice <= 0) return [];

    const now = Math.floor(Date.now() / 1000);
    const candles = [];
    for (let index = count - 1; index >= 0; index -= 1) {
        const time = Math.floor((now - index * intervalSeconds) / intervalSeconds) * intervalSeconds;
        candles.push({
            time,
            open: closePrice,
            high: closePrice,
            low: closePrice,
            close: closePrice,
            volume: 0,
        });
    }
    return candles;
}

export async function getVietnamGoldCandles(symbol, interval, count = 300) {
    const normalizedSymbol = String(symbol || "").trim().toUpperCase();
    const safeCount = Number.isFinite(Number(count)) ? Math.max(10, Math.min(1000, Math.floor(Number(count)))) : 300;
    const normalizedTimeframe = normalizeTimeframe(interval);

    if (normalizedSymbol === SYMBOLS.SJC) {
        // SJC has a real historical endpoint: prioritize this over projected DB candles for 1h/4h.
        if (normalizedTimeframe === "60" || normalizedTimeframe === "240") {
            const realHistory = await fetchSjcHistory(normalizedTimeframe, safeCount);
            if (realHistory.length > 0) return realHistory;
        }

        if (isStoredVietnamGoldTimeframe(normalizedTimeframe)) {
            const stored = await getStoredVietnamGoldCandles(normalizedSymbol, normalizedTimeframe, safeCount);
            if (stored.length > 0) return stored;
        }

        const history = await fetchSjcHistory(interval, safeCount);
        if (history.length > 0) return history;

        const dailyPoints = await fetchSjcRecentDailyPoints();
        if (dailyPoints.length > 0) {
            return buildCandlesFromHistoricalPoints(dailyPoints, interval, safeCount);
        }

        const quotes = await getVietnamGoldQuotes();
        const quote = quotes.find((item) => String(item?.symbol || "").toUpperCase() === normalizedSymbol);
        return buildSyntheticCandlesFromQuote(quote, interval, safeCount);
    }

    if (isStoredVietnamGoldTimeframe(normalizedTimeframe)) {
        const stored = await getStoredVietnamGoldCandles(normalizedSymbol, normalizedTimeframe, safeCount);
        if (stored.length > 0) return stored;
    }

    const quotes = await getVietnamGoldQuotes();
    const quote = quotes.find((item) => String(item?.symbol || "").toUpperCase() === normalizedSymbol);
    return buildSyntheticCandlesFromQuote(quote, interval, safeCount);
}
