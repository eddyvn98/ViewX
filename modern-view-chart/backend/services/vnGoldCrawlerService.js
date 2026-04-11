import fetch from "node-fetch";
import { logError, logInfo, logWarn } from "../logger.js";
import { logVietnamGoldStorageStarted, persistVietnamGoldSnapshots, upsertVietnamGoldDailyCandle } from "./vnGoldStorageService.js";
import { getVietnamGoldQuotes } from "./vnGoldService.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BACKFILL_DAYS = Number.parseInt(process.env.VN_GOLD_BACKFILL_DAYS || "365", 10);
const SNAPSHOT_INTERVAL_MS = Number.parseInt(process.env.VN_GOLD_SNAPSHOT_INTERVAL_MS || "300000", 10);
const STARTUP_SNAPSHOT_DELAY_MS = Number.parseInt(process.env.VN_GOLD_STARTUP_SNAPSHOT_DELAY_MS || "5000", 10);
const SJC_ENDPOINT = "https://sjc.com.vn/GoldPrice/Services/PriceService.ashx";

const BRAND_CONFIG = {
    SJCVN: {
        provider: "SJC",
        historyUrl: (dateText) => `https://giavang.org/trong-nuoc/sjc/${dateText}.html`,
        legacyHistoryUrl: (dateText) => `https://giavang.org/trong-nuoc/sjc/lich-su/${dateText}.html`,
        matchesPrimaryRow: (cells) => normalizeText(cells[0]) === "ho chi minh" && normalizeText(cells[1]).includes("vang sjc 1l"),
        matchesUpdateRow: (cells) => cells.length >= 3 && /\d{2}:\d{2}:\d{2}/.test(cells[2]),
    },
    DOJIVN: {
        provider: "DOJI",
        historyUrl: (dateText) => `https://giavang.org/trong-nuoc/doji/${dateText}.html`,
        matchesPrimaryRow: (cells) => normalizeText(cells[0]) === "ha noi" && normalizeText(cells[1]).includes("sjc"),
        matchesUpdateRow: () => false,
    },
};

