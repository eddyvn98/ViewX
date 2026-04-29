import { safeSend } from "../wsSend.js";
import { getVietnamGoldCandles } from "../../services/vnGoldService.js";
import { getVangTodayCandles } from "../../services/vangTodayService.js";

function normalizeVangTodayInterval(interval) {
    const raw = String(interval || "").trim().toUpperCase();
    if (raw === "D1" || raw === "1D") return "D";
    if (raw === "60" || raw === "1H" || raw === "H1") return "60";
    if (raw === "240" || raw === "4H" || raw === "H4") return "240";
    return raw || "60";
}

function isLegacyVnGoldSymbol(symbol) {
    const upper = String(symbol || "").trim().toUpperCase();
    return upper === "SJCVN" || upper === "DOJIVN";
}

export async function handleVnGoldCandles({ ws }, data) {
    try {
        const symbol = String(data?.symbol || "").trim().toUpperCase();
        const interval = String(data?.interval || "").trim();
        const count = Number.isFinite(Number(data?.count)) ? Number(data.count) : 300;
        let candles = [];

        if (isLegacyVnGoldSymbol(symbol)) {
            candles = await getVietnamGoldCandles(symbol, interval, count);
        } else {
            candles = await getVangTodayCandles(symbol, normalizeVangTodayInterval(interval), "buy", count);
        }

        safeSend(ws, JSON.stringify({
            topic: "mt5_candles",
            symbol,
            interval,
            source: "VN_GOLD",
            candles,
        }));
    } catch {
        // Ignore transient fetch errors; client retry loop will recover.
    }
}
