import { spawn } from "node:child_process";

const child = spawn(
  "npm run start",
  [],
  {
    cwd: "D:/viewx/ViewX/modern-view-chart",
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "0.0.0.0",
      PORT: "3000",
      INTERNAL_NEXT_PORT: "3100",
      BACKEND_ORIGIN: "https://api.vivutrade.io.vn",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[start-frontend-prod] failed:", error);
  process.exit(1);
});
