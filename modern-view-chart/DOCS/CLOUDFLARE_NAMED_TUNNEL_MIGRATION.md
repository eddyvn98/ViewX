# Cloudflare Named Tunnel Migration Runbook

Last updated: 2026-02-25

## Goal

Move from Quick Tunnel to Named Tunnel with fixed domain to avoid URL rotation and reduce reconnect incidents.

## Current State

- Tunnel mode: Quick Tunnel (`*.trycloudflare.com`)
- Risk: URL changes, temporary 429/rate-limits, unstable reconnect path

## Target State

- Named Tunnel: persistent tunnel ID
- Fixed DNS hostname (example: `vivutrade.example.com`)
- Service route split:
  - `vivutrade.example.com` -> frontend (`http://localhost:3000`)
  - `api.vivutrade.example.com` -> backend (`http://localhost:5000`)

## Prerequisites

1. Cloudflare account with zone managed in Cloudflare.
2. `cloudflared` installed on host machine.
3. Logged in:

```powershell
cloudflared tunnel login
```

## Migration Steps

1. Create named tunnel:

```powershell
cloudflared tunnel create vivutrade-prod
```

2. Create config file at `%USERPROFILE%\\.cloudflared\\config.yml`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: C:\Users\<user>\.cloudflared\<TUNNEL_UUID>.json

ingress:
  - hostname: vivutrade.example.com
    service: http://localhost:3000
  - hostname: api.vivutrade.example.com
    service: http://localhost:5000
  - service: http_status:404
```

3. Bind DNS routes:

```powershell
cloudflared tunnel route dns vivutrade-prod vivutrade.example.com
cloudflared tunnel route dns vivutrade-prod api.vivutrade.example.com
```

4. Run tunnel:

```powershell
cloudflared tunnel run vivutrade-prod
```

5. Optional: install as system service:

```powershell
cloudflared service install
```

## Verification Checklist

1. `https://vivutrade.example.com` loads chart UI.
2. `https://api.vivutrade.example.com/api/health` returns `status=ok`.
3. WS connect succeeds with JWT bearer and receives realtime updates.
4. Restart `cloudflared` process and confirm clients auto-reconnect.

## Rollback Plan

1. Stop named tunnel process/service.
2. Start previous quick tunnel command.
3. Update public mobile entrypoint back to quick tunnel URL if required.

## Post-Migration Follow-ups

1. Update `.env`/runtime CORS allowlist to fixed domains.
2. Update client WS/API base URLs.
3. Keep Quick Tunnel script as emergency fallback only.

