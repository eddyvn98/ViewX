import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FORECAST_SCRIPT = path.resolve(__dirname, "../forecast/forecast_service.py");

const DEFAULT_WORKER_TIMEOUT_MS = 15_000;

let workerProcess = null;
let workerReadyPromise = null;
let workerReadyResolver = null;
let workerRl = null;
let isStopping = false;

const pendingRequests = new Map();
let requestIdCounter = 1;

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

function handleWorkerExit(code, signal) {
    if (!isStopping) {
        console.warn(`[ForecastWorker] Worker exited unexpectedly (code: ${code}, signal: ${signal})`);
    }

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
    workerReadyResolver = null;
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

    if (parsed?.status === "ready" && workerReadyResolver) {
        workerReadyResolver(true);
        workerReadyResolver = null;
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

        const startupTimer = setTimeout(() => {
            if (workerReadyResolver) {
                console.warn("[ForecastWorker] Worker startup ready timeout (10s), resolving fallback");
                workerReadyResolver(false);
                workerReadyResolver = null;
            }
        }, 10_000);

        workerReadyPromise.finally(() => clearTimeout(startupTimer));
    } catch (error) {
        console.error("[ForecastWorker] Failed to spawn worker:", error);
        workerProcess = null;
        workerReadyPromise = Promise.resolve(false);
    }

    return workerReadyPromise;
}

export async function executeForecastOnWorker(payload, timeoutMs = DEFAULT_WORKER_TIMEOUT_MS) {
    try {
        const isReady = await startForecastWorker();
        if (!isReady || !workerProcess || workerProcess.killed) {
            return null;
        }

        const reqId = requestIdCounter++;
        const requestPayload = { ...payload, req_id: reqId };

        return await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pendingRequests.delete(reqId);
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
    } catch (err) {
        console.warn("[ForecastWorker] Request failed, will use fallback:", err?.message || err);
        return null;
    }
}

export function stopForecastWorker() {
    isStopping = true;
    if (workerProcess && !workerProcess.killed) {
        try {
            workerProcess.stdin.end();
            workerProcess.kill();
        } catch {}
    }
    workerProcess = null;
    workerReadyPromise = null;
}

process.on("exit", stopForecastWorker);
process.on("SIGINT", stopForecastWorker);
process.on("SIGTERM", stopForecastWorker);
