import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.HOSTNAME || "0.0.0.0";
const publicPort = Number.parseInt(process.env.PORT || "3000", 10);
const upstreamHost = "127.0.0.1";
const upstreamPort = Number.parseInt(process.env.INTERNAL_NEXT_PORT || "3100", 10);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const childEnv = {
    ...process.env,
    HOSTNAME: upstreamHost,
    PORT: String(upstreamPort),
};

const child = spawn(process.execPath, [nextCli, "start", "--hostname", upstreamHost, "--port", String(upstreamPort)], {
    cwd: projectRoot,
    env: childEnv,
    stdio: "inherit",
});

child.on("error", (error) => {
    console.error("[start-next] Failed to start Next.js:", error);
    process.exit(1);
});

let shuttingDown = false;

const pageContentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://accounts.google.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' ws: wss: https://stream.binance.com:9443 https://api.binance.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "frame-src 'self' https://accounts.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
].join("; ");

const nonHtmlContentSecurityPolicy = [
    "default-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "object-src 'none'",
].join("; ");

function getSecurityHeaders(pathname) {
    const common = {
        "x-frame-options": "DENY",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=(), geolocation=(), microphone=()",
        "strict-transport-security": "max-age=15552000; includeSubDomains",
    };

    if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
        return {
            ...common,
            "content-security-policy": nonHtmlContentSecurityPolicy,
        };
    }

    return {
        ...common,
        "content-security-policy": pageContentSecurityPolicy,
    };
}

function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => {
        if (!child.killed) child.kill("SIGTERM");
        process.exit(code);
    });
    setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
        process.exit(code);
    }, 5000).unref();
}

const server = http.createServer((req, res) => {
    const upstreamReq = http.request(
        {
            hostname: upstreamHost,
            port: upstreamPort,
            method: req.method,
            path: req.url,
            headers: {
                ...req.headers,
                host: req.headers.host || `${upstreamHost}:${upstreamPort}`,
            },
        },
        (upstreamRes) => {
            const headers = { ...upstreamRes.headers };
            delete headers["x-powered-by"];
            const pathname = String(req.url || "/").split("?", 1)[0];
            Object.assign(headers, getSecurityHeaders(pathname));
            res.writeHead(upstreamRes.statusCode || 502, headers);
            upstreamRes.pipe(res);
        },
    );

    upstreamReq.on("error", (error) => {
        if (!res.headersSent) {
            res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        }
        res.end(`Upstream Next.js error: ${error.message}`);
    });

    req.pipe(upstreamReq);
});

server.on("clientError", (_error, socket) => {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(publicPort, host, () => {
    console.log(`[start-next] Reverse proxy listening on http://${host}:${publicPort} -> http://${upstreamHost}:${upstreamPort}`);
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    shutdown(code ?? 0);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
