# Pro Flow Security Test Plan

Updated: 2026-03-25  
Owner: Track C (Security/QA)

Related master plan:
- `DOCS/PRO_FLOW_FULL_IMPLEMENTATION_PLAN_2026-03-25.md`

## 1) Purpose
Validate that Pro-only MT5 paths cannot be reached by bypassing UI or client claims, and that routing remains scoped to the correct user/account.

## 2) In Scope
1. Forged `pro_extension` client claims from a Free account.
2. Direct private command calls without using the official UI.
3. Replay of trading requests with reused `request_id`.
4. Cross-user routing and account mix-up attempts.

## 3) Test Environment
1. One Free account.
2. One Pro account.
3. Two distinct MT5 accounts or bridge identities.
4. Backend logs and audit trail enabled.
5. Dedup/replay store enabled with TTL.

## 4) Required Controls Under Test
1. Server-side entitlement check for every Pro route/command.
2. Server-owned identity binding for routing decisions.
3. Per-user/per-account bridge registry.
4. `request_id` idempotency and anti-replay window.
5. Immutable audit logging for connect/auth/trade events.

## 5) Test Cases

| ID | Scenario | Steps | Expected result |
| --- | --- | --- | --- |
| SEC-01 | Forged `pro_extension` | Send handshake or trade request with `client_mode=pro_extension` from a Free account. | Request is rejected. No Pro command is executed. Audit log records entitlement failure. |
| SEC-02 | Direct private command | Call private WS/API command directly, bypassing UI and onboarding flow. | Request is rejected unless the caller is an entitled Pro session bound to the right account. |
| SEC-03 | Replay `request_id` | Submit the same private trade request twice with identical `request_id`. | First request may succeed; second is deduped/rejected. No duplicate order is created. |
| SEC-04 | Cross-user routing | From user A session, attempt to route a command to user B bridge/account. | Backend ignores client-provided ownership fields and routes only to user A owned target. No leakage to user B. |
| SEC-05 | Stale bridge reuse | Disconnect a bridge, then try to use its prior identity for a new private command. | Command fails because the bridge is no longer active or no longer bound. |
| SEC-06 | Mixed entitlement states | Revoke Pro entitlement during an active session, then retry a private command. | Command is denied on re-check. Session state updates and audit is emitted. |

## 6) Pass Criteria
1. `0` successful Free-to-Pro bypasses.
2. `0` cross-user leakage incidents.
3. `0` duplicate execution from replayed `request_id`.
4. All denied attempts produce traceable audit entries.

## 7) Exit Criteria For QA Signoff
1. SEC-01 to SEC-06 all pass in staging.
2. Findings are either fixed or explicitly waived with owner approval.
3. No unexplained route miss or account mix-up remains open.

