import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const envPath = fs.existsSync(path.join(repoRoot, ".env")) ? path.join(repoRoot, ".env") : path.join(repoRoot, "backend/.env");
dotenv.config({ path: envPath });

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith("--")) continue;
        const key = token.slice(2);
        const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
        args[key] = value;
        if (value !== "true") i += 1;
    }
    return args;
}

function parseBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function createWebSocket(wsUrl, token) {
    if (!token) return new WebSocket(wsUrl);
    // Production WebSocket service auth travels reliably through Cloudflare
    // via Sec-WebSocket-Protocol. HTTP metrics still use Authorization.
    return new WebSocket(wsUrl, [`bearer.${token}`]);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const args = parseArgs(process.argv);

    const clientsTarget = Number.parseInt(args.clients || "100", 10);
    const durationSec = Number.parseInt(args["duration-sec"] || "900", 10);
    const rampSec = Number.parseInt(args["ramp-sec"] || "60", 10);
    const healthPollSec = Number.parseInt(args["health-poll-sec"] || "10", 10);
    const token = (args.token || process.env.ACCESS_TOKEN || "").trim();
    const wsBaseUrl = (args["ws-url"] || process.env.NODE_WS_URL || "ws://127.0.0.1:8091").trim();
    const apiBaseUrl = (args["api-url"] || `http://127.0.0.1:${process.env.PORT || "8091"}`).replace(/\/+$/, "");
    const outputPathArg = args.output || "";
    const requireMetrics = parseBoolean(args["require-metrics"], Boolean(token));
    const reconnectAttemptsMax = Number.parseInt(args["reconnect-attempts"] || "3", 10);
    const reconnectDelayMs = Number.parseInt(args["reconnect-delay-ms"] || "1000", 10);
    const connectTimeoutMs = Number.parseInt(args["connect-timeout-ms"] || "10000", 10);

    const connectSpacingMs = Math.max(1, Math.floor((rampSec * 1000) / Math.max(1, clientsTarget)));
    const testStartedAt = Date.now();
    const runUntil = testStartedAt + durationSec * 1000;

    const symbols = ["XAUUSDm", "BTCUSDm", "ETHUSDm", "EURUSDm", "GBPUSDm"];
    const intervals = ["1", "5", "15"];

    const topicCounts = new Map();
    const healthSamples = [];
    const sockets = new Set();
    const clientStates = Array.from({ length: clientsTarget }, () => ({
        openedEver: false,
        connected: false,
        attempts: 0,
        closeEvents: 0,
        lastCloseCode: null,
        lastError: null,
        currentSocket: null,
    }));

    let opened = 0;
    let reconnectAttempts = 0;
    let totalMessages = 0;
    let intentionallyStopping = false;

    function countTopic(topic) {
        const key = topic || "unknown";
        topicCounts.set(key, (topicCounts.get(key) || 0) + 1);
    }

    async function pollHealth() {
        const ts = Date.now();
        const sample = {
            ts,
            ok: false,
            health_ok: false,
            metrics_ok: false,
            ws_clients: null,
            ws_dropped_rate_limit: null,
            ws_dropped_backpressure: null,
            ws_buffer_pressure: null,
            broadcast_p95_ms: null,
            broadcast_stage_p95_ms: null,
        };

        try {
            const healthRes = await fetch(`${apiBaseUrl}/api/health`);
            sample.health_status = healthRes.status;
            sample.health_ok = healthRes.ok;
            if (healthRes.ok) {
                const health = await healthRes.json();
                sample.health = health;
            }
        } catch (err) {
            sample.health_error = err?.message || String(err);
        }

        if (token) {
            try {
                const metricsRes = await fetch(`${apiBaseUrl}/api/metrics`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                sample.metrics_status = metricsRes.status;
                sample.metrics_ok = metricsRes.ok;
                if (metricsRes.ok) {
                    const metrics = await metricsRes.json();
                    const websocket = metrics?.websocket || {};
                    sample.ws_clients = websocket.connected ?? null;
                    sample.ws_dropped_rate_limit = websocket.dropped_rate_limit ?? null;
                    sample.ws_dropped_backpressure = websocket.dropped_backpressure ?? null;
                    sample.ws_buffer_pressure = websocket.buffer_pressure ?? null;
                    sample.broadcast_p95_ms = websocket.broadcast_loop_p95_ms ?? null;
                    sample.broadcast_stage_p95_ms = websocket.broadcast_stage_p95_ms ?? null;
                }
            } catch (err) {
                sample.metrics_error = err?.message || String(err);
            }
        }

        sample.ok = sample.health_ok && (!requireMetrics || sample.metrics_ok);
        healthSamples.push(sample);
    }

    const healthTimer = setInterval(() => {
        void pollHealth();
    }, Math.max(1, healthPollSec) * 1000);
    await pollHealth();

    function startClient(index) {
        if (intentionallyStopping || Date.now() >= runUntil) return;

        const state = clientStates[index];
        state.attempts += 1;
        const ws = createWebSocket(wsBaseUrl, token);
        state.currentSocket = ws;
        sockets.add(ws);
        let openedThisSocket = false;

        const connectTimer = setTimeout(() => {
            if (!openedThisSocket && ws.readyState === WebSocket.CONNECTING) {
                state.lastError = `connect_timeout_${connectTimeoutMs}ms`;
                ws.terminate();
            }
        }, connectTimeoutMs);

        ws.on("open", () => {
            clearTimeout(connectTimer);
            openedThisSocket = true;
            state.connected = true;
            if (!state.openedEver) {
                state.openedEver = true;
                opened += 1;
            }

            const watch = symbols[index % symbols.length];
            ws.send(JSON.stringify({ topic: "auth", userId: `soak_${index}`, symbols }));
            ws.send(JSON.stringify({ topic: "subscribeSymbols", symbols }));
            ws.send(JSON.stringify({ topic: "subscribeCandle", symbol: watch, interval: intervals[index % intervals.length] }));
        });

        ws.on("message", (buffer) => {
            totalMessages += 1;
            try {
                const parsed = JSON.parse(buffer.toString());
                countTopic(parsed.topic || parsed.type || parsed.event);
            } catch {
                countTopic("non_json");
            }
        });

        ws.on("error", (err) => {
            state.lastError = err?.message || String(err);
        });

        ws.on("close", (code) => {
            clearTimeout(connectTimer);
            sockets.delete(ws);
            if (state.currentSocket === ws) state.currentSocket = null;
            state.connected = false;
            if (intentionallyStopping) return;

            state.closeEvents += 1;
            state.lastCloseCode = code;
            if (state.attempts <= reconnectAttemptsMax && Date.now() < runUntil) {
                reconnectAttempts += 1;
                setTimeout(() => startClient(index), reconnectDelayMs);
            }
        });
    }

    for (let i = 0; i < clientsTarget; i += 1) {
        startClient(i);
        if (i % 10 === 0) {
            process.stdout.write(`[soak] starting client ${i + 1}/${clientsTarget}\n`);
        }
        await sleep(connectSpacingMs);
    }

    while (Date.now() < runUntil) {
        await sleep(1000);
        const elapsed = Math.floor((Date.now() - testStartedAt) / 1000);
        if (elapsed % 30 === 0) {
            const connected = clientStates.filter((state) => state.connected).length;
            process.stdout.write(`[soak] elapsed ${elapsed}s, opened=${opened}, connected=${connected}, reconnects=${reconnectAttempts}, msgs=${totalMessages}\n`);
        }
    }

    const connectedAtEnd = clientStates.filter((state) => state.connected).length;
    const failed = clientStates.filter((state) => !state.openedEver).length;
    const unrecovered = clientStates.filter((state) => !state.connected).length;
    const closeEvents = clientStates.reduce((sum, state) => sum + state.closeEvents, 0);

    intentionallyStopping = true;
    clearInterval(healthTimer);
    for (const ws of sockets) {
        if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
            try {
                ws.close(1000, "Soak test completed");
            } catch {
                // Ignore
            }
        }
    }

    await sleep(1500);
    await pollHealth();

    const disconnectRate = (unrecovered / Math.max(1, clientsTarget)) * 100;
    const healthOkSamples = healthSamples.filter((item) => item.ok && Number.isFinite(item.broadcast_p95_ms));
    const maxBroadcastP95 = healthOkSamples.length > 0 ? Math.max(...healthOkSamples.map((x) => x.broadcast_p95_ms)) : null;
    const stageNames = ["price", "price_sources", "price_scope", "price_send", "candle", "candle_fetch", "candle_indicator", "candle_serialize_send"];
    const maxBroadcastStageP95Ms = Object.fromEntries(
        stageNames.map((stage) => {
            const values = healthOkSamples
                .map((sample) => sample.broadcast_stage_p95_ms?.[stage])
                .filter(Number.isFinite);
            return [stage, values.length > 0 ? Math.max(...values) : null];
        })
    );

    const gates = {
        all_clients_opened: opened === clientsTarget,
        all_clients_connected_at_end: connectedAtEnd === clientsTarget,
        received_realtime_messages: totalMessages > 0,
        unrecovered_disconnect_rate_under_1_percent: disconnectRate < 1,
        metrics_available_when_required: requireMetrics ? maxBroadcastP95 !== null : true,
        broadcast_p95_under_250_ms: maxBroadcastP95 !== null ? maxBroadcastP95 < 250 : (requireMetrics ? false : null),
    };

    const report = {
        generated_at: new Date().toISOString(),
        config: {
            clients_target: clientsTarget,
            duration_sec: durationSec,
            ramp_sec: rampSec,
            health_poll_sec: healthPollSec,
            reconnect_attempts: reconnectAttemptsMax,
            reconnect_delay_ms: reconnectDelayMs,
            connect_timeout_ms: connectTimeoutMs,
            ws_url: wsBaseUrl,
            api_url: apiBaseUrl,
            auth_mode: token ? "sec_websocket_protocol" : "guest",
            require_metrics: requireMetrics,
        },
        summary: {
            opened,
            failed_to_open: failed,
            connected_at_end: connectedAtEnd,
            unrecovered,
            close_events: closeEvents,
            reconnect_attempts: reconnectAttempts,
            unrecovered_disconnect_rate_percent: Number(disconnectRate.toFixed(3)),
            total_messages: totalMessages,
            avg_messages_per_sec: Number((totalMessages / Math.max(1, durationSec)).toFixed(3)),
            max_broadcast_p95_ms: maxBroadcastP95,
            max_broadcast_stage_p95_ms: maxBroadcastStageP95Ms,
        },
        gates,
        topic_counts: Object.fromEntries(Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1])),
        client_failures: clientStates
            .map((state, index) => ({
                index,
                opened_ever: state.openedEver,
                connected_at_end: state.connected,
                attempts: state.attempts,
                close_events: state.closeEvents,
                last_close_code: state.lastCloseCode,
                last_error: state.lastError,
            }))
            .filter((state) => !state.opened_ever || !state.connected_at_end),
        health_samples: healthSamples,
    };

    const logsDir = path.join(repoRoot, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = outputPathArg ? path.resolve(repoRoot, outputPathArg) : path.join(logsDir, `ws-soak-report-${stamp}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

    process.stdout.write(`[soak] report written: ${outputPath}\n`);
    process.stdout.write(`[soak] unrecovered_disconnect_rate=${report.summary.unrecovered_disconnect_rate_percent}% | reconnects=${reconnectAttempts} | max_broadcast_p95_ms=${String(maxBroadcastP95)}\n`);
    process.stdout.write(`[soak] max_broadcast_stage_p95_ms=${JSON.stringify(maxBroadcastStageP95Ms)}\n`);

    const failedGate = Object.values(gates).some((value) => value === false);
    if (failedGate) {
        process.exitCode = 2;
    }
}

main().catch((err) => {
    process.stderr.write(`[soak] fatal: ${err?.stack || err?.message || String(err)}\n`);
    process.exit(1);
});
