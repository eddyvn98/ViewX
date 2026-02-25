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

function withAccessToken(wsUrl, token) {
    if (!token) return wsUrl;
    try {
        const parsed = new URL(wsUrl);
        if (!parsed.searchParams.get("access_token") && !parsed.searchParams.get("access_ticket")) {
            parsed.searchParams.set("access_token", token);
        }
        return parsed.toString();
    } catch {
        return wsUrl;
    }
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

    const wsUrl = withAccessToken(wsBaseUrl, token);
    const connectSpacingMs = Math.max(1, Math.floor((rampSec * 1000) / Math.max(1, clientsTarget)));
    const testStartedAt = Date.now();
    const runUntil = testStartedAt + durationSec * 1000;

    const symbols = ["XAUUSDm", "BTCUSDm", "ETHUSDm", "EURUSDm", "GBPUSDm"];
    const intervals = ["1", "5", "15"];

    const topicCounts = new Map();
    const healthSamples = [];
    const sockets = [];

    let opened = 0;
    let failed = 0;
    let unexpectedClosed = 0;
    let totalMessages = 0;
    let intentionallyStopping = false;

    function countTopic(topic) {
        const key = topic || "unknown";
        topicCounts.set(key, (topicCounts.get(key) || 0) + 1);
    }

    async function pollHealth() {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        try {
            const res = await fetch(`${apiBaseUrl}/api/health`, { headers });
            if (!res.ok) {
                healthSamples.push({ ts: Date.now(), ok: false, status: res.status });
                return;
            }
            const data = await res.json();
            const broadcastP95 =
                data.broadcast_p95_ms ??
                data.broadcast_loop_ms_p95 ??
                null;
            const wsDroppedRateLimit =
                data.ws_dropped_rate_limit ??
                data.ws_droppedRateLimit ??
                null;
            const wsDroppedBackpressure =
                data.ws_dropped_backpressure ??
                data.ws_droppedBackpressure ??
                null;
            const wsBufferPressure =
                data.ws_buffer_pressure ??
                data.wsBufferPressure ??
                null;
            healthSamples.push({
                ts: Date.now(),
                ok: true,
                ws_clients: data.ws_clients ?? null,
                ws_dropped_rate_limit: wsDroppedRateLimit,
                ws_dropped_backpressure: wsDroppedBackpressure,
                ws_buffer_pressure: wsBufferPressure,
                broadcast_p95_ms: broadcastP95,
            });
        } catch (err) {
            healthSamples.push({ ts: Date.now(), ok: false, error: err?.message || String(err) });
        }
    }

    const healthTimer = setInterval(() => {
        void pollHealth();
    }, Math.max(1, healthPollSec) * 1000);
    await pollHealth();

    for (let i = 0; i < clientsTarget; i += 1) {
        const ws = new WebSocket(wsUrl);
        ws.__opened = false;
        sockets.push(ws);

        ws.on("open", () => {
            ws.__opened = true;
            opened += 1;
            const watch = symbols[i % symbols.length];
            ws.send(JSON.stringify({ topic: "auth", userId: `soak_${i}`, symbols: symbols }));
            ws.send(JSON.stringify({ topic: "subscribeSymbols", symbols }));
            ws.send(JSON.stringify({ topic: "subscribeCandle", symbol: watch, interval: intervals[i % intervals.length] }));
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

        ws.on("error", () => {
            if (!ws.__opened) failed += 1;
        });

        ws.on("close", (code) => {
            if (intentionallyStopping) return;
            if (code !== 1000) unexpectedClosed += 1;
        });

        if (i % 10 === 0) {
            process.stdout.write(`[soak] starting client ${i + 1}/${clientsTarget}\n`);
        }
        await sleep(connectSpacingMs);
    }

    while (Date.now() < runUntil) {
        await sleep(1000);
        const elapsed = Math.floor((Date.now() - testStartedAt) / 1000);
        if (elapsed % 30 === 0) {
            process.stdout.write(`[soak] elapsed ${elapsed}s, opened=${opened}, failed=${failed}, unexpectedClosed=${unexpectedClosed}, msgs=${totalMessages}\n`);
        }
    }

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

    const disconnectRate = ((failed + unexpectedClosed) / Math.max(1, clientsTarget)) * 100;
    const healthOkSamples = healthSamples.filter((item) => item.ok && Number.isFinite(item.broadcast_p95_ms));
    const maxBroadcastP95 = healthOkSamples.length > 0 ? Math.max(...healthOkSamples.map((x) => x.broadcast_p95_ms)) : null;

    const gates = {
        disconnect_rate_under_1_percent: disconnectRate < 1,
        broadcast_p95_under_250_ms: maxBroadcastP95 !== null ? maxBroadcastP95 < 250 : null,
    };

    const report = {
        generated_at: new Date().toISOString(),
        config: {
            clients_target: clientsTarget,
            duration_sec: durationSec,
            ramp_sec: rampSec,
            health_poll_sec: healthPollSec,
            ws_url: wsBaseUrl,
            api_url: apiBaseUrl,
        },
        summary: {
            opened,
            failed,
            unexpected_closed: unexpectedClosed,
            disconnect_rate_percent: Number(disconnectRate.toFixed(3)),
            total_messages: totalMessages,
            avg_messages_per_sec: Number((totalMessages / Math.max(1, durationSec)).toFixed(3)),
            max_broadcast_p95_ms: maxBroadcastP95,
        },
        gates,
        topic_counts: Object.fromEntries(Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1])),
        health_samples: healthSamples,
    };

    const logsDir = path.join(repoRoot, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = outputPathArg ? path.resolve(repoRoot, outputPathArg) : path.join(logsDir, `ws-soak-report-${stamp}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

    process.stdout.write(`[soak] report written: ${outputPath}\n`);
    process.stdout.write(`[soak] disconnect_rate=${report.summary.disconnect_rate_percent}% | max_broadcast_p95_ms=${String(maxBroadcastP95)}\n`);

    if (!gates.disconnect_rate_under_1_percent || gates.broadcast_p95_under_250_ms === false) {
        process.exitCode = 2;
    }
}

main().catch((err) => {
    process.stderr.write(`[soak] fatal: ${err?.stack || err?.message || String(err)}\n`);
    process.exit(1);
});
