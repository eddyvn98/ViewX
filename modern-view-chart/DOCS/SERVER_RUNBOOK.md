# Modern View Chart Server Runbook

## Scope
- Host app from this laptop.
- Use Cloudflare Quick Tunnel (`trycloudflare.com`) for public access.
- Keep backend pinned to port `8091`.
- Protect API/WS with rotating `ACCESS_TOKEN`.
- Run MongoDB per-project using Docker (`viewx-mongo`).
  Optional: use external MongoDB (Atlas M0) to remove local Docker DB load.

## File Locations
- Repo root: `d:\viewx\ViewX\modern-view-chart`
- Bootstrap: `scripts/server/bootstrap.ps1`
- Start all: `scripts/server/run-all.ps1`
- Stop all: `scripts/server/stop-all.ps1`
- Watchdog: `scripts/server/watchdog.ps1`
- Rotate token: `scripts/server/rotate-access-token.ps1`
- Emergency mode: `scripts/server/emergency-mode.ps1`
- DB scripts: `scripts/server/db-up.ps1`, `scripts/server/db-down.ps1`, `scripts/server/db-status.ps1`
- Logs: `logs\frontend.log`, `logs\backend.log`, `logs\bridge.log`, `logs\tunnel.log`, `logs\token-rotate.log`
- Public link runtime artifacts (git-ignored): `mobile_link.txt`, `public/mobile-access.json`
- Safe templates (tracked): `mobile_link.example.txt`, `public/mobile-access.example.json`

## Required `.env`
```env
PORT=8091
ACCESS_TOKEN=<strong-random-token>
URL_MONGOOSE=mongodb://127.0.0.1:27027/viewx?directConnection=true
FORCE_LOCAL_DOCKER_DB=0
ALLOWED_ORIGINS=https://*.trycloudflare.com,http://localhost:3000,http://127.0.0.1:3000
MAX_WS_CLIENTS=150
WS_MSG_RATE_PER_10S=60
BRIDGE_WS_MSG_RATE_PER_10S=15000
BRIDGE_SYMBOL_REFRESH_SEC=2
BRIDGE_ACTIVE_LOOP_SLEEP_SEC=0.5
BRIDGE_IDLE_LOOP_SLEEP_SEC=1.5
BRIDGE_ACTIVE_POSITIONS_INTERVAL_SEC=2
BRIDGE_IDLE_POSITIONS_INTERVAL_SEC=8
BRIDGE_DAILY_OPEN_REFRESH_SEC=300
WS_HEARTBEAT_INTERVAL_MS=30000
WS_BACKPRESSURE_SKIP_BYTES=262144
WS_ALLOW_QUERY_AUTH=1
WS_QUERY_AUTH_DEPRECATED_UNTIL=2026-03-11T00:00:00.000Z
WS_REQUIRE_ROLE_FOR_TRADING=trader
WS_AUTH_TICKET_TTL_SEC=300
CORE_SYMBOLS=XAUUSDm,BTCUSDm,ETHUSDm,EURUSDm,GBPUSDm
TOKEN_ROTATE_CRON_TIME=03:00
MOBILE_ACCESS_TTL_SEC=43200
STRATEGY_ENGINE_ENABLED=0
NEXT_PUBLIC_STRATEGY_ENGINE_ENABLED=false
NEXT_PUBLIC_WS_URL=
EMERGENCY_MODE=0
EMERGENCY_BLOCK_HEAVY_HTTP=1
EMERGENCY_BLOCK_TRADING=1
EMERGENCY_API_LIMIT_PER_MIN=80
EMERGENCY_AI_LIMIT_PER_MIN=4
EMERGENCY_AI_TASK_LIMIT_PER_MIN=2
EMERGENCY_MARKET_LIMIT_PER_MIN=20
EMERGENCY_MAX_WS_CLIENTS=40
EMERGENCY_WS_MSG_RATE_PER_10S=30
EMERGENCY_BRIDGE_WS_MSG_RATE_PER_10S=4000
EMERGENCY_WS_BROADCAST_INTERVAL_MS=1500
EMERGENCY_BINANCE_BROADCAST_INTERVAL_MS=2000
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

## MongoDB Atlas M0 (Free) - Recommended For Lower Laptop Load
1. Create Atlas free cluster (M0) and DB user.
2. In Atlas Network Access, allow your current public IP (or temporary `0.0.0.0/0` for quick test).
3. Replace `URL_MONGOOSE` in `.env` with Atlas URI:
   `mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority`
4. Keep `FORCE_LOCAL_DOCKER_DB=0`.
5. Restart services with `run-all.ps1`.

Behavior after switch:
- `run-all.ps1` skips local Docker Mongo startup automatically.
- `watchdog.ps1` also skips DB container recovery when using external Mongo.

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

`run-all.ps1` auto-starts Docker Mongo only when `.env` uses local Mongo URI (or `FORCE_LOCAL_DOCKER_DB=1`) and fails fast if `.next/BUILD_ID` is missing (no fallback to `next dev`).

## Strategy Engine (Deferred For Public Endpoint Release)
- `backend/strategy_engine/*` is intentionally excluded from this public endpoint release.
- Keep:
  - `STRATEGY_ENGINE_ENABLED=0`
  - `NEXT_PUBLIC_STRATEGY_ENGINE_ENABLED=false`
- Effects:
  - `request_analysis`, `request_optimization`, `strategy_signal` WS topics are ignored.
  - Terminal "AI Analyze" action is disabled.

## WS Auth Migration (14-day compatibility window)
- Preferred auth:
  - `Authorization: Bearer <token>` (non-browser clients)
  - `Sec-WebSocket-Protocol: bearer.<token>` (browser/mobile clients)
- Temporary compatibility:
  - Query auth (`access_token`, `access_ticket`) is accepted only while:
    - `WS_ALLOW_QUERY_AUTH=1`
    - current time <= `WS_QUERY_AUTH_DEPRECATED_UNTIL`
- Browser bootstrap:
  - Frontend auto-fetches `GET /api/auth/ws-ticket` and uses `bearer.<ticket>` subprotocol when URL has no credential.
- Sunset procedure:
  1. Set `WS_ALLOW_QUERY_AUTH=0`
  2. Restart backend
  3. Verify old query-only links fail with `Unauthorized`

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

## WS Auth Smoke Test
Run:
```powershell
npm run smoke:ws-auth
```

Expected:
- `unauthorized_without_auth` => rejected (`1008 Unauthorized`)
- `service_authorization_header` => accepted
- `service_subprotocol_bearer` => accepted
- `query_auth_compat` => accepted only during compatibility window

Output:
- JSON report is written to `logs/ws-auth-smoke-<timestamp>.json`

## Public Link
Quick read (runtime-generated):
```powershell
Get-Content .\mobile_link.txt
```

JSON detail (runtime-generated):
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

## Emergency Mode (DDoS Response)
Enable + restart:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\emergency-mode.ps1 -Enable
```

Disable + restart:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\emergency-mode.ps1 -Disable
```

Status only:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\emergency-mode.ps1 -Status -NoRestart
```

When enabled:
- API/AI/market rate limits are tightened.
- Heavy HTTP endpoints are temporarily restricted with `503`.
- WS client/message limits are lowered.
- Trading and alert mutating WS commands are blocked.

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
