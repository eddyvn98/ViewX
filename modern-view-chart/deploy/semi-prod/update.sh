#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-D:/viewx/ViewX/modern-view-chart}"
BRANCH="${BRANCH:-main}"
log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

if command -v nvm >/dev/null 2>&1; then
  if [[ -f "$APP_DIR/.nvmrc" ]]; then
    log "Using Node version from .nvmrc"
    nvm install >/dev/null
    nvm use >/dev/null
  fi
else
  log "nvm not found, using current Node: $(node -v)"
fi

cd "$APP_DIR"
log "Updating git branch $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "Installing dependencies (lockfile)"
npm ci

log "Building frontend"
npm run build

log "Reloading PM2 apps"
if pm2 describe viewx-backend-semi >/dev/null 2>&1; then
  pm2 restart viewx-backend-semi
else
  pm2 start "$APP_DIR/deploy/semi-prod/start-backend-semi.mjs" --name viewx-backend-semi
fi

if pm2 describe viewx-frontend-semi >/dev/null 2>&1; then
  pm2 restart viewx-frontend-semi
else
  pm2 start "$APP_DIR/deploy/semi-prod/start-frontend-semi.mjs" --name viewx-frontend-semi
fi

pm2 save

log "Done"
