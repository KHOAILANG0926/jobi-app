#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[$(date -Is)] Daily crawler started"

if [[ ! -f ".env" ]]; then
  echo "[$(date -Is)] ERROR: crawler/.env is missing"
  exit 1
fi

echo "[$(date -Is)] Running Vieclam24h crawler"
python3 crawl_topcv.py

if grep -q '^FB_C_USER=.' .env && grep -q '^FB_XS=.' .env; then
  echo "[$(date -Is)] Running Facebook crawler"
  python3 crawl_facebook.py
else
  echo "[$(date -Is)] Skipping Facebook crawler: FB_C_USER/FB_XS not configured"
fi

echo "[$(date -Is)] Daily crawler finished"
