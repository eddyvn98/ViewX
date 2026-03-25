# Pro Flow Full Implementation Plan

Updated: 2026-03-25  
Owner: Trading Web Platform Team

## 1) Scope
- Complete Pro flow for MT5 extension model end-to-end.
- Keep Free flow intact with no Pro bypass.
- Prepare architecture path for crypto personal exchange accounts.

## 2) Outcomes
1. Pro user can connect extension + MT5 and trade on own account.
2. Free user cannot execute Pro-only command paths.
3. All Pro actions are auditable and observable.
4. Legal consent and VN legal UX gates are enforced before real trading.

## 3) Phase Plan

### Phase 0: Contract Lock (1-2 days)
1. Freeze WS/API contracts for `web_client`, `pro_extension`, `service_bridge`.
2. Freeze entitlement schema (`plan`, `role`, `subscription_status`, `expires_at`).
3. Freeze onboarding state machine and error model.

Deliverables:
- `DOCS/WS_EVENT_SCHEMA_PRO_MT5.md` (update)
- `DOCS/PRO_FLOW_FULL_IMPLEMENTATION_PLAN_2026-03-25.md` (this file)

### Phase 1: Entitlement Enforcement (3-5 days)
1. Add mandatory backend checks for every Pro route/command.
2. Reject Pro command from Free users regardless of client type.
3. Re-check entitlement on active session and enforce revocation.
4. Add structured audit logs for auth/connect/trade.

### Phase 2: WS Isolation + Bridge Registry (4-6 days)
1. Implement per-user/account bridge routing (`userId + accountLogin + terminalId`).
2. Replace global routing for MT5 commands.
3. Add heartbeat/reconnect/stale cleanup.
4. Add route metrics and route miss alerts.

### Phase 3: Extension Runtime Hardening (5-8 days)
1. Extension auth via Pro token and strict binding to account.
2. Standardize metadata in every extension frame.
3. Add idempotency (`request_id`) and anti-replay window.
4. Add version compatibility checks and graceful fallback.

### Phase 4: Trading Reliability (4-6 days)
1. Validate broker/exchange constraints server-side.
2. Normalize errors to stable web payload contract.
3. Add reconciliation loop for partial failures and retry safety.
4. Add deterministic close/modify/place behavior under reconnect.

### Phase 5: Frontend Pro UX Completion (3-4 days)
1. Keep wizard + checklist as gate source for Pro flow.
2. Lock all trade actions until `Pro + Bridge + Account + Legal` are ready.
3. Show actionable remediation per missing step.
4. Full i18n parity for all Pro setup and warning states.

### Phase 6: Security + Legal VN (2-3 days)
1. Terms/Privacy/Pro policy consent evidence with version and timestamp.
2. Secret handling and redaction hardening.
3. Incident response runbook for key leakage and service disruption.
4. Security tests for forged client/direct API/replay attempts.

### Phase 7: Staged Rollout + Gates (5-7 days)
1. Internal alpha.
2. 5-10 Pro users.
3. 30-50 Pro users.
4. Full rollout.

Gate metrics:
- `command_route_success >= 99%`
- `order_ack_p95 < 800ms` (internal routing)
- `0` cross-user leakage incidents
- `0` successful Free->Pro bypass

## 4) Parallel Execution Tracks
1. Track A (Backend): entitlement + WS registry + routing + audit.
2. Track B (Frontend): onboarding UX, guards, i18n, error UX.
3. Track C (Security/QA): abuse tests, chaos tests, rollout gates.

## 5) Definition of Done
1. Pro user can connect and trade using own MT5 account via extension.
2. Free users cannot execute Pro-only command paths.
3. System provides clear audit traces and operational metrics.
4. VN legal consent is captured before real trading commands.
5. No regression to existing Free/Binance behavior.
