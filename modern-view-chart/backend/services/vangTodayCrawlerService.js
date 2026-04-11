import { logInfo, logWarn } from "../logger.js";
import { backfillVangTodayHistoryFromWebsite, getVangTodayLatestQuotes, persistVangTodaySnapshots } from "./vangTodayService.js";

const SNAPSHOT_INTERVAL_MS = Number.parseInt(process.env.VANGTODAY_SNAPSHOT_INTERVAL_MS || "300000", 10);
const STARTUP_DELAY_MS = Number.parseInt(process.env.VANGTODAY_STARTUP_DELAY_MS || "5000", 10);

async function captureOnce() {
    const quotes = await getVangTodayLatestQuotes({ force: true });
    if (quotes.length > 0) {
        await persistVangTodaySnapshots(quotes);
    }
}

export function startVangTodayCrawler() {
    logInfo("vangtoday.crawler.started", {
        snapshotIntervalMs: SNAPSHOT_INTERVAL_MS,
    });

    setTimeout(() => {
        captureOnce().catch((error) => {
            logWarn("vangtoday.capture.initial_failed", { error: error?.message || String(error) });
        });
    }, Math.max(0, STARTUP_DELAY_MS));

    const timer = setInterval(() => {
        captureOnce().catch((error) => {
            logWarn("vangtoday.capture.loop_failed", { error: error?.message || String(error) });
        });
    }, Math.max(60_000, SNAPSHOT_INTERVAL_MS));

    setTimeout(() => {
        backfillVangTodayHistoryFromWebsite()
            .then((count) => {
                logInfo("vangtoday.backfill.completed", { candles: count });
            })
            .catch((error) => {
                logWarn("vangtoday.backfill.failed", { error: error?.message || String(error) });
            });
    }, 15_000);

    return {
        stop() {
            clearInterval(timer);
        },
    };
}
