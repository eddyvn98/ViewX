import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";
import { WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const envPaths = [path.join(repoRoot, ".env"), path.join(repoRoot, "backend/.env")];
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        break;
    }
}

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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskCredential(value) {
    if (!value) return "";
    const raw = String(value);
    const suffix = raw.length >= 4 ? raw.slice(-4) : raw;
    return `***${suffix}`;
}

function normalizeWsUrl(input) {
    const raw = String(input || "").trim();
    if (!raw) return "ws://127.0.0.1:8091";
    if (/^wss?:\/\//i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw)) return raw.replace(/^http/i, "ws");
    return `ws://${raw}`;
}

function decodeJwtClaims(token) {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return {};
    try {
        const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = payload.length % 4 === 0 ? payload : `${payload}${"=".repeat(4 - (payload.length % 4))}`;
        return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    } catch {
        return {};
    }
}

function isWsMessage(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

function summaryForMessage(message) {
    if (!isWsMessage(message)) {
        return { raw: String(message) };
    }

    return {
        topic: message.topic || message.type || message.event || null,
        code: message.code || null,
        detail: message.detail || null,
        request_id: message.request_id || null,
        status: message.status || null,
        command: message.command || null,
        symbol: message.symbol || null,
    };
}

function createWebSocketSession({ url, token, authMode, timeoutMs = 10000 }) {
    return new Promise((resolve, reject) => {
        const options = { maxPayload: 10 * 1024 * 1024 };
        let protocols = undefined;
        if (authMode === "protocol") {
            protocols = [`bearer.${token}`];
        } else {
            options.headers = { Authorization: `Bearer ${token}` };
        }

        const ws = protocols ? new WebSocket(url, protocols, options) : new WebSocket(url, options);
        const messages = [];
        const events = [];
        let closed = false;
        let cursor = 0;

        const pushMessage = (message) => {
            messages.push(message);
            events.push({
                at: new Date().toISOString(),
                message: summaryForMessage(message),
            });
        };

        const session = {
            ws,
            messages,
            events,
            send(payload) {
                const raw = JSON.stringify(payload);
                ws.send(raw);
                events.push({
                    at: new Date().toISOString(),
                    direction: "outbound",
                    message: summaryForMessage(payload),
                });
            },
            async waitFor(predicate, waitMs) {
                const deadline = Date.now() + waitMs;
                while (Date.now() < deadline) {
                    for (let i = cursor; i < messages.length; i += 1) {
                        const candidate = messages[i];
                        if (predicate(candidate)) {
                            cursor = i + 1;
                            return candidate;
                        }
                    }
                    await sleep(50);
                }
                return null;
            },
            async close() {
                if (closed) return;
                closed = true;
                try {
                    ws.close(1000, "pro-security-smoke complete");
                } catch {
                    // ignore
                }
                await sleep(100);
            },
        };

        const connectTimeout = setTimeout(() => {
            try {
                ws.terminate();
            } catch {
                // ignore
            }
            reject(new Error(`WebSocket connect timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        ws.once("open", () => {
            clearTimeout(connectTimeout);
            ws.on("message", (raw) => {
                try {
                    pushMessage(JSON.parse(raw.toString()));
                } catch {
                    pushMessage(raw.toString());
                }
            });
            ws.on("close", (code, reasonBuffer) => {
                closed = true;
                const reason = Buffer.from(reasonBuffer || []).toString("utf-8");
                events.push({
                    at: new Date().toISOString(),
                    direction: "close",
                    message: { code, reason },
                });
            });
            ws.on("error", (error) => {
                events.push({
                    at: new Date().toISOString(),
                    direction: "error",
                    message: { error: error?.message || String(error) },
                });
            });
            resolve(session);
        });

        ws.once("error", (error) => {
            clearTimeout(connectTimeout);
            reject(error);
        });
    });
}

function buildAuthPayload({ userId, role, plan, clientMode, validUntil }) {
    const payload = {
        topic: "auth",
        role,
        plan,
        client_mode: clientMode,
        session: {
            role,
            plan,
            validUntil,
            subscription: {
                plan,
                validUntil,
            },
        },
    };

    if (userId) {
        payload.userId = userId;
    }

    return payload;
}

function buildProCommand({ requestId, symbol, volume = 0.01 }) {
    return {
        topic: "mt5_command",
        command: "buy",
        symbol,
        volume,
        price: 0,
        request_id: requestId,
    };
}

function buildReadOnlyRequest({ requestId, symbol, interval = "1m", count = 2 }) {
    return {
        topic: "mt5_command",
        command: "get_candles",
        symbol,
        interval,
        count,
        request_id: requestId,
    };
}

async function runForgedClientModeCase({ wsUrl, token, authMode, symbol, replyTimeoutMs }) {
    const claims = decodeJwtClaims(token);
    const session = await createWebSocketSession({ url: wsUrl, token, authMode, timeoutMs: replyTimeoutMs });
    const requestId = crypto.randomUUID();
    const validUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    session.send(buildAuthPayload({
        userId: claims.sub || claims.user_id || null,
        role: "viewer",
        plan: "free",
        clientMode: "pro_extension",
        validUntil,
    }));

    await session.waitFor((message) => message?.topic === "bridgeStatus" || message?.topic === "priceUpdate", 2000);

    session.send(buildProCommand({ requestId, symbol }));
    const response = await session.waitFor(
        (message) => message?.topic === "error" || message?.topic === "mt5_order_result",
        replyTimeoutMs,
    );

    const passed =
        response?.topic === "error" &&
        String(response?.code || "").toLowerCase() === "forbidden";

    await session.close();

    return {
        name: "forged_client_mode",
        expected: "Reject pro-only command when client_mode claims pro_extension from a free/viewer session.",
        passed,
        status: passed ? "pass" : "fail",
        request_id: requestId,
        response: response ? summaryForMessage(response) : null,
        evidence: session.events,
    };
}

async function runDirectPrivateCommandCase({ wsUrl, token, authMode, symbol, replyTimeoutMs }) {
    const claims = decodeJwtClaims(token);
    const session = await createWebSocketSession({ url: wsUrl, token, authMode, timeoutMs: replyTimeoutMs });
    const requestId = crypto.randomUUID();
    const validUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    session.send(buildAuthPayload({
        userId: claims.sub || claims.user_id || null,
        role: "viewer",
        plan: "free",
        clientMode: "web_client",
        validUntil,
    }));

    await session.waitFor((message) => message?.topic === "bridgeStatus" || message?.topic === "priceUpdate", 2000);

    session.send(buildProCommand({ requestId, symbol }));
    const response = await session.waitFor(
        (message) => message?.topic === "error" || message?.topic === "mt5_order_result",
        replyTimeoutMs,
    );

    const passed =
        response?.topic === "error" &&
        String(response?.code || "").toLowerCase() === "forbidden";

    await session.close();

    return {
        name: "direct_private_command",
        expected: "Reject direct pro-only command from a viewer/free session even without forged client_mode.",
        passed,
        status: passed ? "pass" : "fail",
        request_id: requestId,
        response: response ? summaryForMessage(response) : null,
        evidence: session.events,
    };
}

async function runReplayRequestIdCase({ wsUrl, token, authMode, symbol, replyTimeoutMs, settleMs }) {
    const claims = decodeJwtClaims(token);
    const session = await createWebSocketSession({ url: wsUrl, token, authMode, timeoutMs: replyTimeoutMs });
    const requestId = crypto.randomUUID();
    const validUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    session.send(buildAuthPayload({
        userId: claims.sub || claims.user_id || null,
        role: "viewer",
        plan: "free",
        clientMode: "web_client",
        validUntil,
    }));

    await session.waitFor((message) => message?.topic === "bridgeStatus" || message?.topic === "priceUpdate", 2000);

    session.send(buildReadOnlyRequest({ requestId, symbol }));
    const firstResponse = await session.waitFor(
        (message) => message?.topic === "mt5_candles" && message?.request_id === requestId,
        replyTimeoutMs,
    );

    let secondResponse = null;
    if (firstResponse) {
        session.send(buildReadOnlyRequest({ requestId, symbol }));
        secondResponse = await session.waitFor(
            (message) => message?.topic === "mt5_candles" && message?.request_id === requestId,
            settleMs,
        );
    }

    const replayError = session.messages.find((message) =>
        message?.topic === "error" &&
        String(message?.code || "").toLowerCase().includes("replay")
    );

    const passed = Boolean(firstResponse) && !secondResponse;

    await session.close();

    return {
        name: "replay_request_id",
        expected: "Return at most one execution/response for the same request_id; the second submit should be rejected or deduped.",
        passed,
        status: passed ? "pass" : "fail",
        request_id: requestId,
        first_response: firstResponse ? summaryForMessage(firstResponse) : null,
        second_response: secondResponse ? summaryForMessage(secondResponse) : null,
        replay_error: replayError ? summaryForMessage(replayError) : null,
        evidence: session.events,
    };
}

async function main() {
    const args = parseArgs(process.argv);
    const wsUrl = normalizeWsUrl(args["ws-url"] || process.env.PRO_QA_WS_URL || process.env.NODE_WS_URL || "");
    const token = (args.token || process.env.PRO_QA_AUTH_TOKEN || process.env.PRO_QA_USER_TOKEN || "").trim();
    const authMode = String(args["auth-mode"] || process.env.PRO_QA_AUTH_MODE || "header").trim().toLowerCase();
    const symbol = String(args.symbol || process.env.PRO_QA_SYMBOL || "XAUUSDm").trim() || "XAUUSDm";
    const outputDir = path.resolve(
        repoRoot,
        String(args["output-dir"] || process.env.PRO_QA_OUTPUT_DIR || "logs").trim(),
    );
    const replyTimeoutMs = Number.parseInt(String(args["reply-timeout-ms"] || process.env.PRO_QA_REPLY_TIMEOUT_MS || "8000"), 10);
    const settleMs = Number.parseInt(String(args["settle-ms"] || process.env.PRO_QA_SETTLE_MS || "2500"), 10);

    if (!token) {
        throw new Error("PRO_QA_AUTH_TOKEN or PRO_QA_USER_TOKEN is required");
    }

    if (!["header", "protocol"].includes(authMode)) {
        throw new Error("PRO_QA_AUTH_MODE must be either 'header' or 'protocol'");
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const startedAt = new Date().toISOString();
    const cases = [];

    cases.push(await runForgedClientModeCase({ wsUrl, token, authMode, symbol, replyTimeoutMs }));
    cases.push(await runDirectPrivateCommandCase({ wsUrl, token, authMode, symbol, replyTimeoutMs }));
    cases.push(await runReplayRequestIdCase({ wsUrl, token, authMode, symbol, replyTimeoutMs, settleMs }));

    const summary = {
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ws_url: wsUrl,
        auth_mode: authMode,
        auth_token_masked: maskCredential(token),
        symbol,
        reply_timeout_ms: replyTimeoutMs,
        settle_ms: settleMs,
        total: cases.length,
        passed: cases.filter((item) => item.passed).length,
        failed: cases.filter((item) => !item.passed).length,
        cases,
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(outputDir, `pro-security-smoke-${stamp}.json`);
    fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

    for (const item of cases) {
        const status = item.passed ? "PASS" : "FAIL";
        const response = item.response || item.first_response || item.second_response || item.replay_error;
        console.log(`[pro-security-smoke] ${status} ${item.name} :: ${item.expected}`);
        if (response) {
            console.log(`[pro-security-smoke]   evidence=${JSON.stringify(response)}`);
        }
    }

    console.log(`[pro-security-smoke] report written: ${reportPath}`);
    console.log(`[pro-security-smoke] passed=${summary.passed}/${summary.total}`);

    if (summary.failed > 0) {
        process.exitCode = 2;
    }
}

main().catch((error) => {
    console.error(`[pro-security-smoke] fatal: ${error?.message || String(error)}`);
    process.exit(1);
});
