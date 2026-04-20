#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

log "Stopping PM2 production apps"
pm2 delete viewx-frontend-prod viewx-backend-prod viewx-cloudflared-host || true

log "Starting Docker production apps"
docker start viewx-backend-staging viewx-frontend-staging
docker update --restart=unless-stopped viewx-cloudflared >/dev/null 2>&1 || true
docker start viewx-cloudflared || true

log "Rollback completed"
