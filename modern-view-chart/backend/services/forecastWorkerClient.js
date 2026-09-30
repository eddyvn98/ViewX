import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FORECAST_SCRIPT = path.resolve(__dirname, "../forecast/forecast_service.py");

const DEFAULT_WORKER_TIMEOUT_MS = 15_000;
const DEFAULT_WORKER_STARTUP_TIMEOUT_MS = 180_000;
const INITIAL_RESTART_DELAY_MS = 2_000;
const MAX_RESTART_DELAY_MS = 15_000;

let workerProcess = null;
let workerReadyPromise = null;
let workerReadyResolver = null;
let workerRl = null;
let isStopping = false;
let restartTimer = null;
let restartAttempts = 0;

const pendingRequests = new Map();
let requestIdCounter = 1;
let workerQueue = Promise.resolve();

function isAutoRestartEnabled() {
    const val = process.env.FORECAST_WORKER_AUTO_RESTART;
    return val !== "0" && val !== "false";
}

function settleWorkerReady(value) {
    if (!workerReadyResolver) return;
    const resolveReady = workerReadyResolver;
    workerReadyResolver = null;
    resolveReady(value);
}

function configuredStartupTimeoutMs() {
    const configured = Number(process.env.FORECAST_WORKER_STARTUP_TIMEOUT_MS);
    return Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_WORKER_STARTUP_TIMEOUT_MS;
}

export function resolvePythonBin() {
    const managedRuntime = path.resolve(__dirname, "../forecast/.venv-311/Scripts/python.exe");
    const configured = (process.env.FORECAST_PYTHON_BIN || process.env.PYTHON_BIN || "").trim();
    if (configured) {
        return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
    }
    if (process.platform === "win32" && fs.existsSync(managedRuntime)) {
        return managedRuntime;
    }
    return "python";
}

function scheduleWorkerRestart() {
    if (isStopping || restartTimer || !isAutoRestartEnabled()) return;

    const delay = Math.min(
        INITIAL_RESTART_DELAY_MS * Math.pow(1.5, restartAttempts),
        MAX_RESTART_DELAY_MS
    );
    restartAttempts++;

    restartTimer = setTimeout(() => {
        restartTimer = null;
        if (!isStopping && (!workerProcess || workerProcess.killed)) {
            console.log(`[ForecastWorker] Auto-restarting background worker (attempt ${restartAttempts})...`);
            startForecastWorker().catch((err) => {
                console.warn("[ForecastWorker] Auto-restart failed:", err?.message || err);
            });
        }
    }, delay);

    if (typeof restartTimer.unref === "function") {
        restartTimer.unref();
    }
}

function handleWorkerExit(code, signal) {
    if (!isStopping) {
        console.warn(`[ForecastWorker] Worker exited unexpectedly (code: ${code}, signal: ${signal})`);
    }

    // A worker may fail before emitting the ready line. Always settle the
    // startup promise so callers can fall back instead of waiting forever.
    settleWorkerReady(false);

    for (const [reqId, request] of pendingRequests.entries()) {
        clearTimeout(request.timer);
        request.reject(new Error(`Worker process terminated before responding to request ${reqId}`));
    }
    pendingRequests.clear();

    if (workerRl) {
        try {
            workerRl.close();
        } catch {}
        workerRl = null;
    }

    workerProcess = null;
    workerReadyPromise = null;

    if (!isStopping) {
        scheduleWorkerRestart();
    }
}

function handleWorkerLine(rawLine) {
    const line = String(rawLine || "").trim();
    if (!line) return;

    let parsed;
    try {
        parsed = JSON.parse(line);
    } catch {
        return;
    }

    if (parsed?.status === "ready") {
        restartAttempts = 0;
        settleWorkerReady(true);
        return;
    }

    const reqId = parsed?.req_id;
    if (reqId !== undefined && pendingRequests.has(reqId)) {
        const { resolve, timer } = pendingRequests.get(reqId);
        clearTimeout(timer);
        pendingRequests.delete(reqId);
        resolve(parsed);
    }
}

