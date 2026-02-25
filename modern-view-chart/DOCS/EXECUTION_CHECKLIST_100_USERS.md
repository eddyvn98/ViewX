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
- [ ] Add roles (`viewer`, `trader`, `admin`) and session revocation
- [ ] Add structured JSON logs and `/api/metrics`
- [ ] Prepare migration to named Cloudflare tunnel with fixed domain
