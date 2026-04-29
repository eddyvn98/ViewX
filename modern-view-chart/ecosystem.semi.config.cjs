module.exports = {
  apps: [
    {
      name: "viewx-backend-semi",
      cwd: "D:/viewx/ViewX/modern-view-chart",
      script: "node",
      args: "backend/index.js",
      windowsHide: true,
      env: {
        NODE_ENV: "production",
        PORT: "18091",
        URL_MONGOOSE: "mongodb://127.0.0.1:27017/viewx?directConnection=true",
        ALLOWED_ORIGINS: "https://vivutrade.io.vn,https://api.vivutrade.io.vn,http://127.0.0.1:13000,http://localhost:13000",
        TIMESFM_ENABLED: "1",
        TIMESFM_REPO: "google/timesfm-1.0-200m-pytorch",
        FORECAST_PYTHON_BIN: "D:/viewx/ViewX/modern-view-chart/backend/forecast/.venv/Scripts/python.exe",
        PAYMENT_BANK_CODE: "TCB",
        PAYMENT_BANK_ACCOUNT_NO: "9779690949",
        PAYMENT_BANK_ACCOUNT_NAME: "HA THANH TU",
        SEPAY_WEBHOOK_SECRET: "viewx_sepay_2026"
      }
    },
    {
      name: "viewx-frontend-semi",
      cwd: "D:/viewx/ViewX/modern-view-chart",
      script: "node",
      args: "scripts/start-next.mjs",
      windowsHide: true,
      env: {
        NODE_ENV: "production",
        HOSTNAME: "0.0.0.0",
        PORT: "13000",
        INTERNAL_NEXT_PORT: "13100",
        BACKEND_ORIGIN: "http://127.0.0.1:18091"
      }
    },
    {
      name: "viewx-bridge-semi",
      cwd: "D:/viewx/ViewX/modern-view-chart",
      script: "python",
      args: "-u backend/bridge/main.py",
      windowsHide: true,
      env: {
        NODE_WS_URL: "ws://127.0.0.1:18091",
        ACCESS_TOKEN: "PFb8oiHD90LjV9LOnl9P_Ekm2TR-XiFM9S7z354wH1Zyrd-P8vZ2yrppS7yOXdL6",
        CORE_SYMBOLS: "XAUUSDm,BTCUSDm,ETHUSDm,EURUSDm,GBPUSDm"
      }
    },
    {
      name: "viewx-cloudflared-host",
      cwd: "D:/viewx/ViewX/modern-view-chart",
      script: "./cloudflared.exe",
      args: "tunnel --config cloudflared.host.yml run",
      windowsHide: true,
      env: {
        TUNNEL_METRICS: "127.0.0.1:20242",
        NO_AUTOUPDATE: "true"
      }
    }
  ]
};
