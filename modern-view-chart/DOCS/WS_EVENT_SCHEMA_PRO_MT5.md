# WebSocket Identity Contract for Free/Pro and Pro MT5

Updated: 2026-09-28

## Goal

Define one identity contract for browser clients, Pro MT5 extensions, and internal service bridges before expanding user-owned MT5 routing.

## Account Tier

The authenticated user identity exposes:

- `account_tier=free`
- `account_tier=pro`

Application plans map as:

- `free -> free`
- `pro -> pro`
- `pro_plus -> pro`

An expired Pro subscription resolves to `free` for runtime authorization.

The detailed product plan remains available separately as `plan=free|pro|pro_plus`.

## WebSocket Credential Rules

### Browser user

Preferred credential:

`Sec-WebSocket-Protocol: bearer.<short-lived-user-bound-ws-ticket>`

The ticket is issued by `GET /api/auth/ws-ticket` after normal user authentication and includes:

- `auth_type=user`
- `sub=<userId>`
- `sv=<sessionVersion>`
- `role=<role>`
- `account_tier=<free|pro>`

The WebSocket server resolves the ticket back to the current database user and validates the current session version before accepting the identity.

Direct user access JWT remains a compatibility fallback.

### Internal service bridge

Service credentials remain supported and resolve to:

- `auth_type=service`
- `client_mode=service_bridge`

Legacy signed service WS tickets remain valid for compatibility.

## Client Modes

### `web_free`

Normal browser client for guest or Free user.

Allowed:

- public/server market data
- virtual trading paths already available to Free users
- normal chart subscriptions

Not a bridge.

### `web_pro`

Normal browser client for authenticated Pro user.

Allowed:

- normal web client behavior
- access to Pro UI/features according to entitlement

Not a bridge.

### `pro_extension`

User-owned local MT5 extension.

Requirements:

- authenticated user identity
- `account_tier=pro`

This mode is eligible to publish MT5 bridge topics for that same user scope.

### `service_bridge`

Internal/system bridge.

Requirements:

- service authentication

This mode remains eligible to publish bridge topics.

## Browser Handshake

After socket open, the browser sends:

```json
{
  "topic": "auth",
  "client_mode": "web_free",
  "symbols": ["BTCUSDT"]
}
```

or for a Pro web user:

```json
{
  "topic": "auth",
  "client_mode": "web_pro",
  "symbols": ["BTCUSDT"]
}
```

The browser must not send a userId. The server identity comes only from the authenticated credential.

## Bridge Promotion Rule

A socket can become an authenticated bridge only when:

- its `client_mode` is `service_bridge` or `pro_extension`
- the credential is valid for that mode

A normal `web_free` or `web_pro` client cannot promote itself to bridge role by sending an MT5 bridge topic.

## Routing Scope

Current routing continues to use the authenticated `userId` as the owner scope.

The next phase will extend the routing key to:

`userId + accountLogin (+ terminalId)`

for multiple terminals/accounts per Pro user.

## Compatibility

This phase intentionally preserves:

- guest web access
- Free web behavior
- Pro web behavior
- existing service bridge credentials
- current per-user MT5 scoped state
- current Binance/VN Gold paths

## Next Phase

Implement a `BridgeRegistry` for `pro_extension` with explicit:

- `terminal_id`
- `account_login`
- heartbeat/stale eviction
- per-user/account active bridge selection
- route miss metrics
