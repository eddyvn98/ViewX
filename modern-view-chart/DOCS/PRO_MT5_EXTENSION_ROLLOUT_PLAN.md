# PRO MT5 Extension Rollout Plan

Updated: 2026-03-25
Owner: Trading Web Platform Team

Related master plan:
- `DOCS/PRO_FLOW_FULL_IMPLEMENTATION_PLAN_2026-03-25.md`

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

## 10) Addendum: Pro Crypto Personal Exchange Plan

### 10.1) Goal
Enable Pro users to connect their own crypto exchange accounts (Binance/Bybit/OKX in phased support) so the web can:
- read personal balances/positions/orders per exchange account
- render personal tradable symbols and account-specific constraints
- place/modify/cancel orders on the exact user-owned exchange account

### 10.2) Principles
1. Keep existing Free/Binance public feed flow unchanged.
2. Personal crypto exchange state must be strictly per-user/per-exchange/per-account.
3. No API key is stored in plaintext; encrypted at rest and masked in logs.
4. Trading actions require explicit entitlement (`pro`) and scoped permissions.

### 10.3) Target Model
Identity key:
- `userId + exchange + accountId`

Source model:
- `BINANCE_PUBLIC` (existing public feed)
- `CRYPTO_PERSONAL` (new private user exchange account)
- `MT5_PERSONAL` (existing Pro MT5 path)

### 10.4) Execution Phases (Crypto)

#### Phase C0: Spec + Security Contract (1-2 days)
Tasks:
1. Define API/WS schema for account connect/sync/trade commands.
2. Define encrypted credential storage contract (KMS/env key envelope).
3. Define permission scopes:
   - read-only
   - trade
4. Define per-exchange rate-limit and retry policy.

Deliverables:
- `DOCS/WS_EVENT_SCHEMA_CRYPTO_PERSONAL.md`
- `DOCS/CRYPTO_CREDENTIAL_SECURITY.md`

#### Phase C1: Account Linking + Vault Layer (3-4 days)
Tasks:
1. Add Pro UI flow: connect exchange account (API key/secret/passphrase if required).
2. Build backend vault service for encrypted credential save/load/rotate/delete.
3. Add account verification handshake (test signed endpoint).
4. Emit account status to UI (`connected`, `degraded`, `revoked`).

Candidate files:
- `backend/modules/user/*`
- `backend/services/*` (new vault and exchange auth services)
- `src/features/terminal/*`
- `src/features/chart/components/*`

Exit criteria:
- Pro user can securely link an exchange account and pass verification.

#### Phase C2: Read-Only Personal Data Path (4-5 days)
Tasks:
1. Fetch scoped account data:
   - balances
   - open orders
   - positions (for derivatives venues)
   - personal fills/history
2. Normalize symbols and precision by exchange/account.
3. Cache per `userId+exchange+accountId` with TTL and freshness status.
4. Add source/account switcher integration in chart and terminal.

Exit criteria:
- Pro user sees only their own exchange account data in UI.

#### Phase C3: Trading Path + Idempotency (4-6 days)
Tasks:
1. Route private trading commands:
   - place/modify/cancel
   - market/limit/stop variants by exchange capability
2. Enforce precision and min-notional filters from exchange metadata.
3. Add idempotency via `request_id` and dedupe TTL store.
4. Standardize exchange error mapping to web-facing error model.

Exit criteria:
- Orders are executed correctly on selected user exchange account with safe retries.

#### Phase C4: Hardening + Rollout (3-4 days)
Tasks:
1. Add monitoring:
   - connect success rate
   - order failure rate by exchange
   - rate-limit hit rate
   - p95 private order ack latency
2. Add audit logs for all private account/trade actions.
3. Run chaos tests: key revoke, clock drift, temporary exchange outage, network flap.
4. Stage rollout by exchange and user cohort.

Exit criteria:
- Crypto personal account flow is stable and observable under partial failures.

### 10.5) Rollout Strategy (Crypto)
1. Internal alpha (single exchange: Binance first).
2. 5-10 Pro users (read-only first, then trading).
3. 30-50 Pro users (add second exchange).
4. Full rollout with per-exchange feature flag gating.

Gate metrics:
- `private_route_success >= 99%`
- `private_order_ack_p95 < 1200ms`
- `0` cross-user account leakage incidents

### 10.6) Definition of Done (Crypto)
1. Pro user can link/unlink personal crypto exchange account securely.
2. Web shows balances/orders/positions scoped to selected user account only.
3. Web trading commands execute on the selected user exchange account only.
4. Free/Binance public flow and MT5 Pro flow have no regression.

## 11) Security Addendum: Client Trust Boundary and Anti "Pro Free" Abuse

### 11.1) Trust Model
1. Treat all clients as untrusted, including browser UI and extension binaries.
2. Do not grant Pro capability from client claims alone (`client_mode`, `role`, local flags).
3. Enforce entitlement and routing ownership on backend for every private command.

### 11.2) Main Abuse Scenarios
1. User self-builds a custom extension/WS client and impersonates `pro_extension`.
2. Free user calls private WS/API routes directly without official UI.
3. Replay or forged command payload attempts (`userId`, `account`, stale requests).
4. Cross-account routing attempts by tampering request metadata.

### 11.3) Mandatory Server Controls
1. Entitlement enforcement:
   - Every Pro path checks `account_tier=pro`, subscription validity window, and revocation state.
   - Reject private commands from non-Pro users regardless of client type.
2. Server-owned identity binding:
   - Ignore client-provided ownership fields for authorization decisions.
   - Derive routing owner from validated token/session and registry mapping only.
3. Command integrity and anti-replay:
   - Require `request_id` + nonce/timestamp window.
   - Store dedupe keys with TTL to prevent duplicate/replayed execution.
4. Session hardening:
   - short-lived access tokens, refresh rotation, server revocation list.
   - per-user + per-IP/device rate limits for private routes.
5. Secrets handling:
   - no plaintext credential storage.
   - encrypted at rest, masked logs, explicit key rotation path.
6. Auditability:
   - immutable audit logs for connect/link/unlink/trade actions.
   - anomaly alerts for repeated auth failures, route mismatch, replay attempts.

### 11.4) Extension Authenticity Position
1. Official extension signing/checks can reduce abuse cost but is not a sole trust anchor.
2. Even if a user uses a custom client, private Pro features remain blocked unless backend entitlement and policy checks pass.
3. Product decision: "client authenticity is defense-in-depth; server authorization is the enforcement boundary."

### 11.5) Explicit Non-Bypass Requirement (Release Gate)
1. A Free account must not execute any Pro-only MT5 or Crypto personal command in staging or production.
2. Security test suite must include:
   - forged `client_mode=pro_extension` from Free account
   - direct WS/API private command calls without UI
   - replayed trading command with reused `request_id`
3. Release blocked if any test above succeeds.