export function startForecastWorker() {
    if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
    }

    if (workerProcess && !workerProcess.killed) {
        return workerReadyPromise;
    }

    isStopping = false;
    const pythonBin = resolvePythonBin();

    workerReadyPromise = new Promise((resolve) => {
        workerReadyResolver = resolve;
    });

    try {
        const child = spawn(pythonBin, [FORECAST_SCRIPT, "--worker"], {
            stdio: ["pipe", "pipe", "pipe"],
            env: {
                ...process.env,
                PYTHONUNBUFFERED: "1",
            },
        });

        workerProcess = child;

        workerRl = readline.createInterface({
            input: child.stdout,
            crlfDelay: Number.POSITIVE_INFINITY,
        });

        workerRl.on("line", handleWorkerLine);

        child.stderr.on("data", (chunk) => {
            const msg = chunk.toString().trim();
            if (msg) console.warn("[ForecastWorker:stderr]", msg);
        });

        child.on("error", (error) => {
            console.error("[ForecastWorker] Spawn error:", error?.message || error);
            handleWorkerExit(-1, "SPAWN_ERROR");
        });

        child.on("close", (code, signal) => {
            handleWorkerExit(code, signal);
        });

        const startupTimeoutMs = configuredStartupTimeoutMs();
        const startupTimer = setTimeout(() => {
            if (!workerReadyResolver) return;
            console.warn(
                `[ForecastWorker] Worker startup ready timeout (${startupTimeoutMs}ms), restarting on next request`,
            );
            settleWorkerReady(false);
            try {
                child.kill();
            } catch {}
        }, startupTimeoutMs);

        workerReadyPromise.finally(() => clearTimeout(startupTimer));
    } catch (error) {
        console.error("[ForecastWorker] Failed to spawn worker:", error);
        settleWorkerReady(false);
        workerProcess = null;
        workerReadyPromise = Promise.resolve(false);
    }

    return workerReadyPromise;
}

async function executeQueuedForecast(payload, timeoutMs) {
    const isReady = await startForecastWorker();
    if (!isReady || !workerProcess || workerProcess.killed) {
        return null;
    }

    const reqId = requestIdCounter++;
    const requestPayload = { ...payload, req_id: reqId };

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingRequests.delete(reqId);
            // A timed-out single-threaded worker may still be computing this
            // request. Kill it before the caller starts one-shot fallback so the
            // same TimesFM request is not left consuming resources twice.
            if (workerProcess && !workerProcess.killed) {
                try {
                    workerProcess.kill();
                } catch {}
            }
            reject(new Error(`Worker request ${reqId} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        pendingRequests.set(reqId, { resolve, reject, timer });

        try {
            workerProcess.stdin.write(JSON.stringify(requestPayload) + "\n");
        } catch (writeErr) {
            clearTimeout(timer);
            pendingRequests.delete(reqId);
            reject(writeErr);
        }
    });
}

export async function executeForecastOnWorker(payload, timeoutMs = DEFAULT_WORKER_TIMEOUT_MS) {
    // TimesFM worker is single-threaded. Serialize requests so timeout starts
    // when a request is actually dispatched, not while it is waiting in line.
    const run = workerQueue.then(() => executeQueuedForecast(payload, timeoutMs));
    workerQueue = run.catch(() => null);

    try {
        return await run;
    } catch (err) {
        console.warn("[ForecastWorker] Request failed, will use fallback:", err?.message || err);
        return null;
    }
}

export function stopForecastWorker() {
    isStopping = true;
    if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
    }
    restartAttempts = 0;
    if (workerProcess && !workerProcess.killed) {
        try {
            workerProcess.stdin.end();
            workerProcess.kill();
        } catch {}
    }
    settleWorkerReady(false);
    workerProcess = null;
    workerReadyPromise = null;
}

process.once("exit", stopForecastWorker);
process.once("SIGINT", () => {
    stopForecastWorker();
    process.exit(130);
});
process.once("SIGTERM", () => {
    stopForecastWorker();
    process.exit(143);
});
