import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

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

async function runCase({ name, url, method = "GET", body = null, timeoutMs = 8000 }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method,
            headers: body ? { "content-type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
            cache: "no-store",
        });

        const ok = response.status >= 200 && response.status < 300;
        return {
            name,
            ok,
            status: response.status,
            outcome: ok ? "ok" : "bad_status",
        };
    } catch (error) {
        return {
            name,
            ok: false,
            status: 0,
            outcome: error?.name === "AbortError" ? "timeout" : "error",
            detail: error?.message || String(error),
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function main() {
    const args = parseArgs(process.argv);
    const baseUrl = (args["base-url"] || process.env.WEB_BASE_URL || "http://127.0.0.1:3000").trim();
    const token = (args.token || process.env.ACCESS_TOKEN || "").trim();
    const clientId = `smoke-${Date.now()}`;

    const wsTicketUrl = new URL("/api/auth/ws-ticket", baseUrl);
    const userStateUrl = new URL("/api/user/state", baseUrl);
    userStateUrl.searchParams.set("client_id", clientId);

    if (token) {
        wsTicketUrl.searchParams.set("access_token", token);
        userStateUrl.searchParams.set("access_token", token);
    }

    const results = [];
    results.push(await runCase({
        name: "ws_ticket_get",
        url: wsTicketUrl.toString(),
        method: "GET",
    }));
    results.push(await runCase({
        name: "user_state_get",
        url: userStateUrl.toString(),
        method: "GET",
    }));
    results.push(await runCase({
        name: "user_state_put",
        url: userStateUrl.toString(),
        method: "PUT",
        body: {
            schema_version: 1,
            state: {
                watchlist: ["XAUUSDm"],
            },
        },
    }));

    const summary = {
        generated_at: new Date().toISOString(),
        base_url: baseUrl,
        token_masked: maskCredential(token),
        total: results.length,
        passed: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
    };

    const logsDir = path.join(repoRoot, "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(logsDir, `api-auth-smoke-${stamp}.json`);
    fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

    console.log(`[api-auth-smoke] report written: ${reportPath}`);
    console.log(`[api-auth-smoke] passed=${summary.passed}/${summary.total}`);

    if (summary.failed > 0) {
        process.exitCode = 2;
    }
}

main().catch((error) => {
    console.error(`[api-auth-smoke] fatal: ${error?.message || String(error)}`);
    process.exit(1);
});
