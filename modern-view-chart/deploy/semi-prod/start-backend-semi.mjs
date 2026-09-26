import { spawn } from "node:child_process";

const child = spawn(
  "npm run server:start",
  [],
  {
    cwd: "D:/viewx/ViewX/modern-view-chart",
    shell: true,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "18092",
      URL_MONGOOSE: "mongodb://127.0.0.1:27017/viewx?directConnection=true",
      ALLOWED_ORIGINS: "https://vivutrade.io.vn,https://api.vivutrade.io.vn,http://127.0.0.1:13010,http://localhost:13010",
      AI_ENABLED: "1",
      TIMESFM_ENABLED: "1",
      TIMESFM_REPO: "google/timesfm-2.5-200m-pytorch",
      FORECAST_PYTHON_BIN: "backend/forecast/.venv-311/Scripts/python.exe",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[start-backend-semi] failed:", error);
  process.exit(1);
});
