# Semi-Prod Deploy Workflow (No Docker)

This project now deploys app services directly on host using `PM2 + Nginx + cloudflared host tunnel`.
Database is kept in existing Mongo container for safety.

## 1) One-time setup

1. Install and pin Node with `nvm`.
2. Use `package-lock.json` and always run `npm ci` (or `npm install` when needed).
3. PM2 processes in use:
   - `viewx-frontend-semi`
   - `viewx-backend-semi`
   - `viewx-bridge-semi`
   - `viewx-cloudflared-host`
4. Keep Mongo container running (`viewx-mongo-staging`) to avoid data loss.

## 2) Daily update (semi-prod)

From repo root:

```powershell
cd D:\viewx\ViewX\modern-view-chart
git pull
npm install
npm run build
pm2 restart viewx-frontend-semi --update-env
pm2 restart viewx-backend-semi --update-env
pm2 restart viewx-bridge-semi --update-env
pm2 restart viewx-cloudflared-host --update-env
```

Quick health check:

```powershell
pm2 ls
pm2 logs viewx-backend-semi --lines 80 --nostream
pm2 logs viewx-frontend-semi --lines 80 --nostream
```

## 3) When only frontend code changed

```powershell
cd D:\viewx\ViewX\modern-view-chart
git pull
npm install
npm run build
pm2 restart viewx-frontend-semi --update-env
```

## 4) When only backend code changed

```powershell
cd D:\viewx\ViewX\modern-view-chart
git pull
npm install
pm2 restart viewx-backend-semi --update-env
```

If forecast / python logic changed:

```powershell
pm2 restart viewx-backend-semi --update-env
```

## 5) Rollback fast

```powershell
cd D:\viewx\ViewX\modern-view-chart\deploy\semi-prod
./rollback.sh
```

## 6) Notes

- Do not deploy app via Docker anymore for normal updates.
- Keep DB container untouched unless there is a planned DB migration.
- If UI change is not visible on mobile, force refresh / clear browser cache.
