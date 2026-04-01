import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";
import mongoose from "mongoose";
import { WebSocket } from "ws";
import { issueAuthTokens } from "../../backend/auth/userJwt.js";
import { userModel } from "../../backend/model/user.js";

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

    // Include legal consent evidence so security tests can reach deep guards
    // (replay/version/routing) instead of being blocked early by consent gates.
    payload.proPolicyVersion = "2026-03";
    payload.proPolicyAcceptedAt = new Date().toISOString();

    return payload;
}

function buildProCommand({ requestId, symbol, volume = 0.01, role = null, plan = null, clientMode = null }) {
    const payload = {
        topic: "mt5_command",
        command: "buy",
        symbol,
        volume,
        price: 0,
        request_id: requestId,
        proPolicyVersion: "2026-03",
        proPolicyAcceptedAt: new Date().toISOString(),
    };
    if (role) payload.role = role;
    if (plan) payload.plan = plan;
    if (clientMode) payload.client_mode = clientMode;
    return payload;
}

function isErrorWithCode(message, code) {
    return (
        message?.topic === "error" &&
        String(message?.code || "").trim().toLowerCase() === String(code || "").trim().toLowerCase()
    );
}

function isLikelyServiceToken(token) {
    const raw = String(token || "").trim();
    if (!raw) return false;
    if (raw.split(".").length >= 2) return false;
    return raw === String(process.env.ACCESS_TOKEN || "").trim();
}

async function resolveQaUserToken({ explicitUserToken, fallbackToken }) {
    const direct = String(explicitUserToken || "").trim();
    if (direct) return { token: direct, source: "explicit_user_token" };

    const fallback = String(fallbackToken || "").trim();
    if (!isLikelyServiceToken(fallback)) {
        return { token: fallback, source: "provided_token" };
    }

    const mongoUri = String(process.env.URL_MONGOOSE || "").trim();
    if (!mongoUri) {
        throw new Error("URL_MONGOOSE is required to auto-generate PRO_QA_USER_TOKEN from service token");
    }

    await mongoose.connect(mongoUri);
    try {
        const user = await userModel
            .findOne({ role: { $in: ["admin", "trader", "viewer"] } })
            .select("_id role sessionVersion")
            .lean();

        if (!user?._id) {
            throw new Error("No user found in database to mint QA user token");
        }

        const tokens = issueAuthTokens({
            userId: String(user._id),
            role: user.role || "viewer",
            sessionVersion: Number.isFinite(Number(user.sessionVersion)) ? Number(user.sessionVersion) : 1,
        });

        return { token: String(tokens.accessToken || "").trim(), source: "auto_minted_from_db" };
    } finally {
        await mongoose.disconnect();
    }
}

function isErrorDetailContaining(message, detailPart) {
    const detail = String(message?.detail || "").trim().toLowerCase();
    return message?.topic === "error" && detail.includes(String(detailPart || "").trim().toLowerCase());
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

    session.send(buildProCommand({ requestId, symbol, role: "viewer", plan: "free", clientMode: "pro_extension" }));
    const response = await session.waitFor(
        (message) => message?.topic === "error" || message?.topic === "mt5_order_result",
        replyTimeoutMs,
    );

    const passed = isErrorWithCode(response, "forbidden");

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

    session.send(buildProCommand({ requestId, symbol, role: "viewer", plan: "free", clientMode: "web_client" }));
    const response = await session.waitFor(
        (message) => message?.topic === "error" || message?.topic === "mt5_order_result",
        replyTimeoutMs,
    );

    const passed = isErrorWithCode(response, "forbidden");

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
        role: "trader",
        plan: "pro",
        clientMode: "web_client",
        validUntil,
    }));

    await session.waitFor((message) => message?.topic === "bridgeStatus" || message?.topic === "priceUpdate", 2000);

    session.send(buildProCommand({ requestId, symbol, role: "trader", plan: "pro", clientMode: "web_client" }));
    const firstResponse = await session.waitFor(
        (message) =>
            message?.request_id === requestId &&
            (message?.topic === "error" || message?.topic === "mt5_order_result"),
        replyTimeoutMs,
    );

    // Replay must be tested regardless of first response availability.
    session.send(buildProCommand({ requestId, symbol, role: "trader", plan: "pro", clientMode: "web_client" }));
    const secondResponse = await session.waitFor(
        (message) =>
            message?.request_id === requestId &&
            (message?.topic === "error" || message?.topic === "mt5_order_result"),
        settleMs,
    );

    const replayError = session.messages.find((message) => isErrorWithCode(message, "conflict"));
    const dedupedReplay =
        secondResponse?.topic === "mt5_order_result" &&
        ["pending", "acknowledged"].includes(String(secondResponse?.status || "").toLowerCase());
    const passed = isErrorWithCode(secondResponse, "conflict") || Boolean(replayError) || dedupedReplay;

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

async function runDirectBridgeTopicCase({ wsUrl, token, authMode, replyTimeoutMs }) {
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

    session.send({
        topic: "mt5_update",
        request_id: requestId,
        data: {
            account: { balance: 1000 },
            positions: [],
        },
    });

    const response = await session.waitFor((message) => message?.topic === "error", replyTimeoutMs);
    const passed =
        isErrorWithCode(response, "forbidden") &&
        (
            isErrorDetailContaining(response, "bridge_topic_requires_authenticated_bridge") ||
            isErrorDetailContaining(response, "bridge_topic_requires_service_auth")
        );

    await session.close();

    return {
        name: "direct_bridge_topic",
        expected: "Reject direct bridge-only topics from non-bridge clients.",
        passed,
        status: passed ? "pass" : "fail",
        request_id: requestId,
        response: response ? summaryForMessage(response) : null,
        evidence: session.events,
    };
}

async function main() {
    const args = parseArgs(process.argv);
    const wsUrl = normalizeWsUrl(args["ws-url"] || process.env.PRO_QA_WS_URL || process.env.NODE_WS_URL || "");
    const tokenCandidate = (args.token || process.env.PRO_QA_AUTH_TOKEN || process.env.PRO_QA_USER_TOKEN || "").trim();
    const explicitUserToken = (args["user-token"] || process.env.PRO_QA_USER_TOKEN || "").trim();
    const authMode = String(args["auth-mode"] || process.env.PRO_QA_AUTH_MODE || "header").trim().toLowerCase();
    const symbol = String(args.symbol || process.env.PRO_QA_SYMBOL || "XAUUSDm").trim() || "XAUUSDm";
    const outputDir = path.resolve(
        repoRoot,
        String(args["output-dir"] || process.env.PRO_QA_OUTPUT_DIR || "logs").trim(),
    );
    const replyTimeoutMs = Number.parseInt(String(args["reply-timeout-ms"] || process.env.PRO_QA_REPLY_TIMEOUT_MS || "8000"), 10);
    const settleMs = Number.parseInt(String(args["settle-ms"] || process.env.PRO_QA_SETTLE_MS || "2500"), 10);

    if (!tokenCandidate) {
        throw new Error("PRO_QA_AUTH_TOKEN or PRO_QA_USER_TOKEN is required");
    }
    const { token, source: tokenSource } = await resolveQaUserToken({
        explicitUserToken,
        fallbackToken: tokenCandidate,
    });
    if (!token) {
        throw new Error("Failed to resolve QA user token");
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
    cases.push(await runDirectBridgeTopicCase({ wsUrl, token, authMode, replyTimeoutMs }));

    const summary = {
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ws_url: wsUrl,
        auth_mode: authMode,
        auth_token_masked: maskCredential(token),
        auth_token_source: tokenSource,
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
