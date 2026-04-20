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
      PORT: "13010",
      INTERNAL_NEXT_PORT: "13100",
      BACKEND_ORIGIN: "http://127.0.0.1:18092",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[start-frontend-semi] failed:", error);
  process.exit(1);
});
