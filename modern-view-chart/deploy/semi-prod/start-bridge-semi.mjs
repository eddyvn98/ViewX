import { spawn } from "node:child_process";

const child = spawn(
  "python -u backend/bridge/main.py",
  [],
  {
    cwd: "D:/viewx/ViewX/modern-view-chart",
    shell: true,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      NODE_WS_URL: "ws://127.0.0.1:18092",
      ACCESS_TOKEN: process.env.ACCESS_TOKEN || "PFb8oiHD90LjV9LOnl9P_Ekm2TR-XiFM9S7z354wH1Zyrd-P8vZ2yrppS7yOXdL6",
      CORE_SYMBOLS: process.env.CORE_SYMBOLS || "XAUUSDm,BTCUSDm,ETHUSDm,EURUSDm,GBPUSDm",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[start-bridge-semi] failed:", error);
  process.exit(1);
});
