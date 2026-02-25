# Tasklist - Phase 2 Runtime Alerts

Date: 2026-02-25
Status: Completed

## Scope

Implement basic operational alerts required by Phase 2 plan:

1. Bridge offline for longer than threshold
2. WS drop spike in a short window
3. DB disconnected for longer than threshold

## Tasks

- [x] Define alert policy and env-driven thresholds
- [x] Implement runtime alert monitor service in backend
- [x] Add optional webhook sink for external notification
- [x] Emit structured JSON logs for all alerts
- [x] Wire monitor into server startup
- [x] Validate with `lint:critical` and `build`
- [x] Update execution checklist with implementation evidence

## Env Variables

- `ALERT_MONITOR_ENABLED` (default: `1`)
- `ALERT_SCAN_INTERVAL_MS` (default: `15000`)
- `ALERT_BRIDGE_OFFLINE_MS` (default: `180000`)
- `ALERT_DB_DISCONNECTED_MS` (default: `120000`)
- `ALERT_WS_DROP_SPIKE_WINDOW_MS` (default: `60000`)
- `ALERT_WS_DROP_SPIKE_DELTA` (default: `30`)
- `ALERT_COOLDOWN_MS` (default: `180000`)
- `ALERT_WEBHOOK_URL` (optional)
