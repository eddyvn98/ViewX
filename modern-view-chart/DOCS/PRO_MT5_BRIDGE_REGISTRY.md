# Pro MT5 Bridge Registry

Updated: 2026-09-28

## Purpose

Route MT5 commands deterministically when a Pro user can connect one or more local terminals/accounts, while preserving the existing shared service bridge.

## Pro Extension Handshake

A Pro extension authenticates with a user credential, then sends:

```json
{
  "topic": "auth",
  "client_mode": "pro_extension",
  "account_login": "10001",
  "terminal_id": "terminal-a",
  "broker": "Example Broker"
}
```

Requirements:

- authenticated user
- `account_tier=pro`
- non-empty `account_login`
- non-empty `terminal_id`

The extension becomes an active bridge when it starts publishing an authenticated bridge topic.

## Registry Identity

Primary identity:

`userId + accountLogin + terminalId`

The registry stores:

- owner user
- account login
- terminal id
- broker
- client mode
- socket
- connected timestamp
- last-seen timestamp

A reconnect using the same identity replaces the older socket.

Existing WebSocket ping/pong handles stale connection eviction; close events unregister the bridge.

## Command Routing

For an MT5 command from a web user:

1. If `account_login` / `terminal_id` are supplied, match only that user's exact bridge candidates.
2. Never fall back to another account when account identity was explicitly requested.
3. If no account is supplied:
   - one personal bridge -> use it
   - multiple personal bridges -> fail as ambiguous
   - no personal bridge -> use the legacy global `service_bridge` if available
4. Route misses return `mt5_bridge_route_not_found` and increment metrics.

This preserves current shared-MT5 behavior while making account-targeted Pro commands deterministic.

## Availability vs State Ownership

Two concepts are intentionally separate:

- **direct bridge ownership**: a bridge registered directly for that user scope
- **effective availability**: direct bridge or legacy shared service fallback

If a user's personal extension disconnects while the global service bridge remains online:

- the user's personal MT5 cached state is cleared
- UI bridge availability can remain online through the shared fallback

## Metrics

`GET /api/metrics` includes:

```json
{
  "bridge": {
    "online": true,
    "registered": 1,
    "route_misses": 0
  }
}
```

## Not Included Yet

This phase does not yet split all MT5 runtime price/position/candle caches by account.

A later read-only personal-data phase should move from user-only state keys to:

`userId + accountLogin (+ terminalId)`

so simultaneous accounts cannot mix state in the same web session.
