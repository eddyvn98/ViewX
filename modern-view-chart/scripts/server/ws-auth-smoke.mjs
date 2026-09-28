import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const envPath = fs.existsSync(path.join(repoRoot, ".env"))
    ? path.join(repoRoot, ".env")
    : path.join(repoRoot, "backend/.env");
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

function maskCredential(value) {
    if (!value) return "";
    const raw = String(value);
    const suffix = raw.length >= 4 ? raw.slice(-4) : raw;
    return `***${suffix}`;
}

function withQueryToken(url, token) {
    const parsed = new URL(url);
    parsed.searchParams.set("access_token", token);
    return parsed.toString();
}

function runWsCase({ name, url, headers, protocols, timeoutMs = 5000, onOpen }) {
    return new Promise((resolve) => {
        let settled = false;
        let timeout = null;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            if (timeout) clearTimeout(timeout);
            resolve({ name, ...result });
        };

        const options = {};
        if (headers && Object.keys(headers).length > 0) options.headers = headers;

        const ws = protocols ? new WebSocket(url, protocols, options) : new WebSocket(url, options);

        timeout = setTimeout(() => {
            try {
                ws.terminate();
            } catch {
                // ignore
            }
            finish({ ok: false, outcome: "timeout" });
        }, timeoutMs);

        ws.on("open", async () => {
            if (typeof onOpen === "function") {
                try {
                    const openResult = await onOpen(ws);
                    if (openResult?.closeImmediately !== false) {
                        ws.close(1000, "case complete");
                    }
                    finish({ ok: true, outcome: "opened", detail: openResult?.detail || null });
                    return;
                } catch (error) {
                    ws.close(1011, "case failed");
                    finish({ ok: false, outcome: "open_handler_error", detail: error?.message || String(error) });
                    return;
                }
            }
            ws.close(1000, "case complete");
            finish({ ok: true, outcome: "opened" });
        });

        ws.on("close", (code, reasonBuffer) => {
            if (settled) return;
            const reason = Buffer.from(reasonBuffer || []).toString("utf-8");
            const unauthorizedClose = code === 1008 && /unauthorized/i.test(reason || "");
            finish({
                ok: unauthorizedClose,
                outcome: "closed",
                detail: {
                    code,
                    reason,
                },
            });
        });

        ws.on("error", (error) => {
            if (settled) return;
            finish({ ok: false, outcome: "error", detail: error?.message || String(error) });
        });
    });
}

async function main() {
    const args = parseArgs(process.argv);
    const token = (args.token || process.env.ACCESS_TOKEN || "").trim();
    const baseUrl = (args["ws-url"] || process.env.NODE_WS_URL || "ws://127.0.0.1:8091").trim();

    if (!token) {
        throw new Error("ACCESS_TOKEN is required for ws auth smoke test");
    }

    const results = [];

    // Anonymous WebSocket access is intentionally supported as a viewer/guest.
    results.push(await runWsCase({
        name: "guest_without_auth",
        url: baseUrl,
    }));

    // Service authentication for production WebSockets uses a bearer subprotocol.
    // This survives the Cloudflare WebSocket path used by api.vivutrade.io.vn.
    results.push(await runWsCase({
        name: "service_subprotocol_bearer",
        url: baseUrl,
        protocols: [`bearer.${token}`],
    }));

    const summary = {
        generated_at: new Date().toISOString(),
        ws_url: baseUrl,
        token_masked: maskCredential(token),
        total: results.length,
        passed: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
    };

    const logsDir = path.join(repoRoot, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(logsDir, `ws-auth-smoke-${stamp}.json`);
    fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

    console.log(`[ws-auth-smoke] report written: ${reportPath}`);
    console.log(`[ws-auth-smoke] passed=${summary.passed}/${summary.total}`);

    if (summary.failed > 0) {
        process.exitCode = 2;
    }
}

main().catch((error) => {
    console.error(`[ws-auth-smoke] fatal: ${error?.message || String(error)}`);
    process.exit(1);
});
