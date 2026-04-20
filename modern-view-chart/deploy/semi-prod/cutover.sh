#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-D:/viewx/ViewX/modern-view-chart}"
log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

cd "$APP_DIR"

log "Stopping docker frontend/backend (mongo kept running)"
docker stop viewx-frontend-staging viewx-backend-staging

log "Stopping docker cloudflared (switch to host PM2)"
docker update --restart=no viewx-cloudflared >/dev/null 2>&1 || true
docker stop viewx-cloudflared || true

log "Deleting canary PM2 apps"
pm2 delete viewx-frontend-semi viewx-backend-semi || true

log "Starting PM2 apps on production ports"
pm2 start "$APP_DIR/deploy/semi-prod/start-backend-prod.mjs" --name viewx-backend-prod
pm2 start "$APP_DIR/deploy/semi-prod/start-frontend-prod.mjs" --name viewx-frontend-prod
pm2 start "$APP_DIR/deploy/semi-prod/start-cloudflared-host.mjs" --name viewx-cloudflared-host

pm2 save

log "Cutover completed"
