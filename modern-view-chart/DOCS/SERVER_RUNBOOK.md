# Modern View Chart Server Runbook

## Scope
- Host app from this laptop.
- Use Cloudflare Quick Tunnel (`trycloudflare.com`) for public access.
- Keep backend pinned to port `8091`.
- Protect API/WS with rotating `ACCESS_TOKEN`.
- Run MongoDB per-project using Docker (`viewx-mongo`).

## File Locations
- Repo root: `d:\viewx\ViewX\modern-view-chart`
- Bootstrap: `scripts/server/bootstrap.ps1`
- Start all: `scripts/server/run-all.ps1`
- Stop all: `scripts/server/stop-all.ps1`
- Watchdog: `scripts/server/watchdog.ps1`
- Rotate token: `scripts/server/rotate-access-token.ps1`
- DB scripts: `scripts/server/db-up.ps1`, `scripts/server/db-down.ps1`, `scripts/server/db-status.ps1`
- Logs: `logs\frontend.log`, `logs\backend.log`, `logs\bridge.log`, `logs\tunnel.log`, `logs\token-rotate.log`
- Public link artifacts: `mobile_link.txt`, `public/mobile-access.json`

## Required `.env`
```env
PORT=8091
ACCESS_TOKEN=<strong-random-token>
URL_MONGOOSE=mongodb://127.0.0.1:27027/viewx?directConnection=true
ALLOWED_ORIGINS=https://*.trycloudflare.com,http://localhost:3000,http://127.0.0.1:3000
MAX_WS_CLIENTS=150
WS_MSG_RATE_PER_10S=60
BRIDGE_WS_MSG_RATE_PER_10S=15000
BRIDGE_SYMBOL_REFRESH_SEC=2
WS_HEARTBEAT_INTERVAL_MS=30000
WS_BACKPRESSURE_SKIP_BYTES=262144
CORE_SYMBOLS=XAUUSDm,BTCUSDm,ETHUSDm,EURUSDm,GBPUSDm
TOKEN_ROTATE_CRON_TIME=03:00
MOBILE_ACCESS_TTL_SEC=43200
```

## MongoDB (Docker per project)
Start DB:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\db-up.ps1
```

Stop DB:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\db-down.ps1
```

Check DB:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\db-status.ps1
```

## First-Time Setup
1. Run bootstrap:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\server\bootstrap.ps1
   ```
2. Register autostart/watchdog/rotation:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\server\setup-autostart.ps1
   ```

## Start / Stop Services
Start:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\run-all.ps1
```

Stop:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\stop-all.ps1
```

Restart:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\stop-all.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\server\run-all.ps1
```

`run-all.ps1` automatically attempts to start MongoDB container first and fails fast if `.next/BUILD_ID` is missing (no fallback to `next dev`).

## Health Checks
Liveness:
```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8091/api/health?access_token=<ACCESS_TOKEN>"
```

Readiness:
```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8091/api/health/ready?access_token=<ACCESS_TOKEN>"
```

## WS Soak Test (100 users / 15 minutes)
Run:
```powershell
npm run soak:ws -- --clients 100 --duration-sec 900 --ramp-sec 60 --health-poll-sec 10
```

Output:
- JSON report is written to `logs/ws-soak-report-<timestamp>.json`
- Gate summary includes:
  - disconnect rate
  - max observed `broadcast_p95_ms`

## Public Link
Quick read:
```powershell
Get-Content .\mobile_link.txt
```

JSON detail:
```powershell
Get-Content .\public\mobile-access.json
```

`mobile_link.txt` includes:
- `access_ticket=<short-lived-signed-ticket>`
- `ws_url=wss://.../?access_ticket=<short-lived-signed-ticket>`

## Token Rotation
Manual forced rotation:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\rotate-access-token.ps1 -Force
```

Scheduled rotation:
- Task name: `ModernViewChartRotateToken`
- Runs daily at `TOKEN_ROTATE_CRON_TIME` (default `03:00`)
- Flow: backup `.env` -> rotate token -> `stop-all` -> `run-all` -> verify health + link artifacts

## Scheduled Tasks
- `ModernViewChartServer`: start services at boot.
- `ModernViewChartBootstrap`: bootstrap at logon (disabled by default).
- `ModernViewChartWatchdog`: check/recover FE/BE/Bridge/Tunnel every minute.
- `ModernViewChartRotateToken`: daily token rotation.

If task registration is blocked by policy:
- Startup fallback launchers are written to:
  - `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ModernViewChartServer.cmd`
  - `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ModernViewChartWatchdog.cmd`
  - `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ModernViewChartRotateToken.cmd`

## Recovery
### Tunnel URL changed/reset
1. Run `stop-all.ps1`.
2. Run `run-all.ps1`.
3. Wait 10-30 seconds.
4. Read new URL from `mobile_link.txt`.

### Cloudflare 429 (error 1015)
1. Wait a few minutes.
2. Retry `run-all.ps1`.
3. Avoid rapid tunnel restart loops.

### Frontend 502 via tunnel
1. Check `logs\frontend.log`.
2. Confirm `http://127.0.0.1:3000` returns `200`.
3. Let watchdog restart frontend or run `run-all.ps1`.

### DB disconnected in health
1. Run `db-status.ps1`.
2. If container down: run `db-up.ps1`.
3. If still disconnected, inspect `logs\backend.log`.

## Keep Link Stable
- Do not run `stop-all.ps1` unless intentional rotation/restart.
- Do not reboot machine during active session.
- Disable sleep/hibernate for server profile.
- Keep tunnel process (`start_mobile_access.py`) alive.
