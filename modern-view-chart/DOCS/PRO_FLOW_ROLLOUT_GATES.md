# Pro Flow Rollout Gates

Updated: 2026-03-25  
Owner: Track C (Security/QA)

Related master plan:
- `DOCS/PRO_FLOW_FULL_IMPLEMENTATION_PLAN_2026-03-25.md`

## 1) Goal
Define the minimum measurable conditions required to move Pro MT5 rollout forward, and the rollback triggers that immediately stop expansion.

## 2) Gate Metrics

| Metric | Threshold | Source of truth |
| --- | --- | --- |
| `command_route_success` | `>= 99%` | Backend route metrics |
| `order_ack_p95` | `< 800ms` for internal routing | WS/backend timing metrics |
| Cross-user leakage incidents | `0` | Security audit + incident review |
| Successful Free-to-Pro bypasses | `0` | Security test suite + production monitoring |
| Replay duplicate executions | `0` | Idempotency/replay logs |
| Route miss count | No unexplained increase; investigate any sustained rise | Bridge registry metrics |

## 3) Go / No-Go Rules

### Go
Proceed to the next rollout cohort only if all of the following are true:
1. `command_route_success >= 99%`
2. `order_ack_p95 < 800ms`
3. `0` cross-user leakage incidents
4. `0` successful Free-to-Pro bypasses
5. `0` replay duplicate executions
6. Audit logs are complete for connect/auth/trade actions

### No-Go
Hold rollout if any of the following occur:
1. Any cross-user leakage is observed.
2. Any Free account reaches a Pro-only command path.
3. Replay protection allows a duplicate trade execution.
4. `command_route_success` drops below `99%`.
5. `order_ack_p95` rises to `800ms` or above for sustained windows.

## 4) Rollout Stages
1. Internal alpha.
2. 5-10 Pro users.
3. 30-50 Pro users.
4. Full rollout.

Advance only after the current stage has met the Go rules for the agreed soak window.

## 5) Rollback Triggers
Trigger immediate rollback or feature-flag disablement if any of the following happen:
1. A confirmed cross-user data leakage incident.
2. A confirmed Free-to-Pro bypass in staging or production.
3. Duplicate order execution caused by a replayed `request_id`.
4. Route failure spikes that break `command_route_success >= 99%`.
5. Latency degradation that keeps `order_ack_p95 >= 800ms`.
6. Bridge registry corruption or stale routing that cannot be cleared safely.

## 6) Rollback Actions
1. Disable Pro MT5 trading path first.
2. Keep Free flow intact.
3. Freeze cohort expansion.
4. Preserve logs, request samples, and affected bridge state for RCA.
5. Re-run `DOCS/PRO_FLOW_SECURITY_TEST_PLAN.md` after fix before re-entry.

## 7) Required Signoff
1. Security/QA signoff for the gate window.
2. Backend owner signoff for routing/latency health.
3. Product owner signoff that user impact is acceptable for the current stage.

