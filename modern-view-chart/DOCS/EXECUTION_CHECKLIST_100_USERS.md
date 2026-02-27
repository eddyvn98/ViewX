# Execution Checklist - 100 Users

Last updated: 2026-02-25
Source plan: `DOCS/PLAN_2026-02-24_100-users.md`

## Phase 1 - Runtime hardening

- [x] Fix route bug in `backend/modules/user/user.routes.js`
- [x] Raise `MAX_WS_CLIENTS` to `150` in `.env` and `.env.example`
- [x] Validate required envs at startup (`PORT`, `URL_MONGOOSE`, `ACCESS_TOKEN`, `MAX_WS_CLIENTS`, `WS_MSG_RATE_PER_10S`)
- [x] Fail fast in `scripts/server/run-all.ps1` when `.next/BUILD_ID` is missing

## Phase 1 - WebSocket stability

- [x] Add heartbeat (`ping/pong`) and stale client close
- [x] Add send backpressure guard (`bufferedAmount`) for non-critical frames
- [x] Add runtime metrics (`ws_connected`, drops, `broadcast_p95_ms`)
- [x] Add subscription index (`symbol -> ws`, `chart -> ws`) to avoid full-client scan each tick
- [x] Add per-tick payload cache reuse for repeated subscription sets
- [x] Add dedicated soak-test script for `100 clients / 15 minutes`

## Phase 1 - API/Tunnel hardening

- [x] Prefer `Authorization: Bearer` (HTTP + WS fallback support kept)
- [x] Tighten base rate limit for AI bridge endpoints
- [x] Stop publishing `ACCESS_TOKEN` in public artifacts (`public/mobile-access.json`, `mobile_link.txt`) by switching to short-lived `access_ticket`
- [x] Add token masking in logs/artifacts
- [x] Add dedicated rate limits for heavy market endpoints

## Phase 1 - Quality gate

- [x] Add `lint:critical`
- [x] Keep `lint:full` for gradual cleanup
- [x] Ensure `build` passes after hardening changes
- [x] Add CI gate rule to require `lint:critical + build` before merge

## Phase 1 - Validation gate

- [x] Run soak test with 100 concurrent WS clients for 15 minutes
- [x] Confirm abnormal disconnect rate < 1%
- [x] Confirm `broadcast_loop_ms_p95 < 250ms`
- [x] Confirm CPU avg < 70% and RAM stable
- [x] Run chaos checks (bridge restart, tunnel rotate, DB reconnect)
  Passed in `logs/ws-soak-chaos-20260225-105532.json` with `db_reconnect_attempt=ok`.

## Phase 2 - Deferred

- [x] Replace shared token with per-user auth (`/api/auth/login`, `/refresh`, `/logout`)
- [x] Move WS auth to short-lived JWT via header/subprotocol
- [x] Add roles (`viewer`, `trader`, `admin`) and session revocation
- [x] Add structured JSON logs and `/api/metrics`
  Implemented runtime monitor in `backend/services/runtimeAlertMonitor.js` for:
  `bridge_offline`, `db_disconnected`, `ws_drop_spike` (with optional `ALERT_WEBHOOK_URL`).
- [x] Prepare migration to named Cloudflare tunnel with fixed domain

## Pre-Public Hardening

- [x] Separate strategy engine from public endpoint release via runtime gates
- [x] Remove runtime access artifacts from tracked files and provide safe templates
- [x] Fix high/critical dependency advisories (`npm audit --omit=dev`)
- [x] Validate regression: `lint:critical` + `build` + smoke checks
  Local validation:
  - `npm run lint:critical` pass
  - `npm run build` pass
  - `npm audit --omit=dev`: 0 high/critical (remaining: `qs` low)
- Evidence commit: `d2bcd70`
- [x] Rotate `ACCESS_TOKEN` and regenerate `access_ticket` immediately before public launch
  Verified at `2026-02-25 13:05:30` in `logs/token-rotate.log` with:
  `Success: service healthy and mobile-access.json updated with access_ticket (no raw token leak).`

## Post-Hardening Runtime Check (Tunnel kept running)

- [x] Public frontend reachable (`200`)
- [x] Public backend `/api/health` reachable (`200`)
- [x] Public backend `/api/health/ready` reachable (`200`)
- [x] Public backend `/api/metrics` reachable with bearer auth (`200`)
- [x] Public WebSocket reachable and receiving realtime frame (`priceUpdate`)

## Public Hardening Patch - 2026-02-25

- [x] Enforce WS bridge trust boundary:
  only service-authenticated sockets can publish bridge topics.
- [x] Add WS role guard for trading commands:
  `mt5_command`, `binance_command`, `alert_command` require `trader` or higher.
- [x] Standardize WS error payload:
  `topic=error`, `code=forbidden|unauthorized`, optional `detail`.
- [x] Start WS auth migration:
  header/subprotocol preferred, query auth compatibility guarded by
  `WS_ALLOW_QUERY_AUTH` + `WS_QUERY_AUTH_DEPRECATED_UNTIL`.
- [x] Remove hardcoded public frontend WS fallback (`ws://127.0.0.1:8091`) by deriving from runtime host or `NEXT_PUBLIC_WS_URL`.
- [x] WS auth smoke matrix passed (`4/4`) via `npm run smoke:ws-auth`
  Evidence: `logs/ws-auth-smoke-2026-02-25T06-42-00-504Z.json`
- [x] Post-patch WS soak gate passed (`100 clients / 15 minutes`)
  Evidence: `logs/ws-soak-report-2026-02-25T07-00-16-213Z.json`
  Summary: `disconnect_rate=0%`, `max_broadcast_p95_ms=8`

## Runtime Cost Optimization - 2026-02-26

- [x] Add bridge idle mode when no active client subscriptions
  Server now sends empty `bridge_symbols_interest` so bridge can reduce MT5 polling load.
- [x] Add configurable bridge poll intervals via env:
  `BRIDGE_ACTIVE_LOOP_SLEEP_SEC`, `BRIDGE_IDLE_LOOP_SLEEP_SEC`,
  `BRIDGE_ACTIVE_POSITIONS_INTERVAL_SEC`, `BRIDGE_IDLE_POSITIONS_INTERVAL_SEC`,
  `BRIDGE_DAILY_OPEN_REFRESH_SEC`.
- [x] Keep full active behavior unchanged when subscriptions exist.
- [x] Add cloud-DB-aware server scripts:
  `run-all.ps1` and `watchdog.ps1` now skip local Docker Mongo when `URL_MONGOOSE` points to external Mongo (Atlas-ready).
- [x] Add emergency defense mode (`EMERGENCY_MODE`) for DDoS response:
  tighten HTTP/WS limits, block heavy HTTP routes, and disable trading mutating WS commands.
