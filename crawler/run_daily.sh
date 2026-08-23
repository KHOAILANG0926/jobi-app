#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[$(date -Is)] Daily crawler started"

if [[ ! -f ".env" ]]; then
  echo "[$(date -Is)] ERROR: crawler/.env is missing"
  exit 1
fi

STATUS=0

run_crawler() {
  local name="$1"
  local timeout_value="$2"
  shift 2

  echo "[$(date -Is)] Running ${name} crawler (timeout ${timeout_value})"
  if timeout "$timeout_value" "$@"; then
    echo "[$(date -Is)] ${name} crawler finished"
  else
    local code=$?
    echo "[$(date -Is)] ERROR: ${name} crawler failed or timed out (exit ${code})"
    STATUS=1
  fi
}

if grep -q '^FB_C_USER=.' .env && grep -q '^FB_XS=.' .env; then
  run_crawler "Facebook" "${FACEBOOK_CRAWLER_TIMEOUT:-45m}" python3 -u crawl_facebook.py
else
  echo "[$(date -Is)] Skipping Facebook crawler: FB_C_USER/FB_XS not configured"
fi

run_crawler "Vieclam24h" "${TOPCV_CRAWLER_TIMEOUT:-60m}" python3 -u crawl_topcv.py

echo "[$(date -Is)] Daily crawler finished"
exit "$STATUS"
