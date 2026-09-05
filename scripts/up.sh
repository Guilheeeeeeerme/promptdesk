#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Starting Docker Compose (api/web/support/chat-worker hot-reload dev servers)"
cd "$ROOT"
exec docker compose up "$@"
