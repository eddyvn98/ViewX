# Pro Flow QA Runbook

Updated: 2026-03-25  
Owner: Track F

## Purpose
Validate the Pro-flow security gates in staging with a lightweight WS smoke:
- forged `client_mode=pro_extension`
- direct private command without UI flow
- replay of `request_id`

## Prerequisites
1. Staging backend is reachable over WebSocket.
2. A real authenticated user token is available for QA.
3. Backend and bridge are running if you want the replay case to complete end-to-end.
4. Emergency mode is off, otherwise the private-command cases may fail for the wrong reason.

## Inputs
Set these env vars before running:

```powershell
$env:PRO_QA_WS_URL="wss://staging.example.com"
$env:PRO_QA_AUTH_TOKEN="<user-jwt-token>"
$env:PRO_QA_AUTH_MODE="header"
$env:PRO_QA_SYMBOL="XAUUSDm"
```

Optional:
- `PRO_QA_OUTPUT_DIR` defaults to `logs`
- `PRO_QA_REPLY_TIMEOUT_MS` defaults to `8000`
- `PRO_QA_SETTLE_MS` defaults to `2500`

Important:
- Use a user JWT from a normal Free/Viewer session, not the server `ACCESS_TOKEN`.
- Do not hardcode tokens in the script or the repo.

## Quick Run

```powershell
node .\scripts\server\pro-security-smoke.mjs
```

Equivalent with explicit envs:

```powershell
node .\scripts\server\pro-security-smoke.mjs --ws-url $env:PRO_QA_WS_URL --token $env:PRO_QA_AUTH_TOKEN --auth-mode header
```

## Expected Results

| Case | Expected pass condition | Fail signal |
| --- | --- | --- |
| Forged `client_mode` | Backend rejects the pro-only command with `topic=error` and `code=forbidden`. | Command is accepted, forwarded, or returns any non-forbidden success path. |
| Direct private command | Backend rejects a direct pro-only command from a viewer/free session. | Command is accepted or executed. |
| Replay `request_id` | First request gets a normal response, second submit does not produce a second execution/response, or the backend emits a replay-style error. | Two responses with the same `request_id`, or clear duplicate execution. |

## Output Artifacts
The script writes a JSON report to:

- `logs/pro-security-smoke-<timestamp>.json`

The report includes:
- masked token
- WS URL
- case-by-case evidence
- request IDs
- pass/fail summary

## How To Collect Evidence
1. Save the JSON report path from console output.
2. Capture the matching backend log window for the same timestamp.
3. For a replay failure, include both response messages that share the same `request_id`.
4. For a forged-client-mode failure, include the outbound auth payload and the first response after the pro-only command.
5. If needed, attach the report JSON and the relevant backend log lines in the QA ticket.

## Troubleshooting
1. If the WebSocket connect fails, confirm `PRO_QA_WS_URL` and network reachability.
2. If the private-command cases fail with `service_unavailable`, check whether emergency mode is enabled.
3. If the replay case times out, confirm the bridge is online and the staging symbol is valid.
4. If the script reports a forbidden error for everything, verify the token is a user JWT and not the server secret.
