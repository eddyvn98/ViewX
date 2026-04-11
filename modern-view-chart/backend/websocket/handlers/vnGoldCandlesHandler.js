import { safeSend } from "../wsSend.js";
import { getVietnamGoldCandles } from "../../services/vnGoldService.js";

export async function handleVnGoldCandles({ ws }, data) {
    try {
        const candles = await getVietnamGoldCandles(data.symbol, data.interval, data.count);
        safeSend(ws, JSON.stringify({
            topic: "mt5_candles",
            symbol: data.symbol,
            interval: data.interval,
            source: "VN_GOLD",
            candles,
        }));
    } catch {
        // Ignore transient fetch errors; client retry loop will recover.
    }
}
