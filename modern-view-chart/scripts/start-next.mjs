import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT || "3000";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextCli, "start", "--hostname", host, "--port", port], {
    stdio: "inherit",
});

child.on("error", (error) => {
    console.error("[start-next] Failed to start Next.js:", error);
    process.exit(1);
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 0);
});
