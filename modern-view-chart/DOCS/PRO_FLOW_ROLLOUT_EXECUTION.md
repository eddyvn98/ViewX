# Pro Flow Rollout Execution Notes

Updated: 2026-03-25  
Owner: Track G (Rollout Ops)

Related gate definition:
- `DOCS/PRO_FLOW_ROLLOUT_GATES.md`

Related implementation plan:
- `DOCS/PRO_FLOW_FULL_IMPLEMENTATION_PLAN_2026-03-25.md`

## 1) Purpose
This note is the execution guide for staged Pro Flow rollout. It turns the rollout gates into an operator checklist that can be used during cohort promotion, soak windows, and rollback decisions.

The rule is simple:
- do not expand the cohort until the current cohort has satisfied the gate metrics
- do not rely on client-side claims for trust or entitlement
- stop immediately if any no-go condition appears

## 2) Rollout Model
Roll out in cohorts, with a soak window at each stage.

1. Internal alpha
2. 5-10 Pro users
3. 30-50 Pro users
4. Full rollout

Use the same gate criteria for every stage. The only thing that changes between stages is exposure size.

## 3) Gate Summary
The source of truth is `DOCS/PRO_FLOW_ROLLOUT_GATES.md`. This execution note mirrors the same pass/fail rules so operators do not need to cross-reference during a live window.

### Go criteria
Advance only when all of the following are true:
1. `command_route_success >= 99%`
2. `order_ack_p95 < 800ms`
3. `cross-user leakage incidents = 0`
4. `successful Free-to-Pro bypasses = 0`
5. `replay duplicate executions = 0`
6. Audit logs are complete for connect/auth/trade actions

### No-go criteria
Hold the rollout if any of the following are true:
1. Any cross-user leakage is observed.
2. Any Free account reaches a Pro-only command path.
3. Replay protection allows duplicate execution.
4. `command_route_success` drops below `99%`.
5. `order_ack_p95` reaches `800ms` or higher for a sustained window.

## 4) Cohort Execution

### 4.1 Internal alpha
Goal:
- validate the end-to-end route chain with very low blast radius

Operator focus:
- routing correctness
- audit completeness
- no leakage across users/accounts
- baseline latency under real traffic

Promote only when:
- metrics are stable across the full soak window
- no manual incident notes are open
- logs confirm complete connect/auth/trade coverage

### 4.2 5-10 Pro users
Goal:
- verify behavior under a small but real Pro cohort

Operator focus:
- sustained command routing success
- ack latency under the threshold
- replay protection continues to hold
- bridge registry behavior stays stable

Promote only when:
- no no-go trigger occurred during the soak window
- route misses are explainable and not rising unexpectedly
- security review shows no bypass path from Free to Pro

### 4.3 30-50 Pro users
Goal:
- check that the system behaves normally at a wider support load

Operator focus:
- trend lines rather than isolated samples
- route miss count movement
- p95 latency drift
- audit log completeness at larger volume

Promote only when:
- the same gates still pass at the larger cohort size
- there is no unexplained increase in route misses
- the current stage has clean incident review notes

### 4.4 Full rollout
Goal:
- expand only after the prior cohorts prove the rollout is stable

Operator focus:
- watch for regression in routing success or latency
- keep rollback path ready
- continue audit retention during and after promotion

Promote only when:
- all gate metrics remain inside threshold
- signoff is recorded from the required owners
- rollback instructions are validated and ready to use

## 5) Preflight Checklist
Run this before each cohort promotion.

1. Confirm the current stage and expected user count.
2. Confirm the gate metrics window to review.
3. Confirm backend route metrics are available.
4. Confirm WS/backend timing metrics are available.
5. Confirm security audit and incident review sources are available.
6. Confirm bridge registry metrics are available.
7. Confirm the audit log stream covers connect/auth/trade actions.
8. Confirm the rollback toggle or disablement path is ready.

If any required signal is missing, do not promote the cohort.

## 6) Evidence To Review
Review the following evidence before granting go:

1. `command_route_success` report from backend route metrics.
2. `order_ack_p95` report from WS/backend timing metrics.
3. Security review for cross-user leakage incidents.
4. Security test results for Free-to-Pro bypass attempts.
5. Replay/idempotency logs for duplicate execution attempts.
6. Route miss trend from bridge registry metrics.
7. Audit log completeness for connect/auth/trade actions.

## 7) Rollback Playbook
If any no-go condition appears:

1. Stop cohort promotion immediately.
2. Disable the Pro MT5 trading path first.
3. Keep Free flow intact.
4. Freeze further cohort expansion.
5. Preserve logs, request samples, and affected bridge state for RCA.
6. Re-run `DOCS/PRO_FLOW_SECURITY_TEST_PLAN.md` after the fix before re-entry.

## 8) Signoff
Required signoff before promotion:

1. Security/QA signoff for the gate window.
2. Backend owner signoff for routing and latency health.
3. Product owner signoff that user impact is acceptable for the current stage.

## 9) Operator Notes
1. Treat client-side claims as untrusted.
2. Do not use credentials in notes, scripts, or logs.
3. Keep the gate review reproducible: the same data should lead to the same decision.
4. If a metric is borderline, prefer no-go and collect another soak window.

## 10) Minimal Promotion Rule
The promotion rule for every stage is:
- if all go criteria are true and no no-go criteria are present, promote
- otherwise, hold the cohort and investigate

That rule should be applied consistently across all stages to avoid ad hoc exceptions.
