#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Installing and building API"
cd "$ROOT/apps/api"
npm install --no-audit --no-fund
rm -f tsconfig.build.tsbuildinfo
npx prisma generate
npx prisma generate --schema prisma-chat/schema.prisma
npm run build
test -f dist/main.js

echo "==> Installing and building Web (SSO host)"
cd "$ROOT/apps/web"
npm install --no-audit --no-fund
VITE_API_URL=/api \
VITE_SUPPORT_ORIGIN="${VITE_SUPPORT_ORIGIN:-http://localhost:8081}" \
VITE_SSO_RETURN_ORIGINS="${SSO_RETURN_ORIGINS:-http://localhost:8081,http://127.0.0.1:8081}" \
  npm run build
test -f dist/index.html

echo "==> Installing and building Support MFE"
cd "$ROOT/apps/support"
npm install --no-audit --no-fund
VITE_API_URL=/api \
VITE_MAIN_ORIGIN="${VITE_MAIN_ORIGIN:-http://localhost:8080}" \
  npm run build
test -f dist/index.html

echo "==> Installing and building Chat Worker"
cd "$ROOT/apps/chat-worker"
npm install --no-audit --no-fund
npx prisma generate --schema ../api/prisma/schema.prisma
npx prisma generate --schema ../api/prisma-chat/schema.prisma
npm run build
test -f dist/main.js

echo "==> Starting Docker Compose"
cd "$ROOT"
exec docker compose up --build "$@"
