import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { logInfo, logWarn } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const bridgeEntry = path.join(repoRoot, "backend/bridge/main.py");
const logDir = path.join(repoRoot, "logs");
const outLogPath = path.join(logDir, "bridge-autostart.out.log");
const errLogPath = path.join(logDir, "bridge-autostart.err.log");

let bridgeProcess = null;
let lastStartAt = 0;

function resolvePythonBinary() {
    const configured = String(process.env.BRIDGE_PYTHON_BIN || "").trim();
    if (configured) return configured;
    return process.platform === "win32" ? "python" : "python3";
}

export function isBridgeAutostartEnabled() {
    return String(process.env.BRIDGE_AUTOSTART_ENABLED || "0").trim() === "1";
}

export function ensureBridgeStarted() {
    if (!fs.existsSync(bridgeEntry)) {
        return { ok: false, reason: "bridge_entry_not_found" };
    }

    if (bridgeProcess && !bridgeProcess.killed) {
        return { ok: true, status: "already_running", pid: bridgeProcess.pid || null };
    }

    const now = Date.now();
    if (now - lastStartAt < 4000) {
        return { ok: true, status: "start_throttled" };
    }

    fs.mkdirSync(logDir, { recursive: true });
    const outFd = fs.openSync(outLogPath, "a");
    const errFd = fs.openSync(errLogPath, "a");

    const child = spawn(resolvePythonBinary(), ["-u", bridgeEntry], {
        cwd: repoRoot,
        detached: true,
        stdio: ["ignore", outFd, errFd],
    });
    child.unref();
    bridgeProcess = child;
    lastStartAt = now;

    child.on("exit", (code, signal) => {
        logWarn("bridge.autostart.exited", {
            pid: child.pid || null,
            code: code ?? null,
            signal: signal ?? null,
        });
        if (bridgeProcess === child) bridgeProcess = null;
    });

    logInfo("bridge.autostart.started", {
        pid: child.pid || null,
        entry: bridgeEntry,
    });

    return {
        ok: true,
        status: "started",
        pid: child.pid || null,
    };
}

