import { runtimeState } from "../runtime-state.js";
import { getDatabaseHealth } from "./database.js";
import { logError, logWarn } from "../logger.js";

function parseBool(raw, fallback) {
    if (raw == null || raw === "") return fallback;
    const normalized = String(raw).trim().toLowerCase();
    return !(normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no");
}

function parsePositiveInt(raw, fallback) {
    const parsed = Number.parseInt(String(raw ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildConfigFromEnv() {
    return {
        enabled: parseBool(process.env.ALERT_MONITOR_ENABLED, true),
        scanIntervalMs: parsePositiveInt(process.env.ALERT_SCAN_INTERVAL_MS, 15000),
        bridgeOfflineMs: parsePositiveInt(process.env.ALERT_BRIDGE_OFFLINE_MS, 180000),
        dbDisconnectedMs: parsePositiveInt(process.env.ALERT_DB_DISCONNECTED_MS, 120000),
        wsDropSpikeWindowMs: parsePositiveInt(process.env.ALERT_WS_DROP_SPIKE_WINDOW_MS, 60000),
        wsDropSpikeDelta: parsePositiveInt(process.env.ALERT_WS_DROP_SPIKE_DELTA, 30),
        cooldownMs: parsePositiveInt(process.env.ALERT_COOLDOWN_MS, 180000),
        webhookUrl: (process.env.ALERT_WEBHOOK_URL || "").trim(),
    };
}

async function emitAlert(config, type, details) {
    const payload = {
        ts: new Date().toISOString(),
        type,
        details,
    };
    logWarn("ops.alert.raised", payload);

    if (!config.webhookUrl) return;
    try {
        await fetch(config.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        logError("ops.alert.webhook_failed", {
            type,
            error: error?.message || error,
        });
    }
}

export function startRuntimeAlertMonitor() {
    const config = buildConfigFromEnv();
    if (!config.enabled) return null;

    let bridgeOfflineSince = runtimeState.bridgeOnline ? null : Date.now();
    let dbDisconnectedSince = null;
    let lastAlertAtByType = new Map();

    let wsWindowStart = Date.now();
    let wsWindowBaseCount = runtimeState.wsDroppedRateLimit + runtimeState.wsDroppedBackpressure;

    function shouldAlert(type) {
        const last = lastAlertAtByType.get(type) || 0;
        return Date.now() - last >= config.cooldownMs;
    }

    function markAlert(type) {
        lastAlertAtByType.set(type, Date.now());
    }

    async function scanOnce() {
        const now = Date.now();

        if (!runtimeState.bridgeOnline) {
            if (!bridgeOfflineSince) bridgeOfflineSince = now;
            const offlineDuration = now - bridgeOfflineSince;
            if (offlineDuration >= config.bridgeOfflineMs && shouldAlert("bridge_offline")) {
                markAlert("bridge_offline");
                await emitAlert(config, "bridge_offline", {
                    offline_ms: offlineDuration,
                    threshold_ms: config.bridgeOfflineMs,
                });
            }
        } else {
            bridgeOfflineSince = null;
        }

        const db = getDatabaseHealth();
        const dbHealthy = db.state === "connected" || db.state === "connecting";
        if (!dbHealthy) {
            if (!dbDisconnectedSince) dbDisconnectedSince = now;
            const disconnectedDuration = now - dbDisconnectedSince;
            if (disconnectedDuration >= config.dbDisconnectedMs && shouldAlert("db_disconnected")) {
                markAlert("db_disconnected");
                await emitAlert(config, "db_disconnected", {
                    state: db.state,
                    disconnected_ms: disconnectedDuration,
                    threshold_ms: config.dbDisconnectedMs,
                    last_error: db.lastError,
                });
            }
        } else {
            dbDisconnectedSince = null;
        }

        const wsDrops = runtimeState.wsDroppedRateLimit + runtimeState.wsDroppedBackpressure;
        if (now - wsWindowStart >= config.wsDropSpikeWindowMs) {
            wsWindowStart = now;
            wsWindowBaseCount = wsDrops;
        } else {
            const delta = wsDrops - wsWindowBaseCount;
            if (delta >= config.wsDropSpikeDelta && shouldAlert("ws_drop_spike")) {
                markAlert("ws_drop_spike");
                wsWindowStart = now;
                wsWindowBaseCount = wsDrops;
                await emitAlert(config, "ws_drop_spike", {
                    dropped_delta: delta,
                    window_ms: config.wsDropSpikeWindowMs,
                    threshold: config.wsDropSpikeDelta,
                    ws_clients: runtimeState.wsClients,
                });
            }
        }
    }

    const intervalId = setInterval(() => {
        scanOnce().catch((error) => {
            logError("ops.alert.scan_failed", { error: error?.message || error });
        });
    }, config.scanIntervalMs);

    if (typeof intervalId.unref === "function") intervalId.unref();
    return {
        stop() {
            clearInterval(intervalId);
        },
        config,
    };
}
