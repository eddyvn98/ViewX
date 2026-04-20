import { spawn } from "node:child_process";

const child = spawn(
  "D:/viewx/ViewX/modern-view-chart/cloudflared.exe tunnel --config D:/viewx/ViewX/modern-view-chart/cloudflared.host.yml run",
  [],
  {
    cwd: "D:/viewx/ViewX/modern-view-chart",
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      TUNNEL_METRICS: "127.0.0.1:20242",
      NO_AUTOUPDATE: "true",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[start-cloudflared-host] failed:", error);
  process.exit(1);
});
