#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:18092/api/health}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:13010}"
MONGO_CONTAINER="${MONGO_CONTAINER:-viewx-mongo-staging}"
MONGO_DB="${MONGO_DB:-viewx}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

http_ok() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  if [[ "$code" -ge 200 && "$code" -lt 400 ]]; then
    log "OK  $url ($code)"
  else
    log "FAIL $url ($code)"
    return 1
  fi
}

log "Checking frontend + backend health endpoints"
http_ok "$FRONTEND_URL"
http_ok "$BACKEND_URL"

log "Checking Mongo collections count in $MONGO_DB"
docker exec "$MONGO_CONTAINER" mongosh --quiet --eval "db.getSiblingDB('$MONGO_DB').stats().collections"

log "Verification passed"
