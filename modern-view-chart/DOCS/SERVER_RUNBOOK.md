# Modern View Chart Server Runbook

## Scope
- Host app from this laptop.
- Use Cloudflare Quick Tunnel (`trycloudflare.com`) for public access.
- Keep backend pinned to port `8091`.

## File Locations
- Repo root: `d:\viewx\ViewX\modern-view-chart`
- Bootstrap script: `scripts/server/bootstrap.ps1`
- Start script: `scripts/server/run-all.ps1`
- Stop script: `scripts/server/stop-all.ps1`
- Logs: `logs\frontend.log`, `logs\backend.log`, `logs\tunnel.log`
- Bridge logs: `logs\bridge.log`, `logs\bridge.err.log`
- Tunnel link outputs: `mobile_link.txt`, `public/mobile-access.json`

## First-Time Setup
1. Open PowerShell in repo root.
2. Run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\server\bootstrap.ps1
   ```
3. Configure auto-start:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\server\setup-autostart.ps1
   ```

## Start Services
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\run-all.ps1
```

## Stop Services
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\stop-all.ps1
```

## Restart Services
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\stop-all.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\server\run-all.ps1
```

## How to Read Current Tunnel Links
- Quick read:
  ```powershell
  Get-Content .\mobile_link.txt
  ```
- JSON detail:
  ```powershell
  Get-Content .\public\mobile-access.json
  ```

## Recovery When Tunnel URL Changes
1. Run `stop-all.ps1`.
2. Run `run-all.ps1`.
3. Wait 10-30 seconds.
4. Read new link from `mobile_link.txt`.
5. Share the new URL (Quick Tunnel changes after restart/reconnect).

## Scheduled Tasks
- Preferred:
  - `ModernViewChartServer`: starts services at boot (30s delay, SYSTEM).
  - `ModernViewChartBootstrap`: manual bootstrap task.
- Fallback when task registration is blocked by policy:
  - Startup file: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ModernViewChartServer.cmd`

## Troubleshooting
- If frontend fails, inspect `logs\frontend.log` for `next start` errors.
- If backend fails, inspect `logs\backend.log` and confirm `.env` has `PORT=8091`.
- If tunnel fails, inspect `logs\tunnel.log` and verify network access to Cloudflare.
- If bridge fails, inspect `logs\bridge.err.log` (common causes: MetaTrader5 package/runtime or terminal not connected).
- If production build fails, `run-all.ps1` automatically falls back to `next dev` so service stays reachable.
