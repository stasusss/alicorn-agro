#!/usr/bin/env bash
# Copy deploy artifacts to /opt/alicorn on the VPS.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 deploy@SERVER_IP" >&2
  exit 1
fi

HOST="$1"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.data' \
  --exclude 'backups' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.vercel' \
  --exclude 'coverage' \
  --exclude '3dmodel.glb' \
  "$ROOT/" "${HOST}:/opt/alicorn/"

echo "Synced to ${HOST}:/opt/alicorn"
echo "Ensure /opt/alicorn/.env exists (chmod 600), then:"
echo "  ssh ${HOST} 'cd /opt/alicorn && docker compose up -d --build'"