function normalizeText(input) {
    return String(input || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function toDateText(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parsePriceText(input) {
    const text = String(input || "").replace(/[^\d.,-]/g, "").trim();
    if (!text) return null;
    const normalized = text.includes(".") && !text.includes(",")
        ? text.replace(/\./g, "")
        : text.replace(/,/g, "");
    const value = Number.parseFloat(normalized);
    if (!Number.isFinite(value)) return null;
    return value * 100;
}

function stripTags(input) {
    return String(input || "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "|")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
}

function parseTableRows(html) {
    return [...String(html || "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
        .map((match) => stripTags(match[1]))
        .filter((cells) => cells.length > 0);
}

function buildDailyCandleFromRows(symbol, rows, day, usedUrl) {
    const config = BRAND_CONFIG[symbol];
    if (!config) return null;

    const primaryRow = rows.find((cells) => config.matchesPrimaryRow(cells)) || null;
    if (!primaryRow) return null;

    const primaryBuy = parsePriceText(primaryRow[2]);
    const primarySell = parsePriceText(primaryRow[3]);
    const primaryMid = Number.isFinite(primaryBuy) && Number.isFinite(primarySell)
        ? Math.round((primaryBuy + primarySell) / 2)
        : primarySell ?? primaryBuy ?? null;

    if (!Number.isFinite(primaryMid) || primaryMid <= 0) return null;

    const updates = rows
        .filter((cells) => config.matchesUpdateRow(cells))
        .map((cells) => {
            const buy = parsePriceText(cells[0]);
            const sell = parsePriceText(cells[1]);
            const midpoint = Number.isFinite(buy) && Number.isFinite(sell)
                ? Math.round((buy + sell) / 2)
                : sell ?? buy ?? null;
            return Number.isFinite(midpoint) && midpoint > 0 ? midpoint : null;
        })
        .filter(Boolean);

    const series = updates.length > 0 ? [primaryMid, ...updates] : [primaryMid];
    return {
        symbol,
        provider: config.provider,
        day,
        open: series[0],
        high: Math.max(...series),
        low: Math.min(...series),
        close: series[series.length - 1],
        points: series.length,
        meta: {
            origin: "giavang.org",
            url: usedUrl,
        },
    };
}

async function fetchGiavangDailyCandle(symbol, day) {
    const config = BRAND_CONFIG[symbol];
    if (!config) return null;

    if (symbol === "SJCVN") {
        const official = await fetchSjcOfficialDailyCandle(day).catch(() => null);
        if (official) return official;
    }

    const dateText = toDateText(day);
    const urls = [config.historyUrl(dateText), config.legacyHistoryUrl?.(dateText)].filter(Boolean);

    for (const url of urls) {
        const response = await fetch(url, {
            headers: {
                "user-agent": "Mozilla/5.0 (compatible; VivuTradeBot/1.0)",
            },
        });
        if (!response.ok) continue;
        const html = await response.text();
        if (/không tìm thấy dữ liệu|404/i.test(html.toLowerCase())) continue;
        const rows = parseTableRows(html);
        const candle = buildDailyCandleFromRows(symbol, rows, day, url);
        if (candle) return candle;
    }
    return null;
}

function toSjcDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

async function fetchSjcOfficialDailyCandle(day) {
    const response = await fetch(SJC_ENDPOINT, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
            method: "GetSJCGoldPriceByDate",
            toDate: toSjcDate(day),
        }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const primary = rows.find((row) =>
        normalizeText(row?.BranchName) === "ho chi minh"
        && normalizeText(row?.TypeName).includes("vang sjc 1l")
    ) || rows[0];
    if (!primary) return null;

    const buy = parsePriceText(primary.Buy);
    const sell = parsePriceText(primary.Sell);
    if (!Number.isFinite(buy) || !Number.isFinite(sell)) return null;
    return {
        symbol: "SJCVN",
        provider: "SJC",
        day,
        open: Math.round((buy + sell) / 2),
        high: Math.max(buy, sell),
        low: Math.min(buy, sell),
        close: Math.round((buy + sell) / 2),
        points: 1,
        meta: {
            origin: "sjc.com.vn",
            url: "https://sjc.com.vn/bieu-do-gia-vang",
        },
    };
}

async function backfillDailyCandles() {
    const safeDays = Math.max(1, Math.min(3000, DEFAULT_BACKFILL_DAYS));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const symbol of Object.keys(BRAND_CONFIG)) {
        for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
            const day = new Date(today.getTime() - offset * DAY_MS);
            try {
                const candle = await fetchGiavangDailyCandle(symbol, day);
                if (!candle) continue;
                await upsertVietnamGoldDailyCandle(candle);
            } catch (error) {
                logWarn("vn_gold.backfill.day_failed", {
                    symbol,
                    day: toDateText(day),
                    error: error?.message || String(error),
                });
            }
        }
    }

    logInfo("vn_gold.backfill.completed", { days: safeDays });
}

async function captureLiveSnapshots() {
    try {
        const quotes = await getVietnamGoldQuotes({ force: true });
        await persistVietnamGoldSnapshots(quotes);
    } catch (error) {
        logWarn("vn_gold.snapshot.capture_failed", { error: error?.message || String(error) });
    }
}

export function startVietnamGoldCrawler() {
    logVietnamGoldStorageStarted({
        snapshotIntervalMs: SNAPSHOT_INTERVAL_MS,
        backfillDays: DEFAULT_BACKFILL_DAYS,
    });

    setTimeout(() => {
        captureLiveSnapshots().catch((error) => {
            logError("vn_gold.snapshot.initial_failed", { error: error?.message || String(error) });
        });
    }, Math.max(0, STARTUP_SNAPSHOT_DELAY_MS));

    const timer = setInterval(() => {
        captureLiveSnapshots().catch((error) => {
            logWarn("vn_gold.snapshot.loop_failed", { error: error?.message || String(error) });
        });
    }, Math.max(60_000, SNAPSHOT_INTERVAL_MS));

    backfillDailyCandles().catch((error) => {
        logWarn("vn_gold.backfill.failed", { error: error?.message || String(error) });
    });

    return {
        stop() {
            clearInterval(timer);
        },
    };
}
