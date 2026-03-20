# PRO MT5 Extension Rollout Plan

Updated: 2026-03-19
Owner: Trading Web Platform Team

## 1) Goal
Enable Pro users to keep using the current web experience, and additionally connect their own local MT5 via extension so the web can:
- receive MT5 personal symbols/data
- render charts from user MT5 source
- show terminal/account/positions/orders from user MT5
- place/modify/close trades on that same user MT5 account

## 2) Non-Negotiable Principles
1. Do not break current Free/Binance flow.
2. MT5 Pro path must be per-user/per-account (no global MT5 state).
3. WS transport must distinguish: `web_client`, `pro_extension`, `service_bridge`.
4. Safe phased rollout with fallback and observability.

## 3) Current Codebase Gaps (Confirmed)
1. MT5 command forwarding is global to first bridge socket:
   - `backend/websocket/handlers/mt5CommandHandler.js`
2. Bridge authentication/topic model is service-oriented, not user-extension oriented:
   - `backend/websocket/index.js`
   - `backend/websocket/auth.js`
3. MT5 account/position state is global and broadcast-wide:
   - `backend/websocket/handlers/mt5PositionsHandler.js`
   - `backend/websocket/handlers/authHandler.js`
4. MT5/Binance source detection still relies on symbol heuristics (`USDT`, `m` suffix):
   - `src/hooks/use-websocket/message-handler.ts`
   - `backend/websocket/services/dataService.js`
5. Symbol specification is not complete for multi-broker validation:
   - `backend/bridge/src/mt5_service.py`

## 4) Target Architecture
1. `web_client` (user web app)
2. `pro_extension` (user local MT5 bridge)
3. `service_bridge` (internal/system bridge only)

Routing key:
- `userId + accountLogin (+ terminalId)`

State isolation:
- all MT5 runtime state keyed per user/account
- no shared global MT5 account/position stream

## 5) Execution Plan By Phase

### Phase 0: Spec Lock (1-2 days)
Tasks:
1. Define WS event contracts and required metadata.
2. Define identity/binding keys: `userId`, `bridgeId`, `terminalId`, `accountLogin`.
3. Define Pro entitlement in JWT/session.
4. Define onboarding UX contract.

Deliverables:
- `DOCS/WS_EVENT_SCHEMA_PRO_MT5.md`
- sequence diagrams for connect/auth/route

### Phase 1: WS Auth + Bridge Registry (3-4 days)
Tasks:
1. Add WS handshake field `client_mode`.
2. Permit `pro_extension` auth via Pro user token.
3. Create `BridgeRegistry` with mappings:
   - `userId -> bridge sockets`
   - `userId+accountLogin -> active bridge`
4. Add heartbeat/reconnect/stale eviction.
5. Emit per-user bridge status.

Files:
- `backend/websocket/auth.js`
- `backend/websocket/index.js`
- `backend/websocket/messageRouter.js`
- new: `backend/websocket/bridgeRegistry.js`

Exit criteria:
- Pro extension connects and is bound to correct user/account.

### Phase 2: Read-Only MT5 Personal Data Path (4-6 days)
Tasks:
1. Route read-only MT5 commands per user/account:
   - `get_candles`, `get_candles_at`, `get_symbol_info`, `get_history`, `get_positions`, `get_account`
2. Replace global MT5 cache with per-user/account state.
3. Require extension frames include:
   - `terminal_id`, `account_login`, `broker`, `source=MT5_PERSONAL`
4. Update web socket handlers/store to consume scoped MT5 data.

Files:
- `backend/websocket/handlers/mt5CommandHandler.js`
- `backend/websocket/handlers/mt5UpdateHandler.js`
- `backend/websocket/handlers/mt5PositionsHandler.js`
- `backend/websocket/handlers/authHandler.js`
- `src/hooks/use-websocket/message-handler.ts`
- `src/hooks/use-websocket/senders.ts`

Exit criteria:
- Pro user sees own MT5 chart/account/positions only.

### Phase 3: Symbol Catalog + Chart Integration (3-4 days)
Tasks:
1. Merge symbol sources (`BINANCE` + `MT5_PERSONAL`).
2. Remove fragile source heuristics based on symbol text.
3. Add source/account switcher in chart + terminal UI.
4. Improve symbol normalization for broker suffix/prefix variants.

Files:
- `src/features/market/*`
- `src/features/chart/hooks/use-chart-history.ts`
- `src/features/chart/components/*`
- `src/hooks/use-websocket/symbol-utils.ts`
- `backend/bridge/src/mt5_service.py`

Exit criteria:
- Pro user can add/browse symbols from own MT5 broker and render charts normally.

### Phase 4: Trading Path (4-5 days)
Tasks:
1. Route write commands by user/account:
   - `order`, `place_order`, `buy`, `sell`, `modify`, `close`, `delete`
2. Add idempotency with `request_id`.
3. Extend symbol spec for validation:
   - `volume_min`, `volume_max`, `volume_step`
   - `trade_stops_level`, `trade_freeze_level`
   - `digits`, `tick_size`, filling modes
4. Standardize error/retcode payload back to web.

Files:
- `backend/bridge/src/mt5_service.py`
- `backend/bridge/src/websocket_client.py`
- `backend/websocket/messageRouter.js`
- `src/features/chart/components/ChartTradingOverlay.tsx`
- `src/features/terminal/components/OrderForm/*`

Exit criteria:
- Web trading executes correctly on user's own MT5 account.

### Phase 5: Pro Onboarding + Hardening (3-4 days)
Tasks:
1. Build Pro connection wizard:
   - extension installed
   - extension connected
   - terminal detected
   - account selected
2. Add metrics/alerts:
   - bridge connected users
   - route miss count
   - order failure rate
   - WS latency
3. Add audit logs for trading actions.
4. Reconnect/chaos tests (MT5 close, network loss, extension restart).

Exit criteria:
- "Install extension + open MT5 + connect" works reliably.

## 6) Timeline
- Fast path: 3-4 weeks
- Safe path: 5-6 weeks (with staged UAT and rollout gates)

## 7) Production Rollout
1. Internal alpha
2. 5-10 Pro users
3. 30-50 Pro users
4. Full Pro rollout

Gate metrics per stage:
- `command_route_success >= 99%`
- `order_ack_p95 < 800ms` (internal WS routing)
- `0` cross-user data leakage incidents

## 8) Risks and Mitigations
1. Cross-user data leakage:
   - strict per-frame user/account filtering
2. Extension disconnect instability:
   - heartbeat, reconnect, queue with expiry
3. Broker rule mismatch:
   - dynamic symbol spec per account, no hardcode
4. Duplicate orders on retry:
   - request idempotency key + TTL store

## 9) Definition of Done
1. Pro user needs only MT5 + extension to connect.
2. Web displays MT5 symbols/charts/terminal from that exact user account.
3. Web trades are executed on that exact local MT5 account.
4. Free/Binance existing flow has no regression.
