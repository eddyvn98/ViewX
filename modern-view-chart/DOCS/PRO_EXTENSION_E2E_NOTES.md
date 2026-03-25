# Pro Extension E2E Notes

Updated: 2026-03-25

## Scope
This note covers the bridge client path under `backend/bridge/src/` only.

## Handshake Metadata
On connect, the bridge now sends an initial `app_ping` frame that carries the pro-extension identity metadata.

Fields:
- `userId`
- `terminalId`
- `accountLogin`
- `bridgeId`
- `clientMode`

Fallback rules:
- `userId`
  - `USER_ID`, `BRIDGE_USER_ID`, or `MT5_USER_ID` when available
  - otherwise the MT5 account login, if present
- `terminalId`
  - `TERMINAL_ID`, `BRIDGE_TERMINAL_ID`, or `MT5_TERMINAL_ID` when available
  - otherwise a stable terminal hash from terminal path + host
- `accountLogin`
  - MT5 `account_info().login`
- `bridgeId`
  - `BRIDGE_ID`, `PRO_EXTENSION_BRIDGE_ID`, or `MT5_BRIDGE_ID` when available
  - otherwise a stable bridge hash from host + terminal + account identity
- `clientMode`
  - `BRIDGE_CLIENT_MODE` when set
  - otherwise `service_bridge`

## Heartbeat And Stale Handling
- The bridge sends `app_ping` on connect as a handshake.
- The bridge also sends periodic `app_ping` heartbeats.
- If no inbound activity arrives within the stale window, the client raises a connection error so the existing outer reconnect loop can reopen the socket.
- Default heartbeat cadence is short and configurable:
  - `BRIDGE_HEARTBEAT_INTERVAL_SEC` default: `15`
  - `BRIDGE_STALE_TIMEOUT_SEC` default: `max(45, heartbeat * 2.5)`

## Compatibility
- Existing service bridge auth still uses the current bearer/subprotocol flow.
- The metadata fields are additive and do not change the existing `mt5_symbols_available`, `mt5_positions_update`, or command handling contracts.
- Logs stay short and URL masking still redacts access tokens.

## Quick Validation
1. Start the bridge and confirm the first log line includes `Handshake sent`.
2. Verify the initial outbound `app_ping` contains the metadata fields above.
3. Disconnect the socket or stop the server and confirm the client reconnect path triggers without manual restart.
