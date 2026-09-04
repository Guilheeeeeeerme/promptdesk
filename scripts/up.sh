#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Installing and building API"
cd "$ROOT/apps/api"
npm install --no-audit --no-fund
rm -f tsconfig.build.tsbuildinfo
npx prisma generate
npm run build
test -f dist/main.js

echo "==> Installing and building Web"
cd "$ROOT/apps/web"
npm install --no-audit --no-fund
VITE_API_URL=/api npm run build
test -f dist/index.html

echo "==> Starting Docker Compose"
cd "$ROOT"
exec docker compose up --build "$@"
