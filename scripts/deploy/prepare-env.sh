#!/usr/bin/env bash
# Build a production .env template from Vercel pull or existing local files.
# Does not print secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/.env.production.hetzner}"
SRC=""

if [[ -f "$ROOT/.env.production.local" ]]; then
  SRC="$ROOT/.env.production.local"
elif [[ -f "$ROOT/.env.local" ]]; then
  SRC="$ROOT/.env.local"
fi

REQUIRED=(DATABASE_URL AUTH_SECRET AUTH_URL)
OPTIONAL=(TELEGRAM_BOT_TOKEN RESEND_API_KEY ALERT_EMAIL_FROM NEXT_PUBLIC_APP_URL)

unquote() {
  local v="$1"
  local len=$((${#v} - 2))
  if [[ ${#v} -ge 2 && "$v" == \"*\" ]]; then
    v="${v:1:$len}"
  elif [[ ${#v} -ge 2 && "$v" == \'*\' ]]; then
    v="${v:1:$len}"
  fi
  printf '%s' "$v"
}

is_placeholder() {
  local v
  v="$(unquote "$1")"
  [[ -z "$v" || "$v" == "[SENSITIVE]" ]]
}

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if [[ -n "$SRC" ]]; then
  # Keep only known keys from the source file. Skip Vercel CLI placeholders.
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    key="${line%%=*}"
    raw="${line#*=}"
    val="$(unquote "$raw")"
    if is_placeholder "$val"; then
      continue
    fi
    for want in "${REQUIRED[@]}" "${OPTIONAL[@]}"; do
      if [[ "$key" == "$want" ]]; then
        printf '%s=%s\n' "$key" "$val" >>"$tmp"
        break
      fi
    done
  done <"$SRC"
fi

set_or_default() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$tmp" 2>/dev/null; then
    grep -v "^${key}=" "$tmp" >"${tmp}.new" || true
    mv "${tmp}.new" "$tmp"
  fi
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
}

set_or_default AUTH_URL "https://alicorn-agro.com"
if ! grep -q '^ALERT_EMAIL_FROM=' "$tmp" 2>/dev/null; then
  printf 'ALERT_EMAIL_FROM=alerts@alicorn-agro.com\n' >>"$tmp"
fi

missing=0
for key in "${REQUIRED[@]}"; do
  if ! grep -q "^${key}=" "$tmp"; then
    echo "MISSING: $key — copy the real value from the Vercel / Neon dashboard" >&2
    missing=1
    continue
  fi
  val="$(grep "^${key}=" "$tmp" | head -1 | cut -d= -f2-)"
  if is_placeholder "$val"; then
    echo "MISSING/PLACEHOLDER: $key — copy the real value from the Vercel dashboard" >&2
    missing=1
  elif [[ "$key" == "DATABASE_URL" && "$val" == pglite:* ]]; then
    echo "ERROR: DATABASE_URL is pglite — use the Postgres URL" >&2
    missing=1
  fi
done

if ! grep -q '^RESEND_API_KEY=.\+' "$tmp" 2>/dev/null; then
  echo "WARN: RESEND_API_KEY missing — email alerts will not send" >&2
fi

install -m 600 /dev/null "$OUT"
cat "$tmp" >"$OUT"

echo "Wrote $OUT (mode 600)"
if [[ "$missing" -ne 0 ]]; then
  echo "Fill missing keys in $OUT, then:" >&2
  echo "  scp $OUT deploy@SERVER_IP:/opt/alicorn/.env" >&2
  echo "  ssh deploy@SERVER_IP 'chmod 600 /opt/alicorn/.env'" >&2
  exit 1
fi

echo "Ready to copy:"
echo "  scp $OUT deploy@SERVER_IP:/opt/alicorn/.env"
echo "  ssh deploy@SERVER_IP 'chmod 600 /opt/alicorn/.env'"
