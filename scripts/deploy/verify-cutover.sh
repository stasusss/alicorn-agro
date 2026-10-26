#!/usr/bin/env bash
# Smoke checks against the production origin.
set -euo pipefail

BASE_URL="${1:-https://alicorn-agro.com.ua}"
BASE_URL="${BASE_URL%/}"

fail=0

check() {
  local name="$1"
  local url="$2"
  local expect="$3"
  local code
  code="$(curl -sS -o /tmp/alicorn-verify.body -w '%{http_code}' --max-time 20 "$url" || true)"
  if [[ "$code" == "$expect" ]]; then
    echo "OK  $name ($code)"
  else
    echo "FAIL $name (got $code, want $expect) — $url" >&2
    fail=1
  fi
}

check "home" "$BASE_URL/" "200"
check "health" "$BASE_URL/api/health" "200"
check "login" "$BASE_URL/login" "200"
check "glb" "$BASE_URL/3dmodel.glb" "200"

if command -v jq >/dev/null 2>&1; then
  ok="$(jq -r '.ok // empty' /tmp/alicorn-verify.body 2>/dev/null || true)"
  # Re-fetch health body specifically
  body="$(curl -sS --max-time 20 "$BASE_URL/api/health" || true)"
  ok="$(printf '%s' "$body" | jq -r '.ok // empty' 2>/dev/null || true)"
  if [[ "$ok" == "true" ]]; then
    echo "OK  health body ok=true"
  else
    echo "FAIL health JSON: $body" >&2
    fail=1
  fi
fi

www_host="${BASE_URL#https://}"
www_host="${www_host#http://}"
www_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -I "https://www.${www_host}/" || true)"
if [[ "$www_code" == "301" || "$www_code" == "308" || "$www_code" == "200" ]]; then
  echo "OK  www responds ($www_code)"
else
  echo "WARN www check got $www_code (DNS may not be ready yet)" >&2
fi

echo
echo "Manual next steps:"
echo "  1. Log in at $BASE_URL/cabinet"
echo "  2. BASE_URL=$BASE_URL GATEWAY_ID=… GATEWAY_API_KEY=… npm run test:ingest"
echo "  3. Trigger a test alert (Telegram + email)"
echo "  4. Point gateways at $BASE_URL/api/ingest"

exit "$fail"
